/**
 * @packageDocumentation
 *
 * ECS clusters in AWS provide compute capacity for running containerized applications. Stackattack's `cluster` component provides an easy way to set up working ECS clusters for running applications on EC2 instances with auto-scaling and private inter-service communication.
 *
 * Stackattack creates ECS clusters with:
 * - EC2 instances used for compute. By default, the configuration will use spot instances. Pass `noSpot: true` to disable spot instances, or `onDemandPercentage` with a percentage value to split your EC2 instances between on demand and spot. The number of instances will always match the requirements of your cluster (within the constraints you set via `minSize` (default 0) and `maxSize` (default 1)). Currently Fargate is not supported.
 * - A private DNS namespace is created so that your services can communicate internally via ECS service discovery. ECS service connect is currently not supported.
 *
 * ```typescript
 * import * as saws from "@stackattack/aws";
 *
 * const ctx = saws.context();
 * const vpc = saws.vpc(ctx);
 * const compute = saws.cluster(ctx, { network: vpc.network("private") });
 *
 * export const clusterName = compute.cluster.name;
 * ```
 *
 * ## Usage
 *
 * After deploying a cluster, you can deploy [services](/components/service/) into it to run code in docker containers.
 *
 * **SSH Access to EC2 Instances:**
 * _NOTE_: if your instances are within a private subnet (as is likely the case), you need a way to access your instances. If you created your vpc with the [vpc](/components/vpc/) component, an EC2 instance connect endpoint is set up automatically.
 *
 * ```bash
 * # Connect to an instance using Instance Connect (no key pairs needed)
 * aws ec2-instance-connect ssh --instance-id i-1234567890abcdef0 --region us-east-1
 * # If you do not have an EC2 instance connect endpoint but have direct access to your instance (e.g. via a VPN), pass --connection-type direct
 * aws ec2-instance-connect ssh --instance-id i-1234567890abcdef0 --region us-east-1 --connection-type direct
 * ```
 *
 * ## Related Components
 *
 * Clusters work together with other Stackattack components:
 * - [vpc](/components/vpc/) - Provides networking foundation with private/public subnets
 * - [service](/components/service/) - Runs containerized applications on the cluster
 * - [load-balancer](/components/load-balancer/) - Routes external traffic to services on the cluster
 *
 * ## Costs
 *
 * ECS cluster costs depend on the underlying EC2 instances and are **usage-based**:
 *
 * - **EC2 instances** - This will depend on your configuration. Your auto-scaling cluster will scale up and down based on the desired capacity of the services you have deployed, meaning instances will be terminated if they are unused and created as you deploy and scale your services. By default Stackattack will use spot instances with an ARM architecture, 1-2 CPUs, 2-4 GB of memory, and a 2:1 memory:cpu ratio (this uses a [mixed instances policy](https://docs.aws.amazon.com/autoscaling/ec2/userguide/ec2-auto-scaling-mixed-instances-groups.html) so the specific instance type(s) that will be launched is not known. This allows for greater availability of spot instances, as it does not rely as much on the capacity of any one specific instance type ). This can be configured with the `instances` parameter. See the [Spot Instance Pricing](https://aws.amazon.com/ec2/spot/pricing/) documentation for specific figures.
 *
 * - **EBS storage** - Each instance gets 25GB of storage by default (~$2/month per instance). Block devices are deleted when instances are terminated.
 *
 * - **Data transfer** - Service-to-service communication within the VPC is free. External data transfer follows standard AWS rates (~$0.09/GB out).
 *
 * - **Service Discovery** - The private DNS namespace is free.
 *
 * Cost optimization strategies:
 * - Use spot instances for non-critical workloads (up to 90% savings)
 * - Enable cluster auto-scaling to scale to zero during low usage
 * - Monitor instance utilization and rightsize instance types
 * - Use [service](/components/service/) placement strategies to maximize instance utilization
 *
 * See [EC2 Pricing](https://aws.amazon.com/ec2/pricing/) for current rates.
 */

import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";
import type { Context } from "../context.js";
import { getEc2InstanceConnectCidr } from "../functions/ec2-instance-connect-cidr.js";
import { serviceAssumeRolePolicy } from "../policies.js";
import { shortId } from "../short-id.js";
import {
  getVpcAttributes,
  getVpcDefaultSecurityGroup,
  getVpcId,
  type NetworkInput,
  type VpcInput,
} from "./vpc.js";

/**
 * Union type representing different ways to specify an ECS cluster.
 * Can be a cluster name (string), an actual Cluster resource, cluster data, or cluster output.
 */
export type ClusterInput =
  | string
  | aws.ecs.Cluster
  | aws.ecs.GetClusterResult
  | ClusterOutput;

/**
 * Extracts the cluster ID from a ClusterInput.
 * @param input - The cluster input to extract the ID from
 * @returns The cluster ID as a Pulumi Output
 */
export function getClusterId(
  input: pulumi.Input<ClusterInput>,
): pulumi.Output<string> {
  return pulumi.output(input).apply((value) => {
    if (typeof value === "string") {
      return pulumi.output(value);
    }
    if ("cluster" in value) {
      return value.cluster.id;
    }
    return pulumi.output(value.id);
  });
}

/**
 * Retrieves the full cluster attributes from a ClusterInput.
 * @param input - The cluster input to get attributes from
 * @returns The cluster attributes as a Pulumi Output
 */
export function getClusterAttributes(
  input: pulumi.Input<ClusterInput>,
): pulumi.Output<aws.ecs.Cluster | aws.ecs.GetClusterResult> {
  return pulumi.output(input).apply((value) => {
    if (typeof value === "string") {
      return aws.ecs.getClusterOutput({
        clusterName: value,
      });
    }
    if ("cluster" in value) {
      return pulumi.output(value.cluster);
    }
    return pulumi.output(value);
  });
}

/**
 * Union type representing different ways to specify an ECS capacity provider.
 * Can be a capacity provider name (string) or an actual CapacityProvider resource.
 */
export type CapacityProviderInput = string | aws.ecs.CapacityProvider;

/**
 * Extracts the capacity provider ID from a CapacityProviderInput.
 * @param input - The capacity provider input to extract the ID from
 * @returns The capacity provider ID as a Pulumi Output
 */
export function getCapacityProviderId(
  input: pulumi.Input<CapacityProviderInput>,
): pulumi.Output<string> {
  return pulumi.output(input).apply((value) => {
    if (typeof value === "string" && value.startsWith("arn:")) {
      return pulumi.output(value.split("/").at(-1)!);
    }
    if (typeof value === "string") {
      return pulumi.output(value);
    }
    return value.name;
  });
}

/**
 * Union type representing different ways to specify an HTTP namespace.
 * Can be a namespace name (string), an actual HttpNamespace resource, or namespace data.
 */
export type HttpNamespaceInput =
  | string
  | aws.servicediscovery.HttpNamespace
  | aws.servicediscovery.GetHttpNamespaceResult;

/**
 * Extracts the HTTP namespace ID from an HttpNamespaceInput.
 * @param input - The HTTP namespace input to extract the ID from
 * @returns The HTTP namespace ARN as a Pulumi Output
 */
export function getHttpNamespaceId(
  input: pulumi.Input<HttpNamespaceInput>,
): pulumi.Output<string> {
  return pulumi.output(input).apply((value) => {
    if (typeof value === "string") {
      return pulumi.output(value);
    }
    return pulumi.output(value.arn);
  });
}

/**
 * Union type representing different ways to specify a private DNS namespace.
 * Can be a namespace name (string) or an actual PrivateDnsNamespace resource.
 */
export type PrivateDnsNamespaceInput =
  | string
  | aws.servicediscovery.PrivateDnsNamespace;

/**
 * Extracts the private DNS namespace ID from a PrivateDnsNamespaceInput.
 * @param input - The private DNS namespace input to extract the ID from
 * @returns The private DNS namespace name as a Pulumi Output
 */
export function getPrivateDnsNamespaceId(
  input: pulumi.Input<PrivateDnsNamespaceInput>,
): pulumi.Output<string> {
  return pulumi.output(input).apply((value) => {
    if (typeof value === "string") {
      return pulumi.output(value);
    }
    return pulumi.output(value.name);
  });
}

/**
 * Retrieves the full private DNS namespace attributes from a PrivateDnsNamespaceInput.
 * @param input - The private DNS namespace input to get attributes from
 * @returns The private DNS namespace attributes as a Pulumi Output
 */
export function getPrivateDnsNamespaceAttributes(
  input: pulumi.Input<PrivateDnsNamespaceInput>,
): pulumi.Output<
  | aws.servicediscovery.PrivateDnsNamespace
  | aws.servicediscovery.GetDnsNamespaceResult
> {
  return pulumi.output(input).apply(async (value) => {
    if (typeof value === "string") {
      return await aws.servicediscovery.getDnsNamespace({
        name: value,
        type: "DNS_PRIVATE",
      });
    }
    return value;
  });
}

/**
 * Arguments for creating a cluster instance role.
 */
export interface ClusterInstanceRoleArgs {
  /** Whether to skip adding a prefix to the resource name */
  noPrefix?: boolean;
}

/**
 * Creates an IAM role for ECS cluster instances with necessary policies attached.
 * @param baseCtx - The context for resource naming and tagging
 * @param args - Optional arguments for role configuration
 * @returns The created IAM role
 */
export function clusterInstanceRole(
  baseCtx: Context,
  args?: ClusterInstanceRoleArgs,
) {
  const ctx = args?.noPrefix ? baseCtx : baseCtx.prefix("instance-role");

  const ecsInstanceRole = new aws.iam.Role(ctx.id(), {
    // Name prefixes can be at most 38 characters
    namePrefix: shortId(baseCtx, "instance-role", 38),
    assumeRolePolicy: serviceAssumeRolePolicy("ec2").json,
    tags: ctx.tags(),
  });
  new aws.iam.RolePolicyAttachment(ctx.id("container-policy-attachment"), {
    role: ecsInstanceRole.name,
    policyArn:
      "arn:aws:iam::aws:policy/service-role/AmazonEC2ContainerServiceforEC2Role",
  });
  new aws.iam.RolePolicyAttachment(ctx.id("ssm-policy-attachment"), {
    role: ecsInstanceRole.name,
    policyArn: "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore",
  });
  new aws.iam.RolePolicyAttachment(ctx.id("cloudwatch-agent-policy-attach"), {
    role: ecsInstanceRole.name,
    policyArn: "arn:aws:iam::aws:policy/CloudWatchAgentServerPolicy",
  });
  return ecsInstanceRole;
}

/**
 * Gets the architecture (e.g., x86_64, arm64) for a given EC2 instance type.
 * @param instanceType - The EC2 instance type to get the architecture for
 * @returns The architecture as a Pulumi Output
 */
export function getInstanceTypeArchitecture(
  instanceType: pulumi.Input<string>,
): pulumi.Output<string> {
  const instanceTypeDetails = aws.ec2.getInstanceTypeOutput({
    instanceType,
  });

  return instanceTypeDetails.supportedArchitectures[0];
}

function cloudwatchAgentConfig() {
  return JSON.stringify({
    metrics: {
      append_dimensions: {
        InstanceId: "${aws:InstanceId}",
        AutoScalingGroupName: "${aws:AutoScalingGroupName}",
      },
      metrics_collected: {
        mem: {
          metrics_collection_interval: 60,
          measurement: ["mem_used_percent"],
        },
        disk: {
          metrics_collection_interval: 60,
          resources: ["/"],
          measurement: ["used_percent"],
        },
        cpu: {
          totalcpu: true,
          metrics_collection_interval: 60,
          measurement: ["cpu_usage_active"],
        },
      },
      aggregation_dimensions: [["InstanceId"], ["AutoScalingGroupName"]],
    },
    agent: {
      metrics_collection_interval: 60,
      run_as_user: "root",
    },
  });
}

/**
 * Arguments for creating a cluster security group.
 */
export interface ClusterSecurityGroupArgs {
  /** The VPC to create the security group in */
  vpc: pulumi.Input<VpcInput>;
  /** Source security group ID to allow access from (defaults to VPC default security group) */
  sourceSecurityGroupId?: pulumi.Input<string>;
  /** Indicate whether the instances should be configured to allow SSH traffic from EC2 instance connect */
  noInstanceConnect?: boolean;
  /** Whether to skip adding a prefix to the resource name */
  noPrefix?: boolean;
}

/**
 * Creates a security group for cluster instances with SSH access and full egress.
 * @param ctx - The context for resource naming and tagging
 * @param args - Arguments for security group configuration
 * @returns The created security group
 */
export function clusterSecurityGroup(
  ctx: Context,
  args: ClusterSecurityGroupArgs,
) {
  if (!args.noPrefix) {
    ctx = ctx.prefix("security-group");
  }
  const group = new aws.ec2.SecurityGroup(ctx.id(), {
    description: "Allow SSH access, all egress",
    vpcId: getVpcId(args.vpc),
    tags: ctx.tags(),
  });

  const vpcAttrs = getVpcAttributes(args.vpc);

  let sourceSecurityGroupId: pulumi.Input<string>;
  if (args.sourceSecurityGroupId) {
    sourceSecurityGroupId = args.sourceSecurityGroupId;
  } else {
    const defaultSecurityGroup = getVpcDefaultSecurityGroup(vpcAttrs.id);
    sourceSecurityGroupId = defaultSecurityGroup.id;
  }

  new aws.ec2.SecurityGroupRule(
    ctx.id("ingress-ssh"),
    {
      type: "ingress",
      securityGroupId: group.id,
      protocol: "tcp",
      fromPort: 22,
      toPort: 22,
      sourceSecurityGroupId,
    },
    {
      deleteBeforeReplace: true,
    },
  );

  if (!args.noInstanceConnect) {
    new aws.ec2.SecurityGroupRule(
      ctx.id("ingress-ec2-instance-connect"),
      {
        type: "ingress",
        securityGroupId: group.id,
        protocol: "-1",
        fromPort: 0,
        toPort: 0,
        cidrBlocks: [getEc2InstanceConnectCidr()],
      },
      {
        deleteBeforeReplace: true,
      },
    );
  }

  new aws.ec2.SecurityGroupRule(
    ctx.id("egress"),
    {
      type: "egress",
      securityGroupId: group.id,
      protocol: "-1",
      fromPort: 0,
      toPort: 0,
      cidrBlocks: ["0.0.0.0/0"],
      ipv6CidrBlocks: ["::/0"],
    },
    {
      deleteBeforeReplace: true,
    },
  );

  return group;
}

/**
 * Arguments for generating a cluster instance initialization script.
 */
export interface ClusterInstanceInitScriptArgs {
  /** The ECS cluster to join */
  cluster: pulumi.Input<ClusterInput>;
  /** Name of the SSM parameter containing CloudWatch agent configuration */
  paramName: pulumi.Input<string>;
}

/**
 * Generates a bash initialization script for ECS cluster instances.
 * @param args - Arguments containing cluster and parameter information
 * @returns The initialization script as a Pulumi Output
 */
export function clusterInstanceInitScript({
  cluster,
  paramName,
}: ClusterInstanceInitScriptArgs): pulumi.Output<string> {
  const clusterId = getClusterId(cluster);

  return pulumi.interpolate`#!/bin/bash
set -eo pipefail

# Always do this first--otherwise this instance won't join the cluster at all
cat >> /etc/ecs/ecs.config <<EOF
ECS_CLUSTER=${clusterId}
ECS_ENABLE_CONTAINER_METADATA=true
ECS_ENABLE_SPOT_INSTANCE_DRAINING=true
EOF

sudo yum install -y ec2-instance-connect
sudo yum install -y amazon-cloudwatch-agent

sudo /opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl -a fetch-config -m ec2 -s -c ssm:${paramName}`;
}

/**
 * Configuration for using a specific EC2 instance type.
 */
export interface ClusterInstanceTypeConfig {
  /** The specific EC2 instance type to use */
  type: pulumi.Input<string>;
}

/**
 * Configuration for using instance requirements instead of specific instance types.
 */
export interface ClusterRequirementsConfig
  extends aws.types.input.ec2.LaunchTemplateInstanceRequirements {
  /** The CPU architecture (e.g., x86_64, arm64) */
  architecture: pulumi.Input<string>;
  /** Whether to allow instance types that don't support ENI trunking */
  allowNoEniTrunking?: boolean;
}

/**
 * Union type for cluster instance configuration.
 * Can specify either a specific instance type or instance requirements.
 */
type ClusterInstancesConfig =
  | ClusterInstanceTypeConfig
  | ClusterRequirementsConfig;

/**
 * Configuration for cluster capacity and scaling behavior.
 */
export interface ClusterCapacityConfig {
  /** Instance configuration (type or requirements) */
  instances?: ClusterInstancesConfig;
  /** Whether to disable spot instances */
  noSpot?: boolean;
  /** Number of on-demand instances to maintain as base capacity */
  onDemandBase?: number;
  /** Percentage of on-demand instances above base capacity */
  onDemandPercentage?: number;
  /** Strategy for allocating spot instances */
  spotAllocationStrategy?: string;
  /** Security group ID that should be allowed SSH access to the instances */
  sourceSecurityGroupId?: pulumi.Input<string>;
  /** Minimum number of instances in the auto scaling group; defaults to 0 */
  minSize?: pulumi.Input<number>;
  /** Maximum number of instances in the auto scaling group; defaults to `minSize` unless `minSize` is 0, then it defaults to 1 */
  maxSize?: pulumi.Input<number>;
  /** Size of the root disk in GB */
  diskSize?: number;
  /** Whether to skip adding a prefix to resource names */
  noPrefix?: boolean;
}

/**
 * Arguments for creating cluster capacity including network and cluster references.
 */
export interface ClusterCapacityArgs extends ClusterCapacityConfig {
  /** Network configuration for the cluster */
  network: NetworkInput;
  /** The ECS cluster to create capacity for */
  cluster: pulumi.Input<ClusterInput>;
}

// Manually fetched from: https://docs.aws.amazon.com/AmazonECS/latest/developerguide/eni-trunking-supported-instance-types.html
const nonEniTrunkingCompatibleInstanceTypes = [
  "a1.metal",
  "c5.metal",
  "c5a.8xlarge",
  "c5ad.8xlarge",
  "c5d.metal",
  "m5.metal",
  "p3dn.24xlarge",
  "r5.metal",
  "r5.8xlarge",
  "c5n.*",
  "d3.*",
  "d3en.*",
  "g3.*",
  "g3s.*",
  "g4dn.*",
  "i3.*",
  "i3en.*",
  "inf1.*",
  "m5dn.*",
  "m5n.*",
  "m5zn.*",
  "mac1.*",
  "r5b.*",
  "r5n.*",
  "r5dn.*",
  "u-12tb1.*",
  "u-6tb1.*",
  "u-9tb1.*",
  "z1d.*",
];

/**
 * Creates ECS cluster capacity including auto scaling group and capacity provider.
 * @param ctx - The context for resource naming and tagging
 * @param args - Arguments for capacity configuration
 * @returns Object containing the capacity provider and auto scaling group
 */
export function clusterCapacity(ctx: Context, args: ClusterCapacityArgs) {
  if (!args?.noPrefix) {
    ctx = ctx.prefix("capacity");
  }

  const instances = args.instances ?? {
    architecture: "arm64",
    memoryMib: { min: 2048, max: 4096 },
    vcpuCount: { min: 1, max: 2 },
    memoryGibPerVcpu: { min: 2, max: 2 },
  };

  let architecture: pulumi.Input<string>;
  let instanceType: pulumi.Input<string> | undefined;
  let instanceRequirements:
    | aws.types.input.ec2.LaunchTemplateInstanceRequirements
    | undefined;
  if ("type" in instances) {
    instanceType = instances.type;
    architecture = getInstanceTypeArchitecture(instances.type);
  } else {
    const {
      architecture: arch,
      allowNoEniTrunking,
      ...requirements
    } = instances;
    architecture = arch;
    if (!allowNoEniTrunking) {
      if (requirements.excludedInstanceTypes) {
        requirements.excludedInstanceTypes = pulumi
          .output(requirements.excludedInstanceTypes)
          .apply((types) => {
            return types.concat(nonEniTrunkingCompatibleInstanceTypes);
          });
      } else {
        requirements.excludedInstanceTypes =
          nonEniTrunkingCompatibleInstanceTypes;
      }
    }
    instanceRequirements = requirements;
  }

  const cluster = getClusterAttributes(args.cluster);

  const ami = aws.ec2.getAmiOutput({
    mostRecent: true,
    owners: ["amazon"],
    filters: [
      {
        name: "name",
        values: [pulumi.interpolate`amzn2-ami-ecs-hvm-*-${architecture}-*`],
      },
    ],
  });

  const cloudWatchConfigParam = new aws.ssm.Parameter(
    ctx.id("cloudwatch-config"),
    {
      type: "String",
      value: cloudwatchAgentConfig(),
      tags: ctx.tags(),
    },
  );

  const securityGroup = clusterSecurityGroup(ctx, {
    vpc: args.network.vpc,
    sourceSecurityGroupId: args.sourceSecurityGroupId,
  });

  const instanceRole = clusterInstanceRole(ctx);

  const profile = new aws.iam.InstanceProfile(ctx.id("instance-profile"), {
    role: instanceRole,
    tags: ctx.tags(),
  });

  const initScript = clusterInstanceInitScript({
    cluster: cluster.id,
    paramName: cloudWatchConfigParam.name,
  });

  const launchTemplate = new aws.ec2.LaunchTemplate(
    ctx.id("launch-template"),
    {
      imageId: ami.id,
      instanceType,
      instanceRequirements,
      iamInstanceProfile: {
        arn: profile.arn,
      },
      userData: initScript.apply((s) => Buffer.from(s).toString("base64")),
      vpcSecurityGroupIds: [securityGroup.id],
      blockDeviceMappings: [
        {
          deviceName: ami.rootDeviceName,
          ebs: {
            deleteOnTermination: "true",
            encrypted: "true",
            volumeSize: args.diskSize ?? 30,
          },
        },
      ],
      metadataOptions: {
        httpEndpoint: "enabled",
        httpTokens: "required",
      },
      tags: ctx.tags(),
    },
    {
      ignoreChanges: ["imageId"],
    },
  );

  const sizes = pulumi.all([args.minSize, args.maxSize]).apply(([min, max]) => {
    if (min === undefined) {
      min = 0;
    }
    if (max === undefined) {
      max = min || 1;
    }
    return { min, max };
  });

  const autoScalingGroup = new aws.autoscaling.Group(
    ctx.id("auto-scaling"),
    {
      vpcZoneIdentifiers: args.network.subnetIds,
      minSize: sizes.min,
      maxSize: sizes.max,
      mixedInstancesPolicy: {
        instancesDistribution: {
          onDemandBaseCapacity: args.onDemandBase,
          onDemandPercentageAboveBaseCapacity: args.noSpot
            ? 100
            : (args.onDemandPercentage ?? 0),
          spotAllocationStrategy:
            args.spotAllocationStrategy ?? "capacity-optimized",
        },
        launchTemplate: {
          launchTemplateSpecification: {
            launchTemplateId: launchTemplate.id,
            version: "$Latest",
          },
        },
      },
      enabledMetrics: [
        "GroupMinSize",
        "GroupMaxSize",
        "GroupDesiredCapacity",
        "GroupPendingCapacity",
        "GroupPendingInstances",
        "GroupInServiceCapacity",
        "GroupInServiceInstances",
        "GroupTerminatingInstances",
      ],
      tags: [
        // ECS will always add this tag, adding it manually eliminates drift in plans
        {
          key: "AmazonECSManaged",
          value: "",
          propagateAtLaunch: true,
        },
      ].concat(
        Object.entries(ctx.tags()).map(([key, value]) => ({
          key,
          value,
          propagateAtLaunch: true,
        })),
      ),
    },
    {
      ignoreChanges: ["desiredCapacity"],
    },
  );

  const capacityProvider = new aws.ecs.CapacityProvider(ctx.id(), {
    autoScalingGroupProvider: {
      autoScalingGroupArn: autoScalingGroup.arn,
      managedTerminationProtection: "DISABLED",
      managedDraining: "ENABLED",
      managedScaling: {
        status: "ENABLED",
        targetCapacity: 100,
        instanceWarmupPeriod: 300,
        maximumScalingStepSize: 1,
        minimumScalingStepSize: 1,
      },
    },
    tags: ctx.tags(),
  });

  return { capacityProvider, autoScalingGroup };
}

/**
 * Arguments for creating a complete ECS cluster with capacity.
 */
export interface ClusterArgs extends ClusterCapacityConfig {
  /** Network configuration for the cluster */
  network: NetworkInput;
  /** Whether to skip adding a prefix to resource names */
  noPrefix?: boolean;
}

/**
 * Input interface for cluster resources.
 */
export interface ClusterResourcesInput {
  /** The ECS cluster */
  cluster: pulumi.Input<ClusterInput>;
  /** The capacity provider for the cluster */
  capacityProvider: pulumi.Input<CapacityProviderInput>;
  /** Optional private DNS namespace for service discovery */
  privateNamespace?: pulumi.Input<PrivateDnsNamespaceInput>;
}

/**
 * Output interface containing all cluster-related resources.
 */
export interface ClusterOutput extends ClusterResourcesInput {
  /** The ECS cluster resource */
  cluster: aws.ecs.Cluster;
  /** The capacity provider resource */
  capacityProvider: aws.ecs.CapacityProvider;
  /** The auto scaling group resource */
  autoScalingGroup: aws.autoscaling.Group;
  /** The private DNS namespace resource */
  privateNamespace: aws.servicediscovery.PrivateDnsNamespace;
}

/**
 * Interface containing the IDs of all cluster-related resources.
 */
export interface ClusterIds {
  /** The cluster ID */
  cluster: pulumi.Output<string>;
  /** The capacity provider name */
  capacityProvider: pulumi.Output<string>;
  /** The auto scaling group ID */
  autoScalingGroup: pulumi.Output<string>;
  /** The private namespace name */
  privateNamespace: pulumi.Output<string>;
}

/**
 * Converts a ClusterOutput to ClusterIds by extracting resource identifiers.
 * @param cluster - The cluster output containing all resources
 * @returns Object containing the IDs of all cluster resources
 */
export function clusterToIds(cluster: ClusterOutput): ClusterIds {
  return {
    cluster: cluster.cluster.id,
    capacityProvider: cluster.capacityProvider.name,
    autoScalingGroup: cluster.autoScalingGroup.id,
    privateNamespace: cluster.privateNamespace.name,
  };
}

/**
 * Creates a complete ECS cluster with capacity provider, auto scaling group, and private namespace.
 * @param ctx - The context for resource naming and tagging
 * @param args - Arguments for cluster configuration
 * @returns Object containing all created cluster resources
 */
export function cluster(ctx: Context, args: ClusterArgs): ClusterOutput {
  const { network, noPrefix, ...capacityArgs } = args;
  if (!noPrefix) {
    ctx = ctx.prefix("cluster");
  }

  const vpcTrunkingSetting = new aws.ecs.AccountSettingDefault(
    ctx.id("vpc-trunking-setting"),
    {
      name: "awsvpcTrunking",
      value: "enabled",
    },
  );

  const cluster = new aws.ecs.Cluster(
    ctx.id(),
    {
      tags: ctx.tags(),
    },
    { dependsOn: [vpcTrunkingSetting] },
  );

  const privateNamespace = new aws.servicediscovery.PrivateDnsNamespace(
    ctx.id("private-namespace"),
    {
      vpc: getVpcId(args.network.vpc),
      name: cluster.name,
      tags: ctx.tags(),
    },
    {
      deleteBeforeReplace: true,
    },
  );

  const capacity = clusterCapacity(ctx, {
    cluster,
    network,
    ...capacityArgs,
  });

  new aws.ecs.ClusterCapacityProviders(
    ctx.id("capacity-providers"),
    {
      clusterName: cluster.name,
      capacityProviders: [capacity.capacityProvider.name],
    },
    {
      dependsOn: [capacity.autoScalingGroup],
    },
  );

  return {
    cluster,
    capacityProvider: capacity.capacityProvider,
    autoScalingGroup: capacity.autoScalingGroup,
    privateNamespace,
  };
}
