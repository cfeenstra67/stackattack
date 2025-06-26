import * as saws from '@stackattack/aws';
import * as aws from '@pulumi/aws';
import * as pulumi from '@pulumi/pulumi';

function env() {
  const ctx = saws.context();
  const config = new pulumi.Config();

  const domain = config.require('domain');

  const vpc = saws.vpc(ctx);

  const cluster = saws.cluster(ctx, {
    network: vpc.network("private"),
    maxSize: 3,
  });

  const database = saws.database(ctx, {
    network: vpc.network("private")
  });

  const certificate = saws.certificate(ctx, {
    domain,
    wildcard: true,
  });

  const loadBalancer = saws.loadBalancer(ctx, {
    network: vpc.network("public"),
    certificate,
  });

  const repo = new aws.ecr.Repository(ctx.id('repo'), {
    tags: ctx.tags()
  });

  return {
    cluster: saws.clusterToIds(cluster),
    loadBalancer: saws.loadBalancerToIds(loadBalancer),
    vpc: saws.vpcToIds(vpc),
    database: saws.databaseToIds(database),
    repoUrl: repo.repositoryUrl,
  };
}

function app() {
  const ctx = saws.context();
  const config = new pulumi.Config();

  const envStack = config.require('env-stack');
  const envRef = saws.stackRef(envStack, env);

  const domain = config.require('domain');

  const cluster = envRef.require('cluster');
  const vpc = saws.vpcFromIds(envRef.require('vpc'));
  const database = envRef.require('database');
  const loadBalancer = envRef.require('loadBalancer');
  const repoUrl = envRef.require('repoUrl');

  const image = aws.ecr.getImageOutput({
    repositoryName: repoUrl.apply((url) =>
      new URL(url).pathname.slice(1)
    ),
    mostRecent: true
  });

  // Deploy a containerized service
  const app = saws.service(ctx.prefix('api'), {
    cluster,
    name: 'ecs-api-example',
    replicas: 1,
    image: image.imageUri,
    network: vpc.network('private'),
    domain,
    loadBalancer,
    cpu: 256,
    memory: 256,
    port: 3000,
    healthcheck: {
      path: '/healthcheck'
    },
    env: {
      DATABASE_URL: database.url,
    },
    init: {
      command: ['init']
    }
  });

  return {
    url: app.url,
    internalUrl: app.internalUrl
  };
}

export default () => saws.select({ env, app });
