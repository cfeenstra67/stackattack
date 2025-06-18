import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";
import {
  VpcInput,
  getVpcAttributes,
  getVpcDefaultSecurityGroup,
} from "./components/vpc.js";
import { Context } from "./context.js";

/**
 * Configuration arguments for creating a security group with single port ingress access.
 */
export interface SinglePortIngressSecurityGroupArgs {
  /** The VPC to create the security group in */
  vpc: pulumi.Input<VpcInput>;
  /** Source security group ID to allow access from (defaults to VPC default security group) */
  sourceSecurityGroupId?: pulumi.Input<string>;
  /** TCP port number to allow ingress on */
  port: pulumi.Input<number>;
  /** Whether to skip adding a prefix to the resource name */
  noPrefix?: boolean;
}

/**
 * Creates a security group that allows TCP ingress on a single port from a source security group.
 * @param ctx - The context for resource naming and tagging
 * @param args - Configuration arguments for the security group
 * @returns The created security group with ingress rule
 */
export function singlePortIngressSecurityGroup(
  ctx: Context,
  args: SinglePortIngressSecurityGroupArgs,
): aws.ec2.SecurityGroup {
  if (!args.noPrefix) {
    ctx = ctx.prefix("security-group");
  }

  const vpcAttrs = getVpcAttributes(args.vpc);

  const securityGroup = new aws.ec2.SecurityGroup(ctx.id(), {
    description: pulumi.interpolate`Allow ingress on port ${args.port} from within security group, no egress`,
    vpcId: vpcAttrs.id,
    tags: ctx.tags(),
  });

  let sourceSecurityGroupId: pulumi.Input<string>;
  if (args.sourceSecurityGroupId) {
    sourceSecurityGroupId = args.sourceSecurityGroupId;
  } else {
    const defaultSecurityGroup = getVpcDefaultSecurityGroup(vpcAttrs.id);
    sourceSecurityGroupId = defaultSecurityGroup.id;
  }

  new aws.ec2.SecurityGroupRule(
    ctx.id("ingress-1"),
    {
      type: "ingress",
      securityGroupId: securityGroup.id,
      protocol: "tcp",
      fromPort: args.port,
      toPort: args.port,
      sourceSecurityGroupId,
    },
    {
      deleteBeforeReplace: true,
    },
  );

  return securityGroup;
}
