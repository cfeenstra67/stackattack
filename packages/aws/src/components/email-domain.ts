/**
 * @packageDocumentation
 *
 * Email domain components for setting up AWS SES email logging and delivery to S3.
 *
 * Creates SNS topic subscriptions that stream email events to S3 via Kinesis Firehose.
 * Includes IAM roles and policies for secure email event delivery and webhook integration.
 */

import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";
import { Context } from "../context.js";
import { serviceAssumeRolePolicy } from "../policies.js";
import { getZoneFromDomain } from "./certificate.js";
import { S3FirehoseArgs, s3Firehose } from "./s3-firehose.js";
import { topicWebhook } from "./topic-webhook.js";

/**
 * Creates an IAM policy document for email log delivery role that allows access to Kinesis Firehose.
 * This policy grants permissions to put records into the specified Firehose delivery stream.
 * @param firehoseArn - The ARN of the Kinesis Firehose delivery stream
 * @returns A policy document output that can be used in IAM role policies
 */
export function emailLogRolePolicy(firehoseArn: pulumi.Input<string>) {
  return aws.iam.getPolicyDocumentOutput({
    statements: [
      {
        sid: "AllowKinesisAccess",
        effect: "Allow",
        actions: ["firehose:PutRecord", "firehose:PutRecordBatch"],
        resources: [firehoseArn],
      },
    ],
  });
}

/**
 * Configuration arguments for setting up email log delivery to S3 via Firehose.
 */
export interface EmailS3LogArgs {
  /** The ARN of the SNS topic that receives email events */
  emailLogTopicArn: pulumi.Input<string>;
  /** The ARN of the Kinesis Firehose delivery stream for S3 logging */
  firehoseArn: pulumi.Input<string>;
  /** Whether to skip adding a prefix to resource names */
  noPrefix?: boolean;
}

/**
 * Creates an SNS topic subscription that delivers email events to S3 via Kinesis Firehose.
 * This function sets up the necessary IAM role and subscription to stream email events to S3.
 * @param ctx - The context for resource naming and tagging
 * @param args - Configuration arguments for the S3 log setup
 * @returns The SNS topic subscription that handles email event delivery
 */
export function emailS3Log(
  ctx: Context,
  args: EmailS3LogArgs,
): aws.sns.TopicSubscription {
  if (!args.noPrefix) {
    ctx = ctx.prefix("s3-log");
  }

  const emailLogDeliveryRole = new aws.iam.Role(ctx.id("role"), {
    assumeRolePolicy: serviceAssumeRolePolicy("sns").json,
    inlinePolicies: [
      {
        name: "sns-kinesis-policy",
        policy: emailLogRolePolicy(args.firehoseArn).json,
      },
    ],
  });

  const subscription = new aws.sns.TopicSubscription(ctx.id(), {
    topic: args.emailLogTopicArn,
    protocol: "firehose",
    endpoint: args.firehoseArn,
    subscriptionRoleArn: emailLogDeliveryRole.arn,
    rawMessageDelivery: true,
  });

  return subscription;
}

/**
 * Configuration arguments for creating an SNS topic policy for email logging.
 */
export interface EmailSNSTopicPolicyArgs {
  /** The ARN of the SNS topic to create the policy for */
  topicArn: pulumi.Input<string>;
  /** The AWS account ID (optional, will be retrieved automatically if not provided) */
  accountId?: pulumi.Input<string>;
}

/**
 * Creates an IAM policy document for SNS topic access by AWS services.
 * This policy allows AWS services within the same account to interact with the SNS topic.
 * @param args - Configuration arguments containing the topic ARN
 * @returns A policy document output that can be used for SNS topic policies
 */
export function emailLogSnsTopicPolicy({ topicArn }: EmailSNSTopicPolicyArgs) {
  const identity = aws.getCallerIdentityOutput();

  return aws.iam.getPolicyDocumentOutput({
    statements: [
      {
        sid: "AllowAWSServiceAccess",
        effect: "Allow",
        principals: [{ type: "AWS", identifiers: ["*"] }],
        actions: [
          "sns:GetTopicAttributes",
          "sns:SetTopicAttributes",
          "sns:AddPermission",
          "sns:RemovePermission",
          "sns:DeleteTopic",
          "sns:Subscribe",
          "sns:ListSubscriptionsByTopic",
          "sns:Publish",
        ],
        resources: [topicArn],
        conditions: [
          {
            test: "StringEquals",
            variable: "AWS:SourceOwner",
            values: [identity.accountId],
          },
        ],
      },
    ],
  });
}

/**
 * Configuration arguments for setting up a complete email domain with SES.
 */
export interface EmailDomainArgs {
  /** The domain name to configure for email sending */
  domain: pulumi.Input<string>;
  /** Email address to receive DMARC reports */
  dmarcInbox: pulumi.Input<string>;
  /** Optional S3 logging configuration via Firehose */
  logs?: S3FirehoseArgs;
  /** Optional webhook URL for email event notifications */
  webhookUrl?: pulumi.Input<string>;
  /** Optional Route53 hosted zone ID (will be auto-detected if not provided) */
  zoneId?: pulumi.Input<string>;
  /** Whether to skip domain verification setup (DNS records) */
  noVerify?: boolean;
  /** Number of DKIM tokens to create (defaults to 3) */
  nTokens?: number;
  /** Whether to skip adding a prefix to resource names */
  noPrefix?: boolean;
}

/**
 * Sets up a complete email domain configuration with Amazon SES.
 * This function creates domain identity, DKIM verification, SPF/DMARC records,
 * configuration set, event logging, and optional S3 logging and webhooks.
 * @param ctx - The context for resource naming and tagging
 * @param args - Configuration arguments for the email domain setup
 * @returns An object containing the SES configuration set and SNS log topic
 */
export function emailDomain(ctx: Context, args: EmailDomainArgs) {
  if (!args.noPrefix) {
    ctx = ctx.prefix("email-domain");
  }

  const awsRegion = aws.getRegionOutput();

  const domainIdentity = new aws.ses.DomainIdentity(ctx.id(), {
    domain: args.domain,
  });

  const zoneId = args.zoneId ?? getZoneFromDomain(args.domain);

  if (!args.noVerify) {
    const domainIdentityVerification = new aws.route53.Record(
      ctx.id("verification"),
      {
        zoneId,
        name: pulumi.interpolate`_amazonses.${args.domain}`,
        type: "TXT",
        ttl: 600,
        records: [domainIdentity.verificationToken],
      },
    );

    const domainDkim = new aws.ses.DomainDkim(ctx.id("dkim"), {
      domain: args.domain,
    });

    const domainDkimVerification: aws.route53.Record[] = [];
    // TODO: unclear if this ever differs from 3 or whether it
    // is otherwise knowable. Docs don't mention specifics
    const nTokens = args.nTokens ?? 3;
    for (let i = 0; i < nTokens; i++) {
      domainDkimVerification.push(
        new aws.route53.Record(ctx.id(`dkim-${i}`), {
          zoneId,
          name: pulumi.interpolate`${domainDkim.dkimTokens[i]}._domainkey.${args.domain}`,
          type: "CNAME",
          ttl: 600,
          records: [
            pulumi.interpolate`${domainDkim.dkimTokens[i]}.dkim.amazonses.com`,
          ],
        }),
      );
    }

    const mailFromDomain = new aws.ses.MailFrom(
      ctx.id("mail-from"),
      {
        domain: args.domain,
        mailFromDomain: pulumi.interpolate`bounce.${args.domain}`,
      },
      {
        dependsOn: [domainIdentityVerification],
      },
    );

    new aws.route53.Record(ctx.id("mail-from-mx"), {
      zoneId,
      name: mailFromDomain.mailFromDomain,
      type: "MX",
      ttl: 600,
      records: [
        pulumi.interpolate`10 feedback-smtp.${awsRegion.name}.amazonses.com`,
      ],
    });

    new aws.route53.Record(ctx.id("mail-from-txt"), {
      zoneId,
      name: mailFromDomain.mailFromDomain,
      type: "TXT",
      ttl: 600,
      records: ["v=spf1 include:amazonses.com ~all"],
    });

    new aws.route53.Record(ctx.id("dmarc-txt"), {
      zoneId,
      name: pulumi.interpolate`_dmarc.${args.domain}`,
      type: "TXT",
      ttl: 600,
      records: [
        pulumi.interpolate`v=DMARC1;p=reject;rua=mailto:${args.dmarcInbox}`,
      ],
    });
  }

  const configurationSet = new aws.ses.ConfigurationSet(ctx.id("config-set"), {
    reputationMetricsEnabled: true,
  });

  const topic = new aws.sns.Topic(ctx.id("log-topic"), {
    tags: ctx.tags(),
  });

  new aws.sns.TopicPolicy(ctx.id("log-topic-policy"), {
    arn: topic.arn,
    policy: emailLogSnsTopicPolicy({ topicArn: topic.arn }).json,
  });

  new aws.ses.EventDestination(ctx.id("log-destination"), {
    configurationSetName: configurationSet.name,
    enabled: true,
    matchingTypes: [
      "send",
      "reject",
      "bounce",
      "complaint",
      "delivery",
      "open",
      "click",
      "renderingFailure",
    ],
    snsDestination: {
      topicArn: topic.arn,
    },
  });

  if (args.logs) {
    const firehose = s3Firehose(ctx, args.logs);
    emailS3Log(ctx, {
      firehoseArn: firehose.firehose.arn,
      emailLogTopicArn: topic.arn,
    });
  }

  if (args.webhookUrl !== undefined) {
    topicWebhook(ctx, {
      topic: topic.arn,
      url: args.webhookUrl,
    });
  }

  return { configurationSet, logTopic: topic };
}
