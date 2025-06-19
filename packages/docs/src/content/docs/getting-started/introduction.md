---
title: Introduction
description: Production-ready AWS infrastructure components for Pulumi
---

<div class="intro-hero">

# Welcome to StackAttack AWS

**Production-ready infrastructure components for the modern cloud**

StackAttack AWS provides a curated collection of battle-tested infrastructure components built on top of Pulumi. Say goodbye to boilerplate and hello to infrastructure that just works.

</div>

## Why StackAttack AWS?

**Reduced boilerplate**: Common patterns are abstracted into reusable components that eliminate repetitive infrastructure code.

**Best practices built-in**: Security, monitoring, and operational best practices are included by default—no more forgetting to enable encryption or configure access logging.

**Consistent patterns**: All components follow the same naming, tagging, and configuration conventions, making your infrastructure predictable and maintainable.

**Type safety**: Full TypeScript support with comprehensive type definitions means fewer runtime errors and better developer experience.

**Simplicity**: No abstractions, just functions. You can import the library to access them, or copy/paste them into your codebase and modify them to your heart's content.

## Philsophy

Stackattack was created for one simple reason: **there's too much code needed to get up and running with infra-as-code**. Most of the time, putting up infrastructure with IaC tools requires a slow, iterative process of cross referencing Pulumi/Terraform docs, cross-referencing them with AWS docs, and trial-and-error to get things working.

Most of the time, what you really want is to get something working quickly with reasonable defaults, then make adjustments if you have more specific requirements. Stackattack aims to be the best way to get started setting up infrastructure managed by Pulumi.

Stackattack exposes a set of simple, self-contained building blocks that can be composed to quickly set up working infrastructure with all of the benefits of Infra-as-code: you can modify your infrastructure with a typical PR-based development workflow, your infrastructure configs are versioned alongside the rest of your code, and you can easily deploy additional copies of your infrastructure as needed.

## Quick Example

This sets up a containerized API deployment, served through a load balancer with HTTPS, with access to a PostgreSQL database.

```typescript
import * as saws from '@stackattack/aws';

const ctx = saws.context();

// Create a VPC with public and private subnets
const vpc = saws.vpc(ctx, { 
  cidr: '10.0.0.0/16' 
});

// Create an encrypted S3 bucket
const storage = saws.bucket(ctx, { 
  versioned: true, 
  encrypted: true 
});

const cluster = saws.cluster(ctx, {
  network: vpc.network("private"),
  instances: {
    architecture: "arm64",
    memoryMib: { min: 4096, max: 8192 },
    vcpuCount: { min: 2, max: 4 },
    memoryGibPerVcpu: { min: 2, max: 2 },
  },
  maxSize: 5,
});

const database = saws.database(ctx, {
  network: vpc.network("private")
});

const certificate = saws.certificate(ctx, {
  domain: "mysite.com",
  wildcard: true,
});

const loadBalancer = saws.loadBalancer(ctx, {
  network: vpc.network("public"),
  certificate,
});

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
    DATABASE_URL: database.url
  }
});
```

## Next Steps

Ready to get started? Here's your path forward:

**[Installation →](/getting-started/installation/)**  
Set up StackAttack AWS in your project

**[Quick Start →](/getting-started/quick-start/)**  
Build your first infrastructure with StackAttack AWS

**[Components →](/components/vpc/)**  
Explore the available infrastructure components
