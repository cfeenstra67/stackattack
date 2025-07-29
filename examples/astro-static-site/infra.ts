import * as pulumi from "@pulumi/pulumi";
import * as saws from "@stackattack/aws";

export default () => {
  const ctx = saws.context();
  const config = new pulumi.Config();

  const domain = config.require("domain");

  const bucket = saws.bucket(ctx, {
    paths: ["./dist"],
    forceDestroy: true,
  });

  // Not normally required, but use in this example so that `forceDestroy` can be specified for integration testing
  const logsBucket = saws.bucket(ctx.prefix("logs"), {
    objectOwnership: "BucketOwnerPreferred",
    forceDestroy: true,
  });

  const { url } = saws.staticSite(ctx, {
    bucket,
    domain,
    logsBucket,
    adapter: saws.astroAdapter(),
  });

  return { url };
};
