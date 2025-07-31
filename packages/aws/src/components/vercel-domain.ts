/**
 * @packageDocumentation
 *
 * Vercel custom domain configuration enables using your own domain with Vercel-hosted applications by creating the necessary DNS records in Route53. This component sets up CNAME records that point to Vercel's edge infrastructure for optimal performance and SSL certificate management.
 *
 * ```typescript
 * import * as saws from "@stackattack/aws";
 *
 * const ctx = saws.context();
 * const vercelRecord = saws.vercelDomain(ctx, {
 *   domain: "app.example.com"
 * });
 *
 * export const domainRecord = vercelRecord.id;
 * ```
 *
 * ## Usage
 *
 * After deployment, configure the domain in your Vercel project:
 *
 * 1. **In Vercel Dashboard**:
 *    - Go to your project settings
 *    - Add "app.example.com" as a custom domain
 *    - Vercel will automatically issue SSL certificates
 *
 * 2. **Using Vercel CLI**:
 *    ```bash
 *    # Add domain to your project
 *    vercel domains add app.example.com
 *
 *    # Verify domain configuration
 *    vercel domains ls
 *
 *    # Check SSL certificate status
 *    vercel certs ls
 *    ```
 *
 * 3. **Verify DNS propagation**:
 *    ```bash
 *    # Check CNAME record
 *    dig CNAME app.example.com
 *
 *    # Test HTTPS access
 *    curl -I https://app.example.com
 *    ```
 *
 * ## Costs
 *
 * Vercel domain configuration through AWS Route53 has minimal infrastructure costs:
 * - **Route53 hosted zone**: $0.50/month per domain
 * - **DNS queries**: $0.40 per million queries (typically <$1/month for most apps)
 * - **Vercel hosting**: Free tier available, Pro starts at $20/month per user
 * - **SSL certificates**: Free via Vercel (Let's Encrypt)
 *
 * This setup provides enterprise-grade edge performance with minimal operational overhead. Vercel handles SSL certificate renewal, CDN distribution, and edge caching automatically, making it cost-effective for modern web applications.
 */

import * as aws from "@pulumi/aws";
import type * as pulumi from "@pulumi/pulumi";
import type { Context } from "../context.js";
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
