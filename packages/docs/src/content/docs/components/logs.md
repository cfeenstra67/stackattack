---
title: logs
description: logs component documentation
---

## Functions

### getLogGroupId

```typescript
function getLogGroupId(input: LogGroupInput): Output<string>
```

### Parameters

- **`input`** (`LogGroupInput`) - The log group input (string, log group resource, or log group result)

## Types

### LogGroupInput

Union type representing different ways to reference a CloudWatch log group.

```typescript
type LogGroupInput = pulumi.Input<string> | pulumi.Input<aws.cloudwatch.LogGroup> | pulumi.Input<aws.cloudwatch.GetLogGroupResult>
```

