import * as aws from "@pulumi/aws";

export function serviceAssumeRolePolicy(...services: string[]) {
  return aws.iam.getPolicyDocumentOutput({
    statements: [
      {
        actions: ["sts:AssumeRole"],
        principals: [
          {
            type: "Service",
            identifiers: services.map((svc) => `${svc}.amazonaws.com`),
          },
        ],
      },
    ],
  });
}
