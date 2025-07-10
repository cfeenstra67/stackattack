/**
 * @packageDocumentation
 *
 * ElastiCache Redis in AWS provides managed Redis instances for caching and session storage. Stackattack creates Redis clusters with secure networking, parameter groups, and proper security group configuration.
 *
 * ```typescript
 * import * as saws from "@stackattack/aws";
 *
 * const ctx = saws.context();
 * const network = saws.vpc(ctx);
 * const cache = saws.redis(ctx, {
 *   network: network.network("private")
 * });
 *
 * export const redisUrl = cache.url;
 * ```
 *
 * ## Usage
 *
 * After deploying a Redis cluster, you can connect to it using:
 *
 * **Direct Connection:**
 * ```bash
 * # Connect using redis-cli from an EC2 instance in the same VPC
 * redis-cli -u redis://your-redis-endpoint.cache.amazonaws.com:6379/0
 *
 * # Test basic operations
 * SET mykey "Hello Redis"
 * GET mykey
 * ```
 *
 * **Application Code:**
 * ```javascript
 * import Redis from "ioredis";
 *
 * const redis = new Redis({
 *   host: "your-redis-endpoint.cache.amazonaws.com",
 *   port: 6379,
 *   retryDelayOnFailover: 100,
 *   maxRetriesPerRequest: 3
 * });
 *
 * await redis.set("session:123", JSON.stringify({ userId: 456 }));
 * const session = await redis.get("session:123");
 * ```
 *
 * ## Related Components
 *
 * Redis clusters work together with other Stackattack components:
 * - [vpc](/components/vpc/) - Provides secure private networking for Redis access
 *
 * ## Costs
 *
 * ElastiCache Redis costs are **fixed hourly charges** based on node type:
 *
 * - **Instance costs** - The default `cache.t4g.micro` costs ~$11.68/month if running 24/7. Larger instances provide more memory and performance:
 *   - `cache.t4g.small` (~$23.36/month) - 1.37GB RAM
 *   - `cache.r7g.large` (~$146.83/month) - 13.07GB RAM
 *   - `cache.r7g.xlarge` (~$293.66/month) - 26.32GB RAM
 *
 * - **Backup storage** - Automatic snapshots are free within the allocated memory size. Additional backup storage is ~$0.085/GB/month.
 *
 * - **Data transfer** - Connections within the same VPC are free. Cross-AZ data transfer costs ~$0.01/GB in each direction.
 *
 * - **Multi-AZ** - If you enable replication groups for high availability, you pay for each additional node.
 *
 * **Memory requirements planning:**
 * - Session storage: ~1KB per user session
 * - Application caching: Depends on cache hit ratio and object sizes
 * - Database query caching: Can range from MBs to GBs depending on query complexity
 *
 * Cost optimization strategies:
 * - Start small; use `cache.t4g.micro` for development and small applications. Unless you're using redis as a primary data store or a cache for a large amount of data, there's a good chance you won't need anything bigger than that for some time.
 * - Monitor memory utilization and scale instance type as needed
 * - Set appropriate TTL values to prevent memory leaks
 * - Use Redis eviction policies like `allkeys-lru` for automatic cleanup
 *
 * See [ElastiCache Pricing](https://aws.amazon.com/elasticache/pricing/) for current rates.
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
