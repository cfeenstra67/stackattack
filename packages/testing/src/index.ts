import * as crypto from "node:crypto";
import {
  type ConfigMap,
  LocalWorkspace,
  Stack,
} from "@pulumi/pulumi/automation/index.js";
import { fullyDeleteStack, unprotectAll } from "./pulumi.js";

export interface RunIntegrationTestArgs {
  sourceStack: string;
  workDir?: string;
  idLength?: number;
  config?: (config: ConfigMap, stackName: string) => ConfigMap;
  validate?: (stack: Stack) => void | Promise<void>;
}

export async function runIntegrationTest({
  sourceStack,
  workDir,
  config,
  validate,
  idLength,
}: RunIntegrationTestArgs): Promise<void> {
  const id = crypto.randomBytes(idLength ?? 4).toString("hex");
  const stackName = process.env.STACK_NAME ?? `test-${id}`;
  const useWorkDir = workDir ?? "./";
  const deleteOnly = Boolean(process.env.DELETE_ONLY);
  const skipDelete = Boolean(process.env.SKIP_DELETE);

  const stack = await LocalWorkspace.createOrSelectStack({
    stackName,
    workDir: useWorkDir,
  });

  const workspace = stack.workspace;

  const allConfig = await workspace.getAllConfig(sourceStack);
  await workspace.setAllConfig(stack.name, allConfig);

  const extraConfig = config?.(allConfig, stackName) ?? {};
  await workspace.setAllConfig(stack.name, extraConfig);

  try {
    if (!deleteOnly) {
      await unprotectAll(stack);

      console.log("Creating", stackName);
      await stack.up();

      await stack.refresh();

      await stack.preview({ expectNoChanges: true });

      if (validate) {
        console.log("Validating", stackName);
        await validate(stack);
        console.log("Validation succeeded for", stackName);
      }
    }
  } finally {
    if (!skipDelete) {
      await fullyDeleteStack(stack);
    }
  }
}
