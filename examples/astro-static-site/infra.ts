import * as pulumi from "@pulumi/pulumi";
import * as saws from "@stackattack/aws";

export default () => {
  const ctx = saws.context();
  const config = new pulumi.Config();

  const domain = config.require("domain");

  const bucket = saws.bucket(ctx, {
    paths: ["./dist"],
    // For example purposes, on real stacks you will typically not want these set unless it's an ephemeral stack of some kind
    noProtect: true,
    forceDestroy: true,
  });

  const { url } = saws.staticSite(ctx, {
    bucket,
    domain,
    adapter: saws.astroAdapter(),
  });

  return { url };
};
