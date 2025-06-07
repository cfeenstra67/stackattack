import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";
import { Context } from "../context.js";
import { singlePortIngressSecurityGroup } from "../security-groups.js";
import { Network } from "./vpc.js";

export interface RedisArgs {
  network: Network;
  engine?: pulumi.Input<string>;
  engineVersion?: pulumi.Input<string>;
  nodeType?: pulumi.Input<string>;
  numNodes?: pulumi.Input<number>;
  sourceSecurityGroupId?: pulumi.Input<string>;
  availabilityZone?: pulumi.Input<string>;
  parameters?: Record<string, pulumi.Input<string>>;
  port?: pulumi.Input<number>;
  noPrefix?: boolean;
}

export interface RedisOutput {
  instance: aws.elasticache.Cluster;
  url: pulumi.Output<string>;
}

export function redis(ctx: Context, args: RedisArgs): RedisOutput {
  if (!args.noPrefix) {
    ctx = ctx.prefix("redis");
  }

  let port: pulumi.Input<number>;
  if (args.port) {
    port = args.port;
  } else {
    port = 6379;
  }

  let engine: pulumi.Input<string>;
  if (args.engine) {
    engine = args.engine;
  } else {
    engine = "redis";
  }

  let engineVersion: pulumi.Input<string>;
  if (args.engineVersion) {
    engineVersion = args.engineVersion;
  } else {
    engineVersion = "6.x";
  }

  const securityGroup = singlePortIngressSecurityGroup(ctx, {
    vpc: args.network.vpc,
    sourceSecurityGroupId: args.sourceSecurityGroupId,
    port,
  });

  const parameterGroup = new aws.elasticache.ParameterGroup(ctx.id("params"), {
    family: pulumi.interpolate`${engine}${engineVersion}`,
    parameters: Object.entries(args.parameters ?? {}).map(([name, value]) => ({
      name,
      value,
    })),
    tags: ctx.tags(),
  });

  const subnetGroup = new aws.elasticache.SubnetGroup(ctx.id("subnet-group"), {
    subnetIds: args.network.subnetIds,
    tags: ctx.tags(),
  });

  const cluster = new aws.elasticache.Cluster(ctx.id(), {
    engine,
    engineVersion,
    nodeType: args.nodeType ?? "cache.t4g.micro",
    numCacheNodes: args.numNodes ?? 1,
    parameterGroupName: parameterGroup.name,
    subnetGroupName: subnetGroup.name,
    securityGroupIds: [securityGroup.id],
    availabilityZone: args.availabilityZone,
    port,
    tags: ctx.tags(),
  });

  return {
    instance: cluster,
    url: pulumi.interpolate`${engine}://${cluster.cacheNodes[0].address}:${port}/0`,
  };
}
