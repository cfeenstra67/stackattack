import * as mime from 'mime-types';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as aws from '@pulumi/aws';
import * as pulumi from '@pulumi/pulumi';
import { PartialPulumi } from "../types.js";
import { Context } from '../context.js';

export async function* walkDirectory(dir: string): AsyncGenerator<string> {
  for await (const d of await fs.promises.opendir(dir)) {
    const entry = path.join(dir, d.name);
    if (d.isDirectory()) yield* walkDirectory(entry);
    else if (d.isFile()) yield entry;
  }
}

export interface S3DirectoryArgs {
  bucket: PartialPulumi<string>;
  directory: string;
  prefix?: string;
}

export async function s3Directory<S extends string>(ctx: Context<S>, {
  bucket,
  directory,
  prefix
}: S3DirectoryArgs): Promise<Record<string, aws.s3.BucketObject>> {
  const out: Record<string, aws.s3.BucketObject> = {};
  for await (const filePath of walkDirectory(directory)) {
    const relPath = path.relative(directory, filePath);
    const key = prefix ? prefix + relPath : relPath;
    out[relPath] = new aws.s3.BucketObjectv2(ctx.id(key), {
      bucket,
      key,
      source: new pulumi.asset.FileAsset(filePath),
      contentType: mime.lookup(filePath) || 'binary/octet-stream'
    });
  }

  return out;
}
