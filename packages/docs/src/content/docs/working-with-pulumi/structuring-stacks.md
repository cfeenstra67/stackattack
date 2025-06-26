---
title: Structuring Stacks
description: This section offers recommendations on how to structure the stacks that make up your infrastructure.
---

When deploying infrastructure with Pulumi, you often do not want to deploy all of your resources as a single stack. There are a few reasons for this:
- Isolation - In Pulumi, when you run `pulumi preview`/`pulumi up` it diffs/deploys the entire stack at once; there's no mechanism to target a subset of resources when planning/applying or anything like that. Separating stacks gives you guarantees that resources in one stack won't be altered by another stack's deployment. For example, deploying my API services won't drop our production database.
- Reuse - You can use `pulumi config` to templatize your configs and deploy copies of stacks that may or may not share the same infrastructure.
- Performance - as the number of resources in a stack grows, it takes longer and longer to do `pulumi up`, `pulumi refresh`, etc. If you add all of your resources to a single pulumi stack, deploying individual services or components will get slower and slower.  Restructuring/splitting up existing stacks can be a lot of work.

You can use outputs and stack reference to pass data between stacks, and Stackattack provides the [stackRef](/utilities/stack-ref) function which adds type safety. A simple example, using a shared wildcard certificate with a static Astro site deployed via Cloudfront:

First, add the `stack-type` key to your pulumi config:
```bash
pulumi config set stack-type env -s my-env-stack
pulumi config set stack-type api -s my-api-stack
# Add a config for the shared infrastructure stack
pulumi config set env-stack my-env-stack -s my-api-stack
```

```ts
import * as pulumi from '@pulumi/pulumi';
import * as saws from '@stackattack/aws';

function env() {
  const ctx = saws.context();

  const certificate = saws.certificate(ctx, {
    domain: "mydomain.dev",
    wildcard: true
  });

  return { certificate };
}

function app() {
  const ctx = saws.context();
  const config = new pulumi.Config();

  const envStack = saws.stackRef(config.require('env-stack'), env);

  const certificate = envStack.require('certificate');

  const bucket = saws.bucket(ctx, {
    paths: ["./dist"]
  });

  const site = saws.staticSite(ctx, {
    domain: "docs.mydomain.dev",
    certificate,
    bucket,
    adapter: saws.astroAdapter()
  });

  return { url: site.url };
}

export default () => saws.select({ env, app });
```

## Grouping your resources

In general, the most important distinctions to make between your resources when structuring stacks are:
- **Stateful vs. Stateless** - Stateful resources in this context should be considered those that _cannot be recreated in the same state once destroyed_, and more generally _things you never want to accidentally destroy_. You usually want to group your stateful resources together into a single stack per environment. For example, for your staging environment you might have an S3 bucket for file storage, an RDS instance, a redis instance, an ECS cluster, etc. You then group your stateless resources by _what you want to deploy together_. This would usually mean a single project's resources, which would reference your shared staging infrastructure. This gives you the flexibility to deploy new services, create copies of services, or whatever else you might want need without independently from your shared infrastructure (which would typically be changed less often).
- **Unique Resources** - Some resources can only exist in a particular configuration once within an AWS account. For example, in a particular region two ACM certificates cannot have identical domain names. Anything that cannot (or should not) have multiple copies exist should be considered similar to a stateful resource--it should go in your shared infrastructure stack.
- **Costs** - Ensure that you have some awareness of what components of your stack cost; if something is expensive and can be shared across stacks rather than being recreated multiple times (for each service, etc.) it can help reduce costs.
- **Deployment speed** - You'll find that some resources deploy quickly, and others can be very slow. Ideally your applications stacks, which you'll deploy frequently, should keep the "slow" resources to a minimum to make deploys as fast as possible.
