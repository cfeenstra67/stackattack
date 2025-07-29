import * as crypto from "node:crypto";
import {
  type ConfigMap,
  LocalWorkspace,
  Stack,
} from "@pulumi/pulumi/automation/index.js";
import { fullyDeleteStack, unprotectAll } from "./pulumi.js";

export interface RunIntegrationTestArgs<T extends string> {
  sourceStacks: T[];
  workDir?: string;
  idLength?: number;
  config?: (src: NoInfer<T>, config: ConfigMap, stackName: string) => ConfigMap;
  validate?: (src: NoInfer<T>, stack: Stack) => void | Promise<void>;
}

export async function runIntegrationTest<T extends string>({
  sourceStacks,
  workDir,
  config,
  validate,
  idLength,
}: RunIntegrationTestArgs<T>): Promise<void> {
  const deleteOnly = Boolean(process.env.DELETE_ONLY);
  const skipDelete = Boolean(process.env.SKIP_DELETE);

  const stacks: [T, Stack][] = [];
  for (const sourceStack of sourceStacks) {
    const id = crypto.randomBytes(idLength ?? 4).toString("hex");
    const stackName = process.env.STACK_NAME ?? `test-${id}`;
    const useWorkDir = workDir ?? "./";

    const stack = await LocalWorkspace.createOrSelectStack({
      stackName,
      workDir: useWorkDir,
    });

    const workspace = stack.workspace;

    const allConfig = await workspace.getAllConfig(sourceStack);
    await workspace.setAllConfig(stack.name, allConfig);

    const extraConfig = config?.(sourceStack, allConfig, stackName) ?? {};
    await workspace.setAllConfig(stack.name, extraConfig);

    stacks.push([sourceStack, stack]);
  }

  try {
    if (!deleteOnly) {
      for (const [sourceStack, stack] of stacks) {
        await unprotectAll(stack);

        console.log("Creating", stack.name);
        await stack.up();

        await stack.refresh();

        await stack.preview({ expectNoChanges: true });

        if (validate) {
          console.log("Validating", stack.name);
          await validate(sourceStack, stack);
          console.log("Validation succeeded for", stack.name);
        }
      }
    }
  } finally {
    if (!skipDelete) {
      for (const [, stack] of stacks.reverse()) {
        await fullyDeleteStack(stack);
      }
    }
  }
}
