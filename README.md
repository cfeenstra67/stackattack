# Stackattack

Production-ready AWS infrastructure components for Pulumi, written in Typescript. Deploy complex applications with minimal code using secure, opinionated defaults.

**[Get Started](https://stackattack.camfeenstra.com/getting-started/quick-start)** | **[Components](https://stackattack.camfeenstra.com/components)** | **[Examples](https://github.com/cfeenstra67/stackattack/tree/main/examples)**

## What is Stackattack?

Stackattack eliminates infrastructure boilerplate by providing battle-tested AWS components with good defaults built on Pulumi. Instead of writing hundreds of lines of infrastructure code, deploy production-ready applications with a fraction of the effort it takes to wire it all up yourself. The following config deploys service to ECS with a database in ~30 lines:

```typescript
import * as saws from "@stackattack/aws";

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

export const appUrl = app.url;
```

## Key Features

- **Secure by Default** - Encryption, private subnets, least-privilege IAM
- **Copy/Paste Friendly** - Components are just functions, no heavy abstractions--you can copy/paste and modify them to fit your use-case. It's always easiest to start with something that works!
- **Deploy in Minutes** - From zero to production infrastructure
- **TypeScript First** - Full type safety and excellent IDE support
- **Composable** - Mix and match components for any architecture
- **Well Documented** - Comprehensive guides and examples. Each component contains usage examples and cost implications.

## Documentation

- [Full Documentation](https://stackattack.camfeenstra.com)
- [Getting Started Guide](https://stackattack.camfeenstra.com/getting-started/introduction/)
- [Component Reference](https://stackattack.camfeenstra.com/components/)
- [Working with Pulumi](https://stackattack.camfeenstra.com/working-with-pulumi/)
- [View all components](https://stackattack.camfeenstra.com/components/)

## Support and Feature Requests

Please [open an issue](https://github.com/cfeenstra67/stackattack/issues/new) if you have any trouble using stackattack or want to request additional components.
