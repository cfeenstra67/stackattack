import * as childProcess from "node:child_process";
import * as util from "node:util";
import type { Stack } from "@pulumi/pulumi/automation/stack.js";

const execFile = util.promisify(childProcess.execFile);

export async function stackCommand(
  stack: Stack,
  args: string[],
): Promise<void> {
  const command = stack.workspace.pulumiCommand.command;
  await execFile(command, ["-s", stack.name, ...args], {
    cwd: stack.workspace.workDir,
  });
}

export async function unprotectAll(stack: Stack): Promise<void> {
  await stackCommand(stack, ["state", "unprotect", "--all"]);
}

export async function fullyDeleteStack(stack: Stack): Promise<void> {
  console.log("Unprotecting resources from", stack.name);
  await unprotectAll(stack);
  console.log("Deleting resources from", stack.name);
  await stack.destroy();
  console.log("Deleting", stack.name);
  await stack.workspace.removeStack(stack.name);
  console.log("Deleted", stack.name);
}
