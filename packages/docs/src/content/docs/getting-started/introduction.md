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

## Architecture Philosophy

### Context-Driven Design
The `Context` is the foundation of StackAttack AWS. It provides consistent resource naming, tagging, and organization across all components, ensuring your infrastructure is organized and discoverable.

### Component Composition
Components are designed as building blocks that create multiple related AWS resources. For example, the `vpc` component creates a VPC, subnets, route tables, and internet gateway—everything you need for a complete network foundation.

### Seamless Integration
Components work together seamlessly. Outputs from one component can be easily used as inputs to another, enabling you to build complex infrastructure with simple, readable code.

## Quick Example

```typescript
import { bucket, vpc, service } from '@stackattack/aws';
import { context } from './shared';

// Create a VPC with public and private subnets
const network = vpc(context, { 
  cidr: '10.0.0.0/16' 
});

// Create an encrypted S3 bucket
const storage = bucket(context, { 
  versioned: true, 
  encrypted: true 
});

// Deploy a containerized service
const app = service(context, {
  image: 'nginx:latest',
  network: network.network('private'),
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