/**
 * @packageDocumentation
 *
 * GitHub role components for creating IAM roles with GitHub Actions OIDC integration.
 *
 * Creates IAM roles that can be assumed by GitHub Actions workflows using OpenID Connect (OIDC).
 * Includes OpenID Connect provider setup, assume role policies, and repository-scoped access control.
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
  /** ARN of existing OpenID Connect provider (creates new one if not provided) */
  openIdProvider?: pulumi.Input<string>;
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
