import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";
import { Context } from "../context.js";

export interface TopicWebhookArgs {
  topic: pulumi.Input<string>;
  url: pulumi.Input<string>;
  protocol?: pulumi.Input<string>;
  retryPolicy?: {
    healthyRetryPolicy?: {
      minDelayTarget?: number;
      maxDelayTarget?: number;
      numRetries?: number;
      numMinDelayRetries?: number;
      numMaxDelayRetries?: number;
      backoffFunction?: "linear" | "arithmetic" | "geometric" | "exponential";
    };
    throttlePolicy?: {
      maxReceivesPerSecond?: number;
    };
    requestPolicy?: {
      headerContentType: "text/plain" | "application/json" | "application/xml";
    };
  };
  noPrefix?: boolean;
}

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
