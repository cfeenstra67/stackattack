import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";
import { Context } from "../context.js";
import {
  NetworkInput,
  VpcInput,
  getVpcAttributes,
  getVpcDefaultSecurityGroup,
  getVpcId,
} from "./vpc.js";

export type LoadBalancerInput =
  | string
  | aws.lb.LoadBalancer
  | aws.lb.GetLoadBalancerResult;

export function getLoadBalancerId(
  input: pulumi.Input<LoadBalancerInput>,
): pulumi.Output<string> {
  return pulumi.output(input).apply((obj) => {
    if (typeof obj === "string") {
      return pulumi.output(obj);
    }
    return pulumi.output(obj.arn);
  });
}

export function getLoadBalancerAttributes(
  input: pulumi.Input<LoadBalancerInput>,
): pulumi.Output<aws.lb.LoadBalancer | aws.lb.GetLoadBalancerResult> {
  return pulumi.output(input).apply((obj) => {
    if (typeof obj === "string") {
      return aws.lb.getLoadBalancerOutput({ arn: obj });
    }
    return pulumi.output(obj);
  });
}

export type ListenerInput = string | aws.lb.Listener | aws.lb.GetListenerResult;

export function getListenerId(
  input: pulumi.Input<ListenerInput>,
): pulumi.Output<string> {
  return pulumi.output(input).apply((obj) => {
    if (typeof obj === "string") {
      return pulumi.output(obj);
    }
    return pulumi.output(obj.id);
  });
}

export function getListenerAttributes(
  input: pulumi.Input<ListenerInput>,
): pulumi.Output<aws.lb.Listener | aws.lb.GetListenerResult> {
  return pulumi.output(input).apply((obj) => {
    if (typeof obj === "string") {
      return aws.lb.getListenerOutput({ arn: obj });
    }
    return pulumi.output(obj);
  });
}

export interface LoadBalancerSecurityGroupArgs {
  vpc: pulumi.Input<VpcInput>;
  destSecurityGroupId?: pulumi.Input<string>;
  noPrefix?: boolean;
}

export function loadBalancerSecurityGroup(
  ctx: Context,
  args: LoadBalancerSecurityGroupArgs,
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

  let destSecurityGroupId: pulumi.Input<string>;
  if (args.destSecurityGroupId) {
    destSecurityGroupId = args.destSecurityGroupId;
  } else {
    const defaultSecurityGroup = getVpcDefaultSecurityGroup(vpc.id);
    destSecurityGroupId = defaultSecurityGroup.id;

    new aws.ec2.SecurityGroupRule(ctx.id("default-ingress"), {
      type: "ingress",
      securityGroupId: defaultSecurityGroup.id,
      protocol: "-1",
      fromPort: 0,
      toPort: 0,
      sourceSecurityGroupId: group.id,
    });
  }

  new aws.ec2.SecurityGroupRule(
    ctx.id("egress-1"),
    {
      type: "egress",
      securityGroupId: group.id,
      protocol: "-1",
      fromPort: 0,
      toPort: 0,
      sourceSecurityGroupId: destSecurityGroupId,
    },
    {
      deleteBeforeReplace: true,
    },
  );

  return group;
}

export interface LoadBalancerListenerCertificateArgs {
  listener: pulumi.Input<ListenerInput>;
  certificate: pulumi.Input<string>;
  noPrefix?: boolean;
}

export function loadBalancerListenerCertificate(
  ctx: Context,
  args: LoadBalancerListenerCertificateArgs,
) {
  if (!args.noPrefix) {
    ctx = ctx.prefix("listener-certificate");
  }
  return new aws.lb.ListenerCertificate(ctx.id(), {
    listenerArn: getListenerId(args.listener),
    certificateArn: args.certificate,
  });
}

export interface LoadBalancerListenerArgs {
  loadBalancer: pulumi.Input<LoadBalancerInput>;
  certificate?: pulumi.Input<string>;
  noPrefix?: boolean;
}

export function loadBalancerListener(
  ctx: Context,
  args: LoadBalancerListenerArgs,
) {
  if (!args.noPrefix) {
    ctx = ctx.prefix("listener");
  }

  let listener: aws.lb.Listener;
  if (args.certificate) {
    new aws.lb.Listener(ctx.id("http"), {
      port: 80,
      protocol: "HTTP",
      loadBalancerArn: getLoadBalancerId(args.loadBalancer),
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

    listener = new aws.lb.Listener(ctx.id("https"), {
      port: 443,
      protocol: "HTTPS",
      certificateArn: args.certificate,
      loadBalancerArn: getLoadBalancerId(args.loadBalancer),
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
    listener = new aws.lb.Listener(ctx.id("http"), {
      port: 80,
      protocol: "HTTP",
      loadBalancerArn: getLoadBalancerId(args.loadBalancer),
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

  return {
    loadBalancer: args.loadBalancer,
    listener,
  } satisfies LoadBalancerWithListener;
}

export function loadBalancerListenerToIds(output: LoadBalancerWithListener) {
  return {
    loadBalancer: getLoadBalancerId(output.loadBalancer),
    listener: getListenerId(output.listener),
  } satisfies LoadBalancerWithListener;
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
  url: pulumi.Output<string>;
}

export interface LoadBalancerWithListener {
  loadBalancer: pulumi.Input<LoadBalancerInput>;
  listener: pulumi.Input<ListenerInput>;
}

export function loadBalancerToIds(output: LoadBalancerOutput) {
  return {
    loadBalancer: output.loadBalancer.arn,
    listener: output.listener.arn,
    url: output.url,
  } satisfies LoadBalancerWithListener & { url: pulumi.Output<string> };
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

  const loadBalancer = new aws.lb.LoadBalancer(ctx.id(), {
    namePrefix: "lb-",
    subnets: args.network.subnetIds,
    securityGroups: [securityGroup.id],
    idleTimeout: args.idleTimeout,
    tags: ctx.tags(),
  });

  const { listener } = loadBalancerListener(ctx, {
    loadBalancer,
    certificate: args.certificate,
  });

  const url = pulumi.interpolate`${listener.protocol.apply((p) =>
    p.toLowerCase(),
  )}://${loadBalancer.dnsName}`;

  return { loadBalancer, listener, url };
}
