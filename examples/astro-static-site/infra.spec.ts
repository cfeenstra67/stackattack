import assert from "node:assert";
import { test } from "node:test";
import { runIntegrationTest } from "@stackattack/testing";

const projectName = "stackattack-astro";

test(projectName, async () => {
  await runIntegrationTest({
    idLength: 2,
    sourceStacks: ["prod"],
    config: (configs, stacks) => {
      const domain = configs.prod[`${projectName}:domain`].value;

      return { domain: { value: `${stacks.prod}.${domain}` } };
    },
    validate: async (stack) => {
      const outputs = await stack.outputs();
      const url = outputs.url.value;
      const response = await fetch(url);

      assert.equal(response.status, 200);

      const text = await response.text();

      assert.match(text, /Astro/);
    },
  });
});
