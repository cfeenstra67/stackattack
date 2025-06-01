import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";
import { BucketInput, getBucketId } from "./components/bucket.js";

export interface S3BucketArnArgs {
  bucket: BucketInput;
}

export function s3BucketArn({
  bucket,
}: S3BucketArnArgs): pulumi.Output<string> {
  const bucketName = getBucketId(bucket);
  return pulumi.interpolate`arn:aws:s3:::${bucketName}`;
}

export interface GlueCatalogArnArgs {
  region?: pulumi.Input<string>;
  accountId?: pulumi.Input<string>;
}

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

export interface GlueDatabaseArnArgs {
  region?: pulumi.Input<string>;
  accountId?: pulumi.Input<string>;
  databaseName: pulumi.Input<string>;
}

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

export interface GlueTableArnArgs {
  region?: pulumi.Input<string>;
  accountId?: pulumi.Input<string>;
  databaseName: pulumi.Input<string>;
  tableName: pulumi.Input<string>;
}

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
