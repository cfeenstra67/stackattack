---
title: Installation
description: How to install and set up StackAttack AWS
---

# Installation

## Prerequisites

- [Node.js](https://nodejs.org/) 18 or later
- [Pulumi CLI](https://www.pulumi.com/docs/get-started/install/)
- AWS credentials configured (via AWS CLI, environment variables, or IAM roles)

## Install the Package

```bash
npm install @stackattack/aws
```

Or with yarn:

```bash
yarn add @stackattack/aws
```

Or with pnpm:

```bash
pnpm add @stackattack/aws
```

## AWS Provider Setup

StackAttack AWS components require the Pulumi AWS provider. Install it in your Pulumi project:

```bash
npm install @pulumi/aws
```

## TypeScript Configuration

If you're using TypeScript, make sure your `tsconfig.json` includes the necessary configuration:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "moduleResolution": "node",
    "declaration": true,
    "strict": true,
    "noImplicitAny": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  }
}
```

## Verify Installation

Create a simple test file to verify everything is working:

```typescript
import { context } from "@stackattack/aws";

const ctx = context({ prefix: "test" });
console.log("StackAttack AWS is ready!");
```

## Next Steps

- [Quick Start](/getting-started/quick-start/) - Build your first infrastructure