import * as aws from '@pulumi/aws';
import * as pulumi from '@pulumi/pulumi';

class TestCustomResource extends pulumi.ComponentResource {
  bucket: pulumi.Output<aws.s3.Bucket | null>;

  constructor(id: string) {
    super('stackattack:components:Test', id, { a: id }, { protect: true });

    const blah = pulumi.output('camfeenstra.com');

    const zone = blah.apply((value) =>
      aws.route53.getZone({ name: value })
    );
    this.bucket = zone.apply((zone) =>
      id.endsWith('t') ?
        new aws.s3.Bucket(id + '-bucket', {
          tags: { Blah: zone.id }
        }, { parent: this })
        : null
    );
  }
}

const resource = new TestCustomResource('test');

const resource2 = new TestCustomResource('test2');

const bucket2 = new aws.s3.Bucket('test');

export const bucket1 = resource.bucket.apply((b) => b?.bucket);

export const bucket2Out = resource2.bucket.apply((b) => b?.bucket);

export const bucket3Out = bucket2.bucket;

// const bucket3 = new aws.s3.Bucket('test');
// console.log('HERE', resource.bucket);
