/**
 * @packageDocumentation
 *
 * VPCs in AWS are isolated virtual networks that provide the networking foundation for your applications. Stackattack creates VPCs with public and private subnets across multiple availability zones, internet gateways, NAT gateways, and VPC endpoints.
 *
 * ```typescript
 * import * as saws from "@stackattack/aws";
 *
 * const ctx = saws.context();
 * // NOTE: if you have multiple VPCs e.g. for different
 * // environments you should specify the `cidrBlock` argument,
 * // with non-overlapping CIDRs for each VPC
 * // e.g. `10.0.0.0/16` (the default), `10.1.0.0/16`, `10.2.0.0/16`, etc.
 * const vpc = saws.vpc(ctx);
 *
 * // `vpcToIds` converts the VPC to only its serializable
 * // identifiers suitable for stack outputs. The full VPC
 * // object can be retrieved in other stacks by using
 * // `saws.vpcFromIds(stackRef.require('vpc'))`
 * export { vpc: saws.vpcToIds(vpc) };
 * ```
 *
 * ## Usage
 *
 * After deploying your VPC, you'll be able to deploy resources into it. See the [Related Components](#related-components) for examples of how resources can be deployed into VPCs.
 *
 * One important thing you'll need to determine is how you access private resources within your VPC from your local machine--**by default the only connectivity provided to private resources is SSH access to EC2 instances via [EC2 Instance Connect](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/connect-linux-inst-eic.html)**.
 *
 * Stackattack provides a few options:
 * - [twingate-connector](/components/twingate-connector/) - Deploys a Twingate Connector for Zero Trust access access to your resources via the Twingate client app. This is a good option: it's very easy to set up and relatively cheap.
 * - [vpc](/components/vpn/) - This sets up an AWS Client VPN endpoint that you can connect to via any OpenVPN client. This provides a way to provision a VPN for access to private resources without any third-party services. However, **this option is quite expensive**. See the [costs](/components/vpn#costs) for the VPN component for details.
 *
 * ## Related Components
 *
 * VPCs provide the networking foundation for other Stackattack components:
 * - [cluster](/components/cluster/) - Requires VPC networking for ECS instances
 * - [service](/components/service/) - Runs in VPC private subnets
 * - [database](/components/database/) - Deployed in VPC private subnets for security
 * - [load-balancer](/components/load-balancer/) - Uses VPC public subnets for internet access
 * - [redis](/components/redis/) - Deployed in VPC private subnets
 *
 * ## Costs
 *
 * VPC core resources are **free**, but associated components incur charges:
 *
 * - **VPC, subnets, route tables, security groups** - No charge for the basic networking infrastructure.
 *
 * - **NAT Gateway** - Stackattack creates NAT Gateway(s) for private subnets (~$45/month + $0.045/GB processed apiece). This enables private subnet instances to access the internet while remaining inaccessible from the internet. If you pass `nat: "multi"` one NAT gateway per private subnet will be created, whereas if you pass `nat: "single"` only one will be created for all private subnets. Passing `nat: "none"` will not create a NAT gateway, but resources in your private subnets will not have access to the public internet.
 *
 * - **Public IP addresses** - Each public IP address costs ~$3.60/month. One public IP address is allocated per NAT gateway.
 *
 * - **Internet Gateway** - Free for the gateway itself, but data transfer charges apply (~$0.09/GB out to internet).
 *
 * - **Instance Connect Endpoints** - Stackattack creates these for secure SSH access (~$3.60/month per endpoint + $0.10/hour when in use).
 *
 * - **VPC Flow Logs** - If enabled, logs cost ~$0.50/GB stored in CloudWatch Logs. Can generate significant data if traffic is high.
 *
 * Cost optimization strategies:
 * - NAT gateways are typically the largest driver of cost (though usage-based charges can eclipse them based on usag of course). For this reason, the default is to create only a single NAT gateway for all of your private subnets. Be aware that using `nat: "multi"` may lead to significantly higher costs (for the benefit of higher availability).
 * - Use the default `flowLogs: false` unless you need traffic analysis
 *
 * See [VPC Pricing](https://aws.amazon.com/vpc/pricing/) for current rates.
 */

import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";
import type { Context } from "../context.js";
import { serviceAssumeRolePolicy } from "../policies.js";
import { getLogGroupId, type LogGroupInput } from "./logs.js";

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

/** Input parameters for s3GatewayEndpoint */
export interface S3GatewayEndpointArgs {
  /** The target VPC to create subnets in */
  vpc: pulumi.Input<VpcInput>;
  /** ID of the private route table to associate the endpoint with */
  privateRouteTableId: pulumi.Input<string>;
  /** Do not add a prefix to the context */
  noPrefix?: boolean;
}

/**
 * Create an S3 Gateway VPC endpoint to connect to S3 within a VPC without going through the public internet
 * @param ctx - The context for resource naming and tagging
 * @param args - Gateway route configuration arguments
 * @returns VPC endpoint object
 */
export function s3GatewayEndpoint(ctx: Context, args: S3GatewayEndpointArgs) {
  if (!args.noPrefix) {
    ctx = ctx.prefix("s3-endpoint");
  }

  const vpcId = getVpcId(args.vpc);

  const region = aws.getRegionOutput();

  return new aws.ec2.VpcEndpoint(ctx.id(), {
    serviceName: pulumi.interpolate`com.amazonaws.${region.name}.s3`,
    vpcId,
    autoAccept: true,
    routeTableIds: [args.privateRouteTableId],
    tags: { ...ctx.tags(), Name: ctx.id() },
  });
}

/** Input parameters for ec2InstanceConnectEndpoint */
export interface EC2InstanceConnectEndpoint {
  /** ID of the private subnet to associate the endpoint with. You will still be able to access resources in other subnets (so long as your other configuration allows it; it does by default if you used Stackattack components to create your vpc) */
  subnetId: pulumi.Input<string>;
  /** Do not add a prefix to the context */
  noPrefix?: boolean;
}

/**
 * Create an EC2 instance connect endpoint for SSH access to instances without public IP addresses
 * @param ctx - The context for resource naming and tagging
 * @param args - Endpoint configuration parameters
 * @returns Instance connect endpoint object
 */
export function ec2InstanceConnectEndpoint(
  ctx: Context,
  args: EC2InstanceConnectEndpoint,
) {
  if (!args.noPrefix) {
    ctx = ctx.prefix("ec2-instance-connect-endpoint");
  }

  return new aws.ec2transitgateway.InstanceConnectEndpoint(ctx.id(), {
    subnetId: args.subnetId,
    tags: { ...ctx.tags(), Name: ctx.id() },
  });
}

export interface SubnetsArgs {
  /** The target VPC to create subnets in */
  vpc: pulumi.Input<VpcInput>;
  /** CIDR allocator for getting new cidrs */
  cidrAllocator: CidrAllocator;
  /** Whether to create a NAT gateway or not; `single` (the default) creates a single NAT gateway in the first subnet in your VPC. `multi` creates a NAT gateway per subnet for high availability. `none` does not create any NAT gateways. */
  nat?: "single" | "none" | "multi";
  /** By default, s3 gateway endpoint(s) will be created for internal access to S3. Passing true disables this behavior. Otherwise, one S3 endpoint will be created per private route table--so one if you're using `nat: "single"` or `nat: "none"` (default), or one per AZ if you're using `nat: "multi"` */
  noS3Endpoints?: boolean;
  /** Availability zone input; see [availabilityZones](#availabilityZones) for details on behavior */
  availabilityZones?: number | pulumi.Input<string>[];
  /** Indicate the netmask to use for subnets, which defines how many IP addresses are available. Defaults to 20 (4096 IP addresses available per subnet) */
  subnetMask?: number;
  /** Do not add a prefix to the context */
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

  const nat = args.nat ?? "single";
  let privateRouteTableId: pulumi.Output<string> | null = null;
  if (nat !== "multi") {
    const privateRouteTable = new aws.ec2.RouteTable(
      ctx.id("private-route-table"),
      {
        vpcId,
        tags: { ...ctx.tags(), Name: ctx.id("private-route-table") },
      },
    );

    if (!args.noS3Endpoints) {
      s3GatewayEndpoint(ctx, {
        vpc: vpcId,
        privateRouteTableId: privateRouteTable.id,
      });
    }

    privateRouteTableId = privateRouteTable.id;
  }

  const subnetMask = args.subnetMask ?? 20;

  let idx = 0;
  for (const zoneId of availabilityZones(args.availabilityZones ?? 2)) {
    const privateCidr = args.cidrAllocator.allocate(subnetMask);
    const publicCidr = args.cidrAllocator.allocate(subnetMask);

    const publicSubnet = new aws.ec2.Subnet(ctx.id(`public-${idx}`), {
      vpcId,
      cidrBlock: publicCidr,
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

    const privateSubnet = new aws.ec2.Subnet(ctx.id(`private-${idx}`), {
      vpcId,
      cidrBlock: privateCidr,
      availabilityZone: zoneId,
      tags: { ...ctx.tags(), Name: ctx.id(`private-${idx}`) },
    });
    privateSubnetIds.push(privateSubnet.id);

    let zonePrivateRouteTableId = privateRouteTableId;
    if (zonePrivateRouteTableId === null) {
      const elasticIp = new aws.ec2.Eip(ctx.id(`nat-ip-${idx}`), {
        tags: { ...ctx.tags(), Name: ctx.id(`nat-ip-${idx}`) },
      });

      const natGateway = new aws.ec2.NatGateway(ctx.id(`nat-gateway-${idx}`), {
        allocationId: elasticIp.id,
        subnetId: publicSubnet.id,
        tags: { ...ctx.tags(), Name: ctx.id(`nat-gateway-${idx}`) },
      });

      const privateRouteTable = new aws.ec2.RouteTable(
        ctx.id(`private-route-table-${idx}`),
        {
          vpcId,
          tags: { ...ctx.tags(), Name: ctx.id(`private-route-table-${idx}`) },
        },
      );

      if (!args?.noS3Endpoints) {
        s3GatewayEndpoint(ctx.prefix(`gateway-endpoint-${idx}`), {
          vpc: vpcId,
          privateRouteTableId: privateRouteTable.id,
          noPrefix: true,
        });
      }

      new aws.ec2.Route(ctx.id(`nat-route-${idx}`), {
        routeTableId: privateRouteTable.id,
        destinationCidrBlock: "0.0.0.0/0",
        natGatewayId: natGateway.id,
      });

      zonePrivateRouteTableId = privateRouteTable.id;
    }

    new aws.ec2.RouteTableAssociation(
      ctx.id(`private-route-table-association-${idx}`),
      {
        routeTableId: zonePrivateRouteTableId,
        subnetId: privateSubnet.id,
      },
    );

    idx++;
  }

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
      routeTableId: privateRouteTableId!,
      destinationCidrBlock: "0.0.0.0/0",
      natGatewayId: natGateway.id,
    });
  }

  return {
    publicSubnetIds,
    privateSubnetIds,
  };
}

/** Get an array of availability zones based on either a number or an array of either full AZ names (us-east-1a, us-west-2b, etc.) or just a single letter (a, b, etc.). If a number is provided, it will return the first N availability zones in the current region. */
export function availabilityZones(
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

  return new aws.ec2.FlowLog(ctx.id(), {
    iamRoleArn: role.arn,
    logDestination: logGroup.arn,
    trafficType: "ALL",
    vpcId: getVpcId(args.vpc),
    tags: ctx.tags(),
  });
}

/** Input properties for the vpc component */
export interface VpcArgs
  extends Pick<
    SubnetsArgs,
    "nat" | "noS3Endpoints" | "subnetMask" | "availabilityZones"
  > {
  /** Provide a CIDR block that defines the range of addresses for your VPC. Defaults to 10.0.0.0/16 if not provided. See https://docs.aws.amazon.com/vpc/latest/userguide/vpc-cidr-blocks.html for details */
  cidrBlock?: pulumi.Input<string>;
  /** Indicate whether VPC Flow Logs should be enabled */
  flowLogs?: boolean;
  /** By default, an EC2 Instance Connect endpoint will be created for SSH access to EC2 instances without a public IP address. Passing true disables this behavior. */
  noInstanceConnectEndpoint?: boolean;
  /** By default, VPCs are created with protect: true, which prevent accidental deletion. To disable this behavior, pass `true`. */
  noProtect?: boolean;
  /** Do not add a name prefix to the context */
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

export interface VpcOutput {
  /** The created VPC object */
  vpc: aws.ec2.Vpc;
  /** The public subnet IDs created in the VPC */
  publicSubnetIds: pulumi.Output<string>[];
  /** The private subnet IDs created in the VPC */
  privateSubnetIds: pulumi.Output<string>[];
  /** Method to get a `Network`, which is a VPC and a set of subnets. `type` should be "public" to choose public subnet IDs, and "private" to choose private ones. You can optionally pass a number of `azs` to limit the number of availability zones that you want to include subnets from */
  network: (type: NetworkType, azs?: number) => Network;
  /** The `cidrAllocator` provides a way to allocate new CIDR blocks within the vpc for subnets or other purposes, given a netmask. */
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

  const allocator = cidrAllocator(cidrBlock);

  let publicSubnetIds: pulumi.Output<string>[] = [];
  let privateSubnetIds: pulumi.Output<string>[] = [];
  const zones = availabilityZones(args?.availabilityZones ?? 2);
  if (zones.length > 0) {
    const results = subnets(ctx, {
      vpc,
      cidrAllocator: allocator,
      availabilityZones: zones,
      subnetMask: args?.subnetMask,
      nat: args?.nat,
      noS3Endpoints: args?.noS3Endpoints,
    });
    publicSubnetIds = results.publicSubnetIds;
    privateSubnetIds = results.privateSubnetIds;
  }

  if (args?.flowLogs) {
    vpcFlowLogs(ctx, { vpc });
  }

  if (!args?.noInstanceConnectEndpoint && privateSubnetIds.length > 0) {
    ec2InstanceConnectEndpoint(ctx, { subnetId: privateSubnetIds[0] });
  }

  return {
    vpc,
    publicSubnetIds,
    privateSubnetIds,
    cidrAllocator: allocator,
    network: (type, azs) => {
      const subnetIds = type === "private" ? privateSubnetIds : publicSubnetIds;

      return {
        vpc,
        subnetIds: azs === undefined ? subnetIds : subnetIds.slice(0, azs),
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
    network: (type: NetworkType, azs?: number) => {
      const subnetIds =
        type === "private" ? vpc.privateSubnetIds : vpc.publicSubnetIds;

      return {
        vpc: attrs,
        subnetIds:
          azs === undefined
            ? subnetIds
            : subnetIds.apply((ids) => ids.slice(0, azs)),
      };
    },
  };
}
