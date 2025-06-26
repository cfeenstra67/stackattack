import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";
import * as saws from "@stackattack/aws";

function githubRolePolicy(bucketArn: pulumi.Input<string>) {
  return aws.iam.getPolicyDocumentOutput({
    statements: [
      {
        actions: [
          "iam",
          "s3",
          "acm",
          "route53",
          "cloudfront",
          "lambda",
        ].flatMap((service) => [
          `${service}:Get*`,
          `${service}:List*`,
          `${service}:Describe*`,
        ]),
        resources: ["*"],
      },
      {
        actions: ["s3:PutObject*", "s3:DeleteObject"],
        resources: [bucketArn, pulumi.interpolate`${bucketArn}/*`],
      },
    ],
  });
}

export default () => {
  const ctx = saws.context();
  const config = new pulumi.Config();

  const domainName = config.require("domain-name");

  const bucket = saws.bucket(ctx, {
    paths: ["./dist"],
  });

  saws.staticSite(ctx, {
    bucket,
    domain: domainName,
    adapter: saws.astroAdapter(),
  });

  const githubRole = saws.githubRole(ctx, {
    repo: "cfeenstra67/stackattack",
    policy: githubRolePolicy(bucket.arn).json,
    openIdProvider: null,
  });

  return { url: `https://${domainName}`, githubRoleArn: githubRole.arn };
};
