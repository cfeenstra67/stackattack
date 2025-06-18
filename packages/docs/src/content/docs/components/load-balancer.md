---
title: load-balancer
description: load-balancer component documentation
---

## Interfaces

### LoadBalancerArgs

Configuration options for creating a complete load balancer setup.


### Properties

- **`certificate?`** (`Input<string>`) - Optional SSL certificate ARN for HTTPS support
- **`idleTimeout?`** (`Input<number>`) - Connection idle timeout in seconds
- **`network`** (`NetworkInput`) - Network configuration including VPC and subnets
- **`noPrefix?`** (`boolean`) - Whether to skip adding a prefix to the context

### LoadBalancerListenerArgs

Configuration options for creating load balancer listeners.


### Properties

- **`certificate?`** (`Input<string>`) - Optional SSL certificate ARN for HTTPS listener
- **`loadBalancer`** (`Input<LoadBalancerInput>`) - The load balancer to create listeners for
- **`noPrefix?`** (`boolean`) - Whether to skip adding a prefix to the context

### LoadBalancerListenerCertificateArgs

Configuration options for attaching a certificate to a load balancer listener.


### Properties

- **`certificate`** (`Input<string>`) - ARN of the SSL certificate to attach
- **`listener`** (`Input<ListenerInput>`) - The listener to attach the certificate to
- **`noPrefix?`** (`boolean`) - Whether to skip adding a prefix to the context

### LoadBalancerOutput

Output from creating a complete load balancer setup.


### Properties

- **`listener`** (`Listener`) - The primary listener resource
- **`loadBalancer`** (`LoadBalancer`) - The created load balancer resource
- **`url`** (`Output<string>`) - The URL of the load balancer

### LoadBalancerSecurityGroupArgs

Configuration options for creating a load balancer security group.


### Properties

- **`destSecurityGroupId?`** (`Input<string>`) - Optional destination security group ID for egress rules
- **`noPrefix?`** (`boolean`) - Whether to skip adding a prefix to the context
- **`vpc`** (`Input<VpcInput>`) - VPC where the security group will be created

### LoadBalancerWithListener

Represents a load balancer paired with a listener.


### Properties

- **`listener`** (`Input<ListenerInput>`) - The listener reference
- **`loadBalancer`** (`Input<LoadBalancerInput>`) - The load balancer reference

## Functions

### getListenerAttributes

```typescript
function getListenerAttributes(input: Input<ListenerInput>): Output<Listener | GetListenerResult>
```

### Parameters

- **`input`** (`Input<ListenerInput>`) - Listener input (ARN string, Listener resource, or query result)

### getListenerId

```typescript
function getListenerId(input: Input<ListenerInput>): Output<string>
```

### Parameters

- **`input`** (`Input<ListenerInput>`) - Listener input (ARN string, Listener resource, or query result)

### getLoadBalancerAttributes

```typescript
function getLoadBalancerAttributes(input: Input<LoadBalancerInput>): Output<LoadBalancer | GetLoadBalancerResult>
```

### Parameters

- **`input`** (`Input<LoadBalancerInput>`) - Load balancer input (ARN string, LoadBalancer resource, or query result)

### getLoadBalancerId

```typescript
function getLoadBalancerId(input: Input<LoadBalancerInput>): Output<string>
```

### Parameters

- **`input`** (`Input<LoadBalancerInput>`) - Load balancer input (ARN string, LoadBalancer resource, or query result)

### loadBalancer

```typescript
function loadBalancer(ctx: Context, args: LoadBalancerArgs): LoadBalancerOutput
```

### Parameters

- **`ctx`** (`Context`) - Pulumi context for resource naming and tagging
- **`args`** (`LoadBalancerArgs`) - Configuration for the load balancer

### loadBalancerListener

```typescript
function loadBalancerListener(ctx: Context, args: LoadBalancerListenerArgs): { listener: Listener; loadBalancer: Input<LoadBalancerInput> }
```

### Parameters

- **`ctx`** (`Context`) - Pulumi context for resource naming and tagging
- **`args`** (`LoadBalancerListenerArgs`) - Configuration for the listeners

### loadBalancerListenerCertificate

```typescript
function loadBalancerListenerCertificate(ctx: Context, args: LoadBalancerListenerCertificateArgs): ListenerCertificate
```

### Parameters

- **`ctx`** (`Context`) - Pulumi context for resource naming and tagging
- **`args`** (`LoadBalancerListenerCertificateArgs`) - Configuration for the certificate attachment

### loadBalancerListenerToIds

```typescript
function loadBalancerListenerToIds(output: LoadBalancerWithListener): { listener: Output<string>; loadBalancer: Output<string> }
```

### Parameters

- **`output`** (`LoadBalancerWithListener`) - LoadBalancerWithListener object with resource references

### loadBalancerSecurityGroup

```typescript
function loadBalancerSecurityGroup(ctx: Context, args: LoadBalancerSecurityGroupArgs): SecurityGroup
```

### Parameters

- **`ctx`** (`Context`) - Pulumi context for resource naming and tagging
- **`args`** (`LoadBalancerSecurityGroupArgs`) - Configuration for the security group

### loadBalancerToIds

```typescript
function loadBalancerToIds(output: LoadBalancerOutput): { listener: Output<string>; loadBalancer: Output<string>; url: Output<string> }
```

### Parameters

- **`output`** (`LoadBalancerOutput`) - LoadBalancerOutput object with resource references

## Types

### ListenerInput

Union type representing different ways to specify a load balancer listener.
Can be an ARN string, Listener resource, or listener query result.

```typescript
type ListenerInput = string | aws.lb.Listener | aws.lb.GetListenerResult
```

### LoadBalancerInput

Union type representing different ways to specify a load balancer.
Can be an ARN string, LoadBalancer resource, or load balancer query result.

```typescript
type LoadBalancerInput = string | aws.lb.LoadBalancer | aws.lb.GetLoadBalancerResult
```

