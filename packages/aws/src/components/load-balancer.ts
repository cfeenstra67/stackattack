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

/**
 * Union type representing different ways to specify a load balancer.
 * Can be an ARN string, LoadBalancer resource, or load balancer query result.
 */
export type LoadBalancerInput =
  | string
  | aws.lb.LoadBalancer
  | aws.lb.GetLoadBalancerResult;

/**
 * Extracts the load balancer ARN/ID from various input types.
 * @param input - Load balancer input (ARN string, LoadBalancer resource, or query result)
 * @returns The load balancer ARN as a Pulumi Output
 */
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

/**
 * Retrieves the full load balancer attributes from various input types.
 * @param input - Load balancer input (ARN string, LoadBalancer resource, or query result)
 * @returns The load balancer resource or query result as a Pulumi Output
 */
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

/**
 * Union type representing different ways to specify a load balancer listener.
 * Can be an ARN string, Listener resource, or listener query result.
 */
export type ListenerInput = string | aws.lb.Listener | aws.lb.GetListenerResult;

/**
 * Extracts the listener ARN/ID from various input types.
 * @param input - Listener input (ARN string, Listener resource, or query result)
 * @returns The listener ARN/ID as a Pulumi Output
 */
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

/**
 * Retrieves the full listener attributes from various input types.
 * @param input - Listener input (ARN string, Listener resource, or query result)
 * @returns The listener resource or query result as a Pulumi Output
 */
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

/**
 * Configuration options for creating a load balancer security group.
 */
export interface LoadBalancerSecurityGroupArgs {
  /** VPC where the security group will be created */
  vpc: pulumi.Input<VpcInput>;
  /** Optional destination security group ID for egress rules */
  destSecurityGroupId?: pulumi.Input<string>;
  /** Whether to skip adding a prefix to the context */
  noPrefix?: boolean;
}

/**
 * Creates a security group for load balancers with HTTP/HTTPS ingress rules.
 * Allows inbound traffic on ports 80 and 443 from anywhere, and outbound traffic to the specified destination.
 * @param ctx - Pulumi context for resource naming and tagging
 * @param args - Configuration for the security group
 * @returns The created security group resource
 */
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

/**
 * Configuration options for attaching a certificate to a load balancer listener.
 */
export interface LoadBalancerListenerCertificateArgs {
  /** The listener to attach the certificate to */
  listener: pulumi.Input<ListenerInput>;
  /** ARN of the SSL certificate to attach */
  certificate: pulumi.Input<string>;
  /** Whether to skip adding a prefix to the context */
  noPrefix?: boolean;
}

/**
 * Attaches an SSL certificate to a load balancer listener.
 * @param ctx - Pulumi context for resource naming and tagging
 * @param args - Configuration for the certificate attachment
 * @returns The created listener certificate resource
 */
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

/**
 * Configuration options for creating load balancer listeners.
 */
export interface LoadBalancerListenerArgs {
  /** The load balancer to create listeners for */
  loadBalancer: pulumi.Input<LoadBalancerInput>;
  /** Optional SSL certificate ARN for HTTPS listener */
  certificate?: pulumi.Input<string>;
  /** Whether to skip adding a prefix to the context */
  noPrefix?: boolean;
}

/**
 * Creates listeners for a load balancer. If a certificate is provided, creates both HTTP (redirect to HTTPS) and HTTPS listeners.
 * Otherwise, creates only an HTTP listener. Both listeners return 404 by default.
 * @param ctx - Pulumi context for resource naming and tagging
 * @param args - Configuration for the listeners
 * @returns Object containing the load balancer input and the primary listener
 */
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

/**
 * Converts a LoadBalancerWithListener object to use ARN/ID strings instead of resources.
 * @param output - LoadBalancerWithListener object with resource references
 * @returns LoadBalancerWithListener object with ARN/ID strings
 */
export function loadBalancerListenerToIds(output: LoadBalancerWithListener) {
  return {
    loadBalancer: getLoadBalancerId(output.loadBalancer),
    listener: getListenerId(output.listener),
  } satisfies LoadBalancerWithListener;
}

/**
 * Configuration options for creating a complete load balancer setup.
 */
export interface LoadBalancerArgs {
  /** Network configuration including VPC and subnets */
  network: NetworkInput;
  /** Optional SSL certificate ARN for HTTPS support */
  certificate?: pulumi.Input<string>;
  /** Connection idle timeout in seconds */
  idleTimeout?: pulumi.Input<number>;
  /** Whether to skip adding a prefix to the context */
  noPrefix?: boolean;
}

/**
 * Output from creating a complete load balancer setup.
 */
export interface LoadBalancerOutput {
  /** The created load balancer resource */
  loadBalancer: aws.lb.LoadBalancer;
  /** The primary listener resource */
  listener: aws.lb.Listener;
  /** The URL of the load balancer */
  url: pulumi.Output<string>;
}

/**
 * Represents a load balancer paired with a listener.
 */
export interface LoadBalancerWithListener {
  /** The load balancer reference */
  loadBalancer: pulumi.Input<LoadBalancerInput>;
  /** The listener reference */
  listener: pulumi.Input<ListenerInput>;
}

/**
 * Converts a LoadBalancerOutput to use ARN strings instead of resources, while preserving the URL.
 * @param output - LoadBalancerOutput object with resource references
 * @returns Object with ARN strings and URL
 */
export function loadBalancerToIds(output: LoadBalancerOutput) {
  return {
    loadBalancer: output.loadBalancer.arn,
    listener: output.listener.arn,
    url: output.url,
  } satisfies LoadBalancerWithListener & { url: pulumi.Output<string> };
}

/**
 * Creates a complete load balancer setup including security group, load balancer, and listeners.
 * Automatically configures security rules for HTTP/HTTPS traffic.
 * @param ctx - Pulumi context for resource naming and tagging
 * @param args - Configuration for the load balancer
 * @returns Complete load balancer setup with URL
 */
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
