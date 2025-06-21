import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";
import { Context } from "../context.js";

export interface GithubAssumeRolePolicyArgs {
  openIdProvider: pulumi.Input<string>;
  repo: pulumi.Input<string>;
  scope?: pulumi.Input<string>;
}

export function githubAssumeRolePolicy({
  openIdProvider,
  repo,
  scope,
}: GithubAssumeRolePolicyArgs) {
  return aws.iam.getPolicyDocumentOutput({
    statements: [
      {
        actions: ["sts:AssumeRoleWithWebIdentity"],
        principals: [{ type: "Federated", identifiers: [openIdProvider] }],
        conditions: [
          {
            test: "ForAllValues:StringLike",
            variable: "token.actions.githubusercontent.com:aud",
            values: ["sts.amazonaws.com"],
          },
          {
            test: "ForAllValues:StringLike",
            variable: "token.actions.githubusercontent.com:sub",
            values: [pulumi.interpolate`repo:${repo}:${scope ?? "*"}`],
          },
        ],
      },
    ],
  });
}

export interface GithubRoleArgs {
  repo: pulumi.Input<string>;
  scope?: pulumi.Input<string>;
  openIdProvider?: pulumi.Input<string>;
  policy?: pulumi.Input<string>;
  noPrefix?: boolean;
}

export function githubRole(ctx: Context, args: GithubRoleArgs): aws.iam.Role {
  if (!args?.noPrefix) {
    ctx = ctx.prefix("github-role");
  }
  let openIdProvider: pulumi.Input<string>;
  if (args?.openIdProvider !== undefined) {
    openIdProvider = args.openIdProvider;
  } else {
    const githubOpenIdProvider = new aws.iam.OpenIdConnectProvider(
      ctx.id("provider"),
      {
        url: "https://token.actions.githubusercontent.com",
        clientIdLists: ["sts.amazonaws.com"],
        thumbprintLists: [
          "6938fd4d98bab03faadb97b34396831e3780aea1",
          "1c58a3a8518e8759bf075b76b750d4f2df264fcd",
        ],
        tags: ctx.tags(),
      },
    );
    openIdProvider = githubOpenIdProvider.arn;
  }

  return new aws.iam.Role(ctx.id(), {
    assumeRolePolicy: githubAssumeRolePolicy({
      openIdProvider,
      repo: args.repo,
      scope: args.scope,
    }).json,
    inlinePolicies: args.policy ? [{ policy: args.policy }] : [],
    tags: ctx.tags(),
  });
}
