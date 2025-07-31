import assert from "node:assert";
import { execFile } from "node:child_process";
import { test } from "node:test";
import { promisify } from "node:util";
import { DescribeImagesCommand, ECRClient } from "@aws-sdk/client-ecr";
import { runIntegrationTest } from "@stackattack/testing";

const execFilePromise = promisify(execFile);

const projectName = "stackattack-ecs-api";

test(projectName, async () => {
  await runIntegrationTest({
    sourceStacks: ["env", "api"],
    config: (configs, stacks, src) => {
      const envDomain = configs.env[`${projectName}:domain`].value;
      const newEnvDomain = `${stacks.env}.${envDomain}`;

      switch (src) {
        case "api": {
          const envStack = configs.api[`${projectName}:env-stack`].value;
          const newEnvStack = envStack.replace("env", stacks.env);
          return {
            domain: { value: `${stacks.api}.${newEnvDomain}` },
            "env-stack": { value: newEnvStack },
          };
        }
        case "env": {
          return { domain: { value: newEnvDomain } };
        }
        default:
          return {};
      }
    },
    validate: async (stack, src) => {
      switch (src) {
        case "env": {
          const outputs = await stack.outputs();

          const repoUrl = outputs.repoUrl.value;
          const repoName = repoUrl.split("/").at(-1);

          assert(!!repoName, "Could not get repo name from outputs");

          const region = (await stack.getConfig("aws:region")).value;
          const ecrClient = new ECRClient({ region });

          const response = await ecrClient.send(
            new DescribeImagesCommand({
              repositoryName: repoName,
            }),
          );
          if (!response.imageDetails?.length) {
            console.log(`Building missing image for ${repoName}`);

            await execFilePromise("./scripts/build-and-push.sh", {
              env: {
                ...process.env,
                ENV_STACK: stack.name,
              },
            });

            console.log(`Built image for ${repoName}`);
          } else {
            console.log("Image exists in", repoName);
          }
          break;
        }
        case "api": {
          const outputs = await stack.outputs();

          const url = outputs.url.value;

          assert(!!url, "Could not get URL from output");

          const rootResp = await fetch(new URL("/healthcheck", url));

          assert.equal(rootResp.status, 200);

          const createResp = await fetch(new URL("/todos", url), {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ title: "Test" }),
          });

          assert.equal(createResp.status, 201);

          const listResp = await fetch(new URL("/todos", url));

          assert.equal(listResp.status, 200);

          const todos = await listResp.json();

          assert(Array.isArray(todos));
          assert(todos.length > 0);
          break;
        }
      }
    },
  });
});
