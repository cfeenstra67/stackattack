---
title: Resource Naming
description: Understanding StackAttack's resource naming conventions
---

# Resource Naming

*Documentation coming soon...*

StackAttack AWS follows consistent naming patterns to make resources easy to identify and manage.

## Naming Patterns

- Resource names use kebab-case
- Prefixes are applied consistently 
- Hash suffixes for uniqueness when needed

## Examples

```typescript
// Context with prefix "my-app"
const ctx = context({ prefix: "my-app" });

// Creates resources named like:
// - my-app-bucket-xyz123
// - my-app-database-subnet-group
// - my-app-vpc-internet-gateway
```