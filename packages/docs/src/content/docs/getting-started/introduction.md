---
title: Introduction
description: Production-ready AWS infrastructure components for Pulumi
---

<div class="intro-hero">

# Welcome to StackAttack

StackAttack provides a curated collection of high-level infrastructure components built on top of Pulumi. It allows you to deploy your applications on robust, secure infrastructure without giving up any control or spending days putting it together.

</div>

## Philsophy

Stackattack was created for one simple reason: **there's too much code needed to get up and running with infra-as-code**. Most of the time, putting up infrastructure with IaC tools requires a slow, iterative process of cross referencing Pulumi/Terraform docs, cross-referencing them with AWS docs, and trial-and-error to get things working.

Most of the time, what you really want is to get something working quickly with reasonable defaults, then make adjustments if you have more specific requirements. Stackattack aims to be the best way to get started setting up infrastructure managed by Pulumi.

Stackattack exposes a set of simple, self-contained building blocks that can be composed to quickly set up working infrastructure with all of the benefits of Infra-as-code: you can modify your infrastructure with a typical PR-based development workflow, your infrastructure configs are versioned alongside the rest of your code, and you can easily deploy additional copies of your infrastructure as needed.

## Quick Example

The following is a complete configuration for two stacks, one providing shared, stateful resources like a VPC, database instance, ECS cluster, and S3 bucket. Then a second one deploys an application on that ECS cluster; for more information on why the stacks are structured this way check out [Structuring Stacks](/components/structuring-stacks/)

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
    storageBucket: storage.bucket.bucket,
  };
}

function app() {
  // type-safe stack reference
  const envRef = saws.stackRef('username/project/prod', env);

  const cluster = sharedRef.require('cluster');
  const vpc = saws.vpcFromIds(sharedRef.require('vpc'));
  const loadBalancer = sharedRef.require('loadBalancer');

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
      STORAGE_URL: storage.url
    },
    // Run a specific command in a separate container instance; 
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

## Next Steps

Ready to get started? Here's your path forward:

**[Installation →](/getting-started/installation/)**  
Set up StackAttack in your project

**[Quick Start →](/getting-started/quick-start/)**  
Build your first infrastructure with StackAttack

**[Components →](/components/vpc/)**  
Explore the available infrastructure components
