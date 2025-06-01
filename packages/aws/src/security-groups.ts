import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";
import {
  VpcInput,
  getVpcAttributes,
  getVpcDefaultSecurityGroup,
} from "./components/vpc.js";
import { Context } from "./context.js";

export interface SinglePortIngressSecurityGroupArgs {
  vpc: VpcInput;
  sourceSecurityGroupId?: pulumi.Input<string>;
  port: pulumi.Input<number>;
  noPrefix?: boolean;
}

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
