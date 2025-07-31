/**
 * @packageDocumentation
 *
 * Amazon SES (Simple Email Service) domain configuration enables sending transactional emails from your custom domain with full deliverability tracking. This component sets up domain verification, DKIM authentication, SPF/DMARC records, and event logging for production email sending.
 *
 * ```typescript
 * import * as saws from "@stackattack/aws";
 *
 * const ctx = saws.context();
 * const emailSetup = saws.emailDomain(ctx, {
 *   domain: "mail.example.com",
 *   dmarcInbox: "dmarc-reports@mail.example.com",
 *   webhookUrl: "https://my-api.example.com/email/webhook" // Optional
 * });
 *
 * export const configurationSet = emailSetup.configurationSet.name;
 * ```
 *
 * ## Usage
 *
 * After deployment, send emails using the AWS SDK:
 *
 * ```javascript
 * // Using AWS SDK
 * import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";
 *
 * const client = new SESv2Client({ region: "us-east-1" });
 * await client.send(new SendEmailCommand({
 *   FromEmailAddress: "noreply@mail.example.com",
 *   Destination: { ToAddresses: ["user@mail.example.com"] },
 *   Content: {
 *     Simple: {
 *       Subject: { Data: "Welcome!" },
 *       Body: { Text: { Data: "Hello from SES!" } }
 *     }
 *   },
 *   ConfigurationSetName: "my-email-config-set"
 * }));
 * ```
 *
 * See the [AWS SDK Documentation](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/client/ses/command/SendEmailCommand/) for more details.
 *
 * You will have to [request production access for SES](https://docs.aws.amazon.com/ses/latest/dg/request-production-access.html) to be able to send to email addresses other than your [verified identifies](https://docs.aws.amazon.com/ses/latest/dg/creating-identities.html). The setup above will allow you to send emails to email addresses with the domain `mail.example.com`, e.g. `user1@mail.example.com`. It also requires that you have `example.com` as a hosted zone in Route53.
 *
 * ### Confirming webhook subscriptions
 *
 * If you provide the `webhookUrl` parameter, you should also configure your API endpoint such that it confirms the webhook subscription. For example:
 *
 * ```javascript
 * import { SNSClient, ConfirmSubscriptionCommand } from "@aws-sdk/client-sns";
 *
 * // Express.js webhook handler
 * app.post('/email/webhook', express.raw({ type: 'text/plain' }), async (req, res) => {
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
 * The API above should be (publicly) available at `https://my-api.example.com` to confirm the subscription. Also ensure that your application is authenticated with AWS and has the `sns:ConfirmSubscription` permission.
 *
 * ## Related Components
 *
 * The email domain component depends on:
 * - [topicWebhook](/components/topic-webhook/) - Used to set up a webhook subscription if `webhookUrl` is passes as a parameter.
 *
 * ## Important Setup Notes
 *
 * - **Production Access**: You must request production access in the AWS SES console to send emails to unverified addresses. This component sets up the domain but does not automatically grant production sending access.
 * - **Dedicated IP**: This component does not include dedicated IP setup. For high-volume sending requiring dedicated IPs, additional configuration is needed.
 *
 * ## Costs
 *
 * SES pricing is usage-based with no upfront costs:
 * - **Free tier**: 200 emails/day for applications hosted on AWS
 * - **Standard pricing**: $0.10 per 1,000 emails sent
 * - **Dedicated IP**: $24.95/month per IP (for high-volume senders, not included in this component)
 * - **Data transfer**: Standard AWS rates for attachments
 *
 * Cost optimization strategies:
 * - Use SES configuration sets to track bounce/complaint rates and maintain sender reputation
 * - Implement email validation to avoid sending to invalid addresses
 * - Consider bulk sending features for newsletters vs transactional emails
 * - Monitor sending quotas to avoid throttling in production
 */

import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";
import type { Context } from "../context.js";
import { serviceAssumeRolePolicy } from "../policies.js";
import { getZoneFromDomain } from "./certificate.js";
import { type S3FirehoseArgs, s3Firehose } from "./s3-firehose.js";
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
 * Outputs of the email domain component
 */
export interface EmailDomainOutput {
  /**
   * Configuration set; if you send emails using this as a parameter (see example above), reputation metrics will be enabled meaning AWS cloudwatch metrics will be emitted that you can use to [track bounce and complaint rates](https://docs.aws.amazon.com/ses/latest/dg/reputation-dashboard-dg.html)
   */
  configurationSet: aws.ses.ConfigurationSet;
  /**
   * SNS topic that events related to emails send through SES with this domain will be sent to. See the SES [notification examples](https://docs.aws.amazon.com/ses/latest/dg/notification-examples.html) for more information.
   */
  logTopic: aws.sns.Topic;
  /**
   * If you pass `webhookUrl` as an input parameter, this will contain the subscription object representing the connection between `logTopic` and your endpoint.
   */
  webhookSubscription: aws.sns.TopicSubscription | null;
}

/**
 * Sets up a complete email domain configuration with Amazon SES.
 * This function creates domain identity, DKIM verification, SPF/DMARC records,
 * configuration set, event logging, and optional S3 logging and webhooks.
 * @param ctx - The context for resource naming and tagging
 * @param args - Configuration arguments for the email domain setup
 * @returns An object containing the SES configuration set and SNS log topic
 */
export function emailDomain(
  ctx: Context,
  args: EmailDomainArgs,
): EmailDomainOutput {
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

  let webhookSubscription: aws.sns.TopicSubscription | null = null;
  if (args.webhookUrl !== undefined) {
    webhookSubscription = topicWebhook(ctx, {
      topic: topic.arn,
      url: args.webhookUrl,
    });
  }

  return { configurationSet, logTopic: topic, webhookSubscription };
}
