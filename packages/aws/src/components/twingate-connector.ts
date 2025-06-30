/**
 * @packageDocumentation
 *
 * Twingate connectors provide secure zero-trust network access to private resources in AWS. StackAttack deploys Twingate connectors as ECS services to create encrypted tunnels between your Twingate network and AWS VPC.
 *
 * ```typescript
 * import * as saws from "@stackattack/aws";
 *
 * const ctx = saws.context();
 * const vpc = saws.vpc(ctx);
 * const cluster = saws.cluster(ctx, { network: vpc.network("private") });
 * const connector = saws.twingate(ctx, {
 *   network: vpc.network("private"),
 *   cluster,
 *   twingateNetwork: "your-network-name",
 *   twingateAccessToken: "your-access-token",
 *   twingateRefreshToken: "your-refresh-token"
 * });
 * ```
 *
 * ## Usage
 *
 * After deploying a Twingate connector, manage it through:
 *
 * **Twingate Admin Console:**
 * - Monitor connector status and health
 * - Configure resource access policies
 * - View connection logs and analytics
 *
 *
 * ## Related Components
 *
 * Twingate connectors work with other StackAttack components:
 * - [vpc](/components/vpc) - Provides the private network where the connector runs
 * - [cluster](/components/cluster) - Provides compute capacity for the connector service
 * - [service](/components/service) - Base service component that runs the Twingate container
 *
 * ## Costs
 *
 * Twingate connector costs are **usage-based** and include:
 * - **ECS Task**: ~$15-30/month for a single connector (2GB RAM, 1 vCPU)
 * - **Data Transfer**: Standard AWS data transfer rates apply for traffic through the connector
 * - **Twingate Licensing**: Separate subscription cost based on your Twingate plan
 *
 * The connector runs continuously to maintain the secure tunnel, so costs are predictable monthly charges rather than per-connection billing.
 */

import * as pulumi from "@pulumi/pulumi";
import { Context } from "../context.js";
import { ClusterResourcesInput } from "./cluster.js";
import { service } from "./service.js";
import { NetworkInput } from "./vpc.js";

/**
 * Configuration options for creating a Twingate connector.
 */
export interface TwingateConnectorArgs {
  /** The VPC network where the Twingate connector will run */
  network: NetworkInput;
  /** The ECS cluster that will host the Twingate connector service */
  cluster: pulumi.Input<ClusterResourcesInput>;
  /** Your Twingate network name (found in Twingate Admin Console) */
  twingateNetwork: pulumi.Input<string>;
  /** Twingate service account access token for connector authentication */
  twingateAccessToken: pulumi.Input<string>;
  /** Twingate service account refresh token for token renewal */
  twingateRefreshToken: pulumi.Input<string>;
  /** Optional custom DNS server IP address for the connector to use */
  customDnsServer?: pulumi.Input<string>;
  /** Enable detailed connection logging and analytics (default: false) */
  connectionLogs?: pulumi.Input<boolean>;
  /** Skip adding 'twingate' prefix to resource names (default: false) */
  noPrefix?: boolean;
}

/**
 * Creates a Twingate connector service that provides secure zero-trust network access.
 *
 * The connector runs as an ECS service and creates an encrypted tunnel between your
 * Twingate network and AWS VPC, allowing secure access to private resources.
 *
 * @param ctx - The StackAttack context for resource configuration
 * @param args - Configuration options for the Twingate connector
 * @returns The ECS service running the Twingate connector
 */
export function twingateConnector(ctx: Context, args: TwingateConnectorArgs) {
  if (!args.noPrefix) {
    ctx = ctx.prefix("twingate");
  }

  return service(ctx, {
    cluster: args.cluster,
    network: args.network,
    name: "twingate",
    image: "twingate/connector:1",
    memory: 2048,
    cpu: 1024,
    env: {
      TWINGATE_NETWORK: args.twingateNetwork,
      TWINGATE_ACCESS_TOKEN: args.twingateAccessToken,
      TWINGATE_REFRESH_TOKEN: args.twingateRefreshToken,
      TWINGATE_LAST_DEPLOYED_BY: "ecs",
      TWINGATE_LOG_ANALYTICS: pulumi
        .output(args.connectionLogs)
        .apply((enabled) => (enabled ? "v2" : "")),
    },
  });
}
