/**
 * @packageDocumentation
 *
 * Sets up a google site verification record. This can be used for verifying you own a domain for usage with Gmail and the Google Search console, among other things.
 *
 * ```typescript
 * import * as pulumi from "@pulumi/pulumi";
 * import * as saws from "@stackattack/aws";
 *
 * const ctx = saws.context();
 * const config = new pulumi.Config();
 *
 * const verificationCode = config.require("google-verification-code");
 *
 * saws.googleSiteVerification(ctx, {
 *   domain: "mydomain.com",
 *   verificationCode
 * });
 * ```
 *
 * ## Usage
 *
 * After deployment, google should be able to verify that you own the domain.
 *
 * You can manually verify that the record has been created successfully using `dig`:
 * ```bash
 * dig TXT mydomain.com
 * ```
 *
 * See [Verify your domain for Google Workspace](https://support.google.com/a/answer/60216) for details on using your domain with Google Workspace.
 *
 * ## Costs
 *
 * The costs associated with setting up a single DNS record are minimal. You'll need a Route53 hosted zone, which costs ~$0.50/month, and DNS queries are billed at $0.40/million. Google only needs one DNS query to verify the domain, though they recommend you keep the site verification record indefinitely to ensure that they can continue to verify ownership.
 */
import * as aws from "@pulumi/aws";
import type * as pulumi from "@pulumi/pulumi";
import type { Context } from "../context.js";
import { getZoneFromDomain } from "./certificate.js";

/**
 * Configuration arguments for setting up google site verification
 */
export interface GoogleSiteVerificationArgs {
  /** The domain name to configure for Gmail */
  domain: pulumi.Input<string>;
  /** Route53 zone ID (auto-detected from domain if not provided) */
  zoneId?: pulumi.Input<string>;
  /** Google verification code for domain ownership. If not passed, no verification record will be created for the domain. This should start with `google-site-verification=...`. */
  verificationCode: pulumi.Input<string>;
  /** Whether to skip adding a prefix to the resource name */
  noPrefix?: boolean;
}

export function googleSiteVerification(
  ctx: Context,
  args: GoogleSiteVerificationArgs,
): aws.route53.Record {
  if (!args.noPrefix) {
    ctx = ctx.prefix("google-site-verification");
  }

  const zoneId = args.zoneId ?? getZoneFromDomain(args.domain);

  return new aws.route53.Record(ctx.id(), {
    name: args.domain,
    zoneId,
    type: "TXT",
    ttl: 300,
    records: [args.verificationCode],
  });
}
