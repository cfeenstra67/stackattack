# Stackattack

Stackattack provides a curated collection of high-level infrastructure components built on top of Pulumi. It allows you to deploy your applications on robust, secure infrastructure without giving up any control or spending days putting it together. Components are just functions, making them copy-paste friendly, so you can choose to use Stackattack as a library or just a set of working examples that you can take and modify for your own purposes.

**[Get Started](https://stackattack.camfeenstra.com/getting-started/quick-start/)** | **[Components](https://stackattack.camfeenstra.com/components)** | **[Examples](https://github.com/cfeenstra67/stackattack/tree/main/examples)**

## What is Stackattack?

Stackattack eliminates infrastructure boilerplate by providing battle-tested AWS components with good defaults built on Pulumi. Instead of writing hundreds of lines of infrastructure code, deploy production-ready applications with a fraction of the effort it takes to wire it all up yourself. The following config deploys service to ECS with a database in ~30 lines:

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

_NOTE_: While this example is meant to demonstrate how much you can do with Stackattack with a small amount of code, it is not recommended to structure your infrastructure code this way with everying in a single stack. See the [Structuring Stacks](https://stackattack.camfeenstra.com/working-with-pulumi/structuring-stacks/) section for recommendations on how separating your resources into stacks.

## Features

- **Secure by Default** - All components are designed with secure defaults in mind, allowing you to get started quickly without worrying about security debt
- **Copy/Paste Friendly** - Components are just functions, no heavy abstractions--you can copy/paste and modify them to fit your use-case. It's always easiest to start with something that works!
- **Composable** - Stackattack components are designed to work well with each other and your existing infrastructure resources seamlessly
- **Well Documented** - Comprehensive guides and examples. Each component contains usage examples and cost implications
- **Deploy in Minutes** - From zero to production infrastructure
- **TypeScript First** - Full type safety and excellent IDE support

## Documentation

- [Full Documentation](https://stackattack.camfeenstra.com)
- [Getting Started Guide](https://stackattack.camfeenstra.com/getting-started/introduction/)
- [View all components](https://stackattack.camfeenstra.com/components/)

## Support and Feature Requests

Please [open an issue](https://github.com/cfeenstra67/stackattack/issues/new) if you have any trouble using stackattack or want to request additional components.
