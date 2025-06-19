/**
 * @packageDocumentation
 *
 * Kinesis Data Firehose components for streaming data to S3 with optional Parquet conversion.
 *
 * Creates Firehose delivery streams with S3 destinations, CloudWatch logging, and optional Glue integration.
 * Supports data transformation, compression, and format conversion from JSON to Parquet using Glue tables.
 */

import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";
import { glueCatalogArn, glueDatabaseArn, s3BucketArn } from "../arns.js";
import { Context } from "../context.js";
import { serviceAssumeRolePolicy } from "../policies.js";
import { BucketInput, bucket, getBucketId } from "./bucket.js";

/**
 * Arguments for creating IAM policy for S3 Firehose access.
 */
export interface S3FirehosePolicyArgs {
  /** The S3 bucket to grant access to */
  bucket: BucketInput;
  /** ARN of the CloudWatch log stream for logging */
  logStreamArn: pulumi.Input<string>;
  /** Optional ARN of a Glue table for Parquet conversion */
  glueParquetTableArn?: pulumi.Input<string>;
}

/**
 * Creates an IAM policy document that grants Firehose access to S3, CloudWatch Logs, and optionally Glue.
 * @param args - Configuration arguments for the policy
 * @returns IAM policy document granting necessary permissions
 */
export function s3FirehosePolicy(args: S3FirehosePolicyArgs) {
  const bucketArn = s3BucketArn({ bucket: args.bucket });

  const statements: aws.iam.GetPolicyDocumentOutputArgs["statements"] = [
    {
      sid: "AllowS3Access",
      effect: "Allow",
      actions: [
        "s3:AbortMultipartUpload",
        "s3:GetBucketLocation",
        "s3:GetObject",
        "s3:ListBucket",
        "s3:ListBucketMultipartUploads",
        "s3:PutObject",
      ],
      resources: [bucketArn, pulumi.interpolate`${bucketArn}/*`],
    },
    {
      sid: "AllowLoggingAccess",
      effect: "Allow",
      actions: ["logs:PutLogEvents"],
      resources: [args.logStreamArn],
    },
  ];

  if (args.glueParquetTableArn !== undefined) {
    const parsedArn = aws.getArnOutput({ arn: args.glueParquetTableArn });
    const databaseName = parsedArn.resource.apply((r) => r.split("/")[1]);
    const databaseArn = glueDatabaseArn({ databaseName });
    const catalogArn = glueCatalogArn();

    statements.push({
      sid: "AllowGlueAccess",
      effect: "Allow",
      actions: [
        // TODO: narrow this down
        "glue:*",
      ],
      resources: [args.glueParquetTableArn, databaseArn, catalogArn],
    });
  }

  return aws.iam.getPolicyDocumentOutput({ statements });
}

/**
 * Creates an IAM policy document that grants Firehose access to read from a Kinesis stream.
 * @param kinesisStreamArn - ARN of the Kinesis stream to grant access to
 * @returns IAM policy document granting Kinesis read permissions
 */
export function s3FirehoseKinesisPolicy(
  kinesisStreamArn: pulumi.Input<string>,
) {
  return aws.iam.getPolicyDocumentOutput({
    statements: [
      {
        sid: "AllowKinesisAccess",
        effect: "Allow",
        actions: [
          "kinesis:DescribeStream",
          "kinesis:GetShardIterator",
          "kinesis:GetRecords",
          "kinesis:ListShards",
        ],
        resources: [kinesisStreamArn],
      },
    ],
  });
}

/**
 * Configuration arguments for creating a Kinesis Firehose delivery stream to S3.
 */
export interface S3FirehoseArgs {
  /** The S3 bucket to deliver data to */
  bucket: BucketInput;
  /** S3 prefix for successful deliveries */
  prefix?: pulumi.Input<string>;
  /** S3 prefix for error outputs (defaults to prefix + "error/") */
  errorPrefix?: pulumi.Input<string>;
  /** JQ queries for dynamic partitioning by field values */
  dynamicPartitioningFields?: Record<string, pulumi.Input<string>>;
  /** Timestamp-based partitioning granularity */
  timestampPartitioning?: "year" | "month" | "day" | "hour";
  /** Optional Glue table ARN for Parquet conversion */
  glueParquetTableArn?: pulumi.Input<string>;
  /** Whether to partition errors by type */
  partitionErrorsByType?: boolean;
  /** Buffering interval in seconds (defaults to 900) */
  bufferInterval?: pulumi.Input<number>;
  /** Buffering size in MB (defaults to 64) */
  bufferSize?: pulumi.Input<number>;
  /** CloudWatch log retention in days (defaults to 365) */
  logRetentionDays?: pulumi.Input<number>;
  /** Whether to skip adding a prefix to the resource name */
  noPrefix?: boolean;
}

/**
 * Creates a Kinesis Firehose delivery stream that delivers data to S3 with optional partitioning and Parquet conversion.
 * @param ctx - The context for resource naming and tagging
 * @param args - Configuration arguments for the Firehose delivery stream
 * @returns Object containing the Firehose stream, output URL, and error URL
 */
export function s3Firehose(ctx: Context, args: S3FirehoseArgs) {
  if (!args.noPrefix) {
    ctx = ctx.prefix("s3-firehose");
  }

  const logGroup = new aws.cloudwatch.LogGroup(ctx.id("log-group"), {
    retentionInDays: args.logRetentionDays ?? 365,
    tags: ctx.tags(),
  });
  const logStream = new aws.cloudwatch.LogStream(ctx.id("log-stream"), {
    logGroupName: logGroup.name,
  });

  const role = new aws.iam.Role(ctx.id("role"), {
    assumeRolePolicy: serviceAssumeRolePolicy("firehose").json,
    tags: ctx.tags(),
  });

  let bucketInput = args.bucket;
  if (!bucketInput) {
    bucketInput = bucket(ctx).bucket;
  }

  const bucketName = getBucketId(bucketInput);

  new aws.iam.RolePolicy(ctx.id("role-policy"), {
    role: role.id,
    policy: s3FirehosePolicy({
      logStreamArn: logStream.arn,
      bucket: bucketName,
      glueParquetTableArn: args.glueParquetTableArn,
    }).json,
  });

  const originalOutputPrefix = pulumi
    .output(args.prefix ?? "")
    .apply((outputPrefix) =>
      outputPrefix.endsWith("/") ? outputPrefix : `${outputPrefix}/`,
    );

  const originalErrorOutputPrefix = pulumi
    .all([args.errorPrefix, originalOutputPrefix])
    .apply(([errorPrefix, outputPrefix]) => {
      const initial = errorPrefix ?? `${outputPrefix}error/`;
      return initial.endsWith("/") ? initial : `${initial}/`;
    });

  let outputPrefix = originalOutputPrefix;
  let errorOutputPrefix = originalErrorOutputPrefix;

  const processors: aws.types.input.kinesis.FirehoseDeliveryStreamExtendedS3ConfigurationProcessingConfigurationProcessor[] =
    [];

  if (args.dynamicPartitioningFields) {
    for (const [fieldName, fieldQuery] of Object.entries(
      args.dynamicPartitioningFields,
    )) {
      outputPrefix = pulumi.interpolate`${outputPrefix}${fieldName}=!{partitionKeyFromQuery:${fieldName}}/`;
      processors.push({
        type: "MetadataExtraction",
        parameters: [
          {
            parameterName: "MetadataExtractionQuery",
            parameterValue: pulumi.interpolate`{${fieldName}:${fieldQuery}}`,
          },
          {
            parameterName: "JsonParsingEngine",
            parameterValue: "JQ-1.6",
          },
        ],
      });
    }
  }

  if (args.timestampPartitioning === "year") {
    outputPrefix = pulumi.interpolate`${outputPrefix}chunk=!{timestamp:yyyy}/`;
    errorOutputPrefix = pulumi.interpolate`${errorOutputPrefix}chunk=!{timestamp:yyyy}/`;
  }
  if (args.timestampPartitioning === "month") {
    outputPrefix = pulumi.interpolate`${outputPrefix}chunk=!{timestamp:yyyy-MM}/`;
    errorOutputPrefix = pulumi.interpolate`${errorOutputPrefix}chunk=!{timestamp:yyyy-MM}/`;
  }
  if (args.timestampPartitioning === "day") {
    outputPrefix = pulumi.interpolate`${outputPrefix}chunk=!{timestamp:yyyy-MM-dd}/`;
    errorOutputPrefix = pulumi.interpolate`${errorOutputPrefix}chunk=!{timestamp:yyyy-MM-dd}/`;
  }
  if (args.timestampPartitioning === "hour") {
    outputPrefix = pulumi.interpolate`${outputPrefix}chunk=!{timestamp:yyyy-MM-dd-HH}/`;
    errorOutputPrefix = pulumi.interpolate`${errorOutputPrefix}chunk=!{timestamp:yyyy-MM-dd-HH}/`;
  }
  if (args.partitionErrorsByType) {
    errorOutputPrefix = pulumi.interpolate`${errorOutputPrefix}!{firehose:error-output-type}/`;
  }

  let glueDatabaseName: pulumi.Input<string> | undefined = undefined;
  let glueTableName: pulumi.Input<string> | undefined = undefined;
  if (args.glueParquetTableArn) {
    const arn = aws.getArnOutput({ arn: args.glueParquetTableArn });
    glueDatabaseName = arn.resource.apply((r) => r.split("/")[1]);
    glueTableName = arn.resource.apply((r) => r.split("/")[2]);
  }

  const stream = new aws.kinesis.FirehoseDeliveryStream(ctx.id(), {
    destination: "extended_s3",
    extendedS3Configuration: {
      roleArn: role.arn,
      bucketArn: s3BucketArn({ bucket: bucketName }),
      bufferingInterval: args.bufferInterval ?? 900,
      bufferingSize: args.bufferSize ?? 64,
      cloudwatchLoggingOptions: {
        enabled: true,
        logGroupName: logGroup.name,
        logStreamName: logStream.name,
      },
      prefix: outputPrefix,
      errorOutputPrefix,
      compressionFormat: args.glueParquetTableArn ? "UNCOMPRESSED" : "GZIP",
      dynamicPartitioningConfiguration: args.dynamicPartitioningFields
        ? { enabled: true }
        : undefined,
      processingConfiguration:
        processors.length > 0
          ? {
              enabled: true,
              processors,
            }
          : undefined,
      dataFormatConversionConfiguration: args.glueParquetTableArn
        ? {
            enabled: true,
            inputFormatConfiguration: {
              deserializer: {
                openXJsonSerDe: {},
              },
            },
            outputFormatConfiguration: {
              serializer: {
                parquetSerDe: {},
              },
            },
            schemaConfiguration: {
              databaseName: glueDatabaseName!,
              roleArn: role.arn,
              tableName: glueTableName!,
            },
          }
        : undefined,
    },
    tags: ctx.tags(),
  });

  new aws.iam.RolePolicy(ctx.id("role-kinesis-policy"), {
    role: role.id,
    policy: s3FirehoseKinesisPolicy(stream.arn).json,
  });

  const url = pulumi.interpolate`s3://${bucketName}/${originalOutputPrefix}`;
  const errorUrl = pulumi.interpolate`s3://${bucketName}/${originalErrorOutputPrefix}`;

  return { firehose: stream, url, errorUrl };
}
