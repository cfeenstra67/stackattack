/**
 * @packageDocumentation
 *
 * SNS topic webhook components for delivering messages to HTTP/HTTPS endpoints.
 *
 * Creates SNS subscriptions with configurable retry policies, throttling, and delivery settings.
 * Supports webhook integrations with customizable backoff strategies and request formatting options.
 */

import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";
import { Context } from "../context.js";

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
