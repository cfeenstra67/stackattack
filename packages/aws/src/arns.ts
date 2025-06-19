import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";
import { BucketInput, getBucketId } from "./components/bucket.js";

/**
 * Arguments for building an S3 bucket ARN.
 */
export interface S3BucketArnArgs {
  /** The S3 bucket to generate an ARN for */
  bucket: pulumi.Input<BucketInput>;
}

/**
 * Constructs an S3 bucket ARN from bucket input.
 * @param args - Arguments containing the bucket reference
 * @returns The S3 bucket ARN as a Pulumi output
 */
export function s3BucketArn({
  bucket,
}: S3BucketArnArgs): pulumi.Output<string> {
  const bucketName = getBucketId(bucket);
  return pulumi.interpolate`arn:aws:s3:::${bucketName}`;
}

/**
 * Arguments for building a Glue catalog ARN.
 */
export interface GlueCatalogArnArgs {
  /** AWS region (defaults to current region if not specified) */
  region?: pulumi.Input<string>;
  /** AWS account ID (defaults to current account if not specified) */
  accountId?: pulumi.Input<string>;
}

/**
 * Constructs a Glue catalog ARN with optional region and account ID.
 * @param args - Optional arguments for region and account ID
 * @returns The Glue catalog ARN as a Pulumi output
 */
export function glueCatalogArn(
  args?: GlueCatalogArnArgs,
): pulumi.Output<string> {
  let region = args?.region;
  let accountId = args?.accountId;
  if (region === undefined) {
    const regionOutput = aws.getRegionOutput();
    region = regionOutput.name;
  }
  if (accountId === undefined) {
    const identity = aws.getCallerIdentityOutput();
    accountId = identity.accountId;
  }
  return pulumi.interpolate`arn:aws:glue:${region}:${accountId}:catalog`;
}

/**
 * Arguments for building a Glue database ARN.
 */
export interface GlueDatabaseArnArgs {
  /** AWS region (defaults to current region if not specified) */
  region?: pulumi.Input<string>;
  /** AWS account ID (defaults to current account if not specified) */
  accountId?: pulumi.Input<string>;
  /** Name of the Glue database */
  databaseName: pulumi.Input<string>;
}

/**
 * Constructs a Glue database ARN from database name and optional region/account.
 * @param args - Arguments containing the database name and optional region/account
 * @returns The Glue database ARN as a Pulumi output
 */
export function glueDatabaseArn({
  region,
  accountId,
  databaseName,
}: GlueDatabaseArnArgs): pulumi.Output<string> {
  if (region === undefined) {
    const regionOutput = aws.getRegionOutput();
    region = regionOutput.name;
  }
  if (accountId === undefined) {
    const identity = aws.getCallerIdentityOutput();
    accountId = identity.accountId;
  }
  return pulumi.interpolate`arn:aws:glue:${region}:${accountId}:database/${databaseName}`;
}

/**
 * Arguments for building a Glue table ARN.
 */
export interface GlueTableArnArgs {
  /** AWS region (defaults to current region if not specified) */
  region?: pulumi.Input<string>;
  /** AWS account ID (defaults to current account if not specified) */
  accountId?: pulumi.Input<string>;
  /** Name of the Glue database containing the table */
  databaseName: pulumi.Input<string>;
  /** Name of the Glue table */
  tableName: pulumi.Input<string>;
}

/**
 * Constructs a Glue table ARN from database/table names and optional region/account.
 * @param args - Arguments containing the database name, table name, and optional region/account
 * @returns The Glue table ARN as a Pulumi output
 */
export function glueTableArn({
  region,
  accountId,
  databaseName,
  tableName,
}: GlueTableArnArgs): pulumi.Output<string> {
  if (region === undefined) {
    const regionOutput = aws.getRegionOutput();
    region = regionOutput.name;
  }
  if (accountId === undefined) {
    const identity = aws.getCallerIdentityOutput();
    accountId = identity.accountId;
  }
  return pulumi.interpolate`arn:aws:glue:${region}:${accountId}:table/${databaseName}/${tableName}`;
}
