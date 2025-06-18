---
title: Context
description: Understanding the Context system for consistent resource management
---

# Context

The `Context` is the foundation of StackAttack AWS. It provides a consistent way to name, tag, and organize your infrastructure resources.

## What is Context?

A Context is an object that encapsulates:
- **Resource naming patterns** - Consistent prefixes and naming conventions
- **Tags** - Common tags applied to all resources
- **Hierarchical organization** - Ability to create nested contexts for different parts of your infrastructure

## Creating a Context

```typescript
import { context } from "@stackattack/aws";

// Basic context with just a prefix
const ctx = context({ prefix: "my-app" });

// Context with tags
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

Every StackAttack component takes a Context as its first parameter:

```typescript
const storage = bucket(ctx, {
  versioned: true,
  encrypted: true,
});

const network = vpc(ctx, {
  cidr: "10.0.0.0/16",
  availabilityZones: ["us-east-1a", "us-east-1b"],
});
```

## Hierarchical Contexts

You can create nested contexts for different parts of your infrastructure:

```typescript
const baseCtx = context({ 
  prefix: "my-app",
  tags: { Environment: "prod" }
});

// Create a context for storage resources
const storageCtx = baseCtx.prefix("storage");

// Create a context for database resources  
const dbCtx = baseCtx.prefix("database");

// Each will have appropriate naming: my-app-storage-*, my-app-database-*
const s3 = bucket(storageCtx, { versioned: true });
const db = database(dbCtx, { network, engine: "postgres" });
```

## Adding Tags

You can add additional tags to a context:

```typescript
const baseCtx = context({ prefix: "my-app" });

const prodCtx = baseCtx.withTags({ 
  Environment: "production",
  CostCenter: "engineering"
});
```

## Context Methods

- `id(value?)` - Generate a resource ID with the context prefix
- `shortId(value)` - Generate a short ID with hash for uniqueness
- `tags(others?)` - Get tags with optional additional tags merged in
- `prefix(value)` - Create a new context with extended prefix
- `withTags(others)` - Create a new context with additional tags

This system ensures all your resources follow consistent naming and tagging patterns, making them easier to manage, monitor, and organize.