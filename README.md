# Stackattack

Production-ready AWS infrastructure components for Pulumi. Deploy complex applications with minimal code using secure, opinionated defaults.

**[Get Started](https://stackattack.camfeenstra.com)** | **[Components](https://stackattack.camfeenstra.com/components/)** | **[Examples](https://github.com/cfeenstra67/stackattack/tree/main/examples)**

## What is StackAttack?

StackAttack eliminates infrastructure boilerplate by providing battle-tested AWS components with good defaults built on Pulumi. Instead of writing hundreds of lines of infrastructure code, deploy production-ready applications with a fraction of the effort it takes to wire it all up yourself. The following config deploys service to ECS with a database in ~30 lines:

```typescript
import * as saws from "@stackattack/aws";

const ctx = saws.context();
const domain = "api.mydomain.com";

const vpc = saws.vpc(ctx);

const db = saws.database(ctx, { network: vpc.network("private") });

const certificate = saws.certificate(ctx, { domain });

const loadBalancer = saws.loadBalancer(ctx, {
  network: vpc.network("public"),
  cerificate
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
- **Deploy in Minutes** - From zero to production infrastructure
- **TypeScript First** - Full type safety and excellent IDE support  
- **Composable** - Mix and match components for any architecture
- **Well Documented** - Comprehensive guides and examples

## Available Components

**Networking & Security**: VPC, Load Balancer, VPN, Certificates  
**Compute**: ECS Clusters, Services, Static Sites  
**Storage**: S3 Buckets, RDS Databases, Redis  
**Integration**: Email Domains, GitHub Actions, Webhooks

[View all components](https://stackattack.camfeenstra.com/components/)

## Quick Start

```bash
npm install @stackattack/aws
```

Create a stack, or use the components within an existing stack:

```typescript
import * as saws from "@stackattack/aws";

const ctx = saws.context();
const domain = "my.astro.site";

const bucket = saws.bucket(ctx, { paths: ["./dist"] })

saws.staticSite(ctx, {
  bucket,
  domain,
  adapter: saws.astroAdapter(),
});

export const url = `https://${domain}`;
```

Deploy with Pulumi:

```bash
pulumi up
```

Test your deployed resources:

```bash
curl https://my.astro.site
```

**[Full Documentation](https://stackattack.camfeenstra.com)**

- [Getting Started Guide](https://stackattack.camfeenstra.com/getting-started/introduction/)
- [Component Reference](https://stackattack.camfeenstra.com/components/)
- [Working with Pulumi](https://stackattack.camfeenstra.com/working-with-pulumi/)

## Philosophy

Most infrastructure-as-code requires too much boilerplate. StackAttack provides the 80% solution that works for most production applications, with the flexibility to customize when needed.

**Composition over Inheritance** - Simple functions that work together  
**Secure Defaults** - Best practices built-in, not bolted-on  
**Copy-Paste Friendly** - No vendor lock-in, functions you can own
