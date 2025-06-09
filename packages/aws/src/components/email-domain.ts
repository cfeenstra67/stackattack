import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";
import { Context } from "../context.js";
import { serviceAssumeRolePolicy } from "../policies.js";
import { getZoneFromDomain } from "./certificate.js";
import { S3FirehoseArgs, s3Firehose } from "./s3-firehose.js";

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

export interface EmailS3LogArgs {
  emailLogTopicArn: pulumi.Input<string>;
  firehoseArn: pulumi.Input<string>;
  noPrefix?: boolean;
}

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

export interface EmailWebhookArgs {
  emailLogTopicArn: pulumi.Input<string>;
  webhookUrl: pulumi.Input<string>;
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

export function emailWebhook(
  ctx: Context,
  args: EmailWebhookArgs,
): aws.sns.TopicSubscription {
  if (!args.noPrefix) {
    ctx = ctx.prefix("webhook");
  }
  return new aws.sns.TopicSubscription(ctx.id(), {
    topic: args.emailLogTopicArn,
    protocol: args.protocol ?? "https",
    endpoint: args.webhookUrl,
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

export interface EmailSNSTopicPolicyArgs {
  topicArn: pulumi.Input<string>;
  accountId?: pulumi.Input<string>;
}

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

export interface EmailDomainArgs {
  domain: pulumi.Input<string>;
  dmarcInbox: pulumi.Input<string>;
  logs?: S3FirehoseArgs;
  webhookUrl?: pulumi.Input<string>;
  zoneId?: pulumi.Input<string>;
  noVerify?: boolean;
  nTokens?: number;
  noPrefix?: boolean;
}

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
    emailWebhook(ctx, {
      emailLogTopicArn: topic.arn,
      webhookUrl: args.webhookUrl,
    });
  }

  return { configurationSet, logTopic: topic };
}
