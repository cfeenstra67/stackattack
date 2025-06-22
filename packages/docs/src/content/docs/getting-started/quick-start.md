---
title: Quick Start
description: Build your first infrastructure with StackAttack AWS
---

# Quick Start

This guide will help you create your first infrastructure using StackAttack AWS components.

## Create a New Pulumi Project

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

Replace the contents of `index.ts` with:

```typescript
import { context, vpc, bucket, database } from "@stackattack/aws";

// Create a context for consistent naming and tagging
const ctx = context({ 
  prefix: "my-app",
  tags: {
    Environment: "development",
    Project: "my-project"
  }
});

// Create a VPC with public and private subnets
const network = vpc(ctx, {
  cidr: "10.0.0.0/16",
  availabilityZones: ["us-east-1a", "us-east-1b"],
});

// Create an S3 bucket with best practices enabled
const storage = bucket(ctx, {
  versioned: true,
  allowCors: false,
});

// Create a PostgreSQL database
const db = database(ctx, {
  network,
  engine: "postgres",
  version: "15",
  instanceType: "db.t4g.micro",
});

// Export important values
export const vpcId = network.vpc.id;
export const bucketName = storage.bucket.bucket;
export const databaseUrl = db.url;
```

## Deploy Your Infrastructure

```bash
pulumi up
```

Review the planned changes and select "yes" to create the resources.

## Clean Up

When you're done experimenting, clean up the resources:

```bash
pulumi destroy
```

## What You Built

In just a few lines of code, you created:

- A VPC with public and private subnets across multiple AZs
- Route tables and internet gateway for connectivity
- An S3 bucket with encryption and versioning enabled
- A PostgreSQL database with proper security groups
- All resources properly tagged and named

## Next Steps

- Learn about the [Context concept](/concepts/context/)
- Explore individual [Components](/components/)
- Check out the [Utilities](/utilities/) for additional helpers