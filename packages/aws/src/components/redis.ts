/**
 * @packageDocumentation
 * 
 * ElastiCache Redis components for creating Redis clusters with secure networking.
 * 
 * Creates ElastiCache clusters with subnet groups, parameter groups, and security groups for Redis access.
 * Supports configurable node types, engine versions, and custom parameter configurations.
 */

import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";
import { Context } from "../context.js";
import { singlePortIngressSecurityGroup } from "../security-groups.js";
import { Network } from "./vpc.js";

/**
 * Configuration arguments for creating an ElastiCache Redis cluster.
 */
export interface RedisArgs {
  /** The network configuration (VPC and subnets) for the Redis cluster */
  network: Network;
  /** ElastiCache engine type (defaults to "redis") */
  engine?: pulumi.Input<string>;
  /** Engine version (defaults to "6.x") */
  engineVersion?: pulumi.Input<string>;
  /** Instance type for cache nodes (defaults to "cache.t4g.micro") */
  nodeType?: pulumi.Input<string>;
  /** Number of cache nodes in the cluster (defaults to 1) */
  numNodes?: pulumi.Input<number>;
  /** Security group ID that should be allowed to access the cluster */
  sourceSecurityGroupId?: pulumi.Input<string>;
  /** Specific availability zone for the cluster */
  availabilityZone?: pulumi.Input<string>;
  /** Custom parameters for the parameter group */
  parameters?: Record<string, pulumi.Input<string>>;
  /** Port number for Redis connections (defaults to 6379) */
  port?: pulumi.Input<number>;
  /** Whether to skip adding a prefix to the resource name */
  noPrefix?: boolean;
}

/**
 * Output from creating a Redis cluster, containing the instance and connection URL.
 */
export interface RedisOutput {
  /** The ElastiCache cluster resource */
  instance: aws.elasticache.Cluster;
  /** Connection URL for the Redis cluster */
  url: pulumi.Output<string>;
}

/**
 * Creates an ElastiCache Redis cluster with security group, parameter group, and subnet group.
 * @param ctx - The context for resource naming and tagging
 * @param args - Configuration arguments for the Redis cluster
 * @returns Redis output containing the cluster instance and connection URL
 */
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
