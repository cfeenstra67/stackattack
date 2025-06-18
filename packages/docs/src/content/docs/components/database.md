---
title: database
description: database component documentation
---

# database

```typescript
function database(ctx: Context, args: DatabaseArgs): DatabaseOutput
```

### Parameters

- **`ctx`** (`Context`) - The context for resource naming and tagging
- **`args`** (`DatabaseArgs`) - Configuration arguments for the database

## Interfaces

### DatabaseArgs

Configuration arguments for creating an RDS database instance.


### Properties

- **`availabilityZone?`** (`Input<string>`) - Specific availability zone for the database instance
- **`engine?`** (`Input<"postgres">`) - Database engine type (currently only postgres is supported)
- **`instanceType?`** (`Input<string>`) - RDS instance type (defaults to "db.t4g.micro")
- **`name?`** (`Input<string>`) - Name of the database to create (defaults to "main")
- **`network`** (`Network`) - The network configuration (VPC and subnets) for the database
- **`noDeletionProtection?`** (`boolean`) - Whether to disable deletion protection
- **`noPrefix?`** (`boolean`) - Whether to skip adding a prefix to the resource name
- **`password?`** (`Input<string>`) - Master password for the database (auto-generated if not provided)
- **`port?`** (`Input<number>`) - Port number for database connections (defaults to 5432)
- **`sourceSecurityGroupId?`** (`Input<string>`) - Security group ID that should be allowed to access the database
- **`username?`** (`Input<string>`) - Master username for the database (defaults to "root")
- **`version?`** (`Input<string>`) - Database engine version (defaults to "17" for postgres)

### DatabaseOutput

Output from creating a database, containing the instance and connection URL.


### Properties

- **`instance`** (`Instance`) - The RDS instance resource
- **`url`** (`Output<string>`) - Connection URL for the database

## Functions

### databaseToIds

```typescript
function databaseToIds(database: DatabaseOutput): { instance: Output<string>; url: Output<string> }
```

### Parameters

- **`database`** (`DatabaseOutput`) - The database output to convert

