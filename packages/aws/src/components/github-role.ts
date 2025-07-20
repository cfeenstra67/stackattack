/**
 * @packageDocumentation
 *
 * GitHub Actions IAM roles enable secure deployment from GitHub workflows to AWS without storing long-term credentials. Using OpenID Connect (OIDC), GitHub Actions can assume AWS IAM roles with fine-grained permissions and repository-scoped access controls.
 *
 * ```typescript
 * import * as saws from "@stackattack/aws";
 * import * as aws from "@pulumi/aws";
 *
 * const ctx = saws.context();
 * const deploymentRole = saws.githubRole(ctx, {
 *   repo: "myorg/myapp",
 *   policy: aws.iam.getPolicyDocumentOutput({
 *     statements: [{ actions: ["s3:*"], resources: ["*"] }]
 *   }).json
 * });
 *
 * export const roleArn = deploymentRole.arn;
 * ```
 *
 * ## Usage
 *
 * In your GitHub Actions workflow, configure the role assumption:
 *
 * ```yaml
 * name: Deploy
 * on:
 *   push:
 *     branches: [main]
 *
 * permissions:
 *   id-token: write
 *   contents: read
 *
 * jobs:
 *   deploy:
 *     runs-on: ubuntu-latest
 *     steps:
 *       - uses: aws-actions/configure-aws-credentials@v4
 *         with:
 *           role-to-assume: arn:aws:iam::123456789012:role/my-github-role
 *           role-session-name: GitHubActions
 *           aws-region: us-east-1
 *       - run: aws s3 ls  # Now authenticated with AWS
 * ```
 *
 * ## Costs
 *
 * GitHub Actions OIDC integration has no additional AWS costs beyond standard IAM usage:
 * - **IAM roles and policies**: Free (no charges for creation or storage)
 * - **STS AssumeRole calls**: $0.01 per 1,000 requests (typically negligible)
 * - **Resource usage**: Costs depend on what AWS services the role accesses
 *
 * This approach eliminates the security risks and management overhead of storing AWS access keys as GitHub secrets, making it both more secure and cost-effective than alternatives.
 */

import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";
import { Context } from "../context.js";

/**
 * Configuration arguments for creating a GitHub assume role policy.
 */
export interface GithubAssumeRolePolicyArgs {
  /** ARN of the OpenID Connect provider for GitHub Actions */
  openIdProvider: pulumi.Input<string>;
  /** GitHub repository in the format "owner/repo" */
  repo: pulumi.Input<string>;
  /** Optional scope to restrict access (e.g., "ref:refs/heads/main", defaults to "*") */
  scope?: pulumi.Input<string>;
}

/**
 * Creates an IAM policy document that allows GitHub Actions to assume a role via OIDC.
 * @param args - Configuration for the assume role policy
 * @returns IAM policy document allowing GitHub Actions role assumption
 */
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

/**
 * Configuration arguments for creating a GitHub Actions IAM role.
 */
export interface GithubRoleArgs {
  /** GitHub repository in the format "owner/repo" */
  repo: pulumi.Input<string>;
  /** Optional scope to restrict access (e.g., "ref:refs/heads/main", defaults to "*") */
  scope?: pulumi.Input<string>;
  /** ARN of existing OpenID Connect provider (creates new one if not provided). If not passed, a provider will be created. If you pass `null`, an existing OpenID Connect provider for https://token.actions.githubusercontent.com will be looked up in your AWS account */
  openIdProvider?: pulumi.Input<string> | null;
  /** Optional inline policy to attach to the role */
  policy?: pulumi.Input<string>;
  /** Whether to skip adding a prefix to the resource name */
  noPrefix?: boolean;
}

/**
 * Creates an IAM role that can be assumed by GitHub Actions workflows via OIDC.
 * @param ctx - The context for resource naming and tagging
 * @param args - Configuration arguments for the GitHub role
 * @returns The created IAM role resource
 */
export function githubRole(ctx: Context, args: GithubRoleArgs): aws.iam.Role {
  if (!args?.noPrefix) {
    ctx = ctx.prefix("github-role");
  }

  const url = "https://token.actions.githubusercontent.com";

  let openIdProvider: pulumi.Input<string>;
  if (args?.openIdProvider === null) {
    const provider = aws.iam.getOpenIdConnectProviderOutput({ url });
    openIdProvider = provider.arn;
  } else if (args?.openIdProvider !== undefined) {
    openIdProvider = args.openIdProvider;
  } else {
    const githubOpenIdProvider = new aws.iam.OpenIdConnectProvider(
      ctx.id("provider"),
      {
        url,
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
