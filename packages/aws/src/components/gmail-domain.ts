import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";
import { Context } from "../context.js";
import { getZoneFromDomain } from "./certificate.js";

export interface GmailDomainArgs {
  domain: pulumi.Input<string>;
  verificationCode: pulumi.Input<string>;
  zoneId?: pulumi.Input<string>;
  noPrefix?: boolean;
}

export function gmailDomain(ctx: Context, args: GmailDomainArgs) {
  if (!args.noPrefix) {
    ctx = ctx.prefix("gmail-domain");
  }

  const zoneId = args.zoneId ?? getZoneFromDomain(args.domain);

  const mxRecord = new aws.route53.Record(ctx.id("mx"), {
    name: args.domain,
    zoneId,
    type: "MX",
    records: ["smtp.google.com."],
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
