import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";
import { Context } from "../context.js";
import { ClusterSecurityGroupArgs } from "./cluster.js";
import { NetworkInput, VpcInput, getVpcAttributes, getVpcId } from "./vpc.js";

export type LoadBalancerInput =
  | pulumi.Input<string>
  | pulumi.Input<aws.lb.LoadBalancer>
  | pulumi.Input<aws.lb.GetLoadBalancerResult>;

export function getLoadBalancerId(
  input: LoadBalancerInput,
): pulumi.Output<string> {
  return pulumi.output(input).apply((obj) => {
    if (typeof obj === "string") {
      return pulumi.output(obj);
    }
    return pulumi.output(obj.arn);
  });
}

export function getLoadBalancerAttributes(
  input: LoadBalancerInput,
): pulumi.Output<aws.lb.LoadBalancer | aws.lb.GetLoadBalancerResult> {
  return pulumi.output(input).apply((obj) => {
    if (typeof obj === "string") {
      return aws.lb.getLoadBalancerOutput({ arn: obj });
    }
    return pulumi.output(obj);
  });
}

export type ListenerInput =
  | pulumi.Input<string>
  | pulumi.Input<aws.lb.Listener>
  | pulumi.Input<aws.lb.GetListenerResult>;

export function getListenerId(input: ListenerInput): pulumi.Output<string> {
  return pulumi.output(input).apply((obj) => {
    if (typeof obj === "string") {
      return pulumi.output(obj);
    }
    return pulumi.output(obj.id);
  });
}

export interface LoadBalancerSecurityGroupArgs {
  vpc: VpcInput;
  noPrefix?: boolean;
}

export function loadBalancerSecurityGroup(
  ctx: Context,
  args: ClusterSecurityGroupArgs,
): aws.ec2.SecurityGroup {
  if (!args.noPrefix) {
    ctx = ctx.prefix("security-group");
  }
  const vpc = getVpcAttributes(args.vpc);

  const group = new aws.ec2.SecurityGroup(ctx.id(), {
    description: "Allow HTTP access, VPC egress",
    vpcId: getVpcId(args.vpc),
    tags: ctx.tags(),
  });

  new aws.ec2.SecurityGroupRule(
    ctx.id("ingress-1"),
    {
      type: "ingress",
      securityGroupId: group.id,
      protocol: "tcp",
      fromPort: 80,
      toPort: 80,
      cidrBlocks: ["0.0.0.0/0"],
      ipv6CidrBlocks: ["::/0"],
    },
    {
      deleteBeforeReplace: true,
    },
  );
  new aws.ec2.SecurityGroupRule(
    ctx.id("ingress-2"),
    {
      type: "ingress",
      securityGroupId: group.id,
      protocol: "tcp",
      fromPort: 443,
      toPort: 443,
      cidrBlocks: ["0.0.0.0/0"],
      ipv6CidrBlocks: ["::/0"],
    },
    {
      deleteBeforeReplace: true,
    },
  );
  new aws.ec2.SecurityGroupRule(
    ctx.id("egress-1"),
    {
      type: "egress",
      securityGroupId: group.id,
      protocol: "-1",
      fromPort: 0,
      toPort: 0,
      cidrBlocks: [vpc.cidrBlock],
      ipv6CidrBlocks: vpc.ipv6CidrBlock.apply((b) => (b ? [b] : [])),
    },
    {
      deleteBeforeReplace: true,
    },
  );

  return group;
}

export interface LoadBalancerArgs {
  network: NetworkInput;
  certificate?: pulumi.Input<string>;
  idleTimeout?: pulumi.Input<number>;
  noPrefix?: boolean;
}

export interface LoadBalancerOutput {
  loadBalancer: aws.lb.LoadBalancer;
  listener: aws.lb.Listener;
}

export interface LoadBalancerWithListener {
  loadBalancer: LoadBalancerInput;
  listener: ListenerInput;
}

export function loadBalancerToIds(
  output: LoadBalancerOutput,
): LoadBalancerWithListener {
  return {
    loadBalancer: output.loadBalancer.arn,
    listener: output.listener.arn,
  };
}

export function loadBalancer(
  ctx: Context,
  args: LoadBalancerArgs,
): LoadBalancerOutput {
  if (!args.noPrefix) {
    ctx = ctx.prefix("load-balancer");
  }

  const securityGroup = loadBalancerSecurityGroup(ctx, {
    vpc: args.network.vpc,
  });

  const loadBalancer = new aws.lb.LoadBalancer(ctx.shortId("load-balancer"), {
    subnets: args.network.subnetIds,
    securityGroups: [securityGroup.id],
    idleTimeout: args.idleTimeout,
    tags: ctx.tags(),
  });

  let listener: aws.lb.Listener;
  if (args.certificate) {
    new aws.lb.Listener(ctx.shortId("http-listener"), {
      port: 80,
      protocol: "HTTP",
      loadBalancerArn: loadBalancer.arn,
      defaultActions: [
        {
          type: "redirect",
          redirect: {
            port: "443",
            protocol: "HTTPS",
            statusCode: "HTTP_301",
          },
        },
      ],
    });

    listener = new aws.lb.Listener(ctx.shortId("https-listener"), {
      port: 443,
      protocol: "HTTPS",
      certificateArn: args.certificate,
      loadBalancerArn: loadBalancer.arn,
      sslPolicy: "ELBSecurityPolicy-2016-08",
      defaultActions: [
        {
          type: "fixed-response",
          fixedResponse: {
            contentType: "text/plain",
            messageBody: "Not found",
            statusCode: "404",
          },
        },
      ],
    });
  } else {
    listener = new aws.lb.Listener(ctx.shortId("http-listener"), {
      port: 80,
      protocol: "HTTP",
      loadBalancerArn: loadBalancer.arn,
      defaultActions: [
        {
          type: "fixed-response",
          fixedResponse: {
            contentType: "text/plain",
            messageBody: "Not found",
            statusCode: "404",
          },
        },
      ],
    });
  }

  return { loadBalancer, listener };
}
