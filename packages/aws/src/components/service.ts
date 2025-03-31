import * as aws from "@pulumi/aws";
import * as awsNative from "@pulumi/aws-native";
import * as pulumi from "@pulumi/pulumi";
import { Context } from "../context.js";
import { getZoneFromDomain } from "./certificate.js";
import {
  ClusterResourcesInput,
  getCapacityProviderId,
  getClusterAttributes,
  getPrivateDnsNamespaceId,
} from "./cluster.js";
import {
  LoadBalancerWithListener,
  getListenerId,
  getLoadBalancerAttributes,
} from "./load-balancer.js";
import { NetworkInput, VpcInput, getVpcAttributes, getVpcId } from "./vpc.js";

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

export interface ServiceSecurityGroupArgs {
  vpc: VpcInput;
  port: pulumi.Input<number>;
  noPrefix?: boolean;
}

export function serviceSecurityGroup(
  ctx: Context,
  args: ServiceSecurityGroupArgs,
) {
  if (!args.noPrefix) {
    ctx = ctx.prefix("security-group");
  }

  const vpcAttrs = getVpcAttributes(args.vpc);
  const group = new aws.ec2.SecurityGroup(ctx.id(), {
    vpcId: getVpcId(vpcAttrs.id),
    tags: ctx.tags(),
  });
  new aws.ec2.SecurityGroupRule(
    ctx.id("ingress"),
    {
      type: "ingress",
      securityGroupId: group.id,
      protocol: "tcp",
      fromPort: args.port,
      toPort: args.port,
      cidrBlocks: [vpcAttrs.cidrBlock],
      ipv6CidrBlocks: vpcAttrs.ipv6CidrBlock.apply((v) => (v ? [v] : [])),
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

  const securityGroups: pulumi.Output<string>[] = [];
  if (port) {
    const group = serviceSecurityGroup(ctx, {
      vpc: args.network.vpc,
      port,
    });

    securityGroups.push(group.id);
  }

  let serviceDiscovery: aws.servicediscovery.Service | undefined = undefined;
  if (args.cluster.privateNamespace && port) {
    serviceDiscovery = new aws.servicediscovery.Service(
      ctx.id("service-discovery"),
      {
        name: ctx.id(),
        dnsConfig: {
          namespaceId: getPrivateDnsNamespaceId(args.cluster.privateNamespace),
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

  return { service };
}
