---
title: StackAttack AWS - Production-Ready Infrastructure Components for Pulumi
description: Deploy secure, scalable AWS infrastructure with minimal code. TypeScript components for VPC, ECS, RDS, S3, and more. Infrastructure as code made simple.
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

This configuration deploys an Astro site served on a custom domain with HTTPS:

```ts
import * as saws from '@stackattack/aws';

const ctx = saws.context();

const bucket = saws.bucket(ctx, { paths: ["./dist"] });

saws.staticSite(ctx, {
  bucket,
  domain: "www.mysite.com",
  adapter: saws.astroAdapter(),
});
```

Check out the [quick start](/getting-started/quick-start) for an example of deploying a containerized services, or the [components](/components) for a listing of all of the components that Stackattack provides.
