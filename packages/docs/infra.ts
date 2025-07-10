import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";
import * as saws from "@stackattack/aws";

interface GithubRolePolicyArgs {
  bucketArn: pulumi.Input<string>;
  distributionArn: pulumi.Input<string>;
}

function githubRolePolicy({
  bucketArn,
  distributionArn,
}: GithubRolePolicyArgs) {
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
        actions: ["s3:PutObject*", "s3:DeleteObject", "s3:PutBucketTagging"],
        resources: [bucketArn, pulumi.interpolate`${bucketArn}/*`],
      },
      {
        actions: ["cloudfront:UpdateDistribution"],
        resources: [distributionArn],
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

  const { url, distribution } = saws.staticSite(ctx, {
    bucket,
    domain: domainName,
    adapter: saws.astroAdapter(),
  });

  const githubRole = saws.githubRole(ctx, {
    repo: "cfeenstra67/stackattack",
    policy: githubRolePolicy({
      bucketArn: bucket.arn,
      distributionArn: distribution.arn,
    }).json,
    openIdProvider: null,
  });

  return { url, githubRoleArn: githubRole.arn };
};
