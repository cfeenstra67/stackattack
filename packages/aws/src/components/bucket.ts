/**
 * @packageDocumentation
 *
 * S3 bucket components for creating and configuring AWS S3 buckets with secure defaults.
 *
 * Includes functions for bucket creation, encryption, versioning, CORS configuration, lifecycle rules,
 * and access policies. All security features are enabled by default (encryption, public access blocking).
 */

import aws from "@pulumi/aws";
import pulumi from "@pulumi/pulumi";
import { s3BucketArn } from "../arns.js";
import { Context } from "../context.js";

/**
 * Union type representing different ways to reference an S3 bucket.
 */
export type BucketInput =
  | string
  | aws.s3.BucketV2
  | aws.s3.Bucket
  | aws.s3.GetBucketResult
  | BucketOutput;

/**
 * Extracts the bucket ID from various bucket input types.
 * @param input - The bucket input (string, bucket resource, or bucket result)
 * @returns The bucket ID as a Pulumi output
 */
export function getBucketId(
  input: pulumi.Input<BucketInput>,
): pulumi.Output<string> {
  return pulumi.output(input).apply((value) => {
    if (typeof value === "string") {
      return pulumi.output(value);
    }
    if ("url" in value) {
      return value.bucket.bucket;
    }
    return pulumi.output(value.bucket);
  });
}

export function getBucketAttributes(
  input: pulumi.Input<BucketInput>,
): pulumi.Output<aws.s3.Bucket | aws.s3.BucketV2 | aws.s3.GetBucketResult> {
  return pulumi.output(input).apply((value) => {
    if (typeof value === "string") {
      return aws.s3.getBucketOutput({
        bucket: value,
      });
    }
    if ("url" in value) {
      return pulumi.output(value.bucket);
    }
    return pulumi.output(value);
  });
}

/**
 * Arguments for configuring S3 bucket versioning.
 */
export interface BucketVersioningArgs {
  /** The S3 bucket to configure versioning for */
  bucket: BucketInput;
  /** Whether to skip adding a prefix to the resource name */
  noPrefix?: boolean;
}

/**
 * Enables versioning on an S3 bucket.
 * @param ctx - The context for resource naming and tagging
 * @param args - Configuration arguments for bucket versioning
 * @returns The bucket versioning configuration resource
 */
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

/**
 * Configures server-side encryption for an S3 bucket using AES256.
 * @param ctx - The context for resource naming and tagging
 * @param args - Configuration arguments for bucket encryption
 * @returns The bucket encryption configuration resource
 */
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

/**
 * Arguments for configuring CORS on an S3 bucket.
 */
export interface BucketCorsArgs {
  /** The S3 bucket to configure CORS for */
  bucket: BucketInput;
  /** Custom CORS rules (defaults to permissive rules if not specified) */
  corsRules?: aws.s3.BucketCorsConfigurationV2Args["corsRules"];
  /** Whether to skip adding a prefix to the resource name */
  noPrefix?: boolean;
}

/**
 * Configures CORS settings for an S3 bucket.
 * @param ctx - The context for resource naming and tagging
 * @param args - Configuration arguments for bucket CORS
 * @returns The bucket CORS configuration resource
 */
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

/**
 * Configuration for a single S3 bucket lifecycle rule.
 */
export interface BucketLifecycleRule {
  /** Optional identifier for the lifecycle rule */
  id?: string;
  /** Number of days after which objects expire */
  days: number;
  /** Whether to include prefix in the rule ID */
  prefix?: boolean;
}

/**
 * Arguments for configuring lifecycle rules on an S3 bucket.
 */
export interface BucketLifecycleRulesArgs {
  /** The S3 bucket to configure lifecycle rules for */
  bucket: BucketInput;
  /** Array of lifecycle rules to apply */
  rules: BucketLifecycleRule[];
  /** Whether to skip adding a prefix to the resource name */
  noPrefix?: boolean;
}

/**
 * Configures lifecycle rules for an S3 bucket to automatically transition or expire objects.
 * @param ctx - The context for resource naming and tagging
 * @param args - Configuration arguments for bucket lifecycle rules
 * @returns The bucket lifecycle configuration resource
 */
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

/**
 * Blocks all public access to an S3 bucket for security.
 * @param ctx - The context for resource naming and tagging
 * @param args - Configuration arguments for the bucket
 * @returns The bucket public access block resource
 */
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

/**
 * Creates an IAM policy that grants specified AWS services access to an S3 bucket.
 * @param bucket - The S3 bucket to grant access to
 * @param services - AWS services that should be granted access
 * @returns An IAM policy document granting the services bucket access
 */
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

/**
 * Arguments for creating a bucket policy that grants access to services and accounts.
 */
export interface BucketPolicyArgs {
  /** The S3 bucket to create a policy for */
  bucket: BucketInput;
  /** AWS services that should be granted access to the bucket */
  services?: pulumi.Input<string>[];
  /** AWS account IDs that should be granted access to the bucket */
  accounts?: pulumi.Input<string>[];
  /** Whether to skip adding a prefix to the resource name */
  noPrefix?: boolean;
}

/**
 * Creates a bucket policy that grants access to specified services and AWS accounts.
 * @param ctx - The context for resource naming and tagging
 * @param args - Configuration arguments for the bucket policy
 * @returns The bucket policy resource
 */
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

/**
 * Configuration arguments for creating an S3 bucket with optional features.
 */
export type BucketArgs = Pick<
  aws.s3.BucketV2Args,
  "bucket" | "bucketPrefix"
> & {
  /** Whether to enable versioning on the bucket */
  versioned?: boolean;
  /** Whether to enable server-side encryption (defaults to true) */
  encrypted?: boolean;
  /** Whether to allow CORS requests */
  allowCors?: boolean;
  /** Whether the bucket should allow public access */
  public?: boolean;
  /** Whether to disable deletion protection */
  noProtect?: boolean;
  /** Lifecycle rules to automatically manage object expiration */
  lifecycleRules?: BucketLifecycleRule[];
  /** Policy configuration for granting access to services and accounts */
  policy?: Omit<BucketPolicyArgs, "bucket" | "noPrefix">;
  /** Whether to skip adding a prefix to the resource name */
  noPrefix?: boolean;
};

export interface BucketOutput {
  bucket: aws.s3.BucketV2;
  url: pulumi.Output<string>;
}

/**
 * Creates an S3 bucket with optional versioning, encryption, CORS, lifecycle rules, and policies.
 * @param ctx - The context for resource naming and tagging
 * @param args - Optional configuration arguments for the bucket
 * @returns An object containing the bucket resource and its S3 URL
 */
export function bucket(ctx: Context, args?: BucketArgs): BucketOutput {
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
