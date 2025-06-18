---
title: vpc
description: vpc component documentation
---

# getVpcAttributes

```typescript
function getVpcAttributes(input: Input<VpcInput>): Output<Vpc | GetVpcResult>
```

### Parameters

- **`input`** (`Input<VpcInput>`) - VPC input in any supported format

## Interfaces

### CidrAllocator

Interface for allocating CIDR blocks within a VPC.


### Properties

- **`allocate`** (`(netmask: number) => Output<string>`) - Allocates a subnet with the specified netmask within the VPC CIDR block
- **`counter`** (`() => OutputInstance<number>`) - Returns the current allocation counter

### InternetGatewayArgs

Arguments for creating an Internet Gateway.


### Properties

- **`noPrefix?`** (`boolean`) - Whether to skip adding prefix to the resource name
- **`vpc`** (`Input<VpcInput>`) - The VPC to attach the Internet Gateway to

### Network

Represents a network configuration with VPC and subnets.


### Properties

- **`subnetIds`** (`Output<string>[]`) - Array of subnet IDs in the network
- **`vpc`** (`Vpc`) - The VPC resource

### NetworkInput

Input type for network configuration.


### Properties

- **`subnetIds`** (`Input<Input<string>[]>`) - Array of subnet ID inputs
- **`vpc`** (`Input<VpcInput>`) - The VPC input

### VPCFlowLogsArgs

Arguments for creating VPC Flow Logs.


### Properties

- **`noPrefix?`** (`boolean`) - Whether to skip adding prefix to the resource name
- **`vpc`** (`VpcInput`) - The VPC to enable flow logs for

### VPCFlowLogsRoleArgs

Arguments for creating a VPC Flow Logs IAM role.


### Properties

- **`logGroup`** (`LogGroupInput`) - The log group where flow logs will be written
- **`noPrefix?`** (`boolean`) - Whether to skip adding prefix to the resource name

### VpcIds

Interface representing VPC resources as IDs for serialization.


### Properties

- **`counter`** (`OutputInstance<number>`) - CIDR allocation counter
- **`privateSubnetIds`** (`Output<string>[]`) - Array of private subnet IDs
- **`publicSubnetIds`** (`Output<string>[]`) - Array of public subnet IDs
- **`vpc`** (`Output<string>`) - The VPC ID

## Functions

### getVpcDefaultSecurityGroup

```typescript
function getVpcDefaultSecurityGroup(vpcId: Input<string>): Output<GetSecurityGroupResult>
```

### Parameters

- **`vpcId`** (`Input<string>`) - The VPC ID to get the default security group for

### getVpcDnsServer

```typescript
function getVpcDnsServer(cidrBlock: Input<string>): Output<string>
```

### Parameters

- **`cidrBlock`** (`Input<string>`) - The VPC CIDR block

### getVpcId

```typescript
function getVpcId(input: Input<VpcInput>): Output<string>
```

### Parameters

- **`input`** (`Input<VpcInput>`) - VPC input in any supported format

### internetGateway

```typescript
function internetGateway(ctx: Context, args: InternetGatewayArgs): InternetGateway
```

### Parameters

- **`ctx`** (`Context`) - The context for resource naming and tagging
- **`args`** (`InternetGatewayArgs`) - Internet Gateway configuration arguments

### subnets

```typescript
function subnets(ctx: Context, args: SubnetsArgs): { privateSubnetIds: Output<string>[]; publicSubnetIds: Output<string>[] }
```

### Parameters

- **`ctx`** (`Context`) - The context for resource naming and tagging
- **`args`** (`SubnetsArgs`) - Subnet configuration arguments

### vpc

```typescript
function vpc(ctx: Context, args?: VpcArgs): VpcOutput
```

### Parameters

- **`ctx`** (`Context`) - The context for resource naming and tagging
- **`args?`** (`VpcArgs`) - VPC configuration arguments

### vpcFlowLogs

```typescript
function vpcFlowLogs(ctx: Context, args: VPCFlowLogsArgs): void
```

### Parameters

- **`ctx`** (`Context`) - The context for resource naming and tagging
- **`args`** (`VPCFlowLogsArgs`) - VPC Flow Logs configuration arguments

### vpcFlowLogsRole

```typescript
function vpcFlowLogsRole(ctx: Context, args: VPCFlowLogsRoleArgs): Role
```

### Parameters

- **`ctx`** (`Context`) - The context for resource naming and tagging
- **`args`** (`VPCFlowLogsRoleArgs`) - VPC Flow Logs role configuration arguments

### vpcFromIds

```typescript
function vpcFromIds(vpcInput: Input<VpcIds>, increment?: number): { cidrAllocator: CidrAllocator; network: (type: NetworkType) => { subnetIds: Output<Output<string>[]>; vpc: Output<Vpc | GetVpcResult> }; privateSubnetIds: Output<Output<string>[]>; publicSubnetIds: Output<Output<string>[]>; vpc: Output<Vpc | GetVpcResult> }
```

### Parameters

- **`vpcInput`** (`Input<VpcIds>`) - The VPC IDs input to reconstruct from
- **`increment?`** (`number`) - Optional increment to add to the CIDR counter

### vpcToIds

```typescript
function vpcToIds(vpc: VpcOutput): VpcIds
```

### Parameters

- **`vpc`** (`VpcOutput`) - The VPC output to convert

## Types

### NetworkType

Type representing network visibility - either public or private.

```typescript
type NetworkType = "public" | "private"
```

### VpcInput

Union type representing various VPC input formats.
Accepts VPC ID string, VPC resource, VPC result, or VPC output.

```typescript
type VpcInput = string | aws.ec2.Vpc | aws.ec2.GetVpcResult | VpcOutput
```

