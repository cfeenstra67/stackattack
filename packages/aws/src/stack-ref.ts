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
