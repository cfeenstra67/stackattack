/**
 * @packageDocumentation
 *
 * Load balancers in AWS write access logs to an S3 bucket. This component can be used to create an AWS Glue table configured to query those logs with Athena. This component can be used on its own or automatically created by passing `accessLogsTable` parameter to the {@link loadBalancer} component.
 *
 * ```typescript
 * import * as saws from '@stackattack/aws';
 *
 * const ctx = saws.context();
 * const vpc = saws.vpc(ctx);
 * const logsBucket = saws.bucket(ctx);
 * const loadBalancer = saws.loadBalancer(ctx, {
 *   network: vpc.network("public")
 * });
 *
 * ```
 *
 */

import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";
import type { Context } from "../context.js";
import { type BucketInput, getBucketId } from "./bucket.js";

/**
 * Configuration options for create a load balancer logs table
 */
export interface LoadBalancerLogsTableArgs {
  /** Name of the table used for query logs */
  name: pulumi.Input<string>;
  /** Database name to create the table in; default to "default" */
  database?: pulumi.Input<string>;
  /** Bucket where load balancer logs are stored */
  bucket: pulumi.Input<BucketInput>;
  /** Prefix within the bucket where load balancer logs are stored. Note that all load balancer logs are stored with a prefix like "AWSLogs/<account_id>/elasticloadbalancing/<region>/". That will be appended automatically--if specified this should only include the prefix _before_ "AWSLogs/...". */
  prefix?: pulumi.Input<string>;
  /** Whether to skip adding a prefix to the context */
  noPrefix?: boolean;
}

export function loadBalancerLogsTable(
  ctx: Context,
  args: LoadBalancerLogsTableArgs,
): aws.glue.CatalogTable {
  if (!args.noPrefix) {
    ctx = ctx.prefix("lb-logs-table");
  }

  const region = aws.getRegionOutput();
  const identity = aws.getCallerIdentityOutput();
  const bucketName = getBucketId(args.bucket);

  const prefix = pulumi
    .output(args.prefix)
    .apply((prefix) =>
      prefix ? (prefix.endsWith("/") ? prefix : `${prefix}/`) : "",
    );

  const accessLogsStorageLocation = pulumi.interpolate`s3://${bucketName}/${prefix}/AWSLogs/${identity.accountId}/elasticloadbalancing/${region.name}/`;

  // Based on instructions here:
  // https://docs.aws.amazon.com/athena/latest/ug/application-load-balancer-logs.html#create-alb-table-partition-projection
  return new aws.glue.CatalogTable(ctx.id(), {
    databaseName: args.database ?? "default",
    name: args.name,
    tableType: "EXTERNAL_TABLE",
    parameters: {
      EXTERNAL: "TRUE",
      "projection.enabled": "true",
      "projection.day.type": "date",
      "projection.day.range": "2024/01/01,NOW",
      "projection.day.format": "yyyy/MM/dd",
      "projection.day.interval": "1",
      "projection.day.interval.unit": "DAYS",
      "storage.location.template": pulumi.interpolate`${accessLogsStorageLocation}\${day}`,
    },
    storageDescriptor: {
      location: accessLogsStorageLocation,
      inputFormat: "org.apache.hadoop.mapred.TextInputFormat",
      outputFormat:
        "org.apache.hadoop.hive.ql.io.HiveIgnoreKeyTextOutputFormat",
      serDeInfo: {
        parameters: {
          "serialization.format": "1",
          "input.regex":
            '([^ ]*) ([^ ]*) ([^ ]*) ([^ ]*):([0-9]*) ([^ ]*)[:-]([0-9]*) ([-.0-9]*) ([-.0-9]*) ([-.0-9]*) (|[-0-9]*) (-|[-0-9]*) ([-0-9]*) ([-0-9]*) "([^ ]*) (.*) (- |[^ ]*)" "([^"]*)" ([A-Z0-9-_]+) ([A-Za-z0-9.-]*) ([^ ]*) "([^"]*)" "([^"]*)" "([^"]*)" ([-.0-9]*) ([^ ]*) "([^"]*)" "([^"]*)" "([^ ]*)" "([^s]+?)" "([^s]+)" "([^ ]*)" "([^ ]*)" ([^ ]*)(.*?)',
        },
        serializationLibrary: "org.apache.hadoop.hive.serde2.RegexSerDe",
      },
      columns: [
        {
          name: "type",
          type: "string",
        },
        {
          name: "time",
          type: "string",
        },
        {
          name: "elb",
          type: "string",
        },
        {
          name: "client_ip",
          type: "string",
        },
        {
          name: "client_port",
          type: "int",
        },
        {
          name: "target_ip",
          type: "string",
        },
        {
          name: "target_port",
          type: "int",
        },
        {
          name: "requesting_processing_time",
          type: "double",
        },
        {
          name: "target_processing_time",
          type: "double",
        },
        {
          name: "response_processing_time",
          type: "double",
        },
        {
          name: "elb_status_code",
          type: "int",
        },
        {
          name: "target_status_code",
          type: "int",
        },
        {
          name: "received_bytes",
          type: "bigint",
        },
        {
          name: "sent_bytes",
          type: "bigint",
        },
        {
          name: "request_verb",
          type: "string",
        },
        {
          name: "request_url",
          type: "string",
        },
        {
          name: "request_proto",
          type: "string",
        },
        {
          name: "user_agent",
          type: "string",
        },
        {
          name: "ssl_cipher",
          type: "string",
        },
        {
          name: "ssl_protocol",
          type: "string",
        },
        {
          name: "target_group_arn",
          type: "string",
        },
        {
          name: "trace_id",
          type: "string",
        },
        {
          name: "domain_name",
          type: "string",
        },
        {
          name: "chosen_cert_arn",
          type: "string",
        },
        {
          name: "matched_rule_priority",
          type: "string",
        },
        {
          name: "request_creation_time",
          type: "string",
        },
        {
          name: "actions_executed",
          type: "string",
        },
        {
          name: "redirect_url",
          type: "string",
        },
        {
          name: "lambda_error_reason",
          type: "string",
        },
        {
          name: "target_port_list",
          type: "string",
        },
        {
          name: "target_status_code_list",
          type: "string",
        },
        {
          name: "classification",
          type: "string",
        },
        {
          name: "classification_reason",
          type: "string",
        },
        {
          name: "conn_trace_id",
          type: "string",
        },
        {
          name: "unhandled_postfix",
          type: "string",
        },
      ],
    },
    partitionKeys: [
      {
        name: "day",
        type: "string",
      },
    ],
  });
}
