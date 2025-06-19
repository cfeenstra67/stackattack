/**
 * @packageDocumentation
 *
 * Stack configuration templates for common AWS infrastructure patterns.
 *
 * Provides predefined stack functions for infrastructure and application deployment,
 * including VPC, VPN, load balancer, ECS cluster, and database configurations.
 */

import * as saws from "./src/index.js";
import * as pulumi from '@pulumi/pulumi';

/**
 * Creates core infrastructure components including VPC, VPN, load balancer, ECS cluster, and database.
 * @returns Infrastructure component IDs and configuration for use by application stacks
 */
function infra() {
  const ctx = saws.context();

  const vpc = saws.vpc(ctx);
  const vpn = saws.vpn(ctx, vpc);

  const certificate = saws.certificate(ctx, { domain: '*.test.singlesock.co' });
  const loadBalancer = saws.loadBalancer(ctx, {
    network: vpc.network("public"),
    certificate,
  });

  const cluster = saws.cluster(ctx, {
    network: vpc.network("private"),
    instances: { type: "a1.medium" }
  });
  const database = saws.database(ctx, { network: vpc.network("private") });

  return {
    clientConfig: vpn.clientConfig,
    cluster: saws.clusterToIds(cluster),
    loadBalancer: saws.loadBalancerToIds(loadBalancer),
    vpc: saws.vpcToIds(vpc),
    database: saws.databaseToIds(database),
  };
};

/**
 * Creates application services that depend on infrastructure components from another stack.
 * @returns Application URLs and service endpoints
 */
function app() {
  const ctx = saws.context();
  const config = new pulumi.Config();

  const ref = saws.stackRef(config.require('infra-stack'), infra);

  const cluster = ref.require('cluster');
  const vpc = saws.vpcFromIds(ref.require('vpc'));
  const database = ref.require('database');
  const loadBalancer = ref.require('loadBalancer');
  
  const domain = 'sa.test.singlesock.co';

  const nginx = saws.service(ctx, {
    name: 'nginx',
    image: 'nginx:latest',
    memory: 256,
    cpu: 256,
    replicas: 1,
    env: {
      DATABASE_URL: database.url
    },
    healthcheck: {
      path: '/'
    },
    domain,
    loadBalancer,
    network: vpc.network('private'),
    cluster
  });

  return { url: nginx.url };  
}

export default () => saws.select({ infra, app });
