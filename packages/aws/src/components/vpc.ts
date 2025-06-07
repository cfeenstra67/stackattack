import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";
import { Context } from "../context.js";
import { serviceAssumeRolePolicy } from "../policies.js";
import { LogGroupInput, getLogGroupId } from "./logs.js";

export type VpcInput = string | aws.ec2.Vpc | aws.ec2.GetVpcResult | VpcOutput;

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

export interface InternetGatewayArgs {
  vpc: pulumi.Input<VpcInput>;
  noPrefix?: boolean;
}

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
  noPrefix?: boolean;
}

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

  let idx = 0;
  for (const zoneId of availabilityZones(args.availabilityZones)) {
    const privateSubnet = new aws.ec2.Subnet(ctx.id(`private-${idx}`), {
      vpcId,
      cidrBlock: args.cidrAllocator.allocate(24),
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
    const elasticIp = new aws.ec2.Eip(ctx.id("nat-ip"));

    const natGateway = new aws.ec2.NatGateway(ctx.id("nat-gateway"), {
      allocationId: elasticIp.id,
      subnetId: publicSubnetIds[0],
      tags: ctx.tags(),
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

export interface CidrAllocator {
  allocate: (netmask: number) => pulumi.Output<string>;
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

export function getVpcDnsServer(
  cidrBlock: pulumi.Input<string>,
): pulumi.Output<string> {
  return pulumi.output(cidrBlock).apply((block) => {
    const parsedCidr = parseCidrBlock(block);
    return numberToIp(parsedCidr.ip + 2);
  });
}

export interface VPCFlowLogsRoleArgs {
  logGroup: LogGroupInput;
  noPrefix?: boolean;
}

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

export interface VPCFlowLogsArgs {
  vpc: VpcInput;
  noPrefix?: boolean;
}

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

interface VpcArgs {
  // https://docs.aws.amazon.com/vpc/latest/userguide/vpc-cidr-blocks.html
  cidrBlock?: pulumi.Input<string>;
  availabilityZones?: number | string[];
  flowLogs?: boolean;
  noProtect?: boolean;
  noPrefix?: boolean;
}

export interface Network {
  vpc: aws.ec2.Vpc;
  subnetIds: pulumi.Output<string>[];
}

export interface NetworkInput {
  vpc: pulumi.Input<VpcInput>;
  subnetIds: pulumi.Input<pulumi.Input<string>[]>;
}

export type NetworkType = "public" | "private";

interface VpcOutput {
  vpc: aws.ec2.Vpc;
  publicSubnetIds: pulumi.Output<string>[];
  privateSubnetIds: pulumi.Output<string>[];
  network: (type: NetworkType) => Network;
  cidrAllocator: CidrAllocator;
}

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
  const zones = availabilityZones(args?.availabilityZones ?? 2);
  if (zones.length > 0) {
    const results = subnets(ctx, {
      vpc,
      cidrAllocator: allocator,
      availabilityZones: zones,
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

export interface VpcIds {
  vpc: pulumi.Output<string>;
  publicSubnetIds: pulumi.Output<string>[];
  privateSubnetIds: pulumi.Output<string>[];
  counter: pulumi.Output<number>;
}

export function vpcToIds(vpc: VpcOutput): VpcIds {
  return {
    vpc: vpc.vpc.id,
    publicSubnetIds: vpc.publicSubnetIds,
    privateSubnetIds: vpc.privateSubnetIds,
    counter: vpc.cidrAllocator.counter(),
  };
}

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
