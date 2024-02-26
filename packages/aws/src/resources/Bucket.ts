import aws from '@pulumi/aws';
import pulumi from '@pulumi/pulumi';
import { Context } from '../context.js';

export interface BucketAES256Encryption {
  type: 'AES256';
}

export interface BucketKMSEncryption {
  type: 'aws:kms';
  kmsKeyId?: pulumi.Input<string>;
}

export interface BucketNoEncryption {
  type: 'none';
}

export type BucketEncryption =
  | BucketAES256Encryption
  | BucketKMSEncryption
  | BucketNoEncryption;

export type BucketAction = 'read-only' | 'read-write' | `s3:${string}`;

export interface BucketServiceAccess {
  service: string | string[];
  prefix?: string;
  permissions: BucketAction | BucketAction[];
}

export type BucketFile = string | Record<string, string>;

export interface BucketArgs {
  name?: pulumi.Input<string>;
  namePrefix?: pulumi.Input<string>;
  encryption?: pulumi.Input<BucketEncryption>;
  files?: pulumi.Input<BucketFile | BucketFile[]>;
  noProtect?: boolean;
  allowServiceAccess?: pulumi.Input<BucketServiceAccess | BucketServiceAccess[]>;
}

export class Bucket<S extends string = string> extends pulumi.ComponentResource {

  readonly bucket: aws.s3.Bucket;

  readonly bucketPolicy: aws.s3.BucketPolicy | null;

  constructor(ctx: Context<S>, args: BucketArgs, opts?: pulumi.ComponentResourceOptions) {
    super('stackattack:aws:Bucket', ctx.id(), args, opts);
    const encryption = args.encryption ?? { type: 'aws:kms' };
  
    this.bucket = new aws.s3.Bucket(ctx.id(), {
      bucket: args.name,
      bucketPrefix: args.namePrefix,
      tags: ctx.tags(),
    }, { protect: !args.noProtect });
  
    new aws.s3.BucketPublicAccessBlock(ctx.id('access-block'), {
      bucket: this.bucket.bucket,
      blockPublicAcls: true,
      blockPublicPolicy: true,
      ignorePublicAcls: true,
      restrictPublicBuckets: true,
    });

    this.bucketPolicy = null;
    if (args.allowServiceAccess) {
      const policy = pulumi.all([pulumi.output(args.allowServiceAccess), this.bucket.arn]).apply(([allowServiceAccess, arn]) => {
        const items = Array.isArray(allowServiceAccess) ? allowServiceAccess : [allowServiceAccess];
        return aws.iam.getPolicyDocumentOutput({
          version: '2012-10-17',
          statements: items.map((item) => {
            // const statements = new Set<aws.types.input.iam.GetPolicyDocumentStatementArgs>();
            const actions = new Set<string>();
            for (const permission of item.permissions) {
              if (permission === 'read-only') {
                actions.add('s3:GetObject');
                actions.add('s3:ListBucket');
              } else if (permission === 'read-write') {
                actions.add('s3:GetObject');
                actions.add('s3:ListBucket');
                actions.add('s3:PutObject');
              } else {
                actions.add(permission);
              }
            }

            return {
              effect: 'Allow',
              principals: [{ type: 'Service', identifiers: [`${item.service}.amazonaws.com`] }],
              actions: Array.from(actions),
              resources: [`${arn}`, `${arn}/${item.prefix ?? ''}*`]
            };
          })
        });
      });

      new aws.s3.BucketPolicy(ctx.id('policy'), {
        bucket: this.bucket.bucket,
        policy: policy.json,
      });
    }
  }
}
