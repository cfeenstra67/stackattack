import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";
import { Context } from "../context.js";

export function getZoneFromDomain(
  domain: pulumi.Input<string>,
): pulumi.Output<string> {
  return pulumi.output(domain).apply((domain) => {
    const root = domain.split(".").slice(-2).join(".");
    return aws.route53.getZoneOutput({ name: root }).id;
  });
}

export interface CertificateArgs {
  domain: pulumi.Input<string>;
  additionalDomains?: pulumi.Input<string>[];
  wildcard?: boolean;
  noValidate?: boolean;
  zone?: pulumi.Input<string>;
  noPrefix?: boolean;
}

export function certificate(
  ctx: Context,
  args: CertificateArgs,
): pulumi.Output<string> {
  if (!args.noPrefix) {
    ctx = ctx.prefix("certificate");
  }

  const zoneId = args.zone ?? getZoneFromDomain(args.domain);

  const additionalDomains = pulumi
    .all([
      args.domain,
      args.wildcard,
      pulumi.output(args.additionalDomains ?? []),
    ])
    .apply(([domain, wildcard, additional]) => {
      const out = [...additional];
      if (wildcard) {
        out.unshift(`*.${domain}`);
      }
      return out;
    });

  const certificate = new aws.acm.Certificate(
    ctx.id(),
    {
      domainName: args.domain,
      subjectAlternativeNames: additionalDomains,
      tags: ctx.tags(),
      validationMethod: "DNS",
    },
    {
      deleteBeforeReplace: true,
    },
  );

  if (args.noValidate) {
    return certificate.arn;
  }

  const fqdns = Array.from({ length: 1 }).map((_, idx) => {
    const record = new aws.route53.Record(
      ctx.id(`validation-${idx}`),
      {
        name: certificate.domainValidationOptions[idx].resourceRecordName,
        zoneId,
        type: certificate.domainValidationOptions[idx].resourceRecordType,
        records: [certificate.domainValidationOptions[idx].resourceRecordValue],
        ttl: 600,
      },
      {
        deleteBeforeReplace: true,
      },
    );

    return record.fqdn;
  });

  const certificateValidation = new aws.acm.CertificateValidation(
    ctx.id("validation"),
    {
      certificateArn: certificate.arn,
      validationRecordFqdns: fqdns,
    },
    {
      deleteBeforeReplace: true,
    },
  );

  return certificateValidation.certificateArn;
}
