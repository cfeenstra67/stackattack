import * as pulumi from '@pulumi/pulumi';
import * as aws from '@pulumi/aws';
import { Context } from '../context.js';
import { CloudfrontDistribution } from './cloudfront-distribution.js';

interface BaseDomainRecord {
  zoneId: pulumi.Input<string>;
  name: pulumi.Input<string>;
  tags?: Record<string, string>;
}

export interface CloudfrontDistributionRecord extends BaseDomainRecord {
  kind: 'cloudfront-distribution',
  distribution: CloudfrontDistribution | aws.cloudfront.Distribution
};

export type RawDNSRecord = Omit<aws.route53.RecordArgs, 'zoneId' | 'name'> & BaseDomainRecord & {
  kind: 'raw';
};

export type DomainArgs = CloudfrontDistributionRecord | RawDNSRecord;

export class Domain<S extends string = string> extends pulumi.ComponentResource {

  record: aws.route53.Record;

  constructor(private readonly ctx: Context<S>, args: DomainArgs, opts?: pulumi.ComponentResourceOptions) {
    super('stackattack:aws:Domain', ctx.id(), args, opts);

    switch (args.kind) {
      case 'cloudfront-distribution': {
        const distribution = args.distribution instanceof CloudfrontDistribution ? args.distribution.distribution : args.distribution;

        this.record = new aws.route53.Record(this.ctx.id(`dns-record-${record.kind}-${record.name}`), {
          name: record.name,
          zoneId: this.zoneId,
          type: 'A',
          aliases: [
            {
              name: distribution.domainName,
              zoneId: distribution.hostedZoneId,
              evaluateTargetHealth: true
            }
          ]
        });
        break;
      }
      case 'raw': {
        const { kind: _, ...args } = record;
        this.records[record.name] = new aws.route53.Record(this.ctx.id(`dns-record-${record.kind}-${record.name}`), {
          zoneId: this.zoneId,
          ...args
        });
      }
    }

  }

  async initialize(args: DomainArgs): Promise<any> {
    if (args.zoneId === undefined) {
      const zone = new aws.route53.Zone(this.ctx.id('zone'), {
        name: args.domain,
        tags: this.ctx.tags(args.tags)
      });

      this.zoneId = zone.id;
    } else {
      this.zoneId = pulumi.output(args.zoneId);
    }

    this.records = {};
    for (const record of args.records) {

    }
  }

}
