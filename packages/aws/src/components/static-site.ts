import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";
import { Context } from "../context.js";
import { serviceAssumeRolePolicy } from "../policies.js";
import { BucketInput, bucket, getBucketAttributes } from "./bucket.js";
import { certificate, getZoneFromDomain } from "./certificate.js";

export interface StaticSiteAdapter {
  getKey?: (uri: string) => string;
  getRedirectPath?: (uri: string) => string;
  staticPaths?: string[];
  errorPages?: Record<number, string>;
}

export function astroAdapter(): StaticSiteAdapter {
  return {
    getKey: (uri) => {
      // Check whether the URI is missing a file name.
      if (uri.endsWith("/")) {
        uri += "index.html";
      }
      // Check whether the URI is missing a file extension.
      else if (!uri.includes(".")) {
        uri += "/index.html";
      }
      return uri;
    },
    getRedirectPath: (uri) => {
      return uri === "/index.html" ? "" : uri;
    },
    errorPages: {
      404: "/404.html",
    },
    staticPaths: ["*.jpg", "*.png", "*.js", "*.css", "*.svg"],
  };
}

export interface StaticSiteArgs {
  bucket: BucketInput;
  domain: pulumi.Input<string>;
  redirectDomains?: pulumi.Input<string>[];
  adapter?: StaticSiteAdapter;
  certificate?: pulumi.Input<string>;
  zoneId?: pulumi.Input<string>;
  logsBucket?: null | pulumi.Input<BucketInput>;
  logsPrefix?: pulumi.Input<string>;
  noBucketPolicy?: boolean;
  noPrefix?: boolean;
}

export function staticSite(ctx: Context, args: StaticSiteArgs) {
  if (!args.noPrefix) {
    ctx = ctx.prefix("static-site");
  }

  const bucketAttrs = getBucketAttributes(args.bucket);

  const lambdaExecutionRole = new aws.iam.Role(ctx.id("lambda-exec-role"), {
    assumeRolePolicy: serviceAssumeRolePolicy("lambda", "edgelambda").json,
    inlinePolicies: [
      {
        policy: aws.iam.getPolicyDocumentOutput({
          statements: [
            {
              resources: ["*"],
              actions: [
                "logs:CreateLogStream",
                "logs:PutLogEvents",
                "logs:CreateLogGroup",
              ],
            },
          ],
        }).json,
      },
    ],
  });

  const eastProvider = new aws.Provider(ctx.id("provider"), {
    region: "us-east-1",
  });

  const domain = pulumi.output(args.domain);
  const redirectDomains = pulumi.all(args.redirectDomains ?? []);
  const getRedirectPath = args.adapter?.getRedirectPath;
  const getKey = args.adapter?.getKey;

  const edgeFunction = new aws.lambda.CallbackFunction(
    ctx.id("lambda-function"),
    {
      role: lambdaExecutionRole,
      // The `async` is important here, it significantly changes the generated
      // code and this doesn't work without it.
      // biome-ignore lint/suspicious/noExplicitAny: don't know how to type this
      callback: async (event: any) => {
        const resolvedDomain = domain.get();
        const resolvedRedirectDomains = redirectDomains.get();

        const request = event.Records[0].cf.request;

        const host = request.headers.host[0].value;
        if (resolvedRedirectDomains.includes(host)) {
          const path = getRedirectPath?.(request.uri) ?? request.uri;
          return {
            status: 302,
            statusDescription: "Found",
            headers: {
              location: [
                { key: "Location", value: `https://${resolvedDomain}${path}` },
              ],
            },
          };
        }
        request.headers.host = [
          { key: "Host", value: request.origin.s3.domainName },
        ];

        const uri = request.uri;
        request.uri = getKey?.(uri) ?? uri;

        return request;
      },
      runtime: "nodejs20.x",
      publish: true,
      timeout: 10,
    },
    { provider: eastProvider },
  );

  const cachePolicy = new aws.cloudfront.CachePolicy(ctx.id("cache-policy"), {
    defaultTtl: 600,
    maxTtl: 600,
    minTtl: 0,
    parametersInCacheKeyAndForwardedToOrigin: {
      cookiesConfig: {
        cookieBehavior: "none",
      },
      headersConfig: {
        headerBehavior: "whitelist",
        headers: { items: ["Host"] },
      },
      queryStringsConfig: {
        queryStringBehavior: "none",
      },
      enableAcceptEncodingGzip: true,
      enableAcceptEncodingBrotli: true,
    },
  });

  const cacheStaticResourcesPolicy = new aws.cloudfront.ResponseHeadersPolicy(
    ctx.id("static-response-headers"),
    {
      customHeadersConfig: {
        items: [
          {
            header: "Cache-Control",
            override: false,
            value: `max-age=${30 * 24 * 3600}`,
          },
        ],
      },
    },
  );

  const accessControl = new aws.cloudfront.OriginAccessControl(
    ctx.id("access-control"),
    {
      description: pulumi.interpolate`${domain} access control`,
      originAccessControlOriginType: "s3",
      signingBehavior: "always",
      signingProtocol: "sigv4",
    },
  );

  if (!args.noBucketPolicy) {
    new aws.s3.BucketPolicy(ctx.id("bucket-policy"), {
      bucket: bucketAttrs.bucket,
      policy: aws.iam.getPolicyDocumentOutput({
        statements: [
          {
            principals: [
              { type: "Service", identifiers: ["cloudfront.amazonaws.com"] },
            ],
            actions: ["s3:GetObject", "s3:ListBucket"],
            resources: [
              bucketAttrs.arn,
              pulumi.interpolate`${bucketAttrs.arn}/*`,
            ],
          },
        ],
      }).json,
    });
  }

  function staticCacheBehaviorForPattern(pattern: string) {
    return {
      pathPattern: pattern,
      targetOriginId: bucketAttrs.arn,
      viewerProtocolPolicy: "redirect-to-https",
      allowedMethods: ["GET", "HEAD", "OPTIONS"],
      cachedMethods: ["GET", "HEAD", "OPTIONS"],
      compress: true,
      cachePolicyId: cachePolicy.id,
      lambdaFunctionAssociations: [
        {
          eventType: "origin-request",
          lambdaArn: edgeFunction.qualifiedArn,
          includeBody: false,
        },
      ],
      responseHeadersPolicyId: cacheStaticResourcesPolicy.id,
    };
  }

  let certificateArn = args.certificate;
  if (args.certificate === undefined) {
    certificateArn = certificate(ctx, {
      domain: args.domain,
      additionalDomains: args.redirectDomains,
    });
  }

  let logsBucketDomain: pulumi.Input<string> | undefined = undefined;
  if (args.logsBucket === undefined) {
    logsBucketDomain = bucket(ctx.prefix("logs")).bucket.bucketDomainName;
  } else if (args.logsBucket !== null) {
    const logsBucketAttrs = getBucketAttributes(args.logsBucket);
    logsBucketDomain = logsBucketAttrs.bucketDomainName;
  }

  const cloudfrontDistribution = new aws.cloudfront.Distribution(
    "distribution",
    {
      enabled: true,
      isIpv6Enabled: false,
      aliases: pulumi
        .all([domain, redirectDomains])
        .apply(([domain, redirectDomains]) => [domain, ...redirectDomains]),
      origins: [
        {
          originId: bucketAttrs.arn,
          domainName: bucketAttrs.bucketRegionalDomainName,
          originAccessControlId: accessControl.id,
        },
      ],
      comment: "",
      defaultRootObject: "index.html",
      defaultCacheBehavior: {
        targetOriginId: bucketAttrs.arn,
        viewerProtocolPolicy: "redirect-to-https",
        allowedMethods: ["GET", "HEAD", "OPTIONS"],
        cachedMethods: ["GET", "HEAD", "OPTIONS"],
        lambdaFunctionAssociations: [
          {
            eventType: "origin-request",
            lambdaArn: edgeFunction.qualifiedArn,
            includeBody: false,
          },
        ],
        compress: true,
        cachePolicyId: cachePolicy.id,
      },
      orderedCacheBehaviors: args.adapter?.staticPaths?.map(
        staticCacheBehaviorForPattern,
      ),
      priceClass: "PriceClass_100",
      customErrorResponses: Object.entries(args.adapter?.errorPages ?? {}).map(
        ([code, page]) => ({
          errorCode: Number(code),
          responseCode: Number(code),
          responsePagePath: page,
        }),
      ),
      restrictions: { geoRestriction: { restrictionType: "none" } },
      viewerCertificate: {
        acmCertificateArn: certificateArn,
        sslSupportMethod: "sni-only",
      },
      loggingConfig: logsBucketDomain
        ? {
            bucket: logsBucketDomain,
            includeCookies: false,
            prefix: args.logsPrefix ?? pulumi.interpolate`${domain}/`,
          }
        : undefined,
    },
    { deleteBeforeReplace: true },
  );

  for (const [idx, domain] of [
    args.domain,
    ...(args.redirectDomains ?? []),
  ].entries()) {
    new aws.route53.Record(ctx.id(`dns-record-${idx}`), {
      name: domain,
      zoneId: args.zoneId ?? getZoneFromDomain(domain),
      type: "A",
      aliases: [
        {
          name: cloudfrontDistribution.domainName,
          zoneId: cloudfrontDistribution.hostedZoneId,
          evaluateTargetHealth: true,
        },
      ],
    });
  }

  return cloudfrontDistribution;
}
