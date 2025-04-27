import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";
import { Context } from "../context.js";
import { getEc2InstanceConnectCidr } from "../functions/ec2-instance-connect-cidr.js";
import { serviceAssumeRolePolicy } from "../policies.js";
import { NetworkInput, VpcInput, getVpcAttributes, getVpcId } from "./vpc.js";

export type ClusterInput =
  | string
  | aws.ecs.Cluster
  | aws.ecs.GetClusterResult
  | ClusterOutput;

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

export type CapacityProviderInput = string | aws.ecs.CapacityProvider;

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

export type HttpNamespaceInput =
  | string
  | aws.servicediscovery.HttpNamespace
  | aws.servicediscovery.GetHttpNamespaceResult;

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

export type PrivateDnsNamespaceInput =
  | string
  | aws.servicediscovery.PrivateDnsNamespace;

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

export interface ClusterInstanceRoleArgs {
  noPrefix?: boolean;
}

export function clusterInstanceRole(
  ctx: Context,
  args?: ClusterInstanceRoleArgs,
) {
  if (!args?.noPrefix) {
    ctx = ctx.prefix("instance-role");
  }
  const ecsInstanceRole = new aws.iam.Role(ctx.id(), {
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

export interface ClusterSecurityGroupArgs {
  vpc: pulumi.Input<VpcInput>;
  noPrefix?: boolean;
}

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

  const extraAccessCidrs: pulumi.Input<string>[] = [
    getEc2InstanceConnectCidr(),
    vpcAttrs.cidrBlock,
  ];
  new aws.ec2.SecurityGroupRule(
    ctx.id("ingress-ssh"),
    {
      type: "ingress",
      securityGroupId: group.id,
      protocol: "tcp",
      fromPort: 22,
      toPort: 22,
      cidrBlocks: extraAccessCidrs,
    },
    {
      deleteBeforeReplace: true,
    },
  );

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

export interface ClusterInstanceInitScriptArgs {
  cluster: pulumi.Input<ClusterInput>;
  paramName: pulumi.Input<string>;
}

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
EOF

sudo yum install -y ec2-instance-connect
sudo yum install -y amazon-cloudwatch-agent

sudo /opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl -a fetch-config -m ec2 -s -c ssm:${paramName}`;
}

export interface ClusterInstanceTypeConfig {
  type: pulumi.Input<string>;
}

export interface ClusterRequirementsConfig
  extends aws.types.input.ec2.LaunchTemplateInstanceRequirements {
  architecture: pulumi.Input<string>;
}

type ClusterInstancesConfig =
  | ClusterInstanceTypeConfig
  | ClusterRequirementsConfig;

export interface ClusterCapacityConfig {
  instances?: ClusterInstancesConfig;
  noSpot?: boolean;
  onDemandBase?: number;
  onDemandPercentage?: number;
  spotAllocationStrategy?: string;
  minSize?: pulumi.Input<number>;
  maxSize?: pulumi.Input<number>;
  diskSize?: number;
  noPrefix?: boolean;
}

export interface ClusterCapacityArgs extends ClusterCapacityConfig {
  network: NetworkInput;
  cluster: pulumi.Input<ClusterInput>;
}

export function clusterCapacity(ctx: Context, args: ClusterCapacityArgs) {
  if (!args?.noPrefix) {
    ctx = ctx.prefix("capacity");
  }

  const instances = args.instances ?? {
    architecture: "x86_64",
    memoryMib: { min: 1, max: 2 },
    memoryGibPerVcpu: { min: 1, max: 2 },
    vcpuCount: { min: 1, max: 2 },
  };

  const architecture =
    "type" in instances
      ? getInstanceTypeArchitecture(instances.type)
      : instances.architecture;
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
      instanceType: "type" in instances ? instances.type : undefined,
      instanceRequirements:
        "type" in instances
          ? undefined
          : (() => {
              const { architecture, ...args } = instances;
              return args;
            })(),
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
            volumeSize: args.diskSize ?? 50,
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
      min = 1;
    }
    if (max === undefined) {
      max = min;
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
            : args.onDemandPercentage ?? 0,
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
      tags: Object.entries(ctx.tags()).map(([key, value]) => ({
        key,
        value,
        propagateAtLaunch: true,
      })),
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

export interface ClusterArgs extends ClusterCapacityConfig {
  network: NetworkInput;
  noPrefix?: boolean;
}

export interface ClusterResourcesInput {
  cluster: pulumi.Input<ClusterInput>;
  capacityProvider: pulumi.Input<CapacityProviderInput>;
  privateNamespace?: pulumi.Input<PrivateDnsNamespaceInput>;
}

export interface ClusterOutput extends ClusterResourcesInput {
  cluster: aws.ecs.Cluster;
  capacityProvider: aws.ecs.CapacityProvider;
  autoScalingGroup: aws.autoscaling.Group;
  privateNamespace: aws.servicediscovery.PrivateDnsNamespace;
}

export interface ClusterIds {
  cluster: pulumi.Output<string>;
  capacityProvider: pulumi.Output<string>;
  autoScalingGroup: pulumi.Output<string>;
  privateNamespace: pulumi.Output<string>;
}

export function clusterToIds(cluster: ClusterOutput): ClusterIds {
  return {
    cluster: cluster.cluster.id,
    capacityProvider: cluster.capacityProvider.name,
    autoScalingGroup: cluster.autoScalingGroup.id,
    privateNamespace: cluster.privateNamespace.name,
  };
}

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
