/**
 * @packageDocumentation
 *
 * S3 buckets in AWS are the standard way to store files within "buckets". Stackattack creates S3 buckets with secure defaults including encryption and public access blocking.
 *
 * ```typescript
 * import * as saws from "@stackattack/aws";
 *
 * const ctx = saws.context();
 * const storage = saws.bucket(ctx);
 *
 * export const storageBucket = storage.bucket;
 * ```
 *
 * ## Usage
 *
 * After deploying a bucket, you can interact with it using:
 *
 * **AWS CLI:**
 * ```bash
 * # Upload a single file
 * aws s3 cp ./local-file.txt s3://your-bucket-name/remote-file.txt
 *
 * # List bucket contents
 * aws s3 ls s3://your-bucket-name/
 * ```
 *
 * **AWS SDK:**
 * ```javascript
 * import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
 *
 * const s3 = new S3Client({ region: "us-east-1" });
 *
 * await s3.send(new PutObjectCommand({
 *   Bucket: "your-bucket-name",
 *   Key: "path/to/file.json",
 *   Body: JSON.stringify({ message: "Hello World" }),
 *   ContentType: "application/json"
 * }));
 * ```
 * ## Related Components
 *
 * Buckets are a foundational component in AWS and integrate with several other components:
 * - [static-site](/components/static-site/) - Serves files stored in S3 publicly using Cloudfront as a CDN with support for framework-specific routing.
 * - [s3-firehose](/components/s3-firehose/) - Sets up a Kinesis Firehose that can be used to buffer data and write it to S3 in chunks. This can be used to query it efficiently with tools that can read data directly from S3 such as Athena or Apache Spark.
 *
 * ## Costs
 *
 * S3 costs are all **usage-based** so you will not be charged if you create a bucket and never use it. S3 costs are broken down by:
 *
 * - **Data Transfer** - This is the component that often makes costs really blow up unless handled carefully. Sending data **to** S3 is always free. However, transferring data **out of** S3 to the internet incurs charges of ~$0.09/GB. If data is transferred from S3 to many clients, this can add up quickly. Consider these cost reduction strategies:
 *   - Use S3 endpoints - The [vpc](/components/vpc/) component sets up VPC endpoints by default, so requests to S3 from your VPC will be made internally in AWS's network and will not incur data transfer charges.
 *   - Consider CloudFront - Use the [staticSite](/components/static-site/) component or create your own CloudFront distribution to serve files publicly. The first 1TB of data transfer out to the internet from CloudFront is free each month; [see CloudFront pricing for details](https://aws.amazon.com/cloudfront/pricing/).
 *
 * - **Data stored** - The storage itself is relatively cheap, ~$0.023/GB/month. If you store 100GB of data in S3 and leave it there, you'll be billed ~$2.30 each month. If you delete the data (including all versions, if versioning is enabled) from S3, you will not be charged for its storage anymore.
 *
 * - **Requests** - You'll be charged for each API call made to your S3 buckets, but this is also relatively cheap: ~$0.0004/1000 read (GET, SELECT) and ~$0.0005/1000 write (POST, PUT, etc.) requests. You will not be charged unless the requests can successfully pass authorization checks.
 *
 * Note: Prices vary by region. See [S3 Pricing](https://aws.amazon.com/s3/pricing/) for current rates.
 */

import aws from "@pulumi/aws";
import pulumi from "@pulumi/pulumi";
import * as mime from "mime-types";
import { s3BucketArn } from "../arns.js";
import type { Context } from "../context.js";
import { walkFiles } from "../functions/walk-files.js";

/**
 * Union type representing different ways to reference an S3 bucket.
 */
export type BucketInput =
  | string
  | aws.s3.BucketV2
  | aws.s3.Bucket
  | aws.s3.GetBucketResult;

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
    return pulumi.output(value.bucket);
  });
}

/**
 * Retrieves the full bucket attributes from various bucket input types.
 * @param input - The bucket input (string, bucket resource, or bucket result)
 * @returns The bucket attributes as a Pulumi output
 */
export function getBucketAttributes(
  input: pulumi.Input<BucketInput>,
): pulumi.Output<aws.s3.Bucket | aws.s3.BucketV2 | aws.s3.GetBucketResult> {
  return pulumi.output(input).apply((value) => {
    if (typeof value === "string") {
      return aws.s3.getBucketOutput({
        bucket: value,
      });
    }
    return pulumi.output(value);
  });
}

/**
 * Arguments for configuring S3 bucket versioning.
 */
export interface BucketVersioningArgs {
  /** The S3 bucket to configure versioning for */
  bucket: pulumi.Input<BucketInput>;
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
  bucket: pulumi.Input<BucketInput>;
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
  bucket: pulumi.Input<BucketInput>;
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
  bucket: pulumi.Input<BucketInput>,
  services: pulumi.Input<string>[],
) {
  const bucketObj = getBucketAttributes(bucket);
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
  bucket: pulumi.Input<BucketInput>;
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

export interface BucketObjectOwnershipArgs {
  /** The S3 bucket to create an ownership resource for */
  bucket: pulumi.Input<BucketInput>;
  /** Object ownership setting */
  objectOwnership: pulumi.Input<string>;
  /** Whether to skip adding a prefix to the resource name */
  noPrefix?: boolean;
}

/**
 * Configures object ownership controls for an S3 bucket.
 * @param ctx - The context for resource naming and tagging
 * @param args - Configuration arguments for bucket object ownership
 * @returns The bucket ownership controls resource
 */
export function bucketObjectOwnership(
  ctx: Context,
  args: BucketObjectOwnershipArgs,
) {
  if (!args.noPrefix) {
    ctx = ctx.prefix("object-ownership");
  }
  return new aws.s3.BucketOwnershipControls(ctx.id(), {
    bucket: getBucketId(args.bucket),
    rule: {
      objectOwnership: args.objectOwnership,
    },
  });
}

/**
 * Configuration arguments for uploading a directory to an S3 bucket.
 */
export interface BucketFilesArgs {
  /** The target S3 bucket for the directory upload */
  bucket: BucketInput;
  /** Local filesystem path to the directory to upload */
  paths: string[];
  /** Optional prefix to prepend to all S3 object keys */
  keyPrefix?: pulumi.Input<string>;
  /** Whether to skip adding 'bucket-directory' prefix to resource names */
  noPrefix?: boolean;
}

/**
 * Uploads all files from a local directory to an S3 bucket with proper MIME types.
 * @param ctx - The context for resource naming and tagging
 * @param args - Configuration arguments for the directory upload
 * @returns Record mapping relative file paths to their corresponding S3 bucket objects
 */
export function bucketFiles(
  ctx: Context,
  args: BucketFilesArgs,
): Record<string, aws.s3.BucketObjectv2> {
  if (!args.noPrefix) {
    ctx = ctx.prefix("files");
  }

  const bucket = getBucketId(args.bucket);
  const out: Record<string, aws.s3.BucketObjectv2> = {};

  for (const root of args.paths) {
    for (const [relPath, filePath] of walkFiles(root)) {
      const key = pulumi.interpolate`${args.keyPrefix ?? ""}${relPath}`;

      out[relPath] = new aws.s3.BucketObjectv2(ctx.id(relPath), {
        bucket,
        key,
        source: new pulumi.asset.FileAsset(filePath),
        contentType: mime.lookup(filePath) || "binary/octet-stream",
      });
    }
  }

  return out;
}

/**
 * Configuration arguments for creating an S3 bucket with optional features.
 */
export interface BucketArgs {
  /** Specify a prefix to use for the bucket name. If neither this nor `bucket` are specified, a prefix will be auto-generated based on the resource name */
  bucketPrefix?: pulumi.Input<string>;
  /** Specify the name of your bucket. In general when using Pulumi, it's preferred to specify name _prefixes_ (`bucketPrefix`, or allow pulumi to generate the prefix for you) so that resources can be recreated before deleting them in the case where they need to replaced. */
  bucket?: pulumi.Input<string>;
  /** Whether to enable versioning on the bucket */
  versioned?: boolean;
  /** Whether to enable server-side encryption (defaults to true) */
  encrypted?: boolean;
  /** Provide an array of path(s) to upload to the bucket */
  paths?: string[];
  /** Whether to allow CORS requests */
  allowCors?: boolean;
  /** Whether the bucket should allow public access */
  public?: boolean;
  /** The object ownership setting for the bucket */
  objectOwnership?: pulumi.Input<string>;
  /** Lifecycle rules to automatically manage object expiration */
  lifecycleRules?: BucketLifecycleRule[];
  /** Policy configuration for granting access to services and accounts */
  policy?: Omit<BucketPolicyArgs, "bucket" | "noPrefix">;
  /** When deleting the bucket, delete all objects in the bucket first. This is dangerous and can cause unintentional data loss (particularly if used in conjunction with `noProtect`), but may be desirable for ephemeral buckets */
  forceDestroy?: pulumi.Input<boolean>;
  /** Whether to disable deletion protection. Since buckets are stateful and deleting them can cause data loss, they are protected by default. */
  noProtect?: boolean;
  /** Whether to skip adding a prefix to the resource name */
  noPrefix?: boolean;
}

/**
 * Creates an S3 bucket with security best practices enabled by default, including encryption, public access blocking, and optional versioning.
 *
 * @param ctx - The context for resource naming and tagging
 * @param args - Optional configuration arguments for the bucket
 * @returns An object containing the bucket resource and its S3 URL
 */
export function bucket(ctx: Context, args?: BucketArgs): aws.s3.BucketV2 {
  if (!args?.noPrefix) {
    ctx = ctx.prefix("bucket");
  }
  const bucket = new aws.s3.BucketV2(
    ctx.id(),
    {
      bucket: args?.bucket,
      bucketPrefix: args?.bucketPrefix,
      forceDestroy: args?.forceDestroy,
      tags: ctx.tags(),
    },
    {
      protect: !args?.noProtect,
      deleteBeforeReplace: args?.bucket !== undefined,
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

  if (args?.objectOwnership) {
    bucketObjectOwnership(ctx, {
      bucket,
      objectOwnership: args.objectOwnership,
    });
  }

  if (args?.paths) {
    bucketFiles(ctx, { bucket, paths: args.paths });
  }

  return bucket;
}
