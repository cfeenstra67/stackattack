import * as saws from "@stackattack/aws";

export default () => {
  const ctx = saws.context();

  const vpc = saws.vpc(ctx);
  const vpn = saws.vpn(ctx, vpc);

  const loadBalancer = saws.loadBalancer(ctx, {
    network: vpc.network("public"),
  });

  const cluster = saws.cluster(ctx, {
    network: vpc.network("private"),
    instances: {
      architecture: "arm64",
      memoryMib: { min: 2048, max: 4096 },
      vcpuCount: { min: 2, max: 4 },
      memoryGibPerVcpu: { min: 2, max: 2 },
    },
  });
  const database = saws.database(ctx, { network: vpc.network("private") });

  return {
    clientConfig: vpn.clientConfig,
    cluster: saws.clusterToIds(cluster),
    loadBalancer: saws.loadBalancerToIds(loadBalancer),
    vpc: saws.vpcToIds(vpc),
    database: saws.databaseToIds(database),
  };
};
