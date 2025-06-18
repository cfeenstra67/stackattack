---
title: cluster
description: cluster component documentation
---

# cluster

```typescript
function cluster(ctx: Context, args: ClusterArgs): ClusterOutput
```

### Parameters

- **`ctx`** (`Context`) - The context for resource naming and tagging
- **`args`** (`ClusterArgs`) - Arguments for cluster configuration

## Interfaces

### ClusterArgs

Arguments for creating a complete ECS cluster with capacity.


### Properties

- **`diskSize?`** (`number`) - Size of the root disk in GB
- **`instances?`** (`ClusterInstancesConfig`) - Instance configuration (type or requirements)
- **`maxSize?`** (`Input<number>`) - Maximum number of instances in the auto scaling group
- **`minSize?`** (`Input<number>`) - Minimum number of instances in the auto scaling group
- **`network`** (`NetworkInput`) - Network configuration for the cluster
- **`noPrefix?`** (`boolean`) - Whether to skip adding a prefix to resource names
- **`noSpot?`** (`boolean`) - Whether to disable spot instances
- **`onDemandBase?`** (`number`) - Number of on-demand instances to maintain as base capacity
- **`onDemandPercentage?`** (`number`) - Percentage of on-demand instances above base capacity
- **`spotAllocationStrategy?`** (`string`) - Strategy for allocating spot instances

### ClusterCapacityArgs

Arguments for creating cluster capacity including network and cluster references.


### Properties

- **`cluster`** (`Input<ClusterInput>`) - The ECS cluster to create capacity for
- **`diskSize?`** (`number`) - Size of the root disk in GB
- **`instances?`** (`ClusterInstancesConfig`) - Instance configuration (type or requirements)
- **`maxSize?`** (`Input<number>`) - Maximum number of instances in the auto scaling group
- **`minSize?`** (`Input<number>`) - Minimum number of instances in the auto scaling group
- **`network`** (`NetworkInput`) - Network configuration for the cluster
- **`noPrefix?`** (`boolean`) - Whether to skip adding a prefix to resource names
- **`noSpot?`** (`boolean`) - Whether to disable spot instances
- **`onDemandBase?`** (`number`) - Number of on-demand instances to maintain as base capacity
- **`onDemandPercentage?`** (`number`) - Percentage of on-demand instances above base capacity
- **`spotAllocationStrategy?`** (`string`) - Strategy for allocating spot instances

### ClusterCapacityConfig

Configuration for cluster capacity and scaling behavior.


### Properties

- **`diskSize?`** (`number`) - Size of the root disk in GB
- **`instances?`** (`ClusterInstancesConfig`) - Instance configuration (type or requirements)
- **`maxSize?`** (`Input<number>`) - Maximum number of instances in the auto scaling group
- **`minSize?`** (`Input<number>`) - Minimum number of instances in the auto scaling group
- **`noPrefix?`** (`boolean`) - Whether to skip adding a prefix to resource names
- **`noSpot?`** (`boolean`) - Whether to disable spot instances
- **`onDemandBase?`** (`number`) - Number of on-demand instances to maintain as base capacity
- **`onDemandPercentage?`** (`number`) - Percentage of on-demand instances above base capacity
- **`spotAllocationStrategy?`** (`string`) - Strategy for allocating spot instances

### ClusterIds

Interface containing the IDs of all cluster-related resources.


### Properties

- **`autoScalingGroup`** (`Output<string>`) - The auto scaling group ID
- **`capacityProvider`** (`Output<string>`) - The capacity provider name
- **`cluster`** (`Output<string>`) - The cluster ID
- **`privateNamespace`** (`Output<string>`) - The private namespace name

### ClusterInstanceInitScriptArgs

Arguments for generating a cluster instance initialization script.


### Properties

- **`cluster`** (`Input<ClusterInput>`) - The ECS cluster to join
- **`paramName`** (`Input<string>`) - Name of the SSM parameter containing CloudWatch agent configuration

### ClusterInstanceRoleArgs

Arguments for creating a cluster instance role.


### Properties

- **`noPrefix?`** (`boolean`) - Whether to skip adding a prefix to the resource name

### ClusterInstanceTypeConfig

Configuration for using a specific EC2 instance type.


### Properties

- **`type`** (`Input<string>`) - The specific EC2 instance type to use

### ClusterOutput

Output interface containing all cluster-related resources.


### Properties

- **`autoScalingGroup`** (`Group`) - The auto scaling group resource
- **`capacityProvider`** (`CapacityProvider`) - The capacity provider resource
- **`cluster`** (`Cluster`) - The ECS cluster resource
- **`privateNamespace`** (`PrivateDnsNamespace`) - The private DNS namespace resource

### ClusterRequirementsConfig

Configuration for using instance requirements instead of specific instance types.


### Properties

- **`acceleratorCount?`** (`Input<LaunchTemplateInstanceRequirementsAcceleratorCount>`) - Block describing the minimum and maximum number of accelerators (GPUs, FPGAs, or AWS Inferentia chips). Default is no minimum or maximum.
- **`acceleratorManufacturers?`** (`Input<Input<string>[]>`) - List of accelerator manufacturer names. Default is any manufacturer.

```
Valid names:
* amazon-web-services
* amd
* nvidia
* xilinx
```
- **`acceleratorNames?`** (`Input<Input<string>[]>`) - List of accelerator names. Default is any acclerator.

```
Valid names:
* a100            - NVIDIA A100 GPUs
* v100            - NVIDIA V100 GPUs
* k80             - NVIDIA K80 GPUs
* t4              - NVIDIA T4 GPUs
* m60             - NVIDIA M60 GPUs
* radeon-pro-v520 - AMD Radeon Pro V520 GPUs
* vu9p            - Xilinx VU9P FPGAs
```
- **`acceleratorTotalMemoryMib?`** (`Input<LaunchTemplateInstanceRequirementsAcceleratorTotalMemoryMib>`) - Block describing the minimum and maximum total memory of the accelerators. Default is no minimum or maximum.
- **`acceleratorTypes?`** (`Input<Input<string>[]>`) - List of accelerator types. Default is any accelerator type.

```
Valid types:
* fpga
* gpu
* inference
```
- **`allowedInstanceTypes?`** (`Input<Input<string>[]>`) - List of instance types to apply your specified attributes against. All other instance types are ignored, even if they match your specified attributes. You can use strings with one or more wild cards, represented by an asterisk (\*), to allow an instance type, size, or generation. The following are examples: `m5.8xlarge`, `c5*.*`, `m5a.*`, `r*`, `*3*`. For example, if you specify `c5*`, you are allowing the entire C5 instance family, which includes all C5a and C5n instance types. If you specify `m5a.*`, you are allowing all the M5a instance types, but not the M5n instance types. Maximum of 400 entries in the list; each entry is limited to 30 characters. Default is all instance types.

> **NOTE:** If you specify `allowedInstanceTypes`, you can't specify `excludedInstanceTypes`.
- **`allowNoEniTrunking?`** (`boolean`) - Whether to allow instance types that don't support ENI trunking
- **`architecture`** (`Input<string>`) - The CPU architecture (e.g., x86_64, arm64)
- **`bareMetal?`** (`Input<string>`) - Indicate whether bare metal instace types should be `included`, `excluded`, or `required`. Default is `excluded`.
- **`baselineEbsBandwidthMbps?`** (`Input<LaunchTemplateInstanceRequirementsBaselineEbsBandwidthMbps>`) - Block describing the minimum and maximum baseline EBS bandwidth, in Mbps. Default is no minimum or maximum.
- **`burstablePerformance?`** (`Input<string>`) - Indicate whether burstable performance instance types should be `included`, `excluded`, or `required`. Default is `excluded`.
- **`cpuManufacturers?`** (`Input<Input<string>[]>`) - List of CPU manufacturer names. Default is any manufacturer.

> **NOTE:** Don't confuse the CPU hardware manufacturer with the CPU hardware architecture. Instances will be launched with a compatible CPU architecture based on the Amazon Machine Image (AMI) that you specify in your launch template.

```
Valid names:
* amazon-web-services
* amd
* intel
```
- **`excludedInstanceTypes?`** (`Input<Input<string>[]>`) - List of instance types to exclude. You can use strings with one or more wild cards, represented by an asterisk (\*), to exclude an instance type, size, or generation. The following are examples: `m5.8xlarge`, `c5*.*`, `m5a.*`, `r*`, `*3*`. For example, if you specify `c5*`, you are excluding the entire C5 instance family, which includes all C5a and C5n instance types. If you specify `m5a.*`, you are excluding all the M5a instance types, but not the M5n instance types. Maximum of 400 entries in the list; each entry is limited to 30 characters. Default is no excluded instance types.

> **NOTE:** If you specify `excludedInstanceTypes`, you can't specify `allowedInstanceTypes`.
- **`instanceGenerations?`** (`Input<Input<string>[]>`) - List of instance generation names. Default is any generation.

```
Valid names:
* current  - Recommended for best performance.
* previous - For existing applications optimized for older instance types.
```
- **`localStorage?`** (`Input<string>`) - Indicate whether instance types with local storage volumes are `included`, `excluded`, or `required`. Default is `included`.
- **`localStorageTypes?`** (`Input<Input<string>[]>`) - List of local storage type names. Default any storage type.

```
Value names:
* hdd - hard disk drive
* ssd - solid state drive
```
- **`maxSpotPriceAsPercentageOfOptimalOnDemandPrice?`** (`Input<number>`) - The price protection threshold for Spot Instances. This is the maximum you’ll pay for a Spot Instance, expressed as a percentage higher than the cheapest M, C, or R instance type with your specified attributes. When Amazon EC2 Auto Scaling selects instance types with your attributes, we will exclude instance types whose price is higher than your threshold. The parameter accepts an integer, which Amazon EC2 Auto Scaling interprets as a percentage. To turn off price protection, specify a high value, such as 999999. Conflicts with `spotMaxPricePercentageOverLowestPrice`
- **`memoryGibPerVcpu?`** (`Input<LaunchTemplateInstanceRequirementsMemoryGibPerVcpu>`) - Block describing the minimum and maximum amount of memory (GiB) per vCPU. Default is no minimum or maximum.
- **`memoryMib`** (`Input<LaunchTemplateInstanceRequirementsMemoryMib>`) - Block describing the minimum and maximum amount of memory (MiB). Default is no maximum.
- **`networkBandwidthGbps?`** (`Input<LaunchTemplateInstanceRequirementsNetworkBandwidthGbps>`) - Block describing the minimum and maximum amount of network bandwidth, in gigabits per second (Gbps). Default is no minimum or maximum.
- **`networkInterfaceCount?`** (`Input<LaunchTemplateInstanceRequirementsNetworkInterfaceCount>`) - Block describing the minimum and maximum number of network interfaces. Default is no minimum or maximum.
- **`onDemandMaxPricePercentageOverLowestPrice?`** (`Input<number>`) - The price protection threshold for On-Demand Instances. This is the maximum you’ll pay for an On-Demand Instance, expressed as a percentage higher than the cheapest M, C, or R instance type with your specified attributes. When Amazon EC2 Auto Scaling selects instance types with your attributes, we will exclude instance types whose price is higher than your threshold. The parameter accepts an integer, which Amazon EC2 Auto Scaling interprets as a percentage. To turn off price protection, specify a high value, such as 999999. Default is 20.

If you set DesiredCapacityType to vcpu or memory-mib, the price protection threshold is applied based on the per vCPU or per memory price instead of the per instance price.
- **`requireHibernateSupport?`** (`Input<boolean>`) - Indicate whether instance types must support On-Demand Instance Hibernation, either `true` or `false`. Default is `false`.
- **`spotMaxPricePercentageOverLowestPrice?`** (`Input<number>`) - The price protection threshold for Spot Instances. This is the maximum you’ll pay for a Spot Instance, expressed as a percentage higher than the cheapest M, C, or R instance type with your specified attributes. When Amazon EC2 Auto Scaling selects instance types with your attributes, we will exclude instance types whose price is higher than your threshold. The parameter accepts an integer, which Amazon EC2 Auto Scaling interprets as a percentage. To turn off price protection, specify a high value, such as 999999. Default is 100. Conflicts with `maxSpotPriceAsPercentageOfOptimalOnDemandPrice`

If you set DesiredCapacityType to vcpu or memory-mib, the price protection threshold is applied based on the per vCPU or per memory price instead of the per instance price.
- **`totalLocalStorageGb?`** (`Input<LaunchTemplateInstanceRequirementsTotalLocalStorageGb>`) - Block describing the minimum and maximum total local storage (GB). Default is no minimum or maximum.
- **`vcpuCount`** (`Input<LaunchTemplateInstanceRequirementsVcpuCount>`) - Block describing the minimum and maximum number of vCPUs. Default is no maximum.

### ClusterResourcesInput

Input interface for cluster resources.


### Properties

- **`capacityProvider`** (`Input<CapacityProviderInput>`) - The capacity provider for the cluster
- **`cluster`** (`Input<ClusterInput>`) - The ECS cluster
- **`privateNamespace?`** (`Input<PrivateDnsNamespaceInput>`) - Optional private DNS namespace for service discovery

### ClusterSecurityGroupArgs

Arguments for creating a cluster security group.


### Properties

- **`noPrefix?`** (`boolean`) - Whether to skip adding a prefix to the resource name
- **`vpc`** (`Input<VpcInput>`) - The VPC to create the security group in

## Functions

### clusterCapacity

```typescript
function clusterCapacity(ctx: Context, args: ClusterCapacityArgs): { autoScalingGroup: Group; capacityProvider: CapacityProvider }
```

### Parameters

- **`ctx`** (`Context`) - The context for resource naming and tagging
- **`args`** (`ClusterCapacityArgs`) - Arguments for capacity configuration

### clusterInstanceInitScript

```typescript
function clusterInstanceInitScript(args: ClusterInstanceInitScriptArgs): Output<string>
```

### Parameters

- **`args`** (`ClusterInstanceInitScriptArgs`) - Arguments containing cluster and parameter information

### clusterInstanceRole

```typescript
function clusterInstanceRole(ctx: Context, args?: ClusterInstanceRoleArgs): Role
```

### Parameters

- **`ctx`** (`Context`) - The context for resource naming and tagging
- **`args?`** (`ClusterInstanceRoleArgs`) - Optional arguments for role configuration

### clusterSecurityGroup

```typescript
function clusterSecurityGroup(ctx: Context, args: ClusterSecurityGroupArgs): SecurityGroup
```

### Parameters

- **`ctx`** (`Context`) - The context for resource naming and tagging
- **`args`** (`ClusterSecurityGroupArgs`) - Arguments for security group configuration

### clusterToIds

```typescript
function clusterToIds(cluster: ClusterOutput): ClusterIds
```

### Parameters

- **`cluster`** (`ClusterOutput`) - The cluster output containing all resources

### getCapacityProviderId

```typescript
function getCapacityProviderId(input: Input<CapacityProviderInput>): Output<string>
```

### Parameters

- **`input`** (`Input<CapacityProviderInput>`) - The capacity provider input to extract the ID from

### getClusterAttributes

```typescript
function getClusterAttributes(input: Input<ClusterInput>): Output<Cluster | GetClusterResult>
```

### Parameters

- **`input`** (`Input<ClusterInput>`) - The cluster input to get attributes from

### getClusterId

```typescript
function getClusterId(input: Input<ClusterInput>): Output<string>
```

### Parameters

- **`input`** (`Input<ClusterInput>`) - The cluster input to extract the ID from

### getHttpNamespaceId

```typescript
function getHttpNamespaceId(input: Input<HttpNamespaceInput>): Output<string>
```

### Parameters

- **`input`** (`Input<HttpNamespaceInput>`) - The HTTP namespace input to extract the ID from

### getInstanceTypeArchitecture

```typescript
function getInstanceTypeArchitecture(instanceType: Input<string>): Output<string>
```

### Parameters

- **`instanceType`** (`Input<string>`) - The EC2 instance type to get the architecture for

### getPrivateDnsNamespaceAttributes

```typescript
function getPrivateDnsNamespaceAttributes(input: Input<PrivateDnsNamespaceInput>): Output<PrivateDnsNamespace | GetDnsNamespaceResult>
```

### Parameters

- **`input`** (`Input<PrivateDnsNamespaceInput>`) - The private DNS namespace input to get attributes from

### getPrivateDnsNamespaceId

```typescript
function getPrivateDnsNamespaceId(input: Input<PrivateDnsNamespaceInput>): Output<string>
```

### Parameters

- **`input`** (`Input<PrivateDnsNamespaceInput>`) - The private DNS namespace input to extract the ID from

## Types

### CapacityProviderInput

Union type representing different ways to specify an ECS capacity provider.
Can be a capacity provider name (string) or an actual CapacityProvider resource.

```typescript
type CapacityProviderInput = string | aws.ecs.CapacityProvider
```

### ClusterInput

Union type representing different ways to specify an ECS cluster.
Can be a cluster name (string), an actual Cluster resource, cluster data, or cluster output.

```typescript
type ClusterInput = string | aws.ecs.Cluster | aws.ecs.GetClusterResult | ClusterOutput
```

### HttpNamespaceInput

Union type representing different ways to specify an HTTP namespace.
Can be a namespace name (string), an actual HttpNamespace resource, or namespace data.

```typescript
type HttpNamespaceInput = string | aws.servicediscovery.HttpNamespace | aws.servicediscovery.GetHttpNamespaceResult
```

### PrivateDnsNamespaceInput

Union type representing different ways to specify a private DNS namespace.
Can be a namespace name (string) or an actual PrivateDnsNamespace resource.

```typescript
type PrivateDnsNamespaceInput = string | aws.servicediscovery.PrivateDnsNamespace
```

