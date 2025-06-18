---
title: s3-firehose
description: s3-firehose component documentation
---

## Interfaces

### S3FirehoseArgs

Configuration arguments for creating a Kinesis Firehose delivery stream to S3.


### Properties

- **`bucket`** (`BucketInput`) - The S3 bucket to deliver data to
- **`bufferInterval?`** (`Input<number>`) - Buffering interval in seconds (defaults to 900)
- **`bufferSize?`** (`Input<number>`) - Buffering size in MB (defaults to 64)
- **`dynamicPartitioningFields?`** (`Record<string, Input<string>>`) - JQ queries for dynamic partitioning by field values
- **`errorPrefix?`** (`Input<string>`) - S3 prefix for error outputs (defaults to prefix + "error/")
- **`glueParquetTableArn?`** (`Input<string>`) - Optional Glue table ARN for Parquet conversion
- **`logRetentionDays?`** (`Input<number>`) - CloudWatch log retention in days (defaults to 365)
- **`noPrefix?`** (`boolean`) - Whether to skip adding a prefix to the resource name
- **`partitionErrorsByType?`** (`boolean`) - Whether to partition errors by type
- **`prefix?`** (`Input<string>`) - S3 prefix for successful deliveries
- **`timestampPartitioning?`** (`"year" | "month" | "day" | "hour"`) - Timestamp-based partitioning granularity

### S3FirehosePolicyArgs

Arguments for creating IAM policy for S3 Firehose access.


### Properties

- **`bucket`** (`BucketInput`) - The S3 bucket to grant access to
- **`glueParquetTableArn?`** (`Input<string>`) - Optional ARN of a Glue table for Parquet conversion
- **`logStreamArn`** (`Input<string>`) - ARN of the CloudWatch log stream for logging

## Functions

### s3Firehose

```typescript
function s3Firehose(ctx: Context, args: S3FirehoseArgs): { errorUrl: Output<string>; firehose: FirehoseDeliveryStream; url: Output<string> }
```

### Parameters

- **`ctx`** (`Context`) - The context for resource naming and tagging
- **`args`** (`S3FirehoseArgs`) - Configuration arguments for the Firehose delivery stream

### s3FirehoseKinesisPolicy

```typescript
function s3FirehoseKinesisPolicy(kinesisStreamArn: Input<string>): Output<GetPolicyDocumentResult>
```

### Parameters

- **`kinesisStreamArn`** (`Input<string>`) - ARN of the Kinesis stream to grant access to

### s3FirehosePolicy

```typescript
function s3FirehosePolicy(args: S3FirehosePolicyArgs): Output<GetPolicyDocumentResult>
```

### Parameters

- **`args`** (`S3FirehosePolicyArgs`) - Configuration arguments for the policy

