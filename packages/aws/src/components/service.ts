import * as aws from "@pulumi/aws";
import * as awsNative from "@pulumi/aws-native";
import * as pulumi from "@pulumi/pulumi";
import { Context } from "../context.js";
import {
  ClusterWithCapacityProvider,
  getCapacityProviderId,
  getClusterAttributes,
} from "./cluster.js";
import { NetworkInput } from "./vpc.js";

export interface TaskDefinitionArgs {
  name: pulumi.Input<string>;
  image: pulumi.Input<string>;
  command?: pulumi.Input<string[]>;
  healthcheck?: {
    command: pulumi.Input<string>;
    interval?: pulumi.Input<number>;
    startPeriod?: pulumi.Input<number>;
    retries?: pulumi.Input<number>;
  };
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
      healthCheck: args.healthcheck
        ? {
            command: ["CMD-SHELL", args.healthcheck.command],
            interval: args.healthcheck.interval ?? 10,
            startPeriod: args.healthcheck.startPeriod ?? 30,
            retries: args.healthcheck.retries ?? 3,
          }
        : undefined,
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
  cluster: ClusterWithCapacityProvider;
};

export function service(ctx: Context, args: ServiceArgs) {
  const { network, cluster, replicas, noPrefix, ...taskArgs } = args;
  if (!noPrefix) {
    ctx = ctx.prefix("service");
  }

  const definition = taskDefinition(ctx, taskArgs);

  const clusterAttrs = getClusterAttributes(cluster.cluster);

  const finalReplicas = args.replicas ?? 1;

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
    },
  );

  return { service };
}
