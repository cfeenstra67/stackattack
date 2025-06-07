import * as pulumi from "@pulumi/pulumi";

// biome-ignore lint/suspicious/noExplicitAny: I don't feel like figuring out a better type
type AsOutput<T> = T extends pulumi.Output<any> ? T : pulumi.Output<T>;

export interface StackRef<T> {
  require: <K extends keyof T>(key: K) => AsOutput<T[K]>;
}

export function stackRef<Output>(
  stack: string,
  func: (...args: never[]) => Output,
): StackRef<Output> {
  const stackRef = new pulumi.StackReference(stack);

  return {
    require: <K extends keyof Output>(key: K) => {
      return stackRef.requireOutput(key as string) as AsOutput<Output[K]>;
    },
  };
}
