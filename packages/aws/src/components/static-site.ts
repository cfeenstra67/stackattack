/**
 * @packageDocumentation
 *
 * Static sites in AWS combine S3 storage with CloudFront CDN for fast global content delivery. Stackattack creates static websites with custom domains, SSL certificates, and framework-specific routing (like Astro).
 *
 * ```typescript
 * import * as saws from "@stackattack/aws";
 *
 * const ctx = saws.context();
 * const storage = saws.bucket(ctx, { paths: ["./dist"] });
 * const site = saws.staticSite(ctx, {
 *   bucket: storage,
 *   domain: "example.com"
 * });
 *
 * export const siteUrl = site.url;
 * ```
 *
 *
 * ## Usage
 *
 * After deploying a static site, you can manage it using:
 *
 * **AWS CLI:**
 * ```bash
 * # View CloudFront distribution details
 * aws cloudfront get-distribution --id E1234567890ABC
 *
 * # Invalidate CloudFront cache after updating files
 * aws cloudfront create-invalidation --distribution-id E1234567890ABC --paths "/*"
 *
 * # Check distribution status and configuration
 * aws cloudfront list-distributions --query 'DistributionList.Items[?Comment==`my-site`]'
 * ```
 *
 * **Content Updates:**
 * ```bash
 * # Sync new files to S3 bucket
 * aws s3 sync ./dist s3://your-bucket-name --delete
 *
 * # Invalidate specific files in CloudFront
 * aws cloudfront create-invalidation --distribution-id E1234567890ABC --paths "/index.html" "/css/*"
 * ```
 *
 * **Custom Error Pages:**
 * ```bash
 * # Upload custom 404 page
 * aws s3 cp ./404.html s3://your-bucket-name/404.html
 * ```
 *
 * **Framework-Specific Deployment:**
 * ```typescript
 * // For Astro sites with proper routing
 * const site = saws.staticSite(ctx, {
 *   bucket: storage,
 *   domain: "example.com",
 *   adapter: saws.astroAdapter()
 * });
 * ```
 *
 * ## Related Components
 *
 * Static sites work together with other Stackattack components:
 * - [bucket](/components/bucket/) - Stores website files in S3
 * - [certificate](/components/certificate/) - Provides SSL certificates for HTTPS domains
 *
 * ## Costs
 *
 * Static site costs are **usage-based** with significant free tiers:
 *
 * - **S3 storage** - ~$0.023/GB/month for file storage. A typical 100MB website costs ~$0.002/month.
 *
 * - **CloudFront** - First 1TB of data transfer out is free each month, then ~$0.085/GB. Includes:
 *   - Free tier: 10,000,000 HTTP requests/month
 *   - Free tier: 2,000,000 CloudFront Function invocations/month
 *   - Additional requests: ~$0.0075 per 10,000 requests
 *
 * - **SSL certificate** - Free through ACM when used with CloudFront.
 *
 * - **Route53 DNS** - ~$0.50/month per hosted zone + $0.40 per million queries.
 *
 * - **Lambda@Edge** (for advanced routing) - Only if used: ~$0.60 per million requests + compute time.
 *
 * **Typical monthly costs:**
 * - Small personal site (<1GB traffic): $0.50-2.00/month (mostly DNS)
 * - Medium business site (<10GB traffic): $2-5/month
 * - Large site (>50GB traffic): $5-15/month
 *
 * Cost optimization strategies:
 * - Use CloudFront caching effectively to reduce origin requests
 * - Optimize images and assets to reduce storage and transfer costs
 * - Set up proper Cache-Control headers for static assets
 * - Consider using `astroAdapter()` for optimized caching of framework builds
 *
 * See [CloudFront Pricing](https://aws.amazon.com/cloudfront/pricing/) for current rates.
 */

import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";
import type { Context } from "../context.js";
import { serviceAssumeRolePolicy } from "../policies.js";
import { shortId } from "../short-id.js";
import { type BucketInput, bucket, getBucketAttributes } from "./bucket.js";
import { certificate, getZoneFromDomain } from "./certificate.js";

/**
 * Configuration interface for static site framework adapters.
 */
export interface StaticSiteAdapter {
  /** The default root page of your app, for example "index.html". This will be served at the "/" path */
  index?: string;
  /** Function to transform URI paths to S3 object keys */
  getKey?: (uri: string) => string;
  /** Function to get redirect path for domain redirects */
  getRedirectPath?: (uri: string) => string;
  /** Default headers to include in every response */
  defaultHeaders?: Record<string, pulumi.Input<string>>;
  /** A list of patterns and headers to include in response for keys that match each pattern */
  headers?: {
    patterns: string[];
    headers: Record<string, pulumi.Input<string>>;
    inherit?: boolean;
  }[];
  /** Mapping of HTTP error codes to custom error page paths */
  errorPages?: { code: number; key: string }[];
}

const DefaultStaticPaths = [
  "*.jpg",
  "*.png",
  "*.apng",
  "*.avif",
  "*.gif",
  "*.webp",
  "*.js",
  "*.css",
  "*.svg",
];

/**
 * Configuration arguments for the Astro static site adapter.
 */
export interface AstroAdapterArgs
  extends Pick<StaticSiteAdapter, "defaultHeaders" | "headers"> {
  /** Custom file patterns that should receive long-term caching headers. By default, this includes "*.jpg", "*.png", "*.apng", "*.avif", "*.gif", "*.webp", "*.js", "*.css", and "*.svg" */
  staticPaths?: string[];
  /** Max age for patterns that match `staticPaths` */
  cacheControlMaxAge?: number;
  /** Default headers to include in every response from your CDN */
  defaultHeaders?: Record<string, string>;
}

/**
 * Creates a static site adapter configured for Astro framework conventions.
 * @param args - Optional configuration for the adapter
 * @returns Static site adapter with Astro-specific routing and caching rules
 */
export function astroAdapter(args?: AstroAdapterArgs): StaticSiteAdapter {
  const maxAge = args?.cacheControlMaxAge ?? 30 * 24 * 3600;
  return {
    index: "index.html",
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
    errorPages: [{ code: 404, key: "/404.html" }],
    defaultHeaders: args?.defaultHeaders,
    headers: [
      {
        patterns: args?.staticPaths ?? DefaultStaticPaths,
        headers: {
          "Cache-Control": `max-age=${maxAge}`,
        },
        ...args?.headers,
      },
    ],
  };
}

/**
 * Configuration arguments for the single page application static site adapter.
 */
export interface SPAAdapterArgs
  extends Pick<StaticSiteAdapter, "defaultHeaders" | "headers"> {
  /** The path to the HTML file for your single page application. Defaults to "index.html" */
  index?: string;
  /** Custom file patterns that should receive long-term caching headers. By default, this includes "*.jpg", "*.png", "*.apng", "*.avif", "*.gif", "*.webp", "*.js", "*.css", and "*.svg" */
  staticPaths?: string[];
  /** Max age for patterns that match `staticPaths` */
  cacheControlMaxAge?: number;
}

/** Static site adapter for a single-page application. This directs all requests to a single HTML page */
export function SPAAdapter(args?: SPAAdapterArgs): StaticSiteAdapter {
  const htmlPath = args?.index ?? "index.html";
  const maxAge = args?.cacheControlMaxAge ?? 30 * 24 * 3600;
  return {
    index: htmlPath,
    getKey: (uri) => (uri.includes(".") ? uri : `/${htmlPath}`),
    getRedirectPath: (uri) => (uri === `/${htmlPath}` ? "" : uri),
    defaultHeaders: args?.defaultHeaders,
    errorPages: [{ code: 404, key: `/${htmlPath}` }],
    headers: [
      {
        patterns: args?.staticPaths ?? DefaultStaticPaths,
        headers: {
          "Cache-Control": `max-age=${maxAge}`,
        },
        ...args?.headers,
      },
    ],
  };
}

/**
 * Configuration arguments for creating a static site with CloudFront distribution.
 */
export interface StaticSiteArgs {
  /** The S3 bucket containing the static site files */
  bucket: pulumi.Input<BucketInput>;
  /** The primary domain name for the static site */
  domain: pulumi.Input<string>;
  /** Additional domains that should redirect to the primary domain */
  redirectDomains?: pulumi.Input<string>[];
  /** Framework-specific adapter for routing and caching behavior */
  adapter?: StaticSiteAdapter;
  /** Response headers to include in every response for a file in the bucket */
  headers?: Record<string, pulumi.Input<string>>;
  /** ARN of existing SSL certificate (creates new one if not provided). Note that the certificate must be created in the us-east-1 region. */
  certificate?: pulumi.Input<string>;
  /** Route53 hosted zone ID (auto-detected from domain if not provided) */
  zoneId?: pulumi.Input<string>;
  /** S3 bucket for CloudFront access logs (creates new one if undefined, disables if null). Note that if you provide a bucket as an input, it must an `objectOwnership` value of "BucketOwnerPreferred" */
  logsBucket?: null | pulumi.Input<BucketInput>;
  /** Prefix for CloudFront access log files */
  logsPrefix?: pulumi.Input<string>;
  /** Whether to skip creating the S3 bucket policy for CloudFront access */
  noBucketPolicy?: boolean;
  /** Whether to skip adding 'static-site' prefix to resource names */
  noPrefix?: boolean;
}

/**
 * Creates a complete static site hosting solution with S3, CloudFront, and Lambda@Edge.
 * @param ctx - The context for resource naming and tagging
 * @param args - Configuration arguments for the static site
 * @returns CloudFront distribution configured for static site hosting
 */
export function staticSite(ctx: Context, args: StaticSiteArgs) {
  if (!args.noPrefix) {
    ctx = ctx.prefix("static-site");
  }

  const bucketAttrs = getBucketAttributes(args.bucket);

  const lambdaExecutionRole = new aws.iam.Role(ctx.id("lambda-exec-role"), {
    // Name prefixes can be at most 38 characters
    namePrefix: shortId(ctx, "lambda-exec-role", 38),
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

  const domain = pulumi.output(args.domain);
  const getRedirectPath = args.adapter?.getRedirectPath;
  const getKey = args.adapter?.getKey;

  const lambdaFunctionAssociations: aws.types.input.cloudfront.DistributionDefaultCacheBehaviorLambdaFunctionAssociation[] =
    [];
  if (args.redirectDomains?.length || getRedirectPath || getKey) {
    const eastProvider = new aws.Provider(ctx.id("provider"), {
      region: "us-east-1",
    });

    const redirectDomains = pulumi.all(args.redirectDomains ?? []);

    const edgeFunction = new aws.lambda.CallbackFunction(
      // Max length is 64 chars, pulumi adds 7
      shortId(ctx, "lambda-function", 64 - 7),
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
                  {
                    key: "Location",
                    value: `https://${resolvedDomain}${path}`,
                  },
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
        tags: ctx.tags(),
      },
      // retainOnDelete is here is because edge lambda function cannot
      // be deleted normally, and attempting to do so will simply hang for
      // a long time. The docs indicate these functions can be deleted
      // "a few hours later" after any associations with cloudfront distributions
      // have been removed.
      // https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/lambda-edge-delete-replicas.html
      { provider: eastProvider, retainOnDelete: true },
    );

    lambdaFunctionAssociations.push({
      eventType: "origin-request",
      lambdaArn: edgeFunction.qualifiedArn,
      includeBody: false,
    });
  }

  const cachePolicy = new aws.cloudfront.CachePolicy(ctx.id("cache-policy"), {
    defaultTtl: 600,
    maxTtl: 600,
    minTtl: 0,
    parametersInCacheKeyAndForwardedToOrigin: {
      cookiesConfig: {
        cookieBehavior: "none",
      },
      headersConfig:
        lambdaFunctionAssociations.length === 0
          ? {
              headerBehavior: "none",
            }
          : {
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

  const defaultHeaders: {
    header: string;
    override: boolean;
    value: pulumi.Input<string>;
  }[] = [];
  if (args.adapter?.defaultHeaders) {
    for (const [name, value] of Object.entries(args.adapter.defaultHeaders)) {
      defaultHeaders.push({
        header: name,
        override: true,
        value,
      });
    }
  }

  let defaultHeadersPolicyId: pulumi.Input<string> | undefined;
  if (defaultHeaders.length > 0) {
    const defaultHeadersPolicy = new aws.cloudfront.ResponseHeadersPolicy(
      ctx.id("response-headers"),
      {
        customHeadersConfig: {
          items: defaultHeaders,
        },
      },
    );
    defaultHeadersPolicyId = defaultHeadersPolicy.id;
  }

  const accessControl = new aws.cloudfront.OriginAccessControl(
    // Max name length is 64, pulumi adds 7 characters
    shortId(ctx, "access-control", 64 - 7),
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

  let certificateArn = args.certificate;
  if (args.certificate === undefined) {
    const provider = new aws.Provider(ctx.id("certificate-provider"), {
      region: "us-east-1",
    });

    certificateArn = certificate(ctx, {
      domain: args.domain,
      additionalDomains: args.redirectDomains,
      provider,
    });
  }

  let logsBucketDomain: pulumi.Input<string> | undefined;
  if (args.logsBucket === undefined) {
    logsBucketDomain = bucket(ctx.prefix("logs"), {
      objectOwnership: "BucketOwnerPreferred",
    }).bucketDomainName;
  } else if (args.logsBucket !== null) {
    const logsBucketAttrs = getBucketAttributes(args.logsBucket);
    logsBucketDomain = logsBucketAttrs.bucketDomainName;
  }

  const orderedCacheBehaviors: aws.types.input.cloudfront.DistributionOrderedCacheBehavior[] =
    [];
  if (args.adapter?.headers) {
    for (const [
      idx,
      { patterns, headers, inherit },
    ] of args.adapter.headers.entries()) {
      const keys = new Set(Object.keys(headers));
      const defaultSubset =
        inherit === false
          ? []
          : defaultHeaders.filter((header) => !keys.has(header.header));

      const headersPolicy = new aws.cloudfront.ResponseHeadersPolicy(
        ctx.id(`response-headers-${idx}`),
        {
          customHeadersConfig: {
            items: [
              ...defaultSubset,
              ...Object.entries(headers).map(([header, value]) => ({
                header,
                override: false,
                value,
              })),
            ],
          },
        },
      );
      for (const pattern of patterns) {
        orderedCacheBehaviors.push({
          pathPattern: pattern,
          targetOriginId: bucketAttrs.arn,
          viewerProtocolPolicy: "redirect-to-https",
          allowedMethods: ["GET", "HEAD", "OPTIONS"],
          cachedMethods: ["GET", "HEAD", "OPTIONS"],
          compress: true,
          cachePolicyId: cachePolicy.id,
          lambdaFunctionAssociations,
          responseHeadersPolicyId: headersPolicy.id,
        });
      }
    }
  }

  const distribution = new aws.cloudfront.Distribution(
    ctx.id(),
    {
      enabled: true,
      isIpv6Enabled: false,
      aliases: pulumi
        .all([domain, args.redirectDomains ?? []])
        .apply(([domain, redirectDomains]) => [domain, ...redirectDomains]),
      origins: [
        {
          originId: bucketAttrs.arn,
          domainName: bucketAttrs.bucketRegionalDomainName,
          originAccessControlId: accessControl.id,
        },
      ],
      comment: "",
      defaultRootObject: args.adapter?.index,
      defaultCacheBehavior: {
        targetOriginId: bucketAttrs.arn,
        viewerProtocolPolicy: "redirect-to-https",
        allowedMethods: ["GET", "HEAD", "OPTIONS"],
        cachedMethods: ["GET", "HEAD", "OPTIONS"],
        lambdaFunctionAssociations,
        compress: true,
        cachePolicyId: cachePolicy.id,
        responseHeadersPolicyId: defaultHeadersPolicyId,
      },
      orderedCacheBehaviors,
      priceClass: "PriceClass_100",
      customErrorResponses: (args.adapter?.errorPages ?? []).map(
        ({ code, key }) => ({
          errorCode: code,
          responseCode: code,
          responsePagePath: key,
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
      tags: ctx.tags(),
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
          name: distribution.domainName,
          zoneId: distribution.hostedZoneId,
          evaluateTargetHealth: true,
        },
      ],
    });
  }

  const url = pulumi.interpolate`https://${args.domain}`;

  return { distribution, url };
}
