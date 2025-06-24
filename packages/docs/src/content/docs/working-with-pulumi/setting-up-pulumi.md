---
title: Setting up Pulumi
description: This section offers tips for getting started with Pulumi--the first thing to determine is where your stack states are going to be stored.
---

## Backend + Secrets Provider Selection

The first decision when setting up Pulumi is choosing where to store your stack state and how to encrypt secrets. Two good options are:

- [Pulumi Cloud](#pulumi-cloud) - You can use the Pulumi API to store the state of your stacks and resources as well as encrypt your secrets. This is the default method used if you don't configure anything.
    - **Pros**: Easy to set up, you can use https://app.pulumi.com which includes lots of nice features like a UI to view your stacks and resources, built-in secrets management, and other features like Pulumi ESC and IDP.
    - **Cons**: **Relatively expensive**. Pulumi Cloud's free tier only offers 200 free resources, and then you're charged at $0.36 per managed resource. Their other features also have usage limitation on the free tier. Typically setting up a full, working infrastructure requires _a lot_ of individual resources (it's a big part of why Stackattack was created!), so if you're using Pulumi to deploy a production application it's likely that you will quickly reach the limit of the free tier, and a bit of math will tell you you're on the hook for at least ~$70/month. 
- [S3 + KMS](#s3--kms) - You can store the state of your pulumi stacks directly on S3, and use a KMS key to encrypt your secrets. This requires [additional configuration](#s3--kms).
    - **Pros**: Cheap (S3 and KMS costs should be minimal, even with a lot of deployment activity), no dependency on Pulumi Cloud
    - **Cons**: requires extra configuration on each stack, [may be slower](https://github.com/pulumi/pulumi/issues/10057), no UI/additional tooling available


Note that [Pulumi has documentation on how to migrate between backends](https://www.pulumi.com/docs/iac/concepts/state-and-backends/#migrating-between-state-backends), so it's fine to start with Pulumi Cloud and move to S3 later when you have a need.

### Pulumi Cloud

To deploy stacks with Pulumi Cloud as a backend, you first must log in:

```bash
pulumi login
```

Then once your [new](/getting-started/quick-start#if-needed-create-a-new-pulumi-project) or [existing](#adding-pulumi-to-an-existing-typescript-project) project is set up, you can create new stacks like so (should be run within the same directory as you `Pulumi.yaml` file):
```bash
pulumi stack init my-new-api-stack
```

And deploy them:
```bash
pulumi up
```

### S3 + KMS

Prerequisites:
- You must have an S3 Bucket where you'd like to store your state
- You must have a KMS key that can be used for signing secrets

You can create these resource manually, or create a simple Pulumi stack to create these resources for you as follows:
```ts
import * as aws from '@pulumi/aws';
import * as pulumi from '@pulumi/pulumi';
import * as saws from '@stackattack/aws';

const ctx = saws.context();

// Create an S3 bucket
const bucket = saws.bucket(ctx);

// Create a KMS signing key
const pulumiSigningKey = new aws.kms.Key(ctx.id('pulumi-key'), {
  description: 'Pulumi secret signing key',
  tags: ctx.tags(),
});

return {
  backend: bucket.url,
  secretsProvider: pulumi.interpolate`awskms://${pulumiSigningKey.id}`,
};
```
You'd have to deploy this stack using Pulumi Cloud initially, though you can migrate it to S3 later or just leave that one stack in Pulumi Cloud.

Once you have your resources ready, you can use them as follows:

To use an S3 bucket as your backend for pulumi stacks, you must specify the S3 URL when logging in:
```bash
pulumi login s3://your-pulumi-state-bucket
```

This only needs to be done **once**.

Each time you create a new stack, you also must provide the `--secrets-provider=awskms://...` flag:
```bash
pulumi stack init my-new-api-stack --secrets-provider=awskms://kms-key-uuid-goes-here
```

Aside from that additional setup, everything else is the same! To deploy your stack, simply run:
```bash
pulumi up
```

## Adding Pulumi to an Existing TypeScript Project

The "happy path" of setting up Pulumi with `pulumi init` only works for new packages/projects, as it wants to set up an entire directory, not just the required files to make Pulumi work. To add Pulumi to an existing project/package, follow the following steps:

To add Pulumi to an existing TypeScript project:

1. **Create a Pulumi.yaml file** in your project root:

```yaml
name: your-project-name
# This is the entry point for your pulumi config. You can change
# it to what you want, but _it must be in the same directory as your
# tsconfig.json file_
main: infra.ts
runtime: nodejs
# If you're using ES Modules, use this `runtime` config instead:
# runtime:
#   name: nodejs
#   options:
#     nodeargs: "--loader ts-node/esm --no-warnings"
description: Your project description
```

2. **Install Pulumi dependencies**:

```bash
npm install --save-dev @pulumi/pulumi @pulumi/aws @stackattack/aws
```

3. **Initialize your stack**:

```bash
# Using Pulumi API
pulumi stack init dev

# Using S3 backend with S3-based secrets
pulumi stack init dev --secrets-provider="awskms://your-kms-key-id"
```

4. **Create your infrastructure file**:

Example entrypoint (`infra.ts` in the example config above):
```typescript
import * as saws from "@stackattack/aws";

const ctx = saws.context();

// Your infrastructure code here
const vpc = saws.vpc(ctx);

export { vpc: saws.vpcToIds(vpc) }
```

5. **Deploy it**:

Deploy your infrastructure with:
```bash
pulumi up
```
