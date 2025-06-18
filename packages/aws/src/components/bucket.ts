import aws from "@pulumi/aws";
import pulumi from "@pulumi/pulumi";
import { s3BucketArn } from "../arns.js";
import { Context } from "../context.js";

export type BucketInput =
  | pulumi.Input<string>
  | aws.s3.BucketV2
  | aws.s3.Bucket
  | aws.s3.GetBucketResult;

export function getBucketId(
  input: pulumi.Input<BucketInput>,
): pulumi.Output<string> {
  return pulumi.output(input).apply((value) => {
    if (typeof value === "string") {
      return pulumi.output(value);
    }
    return pulumi.output(value.bucket);
  });
}

export interface BucketVersioningArgs {
  bucket: BucketInput;
  noPrefix?: boolean;
}

export function bucketVersioning(ctx: Context, args: BucketVersioningArgs) {
  if (!args?.noPrefix) {
    ctx = ctx.prefix("versioning");
  }
  return new aws.s3.BucketVersioningV2(ctx.id(), {
    bucket: getBucketId(args.bucket),
    versioningConfiguration: {
      status: "Enabled",
    },
  });
}

export function bucketEncryption(ctx: Context, args: BucketVersioningArgs) {
  if (!args?.noPrefix) {
    ctx = ctx.prefix("encryption");
  }
  return new aws.s3.BucketServerSideEncryptionConfigurationV2(ctx.id(), {
    bucket: getBucketId(args.bucket),
    rules: [
      {
        applyServerSideEncryptionByDefault: {
          sseAlgorithm: "AES256",
        },
      },
    ],
  });
}

export interface BucketCorsArgs {
  bucket: BucketInput;
  corsRules?: aws.s3.BucketCorsConfigurationV2Args["corsRules"];
  noPrefix?: boolean;
}

export function bucketCors(ctx: Context, args: BucketCorsArgs) {
  if (!args.noPrefix) {
    ctx = ctx.prefix("cors");
  }
  return new aws.s3.BucketCorsConfigurationV2(ctx.id(), {
    bucket: getBucketId(args.bucket),
    corsRules: args.corsRules ?? [
      {
        allowedHeaders: ["*"],
        allowedMethods: ["GET", "PUT", "HEAD", "POST", "DELETE"],
        allowedOrigins: ["*"],
      },
    ],
  });
}

export interface BucketLifecycleRule {
  id?: string;
  days: number;
  prefix?: boolean;
}

export interface BucketLifecycleRulesArgs {
  bucket: BucketInput;
  rules: BucketLifecycleRule[];
  noPrefix?: boolean;
}

export function bucketLifecycleRules(
  ctx: Context,
  args: BucketLifecycleRulesArgs,
) {
  if (!args.noPrefix) {
    ctx = ctx.prefix("lifecycle");
  }
  const finalRules: aws.types.input.s3.BucketLifecycleConfigurationV2Rule[] =
    [];
  let idx = -1;
  for (const rule of args.rules) {
    idx++;
    finalRules.push({
      id: [idx, rule.prefix, rule.days, "days"].filter(Boolean).join("-"),
      expiration: { days: rule.days },
      abortIncompleteMultipartUpload: { daysAfterInitiation: rule.days },
      noncurrentVersionExpiration: { noncurrentDays: rule.days },
      status: "Enabled",
    });
  }

  return new aws.s3.BucketLifecycleConfigurationV2(ctx.id(), {
    bucket: getBucketId(args.bucket),
    rules: finalRules,
  });
}

export function bucketPublicAccessBlock(
  ctx: Context,
  args: BucketVersioningArgs,
) {
  if (!args.noPrefix) {
    ctx = ctx.prefix("access-block");
  }
  return new aws.s3.BucketPublicAccessBlock(ctx.id(), {
    bucket: getBucketId(args.bucket),
    blockPublicAcls: true,
    blockPublicPolicy: true,
    ignorePublicAcls: true,
    restrictPublicBuckets: true,
  });
}

export function bucketServiceAccessPolicy(
  bucket: BucketInput,
  services: pulumi.Input<string>[],
) {
  const bucketObj = aws.s3.getBucketOutput({ bucket: getBucketId(bucket) });
  return aws.iam.getPolicyDocumentOutput({
    statements: [
      {
        principals: [
          {
            type: "Service",
            identifiers: services,
          },
        ],
        actions: ["s3:GetObject", "s3:ListBucket", "s3:PutObject"],
        resources: [bucketObj.arn, pulumi.interpolate`${bucketObj.arn}/*`],
      },
    ],
  });
}

export interface BucketPolicyArgs {
  bucket: BucketInput;
  services?: pulumi.Input<string>[];
  accounts?: pulumi.Input<string>[];
  noPrefix?: boolean;
}

export function bucketPolicy(ctx: Context, args: BucketPolicyArgs) {
  if (!args?.noPrefix) {
    ctx = ctx.prefix("service-access");
  }
  const bucket = getBucketId(args.bucket);
  const bucketArn = s3BucketArn({ bucket });

  const principals: aws.types.input.iam.GetPolicyDocumentStatementPrincipalArgs[] =
    [];
  if (args.services) {
    principals.push({
      type: "Service",
      identifiers: args.services,
    });
  }
  if (args.accounts) {
    principals.push({
      type: "AWS",
      identifiers: args.accounts.map(
        (accountId) => pulumi.interpolate`arn:aws:iam::${accountId}:root`,
      ),
    });
  }

  return new aws.s3.BucketPolicy(ctx.id(), {
    bucket: getBucketId(args.bucket),
    policy: aws.iam.getPolicyDocumentOutput({
      statements: [
        {
          principals,
          actions: ["s3:GetObject", "s3:ListBucket", "s3:PutObject"],
          resources: [bucketArn, pulumi.interpolate`${bucketArn}/*`],
        },
      ],
    }).json,
  });
}

export type BucketArgs = Pick<
  aws.s3.BucketV2Args,
  "bucket" | "bucketPrefix"
> & {
  versioned?: boolean;
  encrypted?: boolean;
  allowCors?: boolean;
  public?: boolean;
  noProtect?: boolean;
  lifecycleRules?: BucketLifecycleRule[];
  policy?: Omit<BucketPolicyArgs, "bucket" | "noPrefix">;
  noPrefix?: boolean;
};

export function bucket(ctx: Context, args?: BucketArgs) {
  if (!args?.noPrefix) {
    ctx = ctx.prefix("bucket");
  }
  const bucket = new aws.s3.BucketV2(
    ctx.id(),
    {
      bucket: args?.bucket,
      bucketPrefix: args?.bucketPrefix,
      tags: ctx.tags(),
    },
    {
      protect: !args?.noProtect,
    },
  );

  if (args?.versioned) {
    bucketVersioning(ctx, { bucket });
  }

  const encrypted = args?.encrypted ?? true;
  if (encrypted) {
    bucketEncryption(ctx, { bucket });
  }

  if (args?.allowCors) {
    bucketCors(ctx, { bucket });
  }

  if (args?.lifecycleRules) {
    bucketLifecycleRules(ctx, { bucket, rules: args.lifecycleRules });
  }

  if (!args?.public) {
    bucketPublicAccessBlock(ctx, { bucket });
  }

  if (args?.policy) {
    bucketPolicy(ctx, { bucket, ...args?.policy });
  }

  const url = pulumi.interpolate`s3://${bucket.bucket}`;

  return { bucket, url };
}
