import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";
import { Context } from "../context.js";
import { getZoneFromDomain } from "./certificate.js";

export interface VercelDomainArgs {
  domain: pulumi.Input<string>;
  zoneId?: pulumi.Input<string>;
  ttl?: pulumi.Input<number>;
  noPrefix?: boolean;
}

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
