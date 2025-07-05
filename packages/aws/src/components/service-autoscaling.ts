/**
 * @packageDocumentation
 *
 * Application Auto Scaling in AWS provides automatic scaling for ECS services based on CloudWatch metrics. Stackattack creates auto scaling policies with CloudWatch alarms that can scale services up or down based on custom metrics.
 *
 * ```typescript
 * import * as saws from "@stackattack/aws";
 *
 * const ctx = saws.context();
 * const vpc = saws.vpc(ctx);
 * const cluster = saws.cluster(ctx, { network: vpc.network("private") });
 * const app = saws.service(ctx, {
 *   name: "my-app",
 *   image: "nginx:latest",
 *   network: vpc.network("private"),
 *   cluster
 * });
 *
 * // NOTE: this can also be specified in the service itself via the `autoScaling` argument; the arguments are identical.
 * saws.serviceAutoScaling(ctx, {
 *   service: app,
 *   minReplicas: 1,
 *   maxReplicas: 10,
 *   policies: saws.targetTrackingPolicies({
 *    targetValue: 50,
 *    metric: 'CPUUtilization',
 *    namespace: 'AWS/ECS',
 * })
 * ```
 *
 * ## Usage
 *
 * After deploying auto scaling, you can monitor and manage it using:
 *
 * **AWS CLI:**
 * ```bash
 * # View scaling policies
 * aws application-autoscaling describe-scaling-policies --service-namespace ecs
 *
 * # View scaling activities
 * aws application-autoscaling describe-scaling-activities --service-namespace ecs
 *
 * # View CloudWatch alarms
 * aws cloudwatch describe-alarms --alarm-names your-alarm-name
 * ```
 * 
 * ## Related Components
 *
 * Autoscaling work together with other Stackattack components:
 * - [service](/components/service) - The autoscaling component is used to scale services based on Cloudwatch metrics.
 *
 * ## Costs
 *
 * Application Auto Scaling itself is **free** - you only pay for the underlying resources:
 *
 * - **CloudWatch Alarms** - Each alarm costs $0.10/month. Multiple scaling policies create multiple alarms, so costs scale with the number of policies you define.
 * - **ECS Service Scaling** - When auto scaling triggers, you pay for additional ECS tasks that are launched. Scaling down reduces costs by terminating tasks.
 * - **CloudWatch Metrics** - Custom metrics cost $0.30/metric/month. Built-in AWS metrics like CPU utilization are free.
 *
 * **Cost Optimization:**
 * - Make sure that your scaling policies are set up such that your application will actually scale down when it should. If you set your scaling policies such that low resource usage triggers a "scale up" action, you may find that your resources stay at their maximum capacity indefinitely
 * - Use built-in metrics (CPU, memory) instead of custom metrics when it makes sense
 * - Set appropriate min/max replica limits to prevent runaway scaling costs
 * - Monitor scaling activities to ensure policies aren't triggering too frequently
 * - Consider longer evaluation periods to reduce alarm noise and unnecessary scaling
 */

import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";
import { Context } from "../context.js";
import { ServiceInput, getServiceId } from "./service.js";

/**
 * Extracts service and cluster dimensions from an ECS service for CloudWatch metrics.
 * @param service - The ECS service to extract dimensions from
 * @returns CloudWatch dimensions object with ServiceName and ClusterName
 */
export function serviceDimensions(
  service: pulumi.Input<ServiceInput>,
): Record<string, pulumi.Input<string>> {
  const arn = getServiceId(service);
  const parsedArn = aws.getArnOutput({ arn });
  const parts = parsedArn.resource.apply((resource) => {
    const [, cluster, service] = resource.split("/");
    return { cluster, service };
  });

  return {
    ServiceName: parts.service,
    ClusterName: parts.cluster,
  };
}

/**
 * Arguments for creating target tracking scaling policies. These are meant to mimic the behavior of "target tracking" scaling in ECS, though they still use step-scaling policies under the hood. This is a good way to get auto scaling set up initially, but you will likely want to switch to step scaling policies to achieve optimal scaling behavior.
 */
export interface TargetTrackingPoliciesArgs {
  /** The target value to maintain for the metric. */
  targetValue: number;
  /** The CloudWatch metric name to track. */
  metric: pulumi.Input<string>;
  /** The CloudWatch namespace for the metric. */
  namespace: pulumi.Input<string>;
  /** Optional dimensions to filter the metric. If not passed, these will be filled with `serviceDimensions` */
  dimensions?: Record<string, pulumi.Input<string>>;
}

/**
 * Creates a pair of scaling policies (up and down) that maintain a target metric value.
 * Uses a multi-step approach with increasing scaling aggressiveness for values further from target.
 * @param args - Configuration for the target tracking policies
 * @returns Array of scaling policies (one for scale-up, one for scale-down)
 */
export function targetTrackingPolicies(
  args: TargetTrackingPoliciesArgs,
): ServiceAutoScalingPolicy[] {
  const bandPercent = 10;
  const numLevels = 3;
  const firstScalePercent = 10;
  const growthFactor = 2.5;

  const upperSteps: AutoScalingPolicyStep[] = [];
  const lowerSteps: AutoScalingPolicyStep[] = [];

  let scalePercent = firstScalePercent;
  for (let i = 0; i < numLevels; i++) {
    const lowerDiff = bandPercent * i;
    const upperDiff = bandPercent * (i + 1);

    upperSteps.push({
      value: (lowerDiff / 100) * args.targetValue,
      adjustment: Math.round(scalePercent),
    });

    lowerSteps.push({
      value: ((100 - upperDiff) / 100) * args.targetValue,
      adjustment: Math.round(scalePercent),
    });

    scalePercent *= growthFactor;
  }

  return [
    {
      direction: "up",
      adjustmentType: "percent-change",
      namespace: args.namespace,
      metric: args.metric,
      dimensions: args.dimensions,
      steps: upperSteps,
    },
    {
      direction: "down",
      adjustmentType: "percent-change",
      namespace: args.namespace,
      metric: args.metric,
      dimensions: args.dimensions,
      steps: lowerSteps,
    },
  ];
}

/**
 * Configuration for a single scaling step within an auto scaling policy.
 */
export interface AutoScalingPolicyStep {
  /** The metric threshold value that triggers this scaling step. */
  value: number;
  /** The scaling adjustment to apply. Use 'min' or 'max' to scale to capacity limits, or a number for relative/absolute changes. These values should always be positive; the correct directionally will be inferred from the `direction` of the parent `ServiceAutoScalingPolicy` */
  adjustment: pulumi.Input<number> | "min" | "max";
}

/**
 * Configuration for a single auto scaling policy.
 */
export interface ServiceAutoScalingPolicy {
  /** CloudWatch metric namespace (e.g., "AWS/ECS", "AWS/ApplicationELB"). */
  namespace: pulumi.Input<string>;
  /** CloudWatch metric name (e.g., "CPUUtilization", "MemoryUtilization"). */
  metric: pulumi.Input<string>;
  /** Statistic to use for the metric. Defaults to "Maximum" for scale-up, "Minimum" for scale-down. */
  statistic?: pulumi.Input<string>;
  /** How the metric data is aggregated. Defaults to the same as statistic. */
  aggregationType?: pulumi.Input<string>;
  /** Dimensions to filter the metric by (e.g., ServiceName, ClusterName). If not provided, this will default to `{ ServiceName: <ecs service name>, ClusterName: <ecs cluster name> }`, which is the correct value for built-in ECS metrics such as `CPUUtilization`. To scale on other metrics, you should pass the dimensions explicitly. */
  dimensions?: Record<string, pulumi.Input<string>>;
  /** Cooldown period in seconds between scaling actions. Defaults to 300 seconds */
  cooldown?: number;
  /** Whether this policy scales "up" or "down". */
  direction: "up" | "down";
  /** Whether to use "change" (relative) or "absolute" (exact capacity) adjustments. */
  adjustmentType: "change" | "absolute" | "percent-change";
  /** How to treat missing data points. Defaults to not specified. */
  missingDataBehavior?: "ignore" | "missing" | "breaching" | "notBreaching";
  /** Period in seconds over which the metric is evaluated. Defaults to 60 seconds */
  period?: pulumi.Input<number>;
  /** Number of consecutive periods the condition must be met before triggering. Defaults to 2 evaluation periods */
  evaluationPeriods?: pulumi.Input<number>;
  /** Scaling steps that define metric thresholds and corresponding capacity adjustments. */
  steps: AutoScalingPolicyStep[];
}

/**
 * Configuration for service auto scaling.
 */
export interface ServiceAutoScalingArgs {
  /** The ECS service to configure auto scaling for. */
  service: pulumi.Input<ServiceInput>;
  /** Minimum number of replicas to maintain. */
  minReplicas: pulumi.Input<number>;
  /** Maximum number of replicas allowed. */
  maxReplicas: pulumi.Input<number>;
  /** Array of scaling policies that define when and how to scale. You should always specify at least one policy with `direction: 'up'` and one with `direction: 'down'` */
  policies: ServiceAutoScalingPolicy[];
  /** If true, skips adding "autoscaling" prefix to resource names. */
  noPrefix?: boolean;
}

/**
 * Creates auto scaling configuration for an ECS service with CloudWatch alarms and scaling policies.
 */
export function serviceAutoScaling(
  ctx: Context,
  args: ServiceAutoScalingArgs,
): void {
  if (!args.noPrefix) {
    ctx = ctx.prefix("autoscaling");
  }

  const serviceArn = getServiceId(args.service);
  const parsedArn = aws.getArnOutput({
    arn: serviceArn,
  });

  const target = new aws.appautoscaling.Target(ctx.id("target"), {
    minCapacity: args.minReplicas,
    maxCapacity: args.maxReplicas,
    resourceId: parsedArn.resource,
    scalableDimension: "ecs:service:DesiredCount",
    serviceNamespace: "ecs",
  });

  let policyIdx = -1;
  for (const {
    direction,
    namespace,
    metric,
    statistic,
    aggregationType,
    adjustmentType,
    dimensions,
    cooldown,
    steps,
    period,
    evaluationPeriods,
    missingDataBehavior,
  } of args.policies) {
    policyIdx++;

    let sortedSteps: AutoScalingPolicyStep[];
    let multiplier: number;
    if (direction === "up") {
      sortedSteps = steps.sort((a, b) => a.value - b.value);
      multiplier = 1;
    } else {
      sortedSteps = steps.sort((a, b) => b.value - a.value);
      multiplier = -1;
    }

    const firstThreshold = sortedSteps[0].value;

    const finalSteps: aws.types.input.appautoscaling.PolicyStepScalingPolicyConfigurationStepAdjustment[] =
      [];
    let idx = -1;
    for (const { value, adjustment } of sortedSteps) {
      idx++;
      let lowerBound: number | undefined;
      let upperBound: number | undefined;
      if (direction === "up") {
        lowerBound = value - firstThreshold;
        const nextValue = sortedSteps[idx + 1]?.value;
        upperBound =
          typeof nextValue === "number"
            ? nextValue - firstThreshold
            : undefined;
      } else {
        const prevValue = sortedSteps[idx + 1]?.value;
        lowerBound =
          typeof prevValue === "number"
            ? prevValue - firstThreshold
            : undefined;
        upperBound = value - firstThreshold;
      }

      let finalScalingAdjustment: pulumi.Output<number>;
      if (adjustment === "min") {
        finalScalingAdjustment = target.minCapacity;
      } else if (adjustment === "max") {
        finalScalingAdjustment = target.maxCapacity;
      } else {
        finalScalingAdjustment = pulumi.output(adjustment);
      }

      finalSteps.push({
        metricIntervalLowerBound: lowerBound?.toString(),
        metricIntervalUpperBound: upperBound?.toString(),
        scalingAdjustment: finalScalingAdjustment.apply((x) => x * multiplier),
      });
    }

    if (finalSteps.length === 0) {
      continue;
    }

    let useStatistic = statistic;
    if (useStatistic === undefined) {
      useStatistic = direction === "up" ? "Maximum" : "Minimum";
    }

    const policy = new aws.appautoscaling.Policy(
      ctx.id(`policy-${policyIdx}`),
      {
        policyType: "StepScaling",
        resourceId: target.resourceId,
        scalableDimension: target.scalableDimension,
        serviceNamespace: target.serviceNamespace,
        stepScalingPolicyConfiguration: {
          adjustmentType:
            adjustmentType === "percent-change"
              ? "PercentChangeInCapacity"
              : adjustmentType === "change"
                ? "ChangeInCapacity"
                : "ExactCapacity",
          cooldown: cooldown ?? 300,
          metricAggregationType: aggregationType ?? useStatistic,
          stepAdjustments: finalSteps,
        },
      },
    );

    const useDimensions = dimensions ?? serviceDimensions(args.service);

    new aws.cloudwatch.MetricAlarm(ctx.id(`metric-${policyIdx}`), {
      comparisonOperator:
        direction === "up"
          ? "GreaterThanOrEqualToThreshold"
          : "LessThanOrEqualToThreshold",
      evaluationPeriods: evaluationPeriods ?? 2,
      metricName: metric,
      namespace: namespace,
      period: period ?? 60,
      statistic: useStatistic,
      threshold: sortedSteps[0].value,
      alarmDescription: pulumi.interpolate`Scaling ${direction} alarm for ${target.arn}`,
      alarmActions: [policy.arn],
      dimensions: useDimensions,
      treatMissingData: missingDataBehavior,
      tags: ctx.tags(),
    });
  }
}
