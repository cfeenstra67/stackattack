---
title: Context
description: Understanding the Context system for consistent resource management
---

The `Context` is a foundational piece of Stackattack. It provides a consistent way to name, tag, and organize your infrastructure resources.

## What is Context?

A Context is an object that encapsulates:
- **Resource naming patterns** - Consistent prefixes and naming conventions
- **Tags** - Common tags applied to all resources
- **Hierarchical organization** - Ability to create nested contexts for different parts of your infrastructure

## Creating a Context

```typescript
import * as saws from "@stackattack/aws";

// Default context, will generate a prefix based on your project + stack name
const ctx = saws.context();

// Context with custom prefix and tags
const ctx = context({ 
  prefix: "my-app",
  tags: {
    Environment: "production",
    Team: "platform",
    Project: "web-service"
  }
});
```

## Using Context with Components

Every Stackattack component takes a Context as its first parameter:

```typescript
const storage = saws.bucket(ctx, {
  versioned: true,
});

const vpc = saws.vpc(ctx);
```

## Hierarchical Contexts

You can create nested contexts for different parts of your infrastructure:

```typescript
const baseCtx = saws.context();

// Each will have appropriate naming: my-app-storage-*, my-app-database-*
const s3 = saws.bucket(baseCtx.prefix("storage"), { versioned: true });
const db = saws.database(baseCtx.prefix("database"), { network: vpc.network("private"), engine: "postgres" });
```

## Adding Tags

You can add additional tags to a context:

```typescript
const baseCtx = saws.context();

const prodCtx = baseCtx.withTags({ 
  Environment: "production",
  CostCenter: "engineering"
});
```

## Context Methods

- `id(value?: string)` - Generate a resource ID with the context prefix
- `shortId(value: string)` - Generate a short ID with hash for uniqueness
- `tags(others?: Record<string, string>)` - Get tags with optional additional tags merged in
- `prefix(value: string)` - Create a new context with extended prefix
- `withTags(others: Record<string, string>)` - Create a new context with additional tags

This system ensures all your resources follow consistent naming and tagging patterns, making them easier to manage, monitor, and organize.
