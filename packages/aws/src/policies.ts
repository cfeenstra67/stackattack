import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";

/**
 * Creates an IAM policy document that allows specified AWS services to assume a role.
 * @param services - AWS service names (e.g., 'ec2', 'lambda') that can assume the role
 * @returns A policy document output allowing the services to assume the role
 */
export function serviceAssumeRolePolicy(...services: pulumi.Input<string>[]) {
  return aws.iam.getPolicyDocumentOutput({
    statements: [
      {
        actions: ["sts:AssumeRole"],
        principals: [
          {
            type: "Service",
            identifiers: services.map(
              (svc) => pulumi.interpolate`${svc}.amazonaws.com`,
            ),
          },
        ],
      },
    ],
  });
}
