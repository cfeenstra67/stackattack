import * as aws from '@pulumi/aws';
import * as pulumi from '@pulumi/pulumi';
import { Context } from '@/context.js';

type DistributionArgs = Pick<
  aws.cloudfront.DistributionArgs,
  'aliases'
>;

export interface CDNDNSConfig {
  zoneId?: pulumi.Input<string>;
  domain: pulumi.Input<string>;
  additionalDomains?: pulumi.Input<string[]>;
  redirectDomains?: pulumi.Input<string>;
  certificateArn?: pulumi.Input<string>;
}

export interface CDNArgs extends DistributionArgs {
  domains?: CDNDNSConfig[];
  bucket: pulumi.Input<string>;
  prefix?: pulumi.Input<string>;
}

export class CDN<S extends string = string> extends pulumi.ComponentResource {
  readonly distribution: aws.cloudfront.Distribution;
  
  constructor(ctx: Context<S>, args: CDNArgs, opts?: pulumi.ComponentResourceOptions) {
    super('stackattack:aws:CDN', ctx.id(), args, opts);

    aws.getDefaultTags()




    // if (args.domains) {
    //   let zoneId = dns.zoneId;
    //   if (zoneId === undefined) {
    //     const zone = new aws.route53.Zone(ctx.id('zone'), {
    //       name: dns.domain,
    //       tags: ctx.tags()
    //     });
  
    //     zoneId = zone.id;
    //   }
    
    //   let certificateArn = dns.certificateArn;
    //   if (certificateArn === undefined) {
    //     const eastProvider = new aws.Provider(ctx.id('aws-us-east-1'), {
    //       region: 'us-east-1',
    //       profile: aws.config.profile,
    //     });
  
    //     const otherNames = pulumi.output(dns.additionalDomains)
  
    //     const certificate = new aws.acm.Certificate('certificate', {
    //       domainName: dns.domain,
    //       validationMethod: 'DNS',
    //       subjectAlternativeNames: dns.additionalDomains,
    //       tags: ctx.tags(tags),
    //     }, { provider: eastProvider });

    //     const fqdns: pulumi.Output<string>[] = [];
    //     for (let i = 0; i < 2; i++) {
    //       const certificateValidationDomain = new aws.route53.Record(`${dns.domain}-validation-${i}`, {
    //         name: certificate.domainValidationOptions[i].resourceRecordName,
    //         type: certificate.domainValidationOptions[i].resourceRecordType,
    //         zoneId,
    //         records: [certificate.domainValidationOptions[i].resourceRecordValue],
    //         ttl: 600
    //       });
    //       fqdns.push(certificateValidationDomain.fqdn);
    //     }
      
    //     const certificateValidation = new aws.acm.CertificateValidation(
    //       `certificate_validation`, {
    //         certificateArn: certificate.arn,
    //         validationRecordFqdns: fqdns,
    //       }, { provider: eastProvider }
    //     );

    //   }  
    // }



    
  }
}

export function cloudfrontDistribution<S extends string>(ctx: Context<S>, {
  dns,
  bucket,
  prefix,
  tags,
}: CloudfrontDistributionArgs) {

  if (dns) {
    let zoneId = dns.zoneId;
    if (zoneId === undefined) {
      const zone = new aws.route53.Zone(ctx.id('zone'), {
        name: dns.domain,
        tags: ctx.tags()
      });

      zoneId = zone.id;
    }
  
    let certificateArn = dns.certificateArn;
    if (certificateArn === undefined) {
      const eastProvider = new aws.Provider(ctx.id('aws-us-east-1'), {
        region: 'us-east-1',
        profile: aws.config.profile,
      });

      const otherNames = pulumi.output(dns.additionalDomains)

      const certificate = new aws.acm.Certificate('certificate', {
        domainName: dns.domain,
        validationMethod: 'DNS',
        subjectAlternativeNames: dns.additionalDomains,
        tags: ctx.tags(tags),
      }, { provider: eastProvider });
    }

  }

}
