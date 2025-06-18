---
title: service
description: service component documentation
---

# service

```typescript
function service(ctx: Context, args: ServiceArgs): ServiceOutput
```

### Parameters

- **`ctx`** (`Context`) - The context for resource naming and tagging
- **`args`** (`ServiceArgs`) - Configuration arguments for the service

## Interfaces

### ServiceOutput

Output from creating an ECS service, containing the service resource and URLs.


### Properties

- **`internalUrl?`** (`Output<string>`) - 
- **`service`** (`Service`) - 
- **`url?`** (`Output<string>`) - 

### TaskDefinitionArgs

Configuration arguments for creating an ECS task definition.


### Properties

- **`command?`** (`Input<string[]>`) - 
- **`cpu?`** (`Input<number>`) - 
- **`env?`** (`Record<string, Input<string>>`) - 
- **`healthcheck?`** (`{ command?: Input<string>; interval?: Input<number>; path?: Input<string>; retries?: Input<number>; startPeriod?: Input<number> }`) - 
- **`image`** (`Input<string>`) - 
- **`init?`** (`{ command: Input<string[]>; env?: Record<string, Input<string>>; image?: Input<string>; stopTimeout?: Input<number> }`) - 
- **`logRetention?`** (`Input<number>`) - 
- **`memory?`** (`Input<number>`) - 
- **`name`** (`Input<string>`) - 
- **`noPrefix?`** (`boolean`) - 
- **`port?`** (`Input<number>`) - 
- **`role?`** (`Input<string>`) - 

## Functions

### checkEcsDeployment

```typescript
function checkEcsDeployment(service: Service, taskDefinition: TaskDefinition): Output<string>
```

### Parameters

- **`service`** (`Service`) - The ECS service to check
- **`taskDefinition`** (`TaskDefinition`) - The expected task definition

### taskDefinition

```typescript
function taskDefinition(ctx: Context, args: TaskDefinitionArgs): TaskDefinition
```

### Parameters

- **`ctx`** (`Context`) - The context for resource naming and tagging
- **`args`** (`TaskDefinitionArgs`) - Configuration arguments for the task definition

## Types

### ServiceArgs

Configuration arguments for creating an ECS service, extending TaskDefinitionArgs.

```typescript
type ServiceArgs = TaskDefinitionArgs & { cluster: pulumi.Input<ClusterResourcesInput>; domain?: pulumi.Input<string>; loadBalancer?: LoadBalancerWithListener; network: NetworkInput; replicas?: pulumi.Input<number>; securityGroups?: pulumi.Input<pulumi.Input<string>[]>; zone?: pulumi.Input<string> }
```

