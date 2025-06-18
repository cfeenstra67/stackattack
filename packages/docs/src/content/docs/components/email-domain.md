---
title: email-domain
description: email-domain component documentation
---

## Interfaces

### EmailDomainArgs

Configuration arguments for setting up a complete email domain with SES.


### Properties

- **`dmarcInbox`** (`Input<string>`) - Email address to receive DMARC reports
- **`domain`** (`Input<string>`) - The domain name to configure for email sending
- **`logs?`** (`S3FirehoseArgs`) - Optional S3 logging configuration via Firehose
- **`noPrefix?`** (`boolean`) - Whether to skip adding a prefix to resource names
- **`noVerify?`** (`boolean`) - Whether to skip domain verification setup (DNS records)
- **`nTokens?`** (`number`) - Number of DKIM tokens to create (defaults to 3)
- **`webhookUrl?`** (`Input<string>`) - Optional webhook URL for email event notifications
- **`zoneId?`** (`Input<string>`) - Optional Route53 hosted zone ID (will be auto-detected if not provided)

### EmailS3LogArgs

Configuration arguments for setting up email log delivery to S3 via Firehose.


### Properties

- **`emailLogTopicArn`** (`Input<string>`) - The ARN of the SNS topic that receives email events
- **`firehoseArn`** (`Input<string>`) - The ARN of the Kinesis Firehose delivery stream for S3 logging
- **`noPrefix?`** (`boolean`) - Whether to skip adding a prefix to resource names

### EmailSNSTopicPolicyArgs

Configuration arguments for creating an SNS topic policy for email logging.


### Properties

- **`accountId?`** (`Input<string>`) - The AWS account ID (optional, will be retrieved automatically if not provided)
- **`topicArn`** (`Input<string>`) - The ARN of the SNS topic to create the policy for

## Functions

### emailDomain

```typescript
function emailDomain(ctx: Context, args: EmailDomainArgs): { configurationSet: ConfigurationSet; logTopic: Topic }
```

### Parameters

- **`ctx`** (`Context`) - The context for resource naming and tagging
- **`args`** (`EmailDomainArgs`) - Configuration arguments for the email domain setup

### emailLogRolePolicy

```typescript
function emailLogRolePolicy(firehoseArn: Input<string>): Output<GetPolicyDocumentResult>
```

### Parameters

- **`firehoseArn`** (`Input<string>`) - The ARN of the Kinesis Firehose delivery stream

### emailLogSnsTopicPolicy

```typescript
function emailLogSnsTopicPolicy(args: EmailSNSTopicPolicyArgs): Output<GetPolicyDocumentResult>
```

### Parameters

- **`args`** (`EmailSNSTopicPolicyArgs`) - Configuration arguments containing the topic ARN

### emailS3Log

```typescript
function emailS3Log(ctx: Context, args: EmailS3LogArgs): TopicSubscription
```

### Parameters

- **`ctx`** (`Context`) - The context for resource naming and tagging
- **`args`** (`EmailS3LogArgs`) - Configuration arguments for the S3 log setup

