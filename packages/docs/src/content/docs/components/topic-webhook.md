---
title: topic-webhook
description: topic-webhook component documentation
---

## Interfaces

### TopicWebhookArgs

Configuration arguments for creating an SNS topic webhook subscription.


### Properties

- **`noPrefix?`** (`boolean`) - Whether to skip adding a prefix to the resource name
- **`protocol?`** (`Input<string>`) - Protocol for delivery (defaults to "https")
- **`retryPolicy?`** (`{ healthyRetryPolicy?: { backoffFunction?: "linear" | "arithmetic" | "geometric" | "exponential"; maxDelayTarget?: number; minDelayTarget?: number; numMaxDelayRetries?: number; numMinDelayRetries?: number; numRetries?: number }; requestPolicy?: { headerContentType: "text/plain" | "application/json" | "application/xml" }; throttlePolicy?: { maxReceivesPerSecond?: number } }`) - Advanced retry and delivery policies
- **`topic`** (`Input<string>`) - SNS topic ARN or reference to subscribe to
- **`url`** (`Input<string>`) - Webhook URL to deliver messages to

## Functions

### topicWebhook

```typescript
function topicWebhook(ctx: Context, args: TopicWebhookArgs): TopicSubscription
```

### Parameters

- **`ctx`** (`Context`) - The context for resource naming and tagging
- **`args`** (`TopicWebhookArgs`) - Configuration arguments for the webhook subscription

