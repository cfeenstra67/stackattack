/**
 * @packageDocumentation
 *
 * ACM certificates in AWS provide SSL/TLS certificates for secure HTTPS connections. StackAttack creates certificates with automatic DNS validation through Route53, supporting wildcards and multiple domains.
 *
 * ```typescript
 * import * as saws from "@stackattack/aws";
 *
 * const ctx = saws.context();
 * const certArn = saws.certificate(ctx, {
 *   domain: "example.com",
 *   wildcard: true
 * });
 *
 * export const certificateArn = certArn;
 * ```
 *
 * ## Usage
 *
 * After deploying a certificate, you can use it with other AWS services:
 *
 * **AWS CLI:**
 * ```bash
 * # View certificate details
 * aws acm describe-certificate --certificate-arn arn:aws:acm:us-east-1:123456789012:certificate/12345678-1234-1234-1234-123456789012
 * ```
 *
 * ## Related Components
 *
 * Certificates work together with other StackAttack components:
 * - [load-balancer](/components/load-balancer) - Uses certificates for HTTPS termination
 * - [static-site](/components/static-site) - Uses certificates for secure CloudFront distributions
 *
 * ## Costs
 *
 * ACM certificates are **completely free** when used with AWS services:
 *
 * - **Certificate issuance** - No cost for requesting, renewing, or using ACM certificates with AWS services like ALB, CloudFront, or API Gateway.
 *
 * - **DNS validation** - Route53 DNS queries during validation are minimal and typically cost less than $0.01.
 *
 * - **Automatic renewal** - ACM automatically renews certificates before expiration at no cost.
 *
 * - **Wildcard certificates** - No additional cost for wildcard (`*.example.com`) or multi-domain certificates.
 *
 * **Important limitations:**
 * - ACM certificates can only be used with AWS services (ALB, CloudFront, API Gateway, etc.)
 * - You cannot export private keys for use on non-AWS infrastructure
 * - For external use cases, consider Let's Encrypt or commercial certificate authorities
 *
 * See [ACM Pricing](https://aws.amazon.com/certificate-manager/pricing/) for details.
 */

import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";
import { Context } from "../context.js";

/**
 * Retrieves the Route53 hosted zone ID for a given domain by extracting the root domain.
 * @param domain - The domain name to find the hosted zone for
 * @returns The Route53 hosted zone ID as a Pulumi output
 */
export function getZoneFromDomain(
  domain: pulumi.Input<string>,
): pulumi.Output<string> {
  return pulumi.output(domain).apply((domain) => {
    const root = domain.split(".").slice(-2).join(".");
    return aws.route53.getZoneOutput({ name: root }).id;
  });
}

/**
 * Configuration arguments for creating an ACM certificate.
 */
export interface CertificateArgs {
  /** The primary domain name for the certificate */
  domain: pulumi.Input<string>;
  /** Additional domain names to include in the certificate */
  additionalDomains?: pulumi.Input<string>[];
  /** Whether to include a wildcard subdomain (*.domain) */
  wildcard?: boolean;
  /** Whether to skip DNS validation (returns certificate ARN immediately) */
  noValidate?: boolean;
  /** Specific Route53 zone ID (auto-detected from domain if not provided) */
  zone?: pulumi.Input<string>;
  /** Use a specific provider instance to create certificate resources. This can allow you to create certificate in different region(s) or account(s) */
  provider?: aws.Provider;
  /** Whether to skip adding a prefix to the resource name */
  noPrefix?: boolean;
}

/**
 * Creates an ACM certificate with DNS validation and optional wildcard support.
 * @param ctx - The context for resource naming and tagging
 * @param args - Configuration arguments for the certificate
 * @returns The ARN of the validated certificate as a Pulumi output
 */
export function certificate(
  ctx: Context,
  args: CertificateArgs,
): pulumi.Output<string> {
  if (!args.noPrefix) {
    ctx = ctx.prefix("certificate");
  }

  const zoneId = args.zone ?? getZoneFromDomain(args.domain);

  const provider = args.provider;

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
      provider,
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
        provider,
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
      provider,
      deleteBeforeReplace: true,
    },
  );

  return certificateValidation.certificateArn;
}
