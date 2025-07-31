/**
 * @packageDocumentation
 *
 * Amazon SNS (Simple Notification Service) webhook subscriptions deliver messages from SNS topics to HTTP/HTTPS endpoints with configurable retry policies and delivery guarantees. This enables integration with external services, monitoring systems, and event-driven architectures.
 *
 * ```typescript
 * import * as saws from "@stackattack/aws";
 *
 * const ctx = saws.context();
 * const webhook = saws.topicWebhook(ctx, {
 *   topic: "arn:aws:sns:us-east-1:123456789012:my-topic",
 *   url: "https://api.example.com/webhooks/sns"
 * });
 *
 * export const subscriptionArn = webhook.arn;
 * ```
 *
 * ## Usage
 *
 * Your webhook endpoint must handle SNS HTTP/HTTPS notifications:
 *
 * ```javascript
 * import { SNSClient, ConfirmSubscriptionCommand } from "@aws-sdk/client-sns";
 *
 * // Express.js webhook handler
 * app.post('/webhooks/sns', express.raw({ type: 'text/plain' }), async (req, res) => {
 *   const message = JSON.parse(req.body);
 *   const messageType = req.headers['x-amz-sns-message-type'] || message.Type;
 *
 *   // Handle subscription confirmation programmatically
 *   if (messageType === 'SubscriptionConfirmation') {
 *     const sns = new SNSClient({ region: "us-east-1" });
 *     await sns.send(new ConfirmSubscriptionCommand({
 *       Token: message.Token,
 *       AuthenticateOnUnsubscribe: 'true',
 *       TopicArn: message.TopicArn
 *     }));
 *     return res.status(200).send('Subscription confirmed');
 *   }
 *
 *   // Handle actual notifications
 *   if (messageType === 'Notification') {
 *     console.log('SNS Message:', message.Message);
 *     // Process your webhook logic here
 *     return res.status(200).send('OK');
 *   }
 *
 *   res.status(400).send('Unknown message type');
 * });
 * ```
 *
 * Monitor webhook delivery using AWS CLI:
 *
 * ```bash
 * # Check subscription status
 * aws sns get-subscription-attributes --subscription-arn arn:aws:sns:...
 *
 * # View delivery policy
 * aws sns list-subscriptions-by-topic --topic-arn arn:aws:sns:...
 *
 * # Test webhook delivery
 * aws sns publish --topic-arn arn:aws:sns:... --message "Test message"
 * ```
 *
 * ## Related Components
 *
 * - [emailDomain](/components/email-domain/) - Used to set up a webhook listening for SES message events.
 *
 * ## Costs
 *
 * SNS webhook delivery costs are based on message volume and delivery attempts:
 * - **HTTP/HTTPS notifications**: $0.60 per million notifications
 * - **Failed delivery retries**: Additional charges for retry attempts
 * - **Data transfer**: Standard AWS data transfer rates apply
 * - **No setup costs**: Pay only for successful and failed deliveries
 *
 * Cost optimization strategies:
 * - Implement proper HTTP status codes (2xx) to avoid unnecessary retries
 * - Use exponential backoff in your webhook handlers to reduce retry storms
 * - Monitor dead letter queues to identify and fix failing endpoints
 * - Consider SNS message filtering to reduce unnecessary webhook calls
 * - Set appropriate retry policies to balance reliability with cost
 */

import * as aws from "@pulumi/aws";
import type * as pulumi from "@pulumi/pulumi";
import type { Context } from "../context.js";

/**
 * Configuration arguments for creating an SNS topic webhook subscription.
 */
export interface TopicWebhookArgs {
  /** SNS topic ARN or reference to subscribe to */
  topic: pulumi.Input<string>;
  /** Webhook URL to deliver messages to */
  url: pulumi.Input<string>;
  /** Protocol for delivery (defaults to "https") */
  protocol?: pulumi.Input<string>;
  /** Advanced retry and delivery policies */
  retryPolicy?: {
    /** Retry policy for healthy endpoint responses */
    healthyRetryPolicy?: {
      /** Minimum delay between retries in seconds (default: 1) */
      minDelayTarget?: number;
      /** Maximum delay between retries in seconds (default: 60) */
      maxDelayTarget?: number;
      /** Total number of retry attempts (default: 50) */
      numRetries?: number;
      /** Number of retries at minimum delay (default: 3) */
      numMinDelayRetries?: number;
      /** Number of retries at maximum delay (default: 35) */
      numMaxDelayRetries?: number;
      /** Backoff function for retry delays (default: "exponential") */
      backoffFunction?: "linear" | "arithmetic" | "geometric" | "exponential";
    };
    /** Throttling policy for message delivery rate */
    throttlePolicy?: {
      /** Maximum messages per second (default: 10) */
      maxReceivesPerSecond?: number;
    };
    /** Request policy for message formatting */
    requestPolicy?: {
      /** Content type for webhook requests (default: "application/json") */
      headerContentType: "text/plain" | "application/json" | "application/xml";
    };
  };
  /** Whether to skip adding a prefix to the resource name */
  noPrefix?: boolean;
}

/**
 * Creates an SNS topic subscription that delivers messages to a webhook URL with configurable retry policies.
 * @param ctx - The context for resource naming and tagging
 * @param args - Configuration arguments for the webhook subscription
 * @returns The SNS topic subscription resource
 */
export function topicWebhook(
  ctx: Context,
  args: TopicWebhookArgs,
): aws.sns.TopicSubscription {
  if (!args.noPrefix) {
    ctx = ctx.prefix("webhook");
  }
  return new aws.sns.TopicSubscription(ctx.id(), {
    topic: args.topic,
    protocol: args.protocol ?? "https",
    endpoint: args.url,
    deliveryPolicy: JSON.stringify({
      healthyRetryPolicy: {
        minDelayTarget:
          args.retryPolicy?.healthyRetryPolicy?.minDelayTarget ?? 1,
        maxDelayTarget:
          args.retryPolicy?.healthyRetryPolicy?.maxDelayTarget ?? 60,
        numRetries: args.retryPolicy?.healthyRetryPolicy?.numRetries ?? 50,
        numMinDelayRetries:
          args.retryPolicy?.healthyRetryPolicy?.numMinDelayRetries ?? 3,
        numMaxDelayRetries:
          args.retryPolicy?.healthyRetryPolicy?.numMaxDelayRetries ?? 35,
        backoffFunction:
          args?.retryPolicy?.healthyRetryPolicy?.backoffFunction ??
          "exponential",
      },
      throttlePolicy: {
        maxReceivesPerSecond:
          args?.retryPolicy?.throttlePolicy?.maxReceivesPerSecond ?? 10,
      },
      requestPolicy: {
        headerContentType:
          args?.retryPolicy?.requestPolicy?.headerContentType ??
          "application/json",
      },
    }),
    rawMessageDelivery: true,
  });
}
