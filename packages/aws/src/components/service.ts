/**
 * @packageDocumentation
 *
 * ECS services in AWS provide a managed way to run containerized applications. Stackattack creates ECS services with task definitions, load balancer integration, health checks, and service discovery.
 *
 * ```typescript
 * import * as saws from "@stackattack/aws";
 *
 * const ctx = saws.context();
 * const vpc = saws.vpc(ctx);
 * const cluster = saws.cluster(ctx, { network: vpc.network("private") });
 * const app = saws.service(ctx, {
 *   name: "my-app",
 *   image: "nginx:latest",
 *   network: vpc.network("private"),
 *   cluster
 * });
 *
 * export const appUrl = app.internalUrl;
 * ```
 *
 *
 * ## Usage
 *
 * After deploying a service, you can manage it using:
 *
 * **AWS CLI:**
 * ```bash
 * # View service status and tasks
 * aws ecs describe-services --cluster your-cluster-name --services your-service-name
 *
 * # View service logs
 * aws logs tail /aws/ecs/your-service-name --follow
 *
 * # Scale the service
 * aws ecs update-service --cluster your-cluster-name --service your-service-name --desired-count 3
 * ```
 *
 * ## Related Components
 *
 * Services work together with other Stackattack components:
 * - [cluster](/components/cluster) - Provides compute capacity for running services
 * - [vpc](/components/vpc) - Provides networking foundation with private/public subnets
 * - [load-balancer](/components/load-balancer) - Routes external traffic to services
 *
 * ## Costs
 *
 * ECS service costs depend on the underlying compute resources and are **usage-based**:
 *
 * - **EC2 instances** - If using EC2 capacity providers, you pay for the underlying EC2 instances (~$0.0116/hour for t3.micro). The [cluster](/components/cluster) component manages auto-scaling groups that can scale to zero when no tasks are running.
 *
 * - **Fargate** - If using Fargate capacity providers, you pay per vCPU-hour (~$0.04048/vCPU/hour) and per GB-hour (~$0.004445/GB/hour). A 0.5 vCPU, 1GB task running 24/7 costs ~$15/month.
 *
 * - **Data transfer** - Minimal costs for service-to-service communication within the same VPC (typically free). External data transfer follows standard AWS rates.
 *
 * - **CloudWatch Logs** - Log storage is ~$0.50/GB/month. Use the `logRetention` parameter to automatically delete old logs and control costs.
 *
 * Cost optimization strategies:
 * - Use the [cluster](/components/cluster) component's auto-scaling features to scale EC2 instances to zero during low usage
 * - Set appropriate `logRetention` periods (default: 30 days)
 * - Consider spot instances for non-critical workloads through capacity provider configuration
 *
 * See [ECS Pricing](https://aws.amazon.com/ecs/pricing/) for current rates.
 */

import * as aws from "@pulumi/aws";
import * as awsNative from "@pulumi/aws-native";
import * as pulumi from "@pulumi/pulumi";
import { ecsClusterArn, ecsServiceArn } from "../arns.js";
import { Context } from "../context.js";
import { getZoneFromDomain } from "./certificate.js";
import {
  ClusterResourcesInput,
  getCapacityProviderId,
  getClusterAttributes,
  getPrivateDnsNamespaceAttributes,
} from "./cluster.js";
import {
  LoadBalancerWithListener,
  getListenerAttributes,
  getListenerId,
  getLoadBalancerAttributes,
} from "./load-balancer.js";
import {
  ServiceAutoScalingArgs,
  serviceAutoScaling,
} from "./service-autoscaling.js";
import { NetworkInput, getVpcDefaultSecurityGroup, getVpcId } from "./vpc.js";

export type ServiceInput = string | aws.ecs.Service | ServiceOutput;

export function getServiceId(
  service: pulumi.Input<ServiceInput>,
): pulumi.Output<string> {
  return pulumi.output(service).apply((value) => {
    if (typeof value === "string") {
      return pulumi.output(value);
    }
    if ("service" in value) {
      value = value.service;
    }
    return ecsServiceArn({
      serviceName: value.name,
      clusterName: value.cluster,
    });
  });
}

export function getServiceAttributes(
  service: pulumi.Input<ServiceInput>,
): pulumi.Output<aws.ecs.Service | aws.ecs.GetServiceResult> {
  const result = pulumi.output(service).apply(async (value) => {
    if (typeof value === "string") {
      const arn = await aws.getArn({ arn: value });
      const [, cluster, service] = arn.resource.split("/");
      const clusterArn = ecsClusterArn({ clusterName: cluster });

      return aws.ecs.getServiceOutput({
        clusterArn,
        serviceName: service,
      });
    }
    if ("service" in value) {
      value = value.service;
    }
    return value;
  });

  return pulumi.output(result);
}

/**
 * Configuration arguments for creating an ECS task definition.
 */
export interface TaskDefinitionArgs {
  /** The name of the container and ECS task family. */
  name: pulumi.Input<string>;
  /** The Docker image to run (e.g., "nginx:latest", "my-registry/my-app:v1.0"). */
  image: pulumi.Input<string>;
  /** Optional command to override the container's default command. */
  command?: pulumi.Input<string[]>;
  /** Health check configuration for the container. */
  healthcheck?: {
    /** Custom shell command for health checks (e.g., "curl -f http://localhost/health"). */
    command?: pulumi.Input<string>;
    /** HTTP path for health checks (e.g., "/health", "/api/status"). */
    path?: pulumi.Input<string>;
    /** Interval between health checks in seconds. */
    interval?: pulumi.Input<number>;
    /** Grace period before first health check in seconds. */
    startPeriod?: pulumi.Input<number>;
    /** Number of consecutive failures before marking unhealthy. */
    retries?: pulumi.Input<number>;
  };
  /** Port the container exposes (required for load balancer integration). */
  port?: pulumi.Input<number>;
  /** IAM role ARN for the task to assume (for AWS API access). */
  role?: pulumi.Input<string>;
  /** Memory limit in MB (defaults to 512). */
  memory?: pulumi.Input<number>;
  /** CPU limit in CPU units, where 1024 = 1 vCPU (defaults to 512). */
  cpu?: pulumi.Input<number>;
  /** Environment variables to pass to the container. */
  env?: Record<string, pulumi.Input<string>>;
  /** Configuration for an init container that runs before the main container. */
  init?: {
    /** Command to run in the init container. */
    command: pulumi.Input<string[]>;
    /** Docker image for init container (uses main image if not specified). */
    image?: pulumi.Input<string>;
    /** Environment variables for the init container. */
    env?: Record<string, pulumi.Input<string>>;
    /** Timeout in seconds for the init container to complete. */
    stopTimeout?: pulumi.Input<number>;
  };
  /** The name of a log group to write logs to. If not specified, a new log group will be created with a 30 day retention period. */
  logGroup?: pulumi.Input<string>;
  /** Whether to skip adding a prefix to resource names. */
  noPrefix?: boolean;
}

/**
 * Creates an ECS task definition with container configuration, logging, and optional init container.
 * @param ctx - The context for resource naming and tagging
 * @param args - Configuration arguments for the task definition
 * @returns The ECS task definition resource
 */
export function taskDefinition(ctx: Context, args: TaskDefinitionArgs) {
  if (!args.noPrefix) {
    ctx = ctx.prefix("task-definition");
  }
  const region = aws.getRegionOutput();

  let logGroupName: pulumi.Input<string>;
  if (args.logGroup !== undefined) {
    logGroupName = args.logGroup;
  } else {
    const logGroup = new aws.cloudwatch.LogGroup(ctx.id("log-group"), {
      retentionInDays: 30,
    });
    logGroupName = logGroup.name;
  }

  let healthCheck:
    | awsNative.types.input.ecs.TaskDefinitionHealthCheckArgs
    | undefined = undefined;
  const healthInterval = args.healthcheck?.interval ?? 10;
  const healthStartPeriod = args.healthcheck?.startPeriod ?? 30;
  const healthRetries = args.healthcheck?.retries ?? 3;
  if (args.healthcheck?.command) {
    healthCheck = {
      command: ["CMD-SHELL", args.healthcheck.command],
      interval: healthInterval,
      startPeriod: healthStartPeriod,
      retries: healthRetries,
    };
  } else if (args.healthcheck?.path) {
    const url = pulumi
      .all([args.port, args.healthcheck.path])
      .apply(([port, path]) => {
        const baseUrl = port ? `http://localhost:${port}` : "http://localhost";
        return new URL(path, baseUrl).href;
      });
    healthCheck = {
      command: [
        "CMD-SHELL",
        pulumi.interpolate`wget -q "${url}" -O - &> /dev/null`,
      ],
      interval: healthInterval,
      startPeriod: healthStartPeriod,
      retries: healthRetries,
    };
  }

  const appContainer: awsNative.types.input.ecs.TaskDefinitionContainerDefinitionArgs =
    {
      name: args.name,
      logConfiguration: {
        logDriver: "awslogs",
        options: {
          "awslogs-group": logGroupName,
          "awslogs-region": region.name,
          "awslogs-stream-prefix": args.name,
        },
      },
      image: args.image,
      command: args.command,
      healthCheck,
      portMappings: args.port
        ? [
            {
              name: args.name,
              appProtocol: "http",
              containerPort: args.port,
            },
          ]
        : [],
      environment: pulumi
        .output(args.env ?? {})
        .apply((env) =>
          Object.entries(env).map(([name, value]) => ({ name, value })),
        ),
    };

  const containers: awsNative.types.input.ecs.TaskDefinitionContainerDefinitionArgs[] =
    [appContainer];
  if (args.init) {
    const initEnv = pulumi
      .all([args.env, args.init.env])
      .apply(([env1, env2]) => ({
        ...env1,
        ...env2,
      }));

    const initContainer: awsNative.types.input.ecs.TaskDefinitionContainerDefinitionArgs =
      {
        name: "init",
        logConfiguration: {
          logDriver: "awslogs",
          options: {
            "awslogs-group": logGroupName,
            "awslogs-region": region.name,
            "awslogs-stream-prefix": pulumi.interpolate`${args.name}-init`,
          },
        },
        image: args.init.image ?? args.image,
        command: args.init.command,
        stopTimeout: args.init.stopTimeout ?? 300,
        environment: initEnv.apply((env) =>
          Object.entries(env).map(([name, value]) => ({ name, value })),
        ),
        essential: false,
      };
    containers.push(initContainer);

    appContainer.dependsOn = [
      {
        containerName: initContainer.name,
        condition: "SUCCESS",
      },
    ];
  }

  const memory = args.memory ?? 512;
  const cpu = args.cpu ?? 512;

  const taskDefinition = new awsNative.ecs.TaskDefinition(
    ctx.id(),
    {
      family: args.name,
      networkMode: "awsvpc",
      taskRoleArn: args.role,
      cpu: pulumi.interpolate`${cpu}`,
      memory: pulumi.interpolate`${memory}`,
      containerDefinitions: containers,
      tags: Object.entries(ctx.tags()).map(([key, value]) => ({ key, value })),
    },
    {
      replaceOnChanges: ["*"],
    },
  );

  return taskDefinition;
}

/**
 * Configuration arguments for creating an ECS service, extending TaskDefinitionArgs.
 */
export interface ServiceArgs extends TaskDefinitionArgs {
  /** The VPC network configuration for the service. */
  network: NetworkInput;
  /** Number of tasks to run (cannot be used with autoScaling). */
  replicas?: pulumi.Input<number>;
  /** The ECS cluster to run the service in. */
  cluster: pulumi.Input<ClusterResourcesInput>;
  /** Custom domain name for external access (requires loadBalancer). */
  domain?: pulumi.Input<string>;
  /** Route53 hosted zone ID for the domain (auto-detected if not specified). */
  zone?: pulumi.Input<string>;
  /** Load balancer configuration for external traffic routing. This must be passed if `domain` is specified. */
  loadBalancer?: LoadBalancerWithListener;
  /** Custom security groups for the service (uses VPC default if not specified). */
  securityGroups?: pulumi.Input<pulumi.Input<string>[]>;
  /** Service level strategy rules that are taken into consideration during task placement. List from top to bottom in order of precedence. Default behavior is to use the `binpack` strategy on `cpu`. */
  orderedPlacementStrategies?: pulumi.Input<
    pulumi.Input<aws.types.input.ecs.ServiceOrderedPlacementStrategy>[]
  >;
  /** Specify an auto-scaling configuration for your service. Cannot be used with `replicas`. See the [serviceAutoScaling](/components/service-autoscaling) component for argument documentation. */
  autoScaling?: Omit<ServiceAutoScalingArgs, "service">;
}

/**
 * Output from creating an ECS service, containing the service resource and URLs.
 */
export interface ServiceOutput {
  /** The ECS service resource. */
  service: aws.ecs.Service;
  /** External URL for the service (only available if `domain` is configured). */
  url?: pulumi.Output<string>;
  /** Internal service discovery URL for VPC communication (only available if `port` is configured) */
  internalUrl?: pulumi.Output<string>;
}

/**
 * Validates that an ECS service deployment matches the expected task definition.
 * @param service - The ECS service to check
 * @param taskDefinition - The expected task definition
 * @returns The actual task definition ARN if deployment is successful
 * @throws Error if deployment failed (task definitions don't match)
 */
export function checkEcsDeployment(
  service: aws.ecs.Service,
  taskDefinition: awsNative.ecs.TaskDefinition,
): pulumi.Output<string> {
  return pulumi
    .all([
      service.name,
      taskDefinition.taskDefinitionArn,
      service.taskDefinition,
    ])
    .apply(([serviceName, expected, actual]) => {
      if (expected !== actual) {
        throw new Error(
          `${serviceName} deployment failed.\n` +
            `Expected task definition: ${expected}\n` +
            `Actual task definition: ${actual}`,
        );
      }

      return actual;
    });
}

/**
 * Creates an ECS service with task definition, load balancer integration, and service discovery.
 * @param ctx - The context for resource naming and tagging
 * @param args - Configuration arguments for the service
 * @returns Service output containing the service resource and access URLs
 */
export function service(ctx: Context, args: ServiceArgs): ServiceOutput {
  const {
    network,
    cluster: clusterInput,
    replicas,
    noPrefix,
    port: portArg,
    ...taskArgs
  } = args;
  if (!noPrefix) {
    ctx = ctx.prefix("service");
  }

  if (args.replicas !== undefined && args.autoScaling) {
    throw new Error(
      "`replicas` should not be provided when autoScaling is provided--the number of replicas will be set dynamically based on the scaling policies",
    );
  }

  const port = portArg ? portArg : args.domain ? 80 : undefined;

  const definition = taskDefinition(ctx, { ...taskArgs, port });

  const cluster = pulumi.output(clusterInput);

  const clusterAttrs = getClusterAttributes(cluster.cluster);

  const finalReplicas = args.replicas ?? 1;

  const loadBalancers: aws.types.input.ecs.ServiceLoadBalancer[] = [];
  const dependsOn: pulumi.Input<pulumi.Resource>[] = [];

  if (args.domain && !args.loadBalancer) {
    throw new Error("loadBalancer must be specified with domain");
  }
  let url: pulumi.Output<string> | undefined = undefined;
  if (args.domain) {
    const targetGroup = new aws.lb.TargetGroup(ctx.id("target-group"), {
      namePrefix: pulumi.output(args.name).apply((name) => name.slice(0, 6)),
      healthCheck: args.healthcheck?.path
        ? {
            path: args.healthcheck.path,
            matcher: "200",
          }
        : undefined,
      targetType: "ip",
      port,
      protocol: "HTTP",
      deregistrationDelay: 30,
      tags: ctx.tags(),
      vpcId: getVpcId(args.network.vpc),
    });

    const rule = new aws.lb.ListenerRule(
      ctx.id("rule"),
      {
        listenerArn: getListenerId(args.loadBalancer!.listener),
        actions: [
          {
            type: "forward",
            targetGroupArn: targetGroup.arn,
          },
        ],
        conditions: [
          {
            hostHeader: {
              values: [args.domain],
            },
          },
        ],
        tags: ctx.tags(),
      },
      {
        deleteBeforeReplace: true,
      },
    );

    const zone = args.zone ?? getZoneFromDomain(args.domain);

    const loadBalancer = getLoadBalancerAttributes(
      args.loadBalancer!.loadBalancer,
    );

    const dnsRecord = new aws.route53.Record(ctx.id("dns-record-api"), {
      zoneId: zone,
      name: args.domain,
      type: "A",
      aliases: [
        {
          name: pulumi.interpolate`dualstack.${loadBalancer.dnsName}`,
          zoneId: loadBalancer.zoneId,
          evaluateTargetHealth: true,
        },
      ],
    });

    const listener = getListenerAttributes(args.loadBalancer!.listener);

    url = pulumi
      .all([listener.protocol, args.domain, dnsRecord.id, rule.id])
      .apply(([protocol, domain]) => `${protocol.toLowerCase()}://${domain}`);

    loadBalancers.push({
      targetGroupArn: targetGroup.arn,
      containerName: args.name,
      containerPort: port!,
    });
    dependsOn.push(rule);
  }

  let serviceDiscovery: aws.servicediscovery.Service | undefined = undefined;
  let internalUrl: pulumi.Output<string> | undefined = undefined;
  if (cluster.privateNamespace && port) {
    const namespace = pulumi.output(cluster.privateNamespace).apply((ns) => {
      if (!ns) {
        throw new Error(
          `You passed an Output value that resolves to ${ns} to cluster.privateNamespace. This is not supported.`,
        );
      }
      return ns;
    });

    const namespaceAttrs = getPrivateDnsNamespaceAttributes(namespace);

    serviceDiscovery = new aws.servicediscovery.Service(
      ctx.id("service-discovery"),
      {
        name: ctx.id(),
        dnsConfig: {
          namespaceId: namespaceAttrs.id,
          dnsRecords: [
            {
              ttl: 10,
              type: "A",
            },
          ],
          routingPolicy: "MULTIVALUE",
        },
        forceDestroy: true,
        tags: ctx.tags(),
      },
      {
        deleteBeforeReplace: true,
      },
    );

    internalUrl = pulumi.interpolate`http://${serviceDiscovery.name}.${namespaceAttrs.name}`;
  }

  let securityGroups: pulumi.Input<pulumi.Input<string>[]>;
  if (args.securityGroups) {
    securityGroups = args.securityGroups;
  } else {
    securityGroups = [getVpcDefaultSecurityGroup(getVpcId(network.vpc)).id];
  }

  const service = new aws.ecs.Service(
    ctx.id(),
    {
      cluster: clusterAttrs.arn,
      desiredCount: finalReplicas,
      taskDefinition: definition.taskDefinitionArn,
      networkConfiguration: {
        subnets: network.subnetIds,
        securityGroups,
      },
      waitForSteadyState: true,
      tags: ctx.tags(),
      deploymentCircuitBreaker: {
        enable: true,
        rollback: true,
      },
      loadBalancers,
      serviceRegistries: serviceDiscovery
        ? {
            registryArn: serviceDiscovery.arn,
            containerName: args.name,
          }
        : undefined,
      orderedPlacementStrategies: args.orderedPlacementStrategies ?? [
        {
          type: "binpack",
          field: "cpu",
        },
      ],
      capacityProviderStrategies: [
        {
          capacityProvider: getCapacityProviderId(cluster.capacityProvider),
          weight: 1,
          base: 1,
        },
      ],
    },
    {
      ignoreChanges: replicas ? [] : ["desiredCount"],
      dependsOn,
    },
  );

  checkEcsDeployment(service, definition);

  if (args.autoScaling) {
    serviceAutoScaling(ctx, {
      service,
      ...args.autoScaling,
    });
  }

  const finalUrl =
    url === undefined
      ? undefined
      : pulumi.all([url, service.id]).apply(([url]) => url);

  const finalInternalUrl =
    internalUrl === undefined
      ? undefined
      : pulumi.all([internalUrl, service.id]).apply(([url]) => url);

  return { service, url: finalUrl, internalUrl: finalInternalUrl };
}
