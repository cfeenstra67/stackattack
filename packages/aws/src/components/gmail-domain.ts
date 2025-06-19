/**
 * @packageDocumentation
 *
 * Gmail domain components for configuring custom domains with Gmail/Google Workspace.
 *
 * Creates Route53 DNS records for domain verification and MX records for Gmail integration.
 * Handles automatic zone detection and domain ownership verification for Google services.
 */

import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";
import { Context } from "../context.js";
import { getZoneFromDomain } from "./certificate.js";

/**
 * Configuration arguments for setting up Gmail domain verification and MX records.
 */
export interface GmailDomainArgs {
  /** The domain name to configure for Gmail */
  domain: pulumi.Input<string>;
  /** Google verification code for domain ownership */
  verificationCode: pulumi.Input<string>;
  /** Route53 zone ID (auto-detected from domain if not provided) */
  zoneId?: pulumi.Input<string>;
  /** Whether to skip adding a prefix to the resource name */
  noPrefix?: boolean;
}

/**
 * Creates Route53 DNS records to configure a custom domain for Gmail/Google Workspace.
 * @param ctx - The context for resource naming and tagging
 * @param args - Configuration arguments for the Gmail domain setup
 * @returns Object containing the MX and verification TXT records
 */
export function gmailDomain(ctx: Context, args: GmailDomainArgs) {
  if (!args.noPrefix) {
    ctx = ctx.prefix("gmail-domain");
  }

  const zoneId = args.zoneId ?? getZoneFromDomain(args.domain);

  const mxRecord = new aws.route53.Record(ctx.id("mx"), {
    name: args.domain,
    zoneId,
    type: "MX",
    ttl: 300,
    records: ["1 smtp.google.com."],
  });

  const verificationRecord = new aws.route53.Record(ctx.id("verification"), {
    name: args.domain,
    zoneId,
    type: "TXT",
    ttl: 300,
    records: [args.verificationCode],
  });

  return { mxRecord, verificationRecord };
}
