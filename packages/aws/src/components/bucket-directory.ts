import * as path from "node:path";
import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";
import * as mime from "mime-types";
import { Context } from "../context.js";
import { walkFiles } from "../functions/walk-files.js";
import { BucketInput, getBucketId } from "./bucket.js";

export interface BucketDirectoryArgs {
  bucket: BucketInput;
  directory: string;
  keyPrefix?: pulumi.Input<string>;
  noPrefix?: boolean;
}

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
