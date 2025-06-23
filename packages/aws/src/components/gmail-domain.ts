/**
 * @packageDocumentation
 *
 * Gmail custom domain configuration enables using your own domain (like mail@yourcompany.com) with Gmail/Google Workspace email services. This component creates the necessary DNS records in Route53 for domain verification and email routing to Google's mail servers.
 *
 * ```typescript
 * import * as saws from "@stackattack/aws";
 *
 * const ctx = saws.context();
 * const gmailSetup = saws.gmailDomain(ctx, {
 *   domain: "mail.example.com",
 *   verificationCode: "google-site-verification=abc123..."
 * });
 *
 * export const mxRecord = gmailSetup.id;
 * ```
 *
 * ## Usage
 *
 * After deployment, complete the Gmail/Google Workspace setup:
 *
 * 1. **In Google Admin Console** (for Google Workspace):
 *    - Add your domain and verify ownership
 *    - Configure user accounts with your custom domain
 *    - Set up email routing and aliases
 *
 * 2. **Verify DNS propagation**:
 *    ```bash
 *    # Check MX records
 *    dig MX mail.example.com
 *
 *    # Verify TXT record for domain verification
 *    dig TXT mail.example.com
 *
 *    # Test email delivery
 *    nslookup -q=MX mail.example.com
 *    ```
 *
 * 3. **Configure email clients**:
 *    - IMAP: imap.gmail.com:993 (SSL)
 *    - SMTP: smtp.gmail.com:587 (TLS)
 *    - Use your custom domain email address and Google account password
 *
 * ## Costs
 *
 * Gmail custom domain setup through AWS Route53 has minimal infrastructure costs:
 * - **Route53 hosted zone**: $0.50/month per domain
 * - **DNS queries**: $0.40 per million queries (typically <$1/month)
 * - **Google Workspace**: $6-$18/user/month (separate Google billing)
 * - **Domain registration**: Varies by registrar and TLD
 *
 * This approach is cost-effective for small to medium businesses wanting professional email addresses without managing email servers. The primary cost is the Google Workspace subscription, not the AWS infrastructure.
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
  /** Google verification code for domain ownership. If not passed, no verification record will be created for the domain */
  verificationCode?: pulumi.Input<string>;
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

  let verificationCode: pulumi.Output<string> | undefined = undefined;
  if (args.verificationCode !== undefined) {
    const prefix = "google-site-verification=";
    verificationCode = pulumi
      .output(args.verificationCode)
      .apply((code) =>
        code.toLowerCase().startsWith(prefix) ? code : `${prefix}${code}`,
      );
  }

  if (verificationCode !== undefined) {
    new aws.route53.Record(ctx.id("verification"), {
      name: args.domain,
      zoneId,
      type: "TXT",
      ttl: 300,
      records: [verificationCode],
    });
  }

  return mxRecord;
}
