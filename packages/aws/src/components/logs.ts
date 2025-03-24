import { resourceIdGetter } from "@/helpers.js";
import * as aws from '@pulumi/aws';

export const getLogGroupId = resourceIdGetter<
  aws.cloudwatch.LogGroup,
  aws.cloudwatch.GetLogGroupResult
>();

export type LogGroupInput = typeof getLogGroupId.$input;
