---
title: redis
description: redis component documentation
---

# redis

```typescript
function redis(ctx: Context, args: RedisArgs): RedisOutput
```

### Parameters

- **`ctx`** (`Context`) - The context for resource naming and tagging
- **`args`** (`RedisArgs`) - Configuration arguments for the Redis cluster

## Interfaces

### RedisArgs

Configuration arguments for creating an ElastiCache Redis cluster.


### Properties

- **`availabilityZone?`** (`Input<string>`) - Specific availability zone for the cluster
- **`engine?`** (`Input<string>`) - ElastiCache engine type (defaults to "redis")
- **`engineVersion?`** (`Input<string>`) - Engine version (defaults to "6.x")
- **`network`** (`Network`) - The network configuration (VPC and subnets) for the Redis cluster
- **`nodeType?`** (`Input<string>`) - Instance type for cache nodes (defaults to "cache.t4g.micro")
- **`noPrefix?`** (`boolean`) - Whether to skip adding a prefix to the resource name
- **`numNodes?`** (`Input<number>`) - Number of cache nodes in the cluster (defaults to 1)
- **`parameters?`** (`Record<string, Input<string>>`) - Custom parameters for the parameter group
- **`port?`** (`Input<number>`) - Port number for Redis connections (defaults to 6379)
- **`sourceSecurityGroupId?`** (`Input<string>`) - Security group ID that should be allowed to access the cluster

### RedisOutput

Output from creating a Redis cluster, containing the instance and connection URL.


### Properties

- **`instance`** (`Cluster`) - The ElastiCache cluster resource
- **`url`** (`Output<string>`) - Connection URL for the Redis cluster

