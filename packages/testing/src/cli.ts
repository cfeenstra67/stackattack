import { LocalWorkspace } from "@pulumi/pulumi/automation/index.js";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { fullyDeleteStack } from "./pulumi.js";

async function main() {
  await yargs(hideBin(process.argv))
    .command(
      "delete",
      "fully delete a testing stack",
      (yargs) =>
        yargs.option("stack", {
          alias: "s",
          type: "string",
          demandOption: true,
        }),
      async (args) => {
        const workDir = "./";

        const stack = await LocalWorkspace.selectStack({
          stackName: args.stack,
          workDir,
        });

        console.log("Refreshing", stack.name);

        await stack.refresh();

        await fullyDeleteStack(stack);
      },
    )
    .parseAsync();
}

main();
