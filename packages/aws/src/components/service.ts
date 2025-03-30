import * as aws from "@pulumi/aws";
import * as awsNative from "@pulumi/aws-native";
import * as pulumi from "@pulumi/pulumi";
import { Context } from "../context.js";
import { getZoneFromDomain } from "./certificate.js";
import {
  ClusterResourcesInput,
  getCapacityProviderId,
  getClusterAttributes,
  getHttpNamespaceId,
} from "./cluster.js";
import {
  LoadBalancerWithListener,
  getListenerId,
  getLoadBalancerAttributes,
} from "./load-balancer.js";
import { NetworkInput, getVpcId } from "./vpc.js";

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
      };
    containers.push(initContainer);

    appContainer.dependsOn = [
      {
        containerName: initContainer.name,
        condition: "SUCCESS",
      },
    ];
  }

  const memory = args.memory ?? 256;

  const taskDefinition = new awsNative.ecs.TaskDefinition(
    ctx.id(),
    {
      family: args.name,
      networkMode: "awsvpc",
      taskRoleArn: args.role,
      cpu: args.cpu ? pulumi.interpolate`${args.cpu}` : undefined,
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

export type ServiceArgs = TaskDefinitionArgs & {
  network: NetworkInput;
  replicas?: pulumi.Input<number>;
  cluster: ClusterResourcesInput;
  domain?: pulumi.Input<string>;
  zone?: pulumi.Input<string>;
  loadBalancer?: LoadBalancerWithListener;
};

export interface ServiceOutput {
  service: aws.ecs.Service;
}

export function service(ctx: Context, args: ServiceArgs): ServiceOutput {
  const {
    network,
    cluster,
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

  const clusterAttrs = getClusterAttributes(cluster.cluster);

  const finalReplicas = args.replicas ?? 1;

  const loadBalancers: aws.types.input.ecs.ServiceLoadBalancer[] = [];
  const dependsOn: pulumi.Input<pulumi.Resource>[] = [];

  if (args.domain && !args.loadBalancer) {
    throw new Error("loadBalancer must be specified with domain");
  }
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

    new aws.route53.Record(ctx.id("dns-record-api"), {
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

    loadBalancers.push({
      targetGroupArn: targetGroup.arn,
      containerName: args.name,
      containerPort: port!,
    });
    dependsOn.push(rule);
  }

  const service = new aws.ecs.Service(
    ctx.id(),
    {
      cluster: clusterAttrs.arn,
      desiredCount: finalReplicas,
      taskDefinition: definition.taskDefinitionArn,
      networkConfiguration: {
        subnets: network.subnetIds,
      },
      waitForSteadyState: true,
      tags: ctx.tags(),
      deploymentCircuitBreaker: {
        enable: true,
        rollback: true,
      },
      loadBalancers,
      serviceConnectConfiguration: {
        enabled: true,
        namespace: cluster.httpNamespace
          ? getHttpNamespaceId(cluster.httpNamespace)
          : undefined,
        services: args.port
          ? [
              {
                portName: args.name,
              },
            ]
          : [],
      },
      orderedPlacementStrategies: [
        {
          type: "binpack",
          field: "memory",
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

  return { service };
}
