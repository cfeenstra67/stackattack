# StackAttack AWS

Production-ready AWS infrastructure components for Pulumi. Deploy complex applications with minimal code using secure, opinionated defaults.

🚀 **[Get Started →](https://stackattack.camfeenstra.com)** | 📚 **[Documentation](https://stackattack.camfeenstra.com/components/)** | 💡 **[Examples](https://stackattack.camfeenstra.com/getting-started/quick-start/)**

## What is StackAttack?

StackAttack eliminates infrastructure boilerplate by providing battle-tested AWS components built on Pulumi. Instead of writing hundreds of lines of infrastructure code, deploy production-ready applications in under 100 lines.

```typescript
import { context, vpc, database, service, loadBalancer } from "@stackattack/aws";

const ctx = context({ prefix: "my-app" });

// Create complete infrastructure in ~20 lines
const network = vpc(ctx, { cidr: "10.0.0.0/16" });
const db = database(ctx, { network, engine: "postgres" });
const lb = loadBalancer(ctx, { network: network.network("public") });

const app = service(ctx, {
  cluster: cluster(ctx, { network: network.network("private") }),
  image: "my-app:latest",
  loadBalancer: lb,
  env: { DATABASE_URL: db.url }
});
```

## Key Features

- **🔒 Secure by Default** - Encryption, private subnets, least-privilege IAM
- **⚡ Deploy in Minutes** - From zero to production infrastructure
- **🎯 TypeScript First** - Full type safety and excellent IDE support  
- **🔧 Composable** - Mix and match components for any architecture
- **📖 Well Documented** - Comprehensive guides and examples

## Available Components

**Networking & Security**: VPC, Load Balancer, VPN, Certificates  
**Compute**: ECS Clusters, Services, Static Sites  
**Storage**: S3 Buckets, RDS Databases, Redis  
**Integration**: Email Domains, GitHub Actions, Webhooks

[→ View all components](https://stackattack.camfeenstra.com/components/)

## Quick Start

```bash
npm install @stackattack/aws
```

Create your first stack:

```typescript
import { context, vpc, bucket } from "@stackattack/aws";

const ctx = context({ prefix: "hello-world" });

const network = vpc(ctx, { cidr: "10.0.0.0/16" });
const storage = bucket(ctx, { versioned: true });

export const vpcId = network.vpc.id;
export const bucketName = storage.bucket.bucket;
```

Deploy with Pulumi:

```bash
pulumi up
```

## Why StackAttack?

**Before StackAttack** (200+ lines):
```typescript
// Dozens of AWS resources with complex interdependencies
// Security groups, subnets, route tables, IAM roles...
// Easy to misconfigure, hard to maintain
```

**With StackAttack** (20 lines):
```typescript
const ctx = context({ prefix: "my-app" });
const network = vpc(ctx, { cidr: "10.0.0.0/16" });
const app = service(ctx, { network, image: "my-app:latest" });
```

## Documentation

**[📚 Full Documentation →](https://stackattack.camfeenstra.com)**

- [Getting Started Guide](https://stackattack.camfeenstra.com/getting-started/introduction/)
- [Component Reference](https://stackattack.camfeenstra.com/components/)
- [Working with Pulumi](https://stackattack.camfeenstra.com/working-with-pulumi/)

## Philosophy

Most infrastructure-as-code requires too much boilerplate. StackAttack provides the 80% solution that works for most production applications, with the flexibility to customize when needed.

**Composition over Inheritance** - Simple functions that work together  
**Secure Defaults** - Best practices built-in, not bolted-on  
**Copy-Paste Friendly** - No vendor lock-in, functions you can own

## License

MIT - Use it, modify it, ship it.

---

*Built with ❤️ for the Pulumi community*