import assert from "node:assert";
import { test } from "node:test";
import { runIntegrationTest } from "@stackattack/testing";

const projectName = "stackattack-vite";

test(projectName, async () => {
  await runIntegrationTest({
    idLength: 2,
    sourceStacks: ["prod"],
    config: (_, config, stackName) => {
      const domain = config[`${projectName}:domain`].value;

      return { domain: { value: `${stackName}.${domain}` } };
    },
    validate: async (_, stack) => {
      const outputs = await stack.outputs();
      const url = outputs.url.value;
      const domain = await stack.getConfig(`${projectName}:domain`);

      assert.equal(url, `https://${domain.value}`);

      const response = await fetch(url);

      assert.equal(response.status, 200);

      const text = await response.text();

      assert.match(text, /Vite/);
    },
  });
});
