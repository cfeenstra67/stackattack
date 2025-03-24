import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";

export type LogGroupInput =
  | pulumi.Input<string>
  | pulumi.Input<aws.cloudwatch.LogGroup>
  | pulumi.Input<aws.cloudwatch.GetLogGroupResult>;

export function getLogGroupId(input: LogGroupInput): pulumi.Output<string> {
  return pulumi.output(input).apply((value) => {
    if (typeof value === "string") {
      return pulumi.output(value);
    }
    return pulumi.output(value.id);
  });
}
