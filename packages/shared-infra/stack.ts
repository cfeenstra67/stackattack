import * as saws from "@stackattack/aws";

export default () => {
  const ctx = saws.context();

  const vpc = saws.vpc(ctx);
  const vpn = saws.vpn(ctx, vpc);

  // const lmkCertificate = saws.certificate(ctx, { domain: '*.lmkapp.dev' });
  // const lmkLoadBalancer = saws.loadBalancer(ctx, {
  //   network: vpc.network("public"),
  //   certificate: lmkCertificate,
  // });

  const cluster = saws.cluster(ctx, {
    network: vpc.network("private"),
    instances: {
      architecture: "arm64",
      memoryMib: { min: 2048, max: 4096 },
      vcpuCount: { min: 2, max: 4 },
    },
  });
  const database = saws.database(ctx, { network: vpc.network("private") });

  return {
    clientConfig: vpn.clientConfig,
    cluster: saws.clusterToIds(cluster),
    // lmkLoadBalancer: saws.loadBalancerToIds(lmkLoadBalancer),
    vpc: saws.vpcToIds(vpc),
    database: saws.databaseToIds(database),
  };
};
