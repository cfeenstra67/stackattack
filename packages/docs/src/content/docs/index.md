---
title: StackAttack AWS
description: Production-ready AWS infrastructure components for Pulumi
template: splash
hero:
  title: StackAttack AWS
  tagline: Production-ready AWS infrastructure components for Pulumi
  image:
    file: ../../assets/hero.png
  actions:
    - text: Get Started
      link: /getting-started/introduction/
      icon: right-arrow
      variant: primary
    - text: View Components
      link: /components/
      icon: external
---

## Features

- **Type-safe**: Built with TypeScript for excellent IDE support and type safety
- **Production-ready**: Battle-tested components used in production environments  
- **Consistent**: Standardized naming, tagging, and configuration patterns
- **Composable**: Mix and match components to build complex infrastructure
- **Well-documented**: Comprehensive documentation with examples

## Quick Example

```typescript
import { context, bucket, database, vpc } from "@stackattack/aws";

const ctx = context({ prefix: "my-app" });

// Create a VPC with public and private subnets
const network = vpc(ctx, {
  cidr: "10.0.0.0/16",
  availabilityZones: ["us-east-1a", "us-east-1b"],
});

// Create an S3 bucket with encryption and versioning
const storage = bucket(ctx, {
  versioned: true,
  encrypted: true,
});

// Create a PostgreSQL database
const db = database(ctx, {
  network,
  engine: "postgres",
  instanceType: "db.t4g.micro",
});
```