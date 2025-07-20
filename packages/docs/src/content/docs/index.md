---
title: Stackattack - Production-Ready Infrastructure Components for Pulumi
description: High-level, production-ready AWS components for Pulumi - Deploy secure, scalable applications with minimal code
template: splash
hero:
  title: Stackattack
  tagline: High-level, production-ready AWS components for Pulumi
  image:
    file: ../../assets/hero.png
  actions:
    - text: Get Started
      link: /getting-started/introduction/
      icon: right-arrow
      variant: primary
    - text: View on GitHub
      link: https://github.com/cfeenstra67/stackattack
      icon: external
      variant: minimal
      attrs:
        rel: me
---

## Features

- **Secure by Default** - All components are designed with secure defaults in mind, allowing you to get started quickly without worrying about security debt
- **Copy/Paste Friendly** - Components are just functions, no heavy abstractions--you can copy/paste and modify them to fit your use-case. It's always easiest to start with something that works!
- **Composable** - Stackattack components are designed to work well with each other and your existing infrastructure resources seamlessly
- **Well Documented** - Comprehensive guides and examples. Each component contains usage examples and cost implications
- **Deploy in Minutes** - From zero to production infrastructure
- **TypeScript First** - Full type safety and excellent IDE support

## Quick Example

The following config deploys service to ECS with a database in ~30 lines, utilizing a handful of Stackattack components:

```typescript
import * as saws from "@stackattack/aws";

export default () => {
  const ctx = saws.context();
  const domain = "api.mydomain.com";

  const vpc = saws.vpc(ctx);

  const db = saws.database(ctx, { network: vpc.network("private") });

  const certificate = saws.certificate(ctx, { domain });

  const loadBalancer = saws.loadBalancer(ctx, {
    network: vpc.network("public"),
    certificate
  });

  const cluster = saws.cluster(ctx, { network: vpc.network("private") });

  const app = saws.service(ctx, {
    cluster,
    domain,
    image: "my-app:latest",
    loadBalancer,
    port: 3000,
    env: { DATABASE_URL: db.url }
  });

  return { appUrl: app.url };
};
```

Check out the [quick start](/getting-started/quick-start/) for setting up a multi-stack environment from scratch, or browse the [components](/components/) for a listing of all of the components that Stackattack provides.

The example above uses the following components:
- [vpc](/components/vpc/) - Creates a working VPC and associated resources such as subnets, NAT gateway, route tables, and more.
- [database](/components/database/) - Creates a PostgreSQL instance running on RDS.
- [certificate](/components/certificate/) - Creates a certificate using AWS ACM.
- [loadBalancer](/components/load-balancer/) - Creates a load balancer and listener, optionally associated with a default certificate.
- [cluster](/components/cluster/) - Creates an ECS cluster, auto-scaling group, and capacity provider for running services.
- [service](/components/service/) - Creates an ECS service to run docker containers on, with optional auto-scaling.
