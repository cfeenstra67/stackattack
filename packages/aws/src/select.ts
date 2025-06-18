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
