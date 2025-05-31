import * as pulumi from "@pulumi/pulumi";

export interface StackRef<T> {
  require: <K extends keyof T>(key: K) => pulumi.Output<T[K]>;
}

export function stackRef<Output>(
  stack: string,
  func: () => Output,
): StackRef<Output> {
  const stackRef = new pulumi.StackReference(stack);

  return {
    require: <K extends keyof Output>(key: K) => {
      return stackRef.requireOutput(key as string) as pulumi.Output<Output[K]>;
    },
  };
}
