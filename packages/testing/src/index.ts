import * as crypto from "node:crypto";
import {
  type ConfigMap,
  LocalWorkspace,
  type Stack,
} from "@pulumi/pulumi/automation/index.js";
import { fullyDeleteStack, unprotectAll } from "./pulumi.js";

export interface RunIntegrationTestArgs<T extends string> {
  sourceStacks: T[];
  workDir?: string;
  idLength?: number;
  config?: (
    configs: Record<NoInfer<T>, ConfigMap>,
    stacks: Record<NoInfer<T>, string>,
    src: NoInfer<T>,
  ) => Partial<ConfigMap>;
  validate?: (stack: Stack, src: NoInfer<T>) => void | Promise<void>;
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
  const id =
    process.env.RUN_ID ?? crypto.randomBytes(idLength ?? 4).toString("hex");
  const useWorkDir = workDir ?? "./";

  console.log("Run ID:", id);

  const stackNames = {} as Record<T, string>;
  const stackObjects = {} as Record<T, Stack>;
  const stackConfigs = {} as Record<T, ConfigMap>;
  for (const src of sourceStacks) {
    const name = `${src}-${id}`;
    stackNames[src] = name;

    const stack = await LocalWorkspace.createOrSelectStack({
      stackName: name,
      workDir: useWorkDir,
    });
    stackObjects[src] = stack;

    const workspace = stack.workspace;

    const config = await workspace.getAllConfig(src);
    stackConfigs[src] = config;
  }

  const stacks: [T, Stack][] = [];
  for (const sourceStack of sourceStacks) {
    const stack = stackObjects[sourceStack];

    const workspace = stack.workspace;
    await workspace.setAllConfig(stack.name, stackConfigs[sourceStack]);

    const extraConfig = config?.(stackConfigs, stackNames, sourceStack) ?? {};
    const configWithoutUndefined = Object.fromEntries(
      Object.entries(extraConfig).flatMap(([key, val]) =>
        val === undefined ? [] : [[key, val]],
      ),
    );
    await workspace.setAllConfig(stack.name, configWithoutUndefined);

    stacks.push([sourceStack, stack]);
  }

  let step = "";
  let targetStack = "";
  try {
    if (!deleteOnly) {
      for (const [sourceStack, stack] of stacks) {
        targetStack = stack.name;
        step = "unprotecting existing resources";
        await unprotectAll(stack);

        step = "creating";
        console.log("Creating", stack.name);
        await stack.up();

        step = "refreshing";
        await stack.refresh();

        step = "confirming no drift";
        await stack.preview({ expectNoChanges: true });

        if (validate) {
          step = "validating";
          console.log("Validating", stack.name);
          await validate(stack, sourceStack);
          console.log("Validation succeeded for", stack.name);
        }
      }
    }
  } catch (error) {
    console.error(
      `Error on step "${step}" for "${targetStack}": ${error}`,
      (error as Error).stack,
    );
    throw error;
  } finally {
    if (!skipDelete) {
      for (const [, stack] of stacks.reverse()) {
        await fullyDeleteStack(stack);
      }
    }
  }
}
