import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";

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
