---
title: Quick Start
description: Build your first infrastructure with StackAttack AWS
---
This guide will help you create your first infrastructure using StackAttack AWS components.

## (If needed) Create a New Pulumi Project

Stackattack can be easily added to any existing pulumi project that's using typescript. If you want to 

```bash
mkdir my-infrastructure
cd my-infrastructure
pulumi new typescript
```

## Install Dependencies

```bash
npm install @stackattack/aws @pulumi/aws
```

## Create Basic Infrastructure

The following is a complete configuration for two stacks, one providing shared, stateful resources like a VPC, database instance, ECS cluster, and S3 bucket. Then a second one deploys an application on that ECS cluster; for more information on why the stacks are structured this way check out [Structuring Stacks](/working-with-pulumi/structuring-stacks/).

```typescript
import * as saws from '@stackattack/aws';

function env() {
  const ctx = saws.context();

  // Create a VPC with public and private subnets
  const vpc = saws.vpc(ctx);

  // Create a private S3 bucket
  const storage = saws.bucket(ctx);

  // Create an ECS cluster w/ an auto-scaling group
  const cluster = saws.cluster(ctx, {
    network: vpc.network("private"),
    maxSize: 3,
  });

  // Create a PostgreSQL database
  const database = saws.database(ctx, {
    network: vpc.network("private")
  });

  // Create an ACM signing certificate for HTTPS support
  const certificate = saws.certificate(ctx, {
    domain: "mysite.com",
    wildcard: true,
  });

  // Create a load balancer to route external requests to your service
  const loadBalancer = saws.loadBalancer(ctx, {
    network: vpc.network("public"),
    certificate,
  });

  return {
    cluster: saws.clusterToIds(cluster),
    loadBalancer: saws.loadBalancerToIds(loadBalancer),
    vpc: saws.vpcToIds(vpc),
    database: saws.databaseToIds(database),
    storageBucket: storage.bucket,
  };
}

function app() {
  // type-safe stack reference
  const envRef = saws.stackRef('username/project/prod', env);

  const cluster = envRef.require('cluster');
  const vpc = saws.vpcFromIds(envRef.require('vpc'));
  const loadBalancer = envRef.require('loadBalancer');
  const storageBucket = envRef.require('storageBucket');

  // Deploy a containerized service
  const app = saws.service(ctx.prefix('api'), {
    cluster,
    name: 'mysite-api',
    replicas: 1,
    image: 'mysite-api:latest',
    network: vpc.network('private'),
    domain: 'api.mysite.com',
    loadBalancer,
    cpu: 256,
    memory: 256,
    port: 3000,
    healthcheck: {
      path: '/healthcheck'
    },
    env: {
      DATABASE_URL: database.url,
      STORAGE_BUCKET: storageBucket
    },
    // Run a specific command in a separate container instance; e.g. run database migrations
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
```

You should then create two pulumi stacks:
```bash
ENV_STACK=prod
API_STACK=api-prod
pulumi stack init $ENV_STACK
pulumi config set stack-type env -s $ENV_STACK
pulumi stack init $API_STACK
pulumi config set stack-type api -s $API_STACK
```
And deploy them:
```bash
# This will take a while (>10 minutes)
pulumi up -s $ENV_STACK
# This should take <5 minutes
pulumi up -s $API_STACK 
```

After deployment, this will give you a service running in ECS at https://api.mysite.com.

## What You Built

In just a few lines of code, you created:

- A VPC with public and private subnets across multiple AZs
- Route tables and internet gateway for connectivity
- An S3 bucket with encryption and versioning enabled
- A PostgreSQL database with proper security groups

## Next Steps

- Learn about [contexts](/concepts/context/)
- Explore individual [components](/components/)
