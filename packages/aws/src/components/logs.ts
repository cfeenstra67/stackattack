import * as aws from "@pulumi/aws";
import { resourceIdGetter } from "../helpers.js";

export const getLogGroupId = resourceIdGetter<
  aws.cloudwatch.LogGroup,
  aws.cloudwatch.GetLogGroupResult
>();

export type LogGroupInput = typeof getLogGroupId.$input;
