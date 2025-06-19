/**
 * @packageDocumentation
 *
 * Vercel domain configuration components for setting up DNS records for Vercel-hosted applications.
 *
 * Provides functions for creating CNAME records that point to Vercel's DNS infrastructure,
 * enabling custom domains for Vercel deployments.
 */

import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";
import { Context } from "../context.js";
import { getZoneFromDomain } from "./certificate.js";

/**
 * Configuration arguments for setting up a custom domain with Vercel.
 */
export interface VercelDomainArgs {
  /** The custom domain name to configure for Vercel */
  domain: pulumi.Input<string>;
  /** Route53 hosted zone ID (auto-detected from domain if not provided) */
  zoneId?: pulumi.Input<string>;
  /** DNS record TTL in seconds (defaults to 300) */
  ttl?: pulumi.Input<number>;
  /** Whether to skip adding 'vercel-domain' prefix to resource names */
  noPrefix?: boolean;
}

/**
 * Creates a CNAME record pointing a custom domain to Vercel's DNS infrastructure.
 * @param ctx - The context for resource naming and tagging
 * @param args - Configuration arguments for the Vercel domain setup
 * @returns Route53 CNAME record configured for Vercel hosting
 */
export function vercelDomain(ctx: Context, args: VercelDomainArgs) {
  if (!args.noPrefix) {
    ctx = ctx.prefix("vercel-domain");
  }
  const zoneId = args.zoneId ?? getZoneFromDomain(args.domain);
  return new aws.route53.Record(ctx.id(), {
    name: args.domain,
    zoneId,
    type: "CNAME",
    ttl: args.ttl ?? 300,
    records: ["cname.vercel-dns.com."],
  });
}
