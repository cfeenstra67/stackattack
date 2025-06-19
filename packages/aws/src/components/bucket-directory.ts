/**
 * @packageDocumentation
 *
 * S3 bucket directory upload components for bulk uploading local directories to S3 buckets.
 *
 * Provides functions for recursively uploading directory contents to S3 with proper MIME type
 * detection and configurable key prefixes.
 */

import * as path from "node:path";
import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";
import * as mime from "mime-types";
import { Context } from "../context.js";
import { walkFiles } from "../functions/walk-files.js";
import { BucketInput, getBucketId } from "./bucket.js";

/**
 * Configuration arguments for uploading a directory to an S3 bucket.
 */
export interface BucketDirectoryArgs {
  /** The target S3 bucket for the directory upload */
  bucket: BucketInput;
  /** Local filesystem path to the directory to upload */
  directory: string;
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
export function bucketDirectory(
  ctx: Context,
  args: BucketDirectoryArgs,
): Record<string, aws.s3.BucketObjectv2> {
  if (!args.noPrefix) {
    ctx = ctx.prefix("bucket-directory");
  }

  const bucket = getBucketId(args.bucket);
  const out: Record<string, aws.s3.BucketObjectv2> = {};

  for (const relPath of walkFiles(args.directory)) {
    const filePath = path.join(args.directory, relPath);
    const key = pulumi.interpolate`${args.keyPrefix ?? ""}${relPath}`;

    out[relPath] = new aws.s3.BucketObjectv2(ctx.id(relPath), {
      bucket,
      key,
      source: new pulumi.asset.FileAsset(filePath),
      contentType: mime.lookup(filePath) || "binary/octet-stream",
    });
  }

  return out;
}
