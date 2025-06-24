/**
 * @packageDocumentation
 *
 * Type-safe cross-stack references that allow you to access outputs from other Pulumi stacks with full TypeScript support. Essential for multi-stack architectures where stateful infrastructure is separated from application stacks.
 *
 * ```typescript
 * import * as pulumi from "@pulumi/pulumi";
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
 * Reference stacks using Pulumi config to specify stack names:
 *
 * ```bash
 * # Configure the env stack reference
 * pulumi config set stack-type app -s my-app-stack
 * pulumi config set env-stack my-env-stack -s my-app-stack
 *
 * # Deploy with type-safe access to env stack outputs
 * pulumi up
 * ```
 *
 * The function parameter serves as a type template - it defines the shape of the referenced stack's outputs without being executed. This enables full TypeScript IntelliSense and type checking for cross-stack references. See the [Structuring Stacks](/working-with-pulumi/structuring-stacks) guide for comprehensive multi-stack patterns.
 */

import * as pulumi from "@pulumi/pulumi";

// biome-ignore lint/suspicious/noExplicitAny: I don't feel like figuring out a better type
type AsOutput<T> = T extends pulumi.Output<any> ? T : pulumi.Output<T>;

/**
 * Interface for referencing outputs from another Pulumi stack.
 */
export type StackRef<T> = {
  /** Requires an output from the referenced stack by key */
  require: <K extends keyof T>(key: K) => AsOutput<T[K]>;
  /** Gets an output from the referenced stack by key */
  get: <K extends keyof T>(key: K) => AsOutput<T[K] | undefined>;
};

/**
 * Creates a reference to another Pulumi stack's outputs.
 * @param stack - The stack reference string
 * @param func - Function that defines the output type structure
 * @returns A StackRef instance for accessing the referenced stack's outputs
 */
export function stackRef<Output>(
  stack: string,
  func: (...args: never[]) => Output,
): StackRef<Output> {
  const stackRef = new pulumi.StackReference(stack);

  return {
    require: <K extends keyof Output>(key: K) => {
      return stackRef.requireOutput(key as string) as AsOutput<Output[K]>;
    },
    get: <K extends keyof Output>(key: K) => {
      return stackRef.getOutput(key as string) as AsOutput<
        Output[K] | undefined
      >;
    },
  };
}
