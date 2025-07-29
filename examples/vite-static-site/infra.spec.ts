import assert from "node:assert";
import { test } from "node:test";
import { runIntegrationTest } from "@stackattack/testing";

const projectName = "stackattack-vite";

test(projectName, async () => {
  await runIntegrationTest({
    idLength: 2,
    sourceStack: "prod",
    config: (config, stackName) => {
      const domain = config[`${projectName}:domain`].value;

      return { domain: { value: `${stackName}.${domain}` } };
    },
    validate: async (stack) => {
      const outputs = await stack.outputs();
      const url = outputs.url.value;
      const response = await fetch(url);

      assert.equal(response.status, 200);

      const text = await response.text();

      assert.match(text, /Vite/);
    },
  });
});
