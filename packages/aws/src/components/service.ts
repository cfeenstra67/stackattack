/**
 * @packageDocumentation
 *
 * ECS services in AWS provide a managed way to run containerized applications. StackAttack creates ECS services with task definitions, load balancer integration, health checks, and service discovery.
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
 * Services work together with other StackAttack components:
 * - [cluster](/components/cluster) - Provides compute capacity for running services
 * - [vpc](/components/vpc) - Provides networking foundation with private/public subnets
 * - [load-balancer](/components/load-balancer) - Routes external traffic to services
 * - [database](/components/database) - Provides persistent data storage for services
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
import { NetworkInput, getVpcDefaultSecurityGroup, getVpcId } from "./vpc.js";

/**
 * Configuration arguments for creating an ECS task definition.
 */
export interface TaskDefinitionArgs {
  name: pulumi.Input<string>;
  image: pulumi.Input<string>;
  command?: pulumi.Input<string[]>;
  healthcheck?: {
    command?: pulumi.Input<string>;
    path?: pulumi.Input<string>;
    interval?: pulumi.Input<number>;
    startPeriod?: pulumi.Input<number>;
    retries?: pulumi.Input<number>;
  };
  port?: pulumi.Input<number>;
  role?: pulumi.Input<string>;
  memory?: pulumi.Input<number>;
  cpu?: pulumi.Input<number>;
  env?: Record<string, pulumi.Input<string>>;
  init?: {
    command: pulumi.Input<string[]>;
    image?: pulumi.Input<string>;
    env?: Record<string, pulumi.Input<string>>;
    stopTimeout?: pulumi.Input<number>;
  };
  logRetention?: pulumi.Input<number>;
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

  const logGroup = new aws.cloudwatch.LogGroup(ctx.id("log-group"), {
    retentionInDays: args.logRetention ?? 30,
  });

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
          "awslogs-group": logGroup.name,
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
            "awslogs-group": logGroup.name,
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
export type ServiceArgs = TaskDefinitionArgs & {
  network: NetworkInput;
  replicas?: pulumi.Input<number>;
  cluster: pulumi.Input<ClusterResourcesInput>;
  domain?: pulumi.Input<string>;
  zone?: pulumi.Input<string>;
  loadBalancer?: LoadBalancerWithListener;
  securityGroups?: pulumi.Input<pulumi.Input<string>[]>;
};

/**
 * Output from creating an ECS service, containing the service resource and URLs.
 */
export interface ServiceOutput {
  service: aws.ecs.Service;
  url?: pulumi.Output<string>;
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
      orderedPlacementStrategies: [
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
