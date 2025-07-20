import { IntegrationTestOptions, assertOutputs } from "@pulumi/pulumi/automation/index.js";

const opts: IntegrationTestOptions = {
  projectName: "stackattack-vpc-test",
  program: async () => {
    // const ctx = context();
    // const net = vpc(ctx, { natGateways: "single" });
    // return { subnetIds: net.private.map(s => s.id) };
  },
  validate: (stack) => {
    assertOutputs(stack, {
      subnetIds: (ids) => ids.length === 2,   // single-AZ default
    });
  },
};
