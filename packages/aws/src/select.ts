/**
 * @packageDocumentation
 *
 * Multi-stack deployment pattern that allows a single Pulumi project to deploy different types of stacks based on configuration. This is essential for separating stateful infrastructure from stateless applications while maintaining shared code.
 *
 * ```typescript
 * import * as saws from "@stackattack/aws";
 *
 * function env() {
 *   const ctx = saws.context();
 *
 *   const certificate = saws.certificate(ctx, {
 *     domain: "mydomain.dev",
 *     wildcard: true
 *   });
 *
 *   return { certificate };
 * }
 *
 * function app() {
 *   const ctx = saws.context();
 *   const config = new pulumi.Config();
 *
 *   const envStack = saws.stackRef(config.require('env-stack'), env);
 *   const certificate = envStack.require('certificate');
 *
 *   const bucket = saws.bucket(ctx, {
 *     paths: ["./dist"]
 *   });
 *
 *   const site = saws.staticSite(ctx, {
 *     domain: "docs.mydomain.dev",
 *     certificate,
 *     bucket,
 *     adapter: saws.astroAdapter()
 *   });
 *
 *   return { url: site.url };
 * }
 *
 * export default () => saws.select({ env, app });
 * ```
 *
 * ## Usage
 *
 * Configure stack types using Pulumi config:
 *
 * ```bash
 * # Create environment stack
 * pulumi stack init my-env-stack
 * pulumi config set stack-type env
 * pulumi up
 *
 * # Create app stack
 * pulumi stack init my-app-stack
 * pulumi config set stack-type app
 * pulumi config set env-stack my-env-stack
 * pulumi up
 * ```
 *
 * This pattern enables you to deploy shared infrastructure separately from applications, allowing for faster deployments and better isolation. See the [Structuring Stacks](/working-with-pulumi/structuring-stacks) guide for recommendations on separating your resources into stacks.
 */

import * as pulumi from "@pulumi/pulumi";

/**
 * Selects and executes a function based on the 'stack-type' configuration value.
 * @param funcs - Record of function names to functions that can be executed
 * @returns The result of executing the selected function
 */
export function select(funcs: Record<string, () => unknown>) {
  const config = new pulumi.Config();
  const names = Object.keys(funcs);
  const stackType = config.require("stack-type", { allowedValues: names });
  const stack = funcs[stackType];
  return stack();
}
