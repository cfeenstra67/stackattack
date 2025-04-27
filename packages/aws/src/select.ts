import * as pulumi from "@pulumi/pulumi";

export function select(funcs: Record<string, () => unknown>) {
  const config = new pulumi.Config();
  const names = Object.keys(funcs);
  const stackType = config.require("stack-type", { allowedValues: names });
  const stack = funcs[stackType];
  return stack();
}
