import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";
import * as saws from "@stackattack/aws";

function env() {
  const ctx = saws.context();
  const config = new pulumi.Config();

  const domain = config.require("domain");

  const vpc = saws.vpc(ctx);

  const cluster = saws.cluster(ctx, {
    network: vpc.network("private"),
    maxSize: 3,
  });

  const database = saws.database(ctx, {
    network: vpc.network("private"),
    // Disable deletion protection so we can tear down the database since this is just an example
    noDeletionProtection: true,
  });

  const certificate = saws.certificate(ctx, {
    domain,
    wildcard: true,
  });

  const loadBalancer = saws.loadBalancer(ctx, {
    network: vpc.network("public"),
    certificate,
  });

  const repo = new aws.ecr.Repository(ctx.id("repo"), {
    // So we can tear this stack cleanly since it's just an example
    forceDelete: true,
    tags: ctx.tags(),
  });

  return {
    cluster: saws.clusterToIds(cluster),
    loadBalancer: saws.loadBalancerToIds(loadBalancer),
    vpc: saws.vpcToIds(vpc),
    database: saws.databaseToIds(database),
    repoUrl: repo.repositoryUrl,
  };
}

function api() {
  const ctx = saws.context();
  const config = new pulumi.Config();

  const envStack = config.require("env-stack");
  const envRef = saws.stackRef(envStack, env);

  const domain = config.require("domain");

  const cluster = envRef.require("cluster");
  const vpc = saws.vpcFromIds(envRef.require("vpc"));
  const database = envRef.require("database");
  const loadBalancer = envRef.require("loadBalancer");
  const repoUrl = envRef.require("repoUrl");

  const image = aws.ecr.getImageOutput({
    repositoryName: repoUrl.apply((url) => url.split("/")[1]),
    mostRecent: true,
  });

  const app = saws.service(ctx, {
    cluster,
    name: "ecs-api-example",
    command: ["api"],
    image: image.imageUri,
    network: vpc.network("private"),
    domain,
    loadBalancer,
    cpu: 256,
    memory: 256,
    port: 3000,
    healthcheck: {
      path: "/healthcheck",
    },
    env: {
      DATABASE_URL: pulumi.interpolate`${database.url}?sslmode=verify-full`,
    },
    init: {
      command: ["init"],
    },
    autoScaling: {
      minReplicas: 1,
      maxReplicas: 3,
      policies: saws.targetTrackingPolicies({
        targetValue: 50,
        metric: "CPUUtilization",
        namespace: "AWS/ECS",
      }),
    },
  });

  return {
    url: app.url,
    internalUrl: app.internalUrl,
  };
}

export default () => saws.select({ env, api });
