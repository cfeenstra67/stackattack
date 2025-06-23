/**
 * @internal
 *
 * Internal utilities for working with CloudWatch log groups.
 * This file contains helper functions and should not appear in component documentation.
 */

import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";

/**
 * Union type representing different ways to reference a CloudWatch log group.
 */
export type LogGroupInput =
  | pulumi.Input<string>
  | pulumi.Input<aws.cloudwatch.LogGroup>
  | pulumi.Input<aws.cloudwatch.GetLogGroupResult>;

/**
 * Extracts the log group ID from various log group input types.
 * @param input - The log group input (string, log group resource, or log group result)
 * @returns The log group ID as a Pulumi output
 */
export function getLogGroupId(input: LogGroupInput): pulumi.Output<string> {
  return pulumi.output(input).apply((value) => {
    if (typeof value === "string") {
      return pulumi.output(value);
    }
    return pulumi.output(value.id);
  });
}
