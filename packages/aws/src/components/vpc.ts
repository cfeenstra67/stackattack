/**
 * @packageDocumentation
 *
 * VPCs in AWS are isolated virtual networks that provide the networking foundation for your applications. StackAttack creates VPCs with public and private subnets across multiple availability zones, internet gateways, NAT gateways, and VPC endpoints.
 *
 * ```typescript
 * import * as saws from "@stackattack/aws";
 *
 * const ctx = saws.context();
 * const network = saws.vpc(ctx);
 *
 * export const vpcId = network.vpc.id;
 * ```
 *
 * ## Usage
 *
 * After deploying a VPC, you can manage it using:
 *
 * **AWS CLI:**
 * ```bash
 * # View VPC details
 * aws ec2 describe-vpcs --vpc-ids vpc-1234567890abcdef0
 *
 * # List subnets in the VPC
 * aws ec2 describe-subnets --filters "Name=vpc-id,Values=vpc-1234567890abcdef0"
 *
 * # View route tables
 * aws ec2 describe-route-tables --filters "Name=vpc-id,Values=vpc-1234567890abcdef0"
 *
 * # Enable VPC Flow Logs for troubleshooting
 * aws ec2 create-flow-logs --resource-type VPC --resource-ids vpc-1234567890abcdef0 --traffic-type ALL --log-destination-type cloud-watch-logs --log-group-name VPCFlowLogs
 * ```
 *
 * **AWS SDK:**
 * ```javascript
 * import { EC2Client, DescribeVpcsCommand } from "@aws-sdk/client-ec2";
 *
 * const ec2 = new EC2Client({ region: "us-east-1" });
 *
 * const vpcs = await ec2.send(new DescribeVpcsCommand({
 *   VpcIds: ["vpc-1234567890abcdef0"]
 * }));
 * ```
 *
 * ## Related Components
 *
 * VPCs provide the networking foundation for other StackAttack components:
 * - [cluster](/components/cluster) - Requires VPC networking for ECS instances
 * - [service](/components/service) - Runs in VPC private subnets
 * - [database](/components/database) - Deployed in VPC private subnets for security
 * - [load-balancer](/components/load-balancer) - Uses VPC public subnets for internet access
 * - [redis](/components/redis) - Deployed in VPC private subnets
 *
 * ## Costs
 *
 * VPC core resources are **free**, but associated components incur charges:
 *
 * - **VPC, subnets, route tables, security groups** - No charge for the basic networking infrastructure.
 *
 * - **NAT Gateway** - StackAttack creates a single NAT Gateway for all private subnets (~$45/month + $0.045/GB processed). This enables private subnet instances to access the internet while remaining inaccessible from the internet.
 *
 * - **Internet Gateway** - Free for the gateway itself, but data transfer charges apply (~$0.09/GB out to internet).
 *
 * - **VPC Endpoints** - StackAttack creates S3 gateway endpoints (free) to avoid data transfer charges when accessing S3 from private subnets. Interface endpoints cost ~$7.20/month per endpoint if you add them.
 *
 * - **Instance Connect Endpoints** - StackAttack creates these for secure SSH access (~$3.60/month per endpoint + $0.10/hour when in use).
 *
 * - **VPC Flow Logs** - If enabled, logs cost ~$0.50/GB stored in CloudWatch Logs. Can generate significant data if traffic is high.
 *
 * Cost optimization strategies:
 * - Use the default `flowLogs: false` unless you need traffic analysis
 * - VPC endpoints save money on data transfer if you frequently access AWS services
 * - Consider multiple smaller VPCs vs one large VPC based on isolation requirements
 *
 * See [VPC Pricing](https://aws.amazon.com/vpc/pricing/) for current rates.
 */

import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";
import { Context } from "../context.js";
import { serviceAssumeRolePolicy } from "../policies.js";
import { LogGroupInput, getLogGroupId } from "./logs.js";

/**
 * Union type representing various VPC input formats.
 * Accepts VPC ID string, VPC resource, VPC result, or VPC output.
 */
export type VpcInput = string | aws.ec2.Vpc | aws.ec2.GetVpcResult | VpcOutput;

/**
 * Extracts the VPC ID from various VPC input formats.
 * @param input - VPC input in any supported format
 * @returns The VPC ID as a Pulumi output string
 */
export function getVpcId(input: pulumi.Input<VpcInput>): pulumi.Output<string> {
  return pulumi.output(input).apply((value) => {
    if (typeof value === "string") {
      return pulumi.output(value);
    }
    if ("vpc" in value) {
      return value.vpc.id;
    }
    return pulumi.output(value.id);
  });
}

/**
 * Retrieves VPC attributes from various VPC input formats.
 * @param input - VPC input in any supported format
 * @returns VPC attributes as a Pulumi output
 */
export function getVpcAttributes(
  input: pulumi.Input<VpcInput>,
): pulumi.Output<aws.ec2.Vpc | aws.ec2.GetVpcResult> {
  return pulumi.output(input).apply((value) => {
    if (typeof value === "string") {
      return aws.ec2.getVpcOutput({
        id: value,
      });
    }
    if ("vpc" in value) {
      return pulumi.output(value.vpc);
    }
    return pulumi.output(value);
  });
}

/**
 * Retrieves the default security group for a VPC.
 * @param vpcId - The VPC ID to get the default security group for
 * @returns The default security group for the specified VPC
 */
export function getVpcDefaultSecurityGroup(vpcId: pulumi.Input<string>) {
  return aws.ec2.getSecurityGroupOutput({
    vpcId,
    filters: [
      {
        name: "group-name",
        values: ["default"],
      },
    ],
  });
}

/**
 * Arguments for creating an Internet Gateway.
 */
export interface InternetGatewayArgs {
  /** The VPC to attach the Internet Gateway to */
  vpc: pulumi.Input<VpcInput>;
  /** Whether to skip adding prefix to the resource name */
  noPrefix?: boolean;
}

/**
 * Creates an Internet Gateway attached to a VPC.
 * @param ctx - The context for resource naming and tagging
 * @param args - Internet Gateway configuration arguments
 * @returns The created Internet Gateway resource
 */
export function internetGateway(ctx: Context, args: InternetGatewayArgs) {
  if (!args.noPrefix) {
    ctx = ctx.prefix("internet-gateway");
  }
  return new aws.ec2.InternetGateway(ctx.id(), {
    vpcId: getVpcId(args.vpc),
    tags: { ...ctx.tags(), Name: ctx.id() },
  });
}

interface SubnetsArgs {
  vpc: pulumi.Input<VpcInput>;
  cidrAllocator: CidrAllocator;
  nat?: "single" | "none";
  availabilityZones: number | pulumi.Input<string>[];
  subnetMask?: number;
  noPrefix?: boolean;
}

/**
 * Creates public and private subnets across multiple availability zones.
 * @param ctx - The context for resource naming and tagging
 * @param args - Subnet configuration arguments
 * @returns Object containing arrays of public and private subnet IDs
 */
export function subnets(ctx: Context, args: SubnetsArgs) {
  if (!args.noPrefix) {
    ctx = ctx.prefix("subnets");
  }
  const vpcId = getVpcId(args.vpc);

  const publicSubnetIds: pulumi.Output<string>[] = [];
  const privateSubnetIds: pulumi.Output<string>[] = [];

  const publicRouteTable = new aws.ec2.RouteTable(
    ctx.id("public-route-table"),
    {
      vpcId,
      tags: { ...ctx.tags(), Name: ctx.id("public-route-table") },
    },
  );

  const gateway = internetGateway(ctx, { vpc: args.vpc });

  new aws.ec2.Route(ctx.id("gateway-route"), {
    routeTableId: publicRouteTable.id,
    destinationCidrBlock: "0.0.0.0/0",
    gatewayId: gateway.id,
  });

  const privateRouteTable = new aws.ec2.RouteTable(
    ctx.id("private-route-table"),
    {
      vpcId,
      tags: { ...ctx.tags(), Name: ctx.id("private-route-table") },
    },
  );

  const region = aws.getRegionOutput();
  new aws.ec2.VpcEndpoint(ctx.id("s3-endpoint"), {
    serviceName: pulumi.interpolate`com.amazonaws.${region.name}.s3`,
    vpcId,
    autoAccept: true,
    routeTableIds: [privateRouteTable.id],
    tags: { ...ctx.tags(), Name: ctx.id("s3-endpoint") },
  });

  const subnetMask = args.subnetMask ?? 20;

  let idx = 0;
  for (const zoneId of availabilityZones(args.availabilityZones)) {
    const privateSubnet = new aws.ec2.Subnet(ctx.id(`private-${idx}`), {
      vpcId,
      cidrBlock: args.cidrAllocator.allocate(subnetMask),
      availabilityZone: zoneId,
      tags: { ...ctx.tags(), Name: ctx.id(`private-${idx}`) },
    });
    privateSubnetIds.push(privateSubnet.id);

    new aws.ec2.RouteTableAssociation(
      ctx.id(`private-route-table-association-${idx}`),
      {
        routeTableId: privateRouteTable.id,
        subnetId: privateSubnet.id,
      },
    );

    new aws.ec2transitgateway.InstanceConnectEndpoint(
      ctx.id(`instance-connect-endpoint-${idx}`),
      {
        subnetId: privateSubnet.id,
        tags: ctx.tags(),
      },
    );

    const publicSubnet = new aws.ec2.Subnet(ctx.id(`public-${idx}`), {
      vpcId,
      cidrBlock: args.cidrAllocator.allocate(24),
      availabilityZone: zoneId,
      tags: { ...ctx.tags(), Name: ctx.id(`public-${idx}`) },
    });
    publicSubnetIds.push(publicSubnet.id);

    new aws.ec2.RouteTableAssociation(
      ctx.id(`public-route-table-association-${idx}`),
      {
        routeTableId: publicRouteTable.id,
        subnetId: publicSubnet.id,
      },
    );

    idx++;
  }

  const nat = args.nat ?? "single";
  if (nat === "single") {
    const elasticIp = new aws.ec2.Eip(ctx.id("nat-ip"), {
      tags: { ...ctx.tags(), Name: ctx.id("nat-ip") },
    });

    const natGateway = new aws.ec2.NatGateway(ctx.id("nat-gateway"), {
      allocationId: elasticIp.id,
      subnetId: publicSubnetIds[0],
      tags: { ...ctx.tags(), Name: ctx.id("nat-gateway") },
    });

    new aws.ec2.Route(ctx.id("nat-route"), {
      routeTableId: privateRouteTable.id,
      destinationCidrBlock: "0.0.0.0/0",
      natGatewayId: natGateway.id,
    });
  }

  return { publicSubnetIds, privateSubnetIds };
}

function availabilityZones(
  zones: number | pulumi.Input<string>[],
): pulumi.Output<string>[] {
  if (zones === 0 || (Array.isArray(zones) && zones.length === 0)) {
    return [];
  }
  if (Array.isArray(zones)) {
    const region = aws.getRegionOutput();
    const out: pulumi.Output<string>[] = [];
    for (const item of zones.sort()) {
      out.push(
        pulumi.output(item).apply((val) => {
          if (val.length === 1) {
            return pulumi.interpolate`${region.name}${item}`;
          }
          return pulumi.output(val);
        }),
      );
    }

    return out;
  }

  const allZones = aws.getAvailabilityZonesOutput();

  const zoneIds = allZones.names.apply((zoneValues) => {
    const results = zoneValues.sort().slice(0, zones);
    if (results.length < zones) {
      throw new Error(
        `There are only ${zoneValues} < ${zones} AZs available in the current region`,
      );
    }
    return results;
  });

  const out: pulumi.Output<string>[] = [];
  for (let i = 0; i < zones; i++) {
    out.push(zoneIds.apply((ids) => ids[i]));
  }

  return out;
}

function ipToNumber(ip: string): number {
  return (
    ip.split(".").reduce((acc, octet) => (acc << 8) + Number(octet), 0) >>> 0
  );
}

function numberToIp(num: number): string {
  return [
    (num >>> 24) & 255,
    (num >>> 16) & 255,
    (num >>> 8) & 255,
    num & 255,
  ].join(".");
}

/**
 * Interface for allocating CIDR blocks within a VPC.
 */
export interface CidrAllocator {
  /** Allocates a subnet with the specified netmask within the VPC CIDR block */
  allocate: (netmask: number) => pulumi.Output<string>;
  /** Returns the current allocation counter */
  counter: () => pulumi.Output<number>;
}

function parseCidrBlock(block: string) {
  const [cidrIp, netmask] = block.split("/");
  if (!netmask || cidrIp.split(".").length !== 4) {
    throw new Error(`Invalid cidr block: ${block}`);
  }
  return { block, ip: ipToNumber(cidrIp), netmask: Number(netmask) };
}

function cidrAllocator(
  cidrBlock: pulumi.Input<string>,
  initial?: pulumi.Input<number>,
): CidrAllocator {
  const parsedCidr = pulumi.output(cidrBlock).apply(parseCidrBlock);

  // https://docs.aws.amazon.com/vpc/latest/userguide/subnet-sizing.html
  const initialCounter = pulumi.output(initial).apply((initialVal) => {
    return initialVal === undefined ? 256 : initialVal;
  });
  let counter = 0;

  return {
    allocate: (subnetMask) =>
      pulumi
        .all([initialCounter, parsedCidr])
        .apply(([initial, { block, ip, netmask }]) => {
          const maxIps = ip + (1 << (32 - netmask));
          const requestedIps = 1 << (32 - subnetMask);
          const nextIp = ip + initial + counter;
          let remainder = nextIp % requestedIps;
          if (remainder > 0) {
            remainder = requestedIps - remainder;
          }
          const currentIp = nextIp + remainder;

          if (currentIp + requestedIps > maxIps) {
            const remaining = maxIps - currentIp;
            throw new Error(
              `Not enough addresses left (/${subnetMask}: ` +
                `${requestedIps} > ${block}: ${remaining})`,
            );
          }

          counter += requestedIps + remainder;

          return `${numberToIp(currentIp)}/${subnetMask}`;
        }),
    counter: () => initialCounter.apply((c) => c + counter),
  };
}

/**
 * Gets the VPC DNS server IP address based on the VPC CIDR block.
 * AWS reserves the second IP address in the VPC CIDR block for the DNS server.
 * @param cidrBlock - The VPC CIDR block
 * @returns The DNS server IP address
 */
export function getVpcDnsServer(
  cidrBlock: pulumi.Input<string>,
): pulumi.Output<string> {
  return pulumi.output(cidrBlock).apply((block) => {
    const parsedCidr = parseCidrBlock(block);
    return numberToIp(parsedCidr.ip + 2);
  });
}

/**
 * Arguments for creating a VPC Flow Logs IAM role.
 */
export interface VPCFlowLogsRoleArgs {
  /** The log group where flow logs will be written */
  logGroup: LogGroupInput;
  /** Whether to skip adding prefix to the resource name */
  noPrefix?: boolean;
}

/**
 * Creates an IAM role for VPC Flow Logs with appropriate permissions.
 * @param ctx - The context for resource naming and tagging
 * @param args - VPC Flow Logs role configuration arguments
 * @returns The created IAM role for VPC Flow Logs
 */
export function vpcFlowLogsRole(ctx: Context, args: VPCFlowLogsRoleArgs) {
  if (!args.noPrefix) {
    ctx = ctx.prefix("role");
  }
  const logGroupId = getLogGroupId(args.logGroup);
  const logGroupOutput = aws.cloudwatch.getLogGroupOutput({ name: logGroupId });
  return new aws.iam.Role(ctx.id(), {
    assumeRolePolicy: serviceAssumeRolePolicy("vpc-flow-logs").json,
    tags: ctx.tags(),
    inlinePolicies: [
      {
        name: "vpc-flow-logs-policy",
        policy: aws.iam.getPolicyDocumentOutput({
          statements: [
            {
              actions: [
                "logs:CreateLogGroup",
                "logs:CreateLogStream",
                "logs:PutLogEvents",
              ],
              resources: [
                logGroupOutput.arn,
                pulumi.interpolate`${logGroupOutput.arn}:log-stream:*`,
              ],
            },
            {
              actions: ["logs:DescribeLogGroups", "logs:DescribeLogStream"],
              resources: ["*"],
            },
          ],
        }).json,
      },
    ],
  });
}

/**
 * Arguments for creating VPC Flow Logs.
 */
export interface VPCFlowLogsArgs {
  /** The VPC to enable flow logs for */
  vpc: VpcInput;
  /** Whether to skip adding prefix to the resource name */
  noPrefix?: boolean;
}

/**
 * Creates VPC Flow Logs with associated log group and IAM role.
 * @param ctx - The context for resource naming and tagging
 * @param args - VPC Flow Logs configuration arguments
 */
export function vpcFlowLogs(ctx: Context, args: VPCFlowLogsArgs) {
  if (!args.noPrefix) {
    ctx = ctx.prefix("flow-logs");
  }
  const logGroup = new aws.cloudwatch.LogGroup(ctx.id("log-group"), {
    tags: ctx.tags(),
  });

  const role = vpcFlowLogsRole(ctx, { logGroup });

  new aws.ec2.FlowLog(ctx.id(), {
    iamRoleArn: role.arn,
    logDestination: logGroup.arn,
    trafficType: "ALL",
    vpcId: getVpcId(args.vpc),
    tags: ctx.tags(),
  });
}

export interface VpcArgs {
  // https://docs.aws.amazon.com/vpc/latest/userguide/vpc-cidr-blocks.html
  cidrBlock?: pulumi.Input<string>;
  availabilityZones?: number | string[];
  flowLogs?: boolean;
  subnetMask?: number;
  noProtect?: boolean;
  noPrefix?: boolean;
}

/**
 * Represents a network configuration with VPC and subnets.
 */
export interface Network {
  /** The VPC resource */
  vpc: aws.ec2.Vpc;
  /** Array of subnet IDs in the network */
  subnetIds: pulumi.Output<string>[];
}

/**
 * Input type for network configuration.
 */
export interface NetworkInput {
  /** The VPC input */
  vpc: pulumi.Input<VpcInput>;
  /** Array of subnet ID inputs */
  subnetIds: pulumi.Input<pulumi.Input<string>[]>;
}

/**
 * Type representing network visibility - either public or private.
 */
export type NetworkType = "public" | "private";

interface VpcOutput {
  vpc: aws.ec2.Vpc;
  publicSubnetIds: pulumi.Output<string>[];
  privateSubnetIds: pulumi.Output<string>[];
  network: (type: NetworkType) => Network;
  cidrAllocator: CidrAllocator;
}

/**
 * Creates a complete VPC with public and private subnets across availability zones.
 * @param ctx - The context for resource naming and tagging
 * @param args - VPC configuration arguments
 * @returns VPC output with created resources and helper functions
 */
export function vpc(ctx: Context, args?: VpcArgs): VpcOutput {
  if (!args?.noPrefix) {
    ctx = ctx.prefix("vpc");
  }
  const cidrBlock = args?.cidrBlock ?? "10.0.0.0/16";

  const vpc = new aws.ec2.Vpc(
    ctx.id(),
    {
      cidrBlock,
      enableDnsHostnames: true,
      enableDnsSupport: true,
      tags: {
        ...ctx.tags(),
        Name: ctx.id(),
      },
    },
    {
      protect: !args?.noProtect,
    },
  );

  new aws.ec2.DefaultSecurityGroup(ctx.id("default-sg"), {
    vpcId: vpc.id,
    ingress: [
      {
        protocol: "-1",
        self: true,
        fromPort: 0,
        toPort: 0,
      },
    ],
    egress: [
      {
        fromPort: 0,
        toPort: 0,
        protocol: "-1",
        cidrBlocks: ["0.0.0.0/0"],
      },
    ],
    tags: ctx.tags(),
  });

  const allocator = cidrAllocator(cidrBlock);

  let publicSubnetIds: pulumi.Output<string>[] = [];
  let privateSubnetIds: pulumi.Output<string>[] = [];
  const zones = availabilityZones(args?.availabilityZones ?? 1);
  if (zones.length > 0) {
    const results = subnets(ctx, {
      vpc,
      cidrAllocator: allocator,
      availabilityZones: zones,
      subnetMask: args?.subnetMask,
    });
    publicSubnetIds = results.publicSubnetIds;
    privateSubnetIds = results.privateSubnetIds;
  }

  if (args?.flowLogs) {
    vpcFlowLogs(ctx, { vpc });
  }

  return {
    vpc,
    publicSubnetIds,
    privateSubnetIds,
    cidrAllocator: allocator,
    network: (type) => {
      return {
        vpc,
        subnetIds: type === "private" ? privateSubnetIds : publicSubnetIds,
      };
    },
  };
}

/**
 * Interface representing VPC resources as IDs for serialization.
 */
export interface VpcIds {
  /** The VPC ID */
  vpc: pulumi.Output<string>;
  /** Array of public subnet IDs */
  publicSubnetIds: pulumi.Output<string>[];
  /** Array of private subnet IDs */
  privateSubnetIds: pulumi.Output<string>[];
  /** CIDR allocation counter */
  counter: pulumi.Output<number>;
}

/**
 * Converts a VPC output to a serializable VPC IDs format.
 * @param vpc - The VPC output to convert
 * @returns VPC IDs representation for serialization
 */
export function vpcToIds(vpc: VpcOutput): VpcIds {
  return {
    vpc: vpc.vpc.id,
    publicSubnetIds: vpc.publicSubnetIds,
    privateSubnetIds: vpc.privateSubnetIds,
    counter: vpc.cidrAllocator.counter(),
  };
}

/**
 * Reconstructs a VPC output from serialized VPC IDs.
 * @param vpcInput - The VPC IDs input to reconstruct from
 * @param increment - Optional increment to add to the CIDR counter
 * @returns Reconstructed VPC output with all original functionality
 */
export function vpcFromIds(vpcInput: pulumi.Input<VpcIds>, increment?: number) {
  const vpc = pulumi.output(vpcInput) as unknown as pulumi.Output<VpcIds>;
  const attrs = getVpcAttributes(vpc.vpc);
  return {
    vpc: attrs,
    publicSubnetIds: vpc.publicSubnetIds,
    privateSubnetIds: vpc.privateSubnetIds,
    cidrAllocator: cidrAllocator(
      attrs.cidrBlock,
      vpc.counter.apply((c) => c + (increment ?? 0)),
    ),
    network: (type: NetworkType) => {
      return {
        vpc: attrs,
        subnetIds:
          type === "private" ? vpc.privateSubnetIds : vpc.publicSubnetIds,
      };
    },
  };
}
