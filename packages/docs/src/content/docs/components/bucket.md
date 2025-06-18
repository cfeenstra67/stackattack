---
title: bucket
description: bucket component documentation
---

# bucket

```typescript
function bucket(ctx: Context, args?: BucketArgs): { bucket: BucketV2; url: Output<string> }
```

### Parameters

- **`ctx`** (`Context`) - The context for resource naming and tagging
- **`args?`** (`BucketArgs`) - Optional configuration arguments for the bucket

## Interfaces

### BucketCorsArgs

Arguments for configuring CORS on an S3 bucket.


### Properties

- **`bucket`** (`BucketInput`) - The S3 bucket to configure CORS for
- **`corsRules?`** (`Input<Input<BucketCorsConfigurationV2CorsRule>[]>`) - Custom CORS rules (defaults to permissive rules if not specified)
- **`noPrefix?`** (`boolean`) - Whether to skip adding a prefix to the resource name

### BucketLifecycleRule

Configuration for a single S3 bucket lifecycle rule.


### Properties

- **`days`** (`number`) - Number of days after which objects expire
- **`id?`** (`string`) - Optional identifier for the lifecycle rule
- **`prefix?`** (`boolean`) - Whether to include prefix in the rule ID

### BucketLifecycleRulesArgs

Arguments for configuring lifecycle rules on an S3 bucket.


### Properties

- **`bucket`** (`BucketInput`) - The S3 bucket to configure lifecycle rules for
- **`noPrefix?`** (`boolean`) - Whether to skip adding a prefix to the resource name
- **`rules`** (`BucketLifecycleRule[]`) - Array of lifecycle rules to apply

### BucketPolicyArgs

Arguments for creating a bucket policy that grants access to services and accounts.


### Properties

- **`accounts?`** (`Input<string>[]`) - AWS account IDs that should be granted access to the bucket
- **`bucket`** (`BucketInput`) - The S3 bucket to create a policy for
- **`noPrefix?`** (`boolean`) - Whether to skip adding a prefix to the resource name
- **`services?`** (`Input<string>[]`) - AWS services that should be granted access to the bucket

### BucketVersioningArgs

Arguments for configuring S3 bucket versioning.


### Properties

- **`bucket`** (`BucketInput`) - The S3 bucket to configure versioning for
- **`noPrefix?`** (`boolean`) - Whether to skip adding a prefix to the resource name

## Functions

### bucketCors

```typescript
function bucketCors(ctx: Context, args: BucketCorsArgs): BucketCorsConfigurationV2
```

### Parameters

- **`ctx`** (`Context`) - The context for resource naming and tagging
- **`args`** (`BucketCorsArgs`) - Configuration arguments for bucket CORS

### bucketEncryption

```typescript
function bucketEncryption(ctx: Context, args: BucketVersioningArgs): BucketServerSideEncryptionConfigurationV2
```

### Parameters

- **`ctx`** (`Context`) - The context for resource naming and tagging
- **`args`** (`BucketVersioningArgs`) - Configuration arguments for bucket encryption

### bucketLifecycleRules

```typescript
function bucketLifecycleRules(ctx: Context, args: BucketLifecycleRulesArgs): BucketLifecycleConfigurationV2
```

### Parameters

- **`ctx`** (`Context`) - The context for resource naming and tagging
- **`args`** (`BucketLifecycleRulesArgs`) - Configuration arguments for bucket lifecycle rules

### bucketPolicy

```typescript
function bucketPolicy(ctx: Context, args: BucketPolicyArgs): BucketPolicy
```

### Parameters

- **`ctx`** (`Context`) - The context for resource naming and tagging
- **`args`** (`BucketPolicyArgs`) - Configuration arguments for the bucket policy

### bucketPublicAccessBlock

```typescript
function bucketPublicAccessBlock(ctx: Context, args: BucketVersioningArgs): BucketPublicAccessBlock
```

### Parameters

- **`ctx`** (`Context`) - The context for resource naming and tagging
- **`args`** (`BucketVersioningArgs`) - Configuration arguments for the bucket

### bucketServiceAccessPolicy

```typescript
function bucketServiceAccessPolicy(bucket: BucketInput, services: Input<string>[]): Output<GetPolicyDocumentResult>
```

### Parameters

- **`bucket`** (`BucketInput`) - The S3 bucket to grant access to
- **`services`** (`Input<string>[]`) - AWS services that should be granted access

### bucketVersioning

```typescript
function bucketVersioning(ctx: Context, args: BucketVersioningArgs): BucketVersioningV2
```

### Parameters

- **`ctx`** (`Context`) - The context for resource naming and tagging
- **`args`** (`BucketVersioningArgs`) - Configuration arguments for bucket versioning

### getBucketId

```typescript
function getBucketId(input: Input<BucketInput>): Output<string>
```

### Parameters

- **`input`** (`Input<BucketInput>`) - The bucket input (string, bucket resource, or bucket result)

## Types

### BucketArgs

Configuration arguments for creating an S3 bucket with optional features.

```typescript
type BucketArgs = Pick<aws.s3.BucketV2Args, "bucket" | "bucketPrefix"> & { allowCors?: boolean; encrypted?: boolean; lifecycleRules?: BucketLifecycleRule[]; noPrefix?: boolean; noProtect?: boolean; policy?: Omit<BucketPolicyArgs, "bucket" | "noPrefix">; public?: boolean; versioned?: boolean }
```

### BucketInput

Union type representing different ways to reference an S3 bucket.

```typescript
type BucketInput = pulumi.Input<string> | aws.s3.BucketV2 | aws.s3.Bucket | aws.s3.GetBucketResult
```

