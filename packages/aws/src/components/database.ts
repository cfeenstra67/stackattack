import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";
import * as random from "@pulumi/random";
import { Context } from "../context.js";
import { singlePortIngressSecurityGroup } from "../security-groups.js";
import { Network } from "./vpc.js";

export interface DatabaseArgs {
  network: Network;
  availabilityZone?: pulumi.Input<string>;
  sourceSecurityGroupId?: pulumi.Input<string>;
  engine?: pulumi.Input<"postgres">;
  version?: pulumi.Input<string>;
  port?: pulumi.Input<number>;
  name?: pulumi.Input<string>;
  username?: pulumi.Input<string>;
  password?: pulumi.Input<string>;
  instanceType?: pulumi.Input<string>;
  noDeletionProtection?: boolean;
  noPrefix?: boolean;
}

export interface DatabaseOutput {
  instance: aws.rds.Instance;
  url: pulumi.Output<string>;
}

export function database(ctx: Context, args: DatabaseArgs): DatabaseOutput {
  if (!args.noPrefix) {
    ctx = ctx.prefix("database");
  }
  const port = args.port ?? 5432;

  const subnetGroup = new aws.rds.SubnetGroup(ctx.id("subnet-group"), {
    subnetIds: args.network.subnetIds,
    tags: ctx.tags(),
  });

  const securityGroup = singlePortIngressSecurityGroup(ctx, {
    vpc: args.network.vpc,
    sourceSecurityGroupId: args.sourceSecurityGroupId,
    port,
  });

  const params: aws.types.input.rds.ParameterGroupParameter[] = [
    {
      name: "rds.force_ssl",
      value: "1",
      applyMethod: "immediate",
    },
  ];

  const username = args.username ?? "root";

  let password: pulumi.Output<string>;
  if (args.password) {
    password = pulumi.secret(args.password);
  } else {
    const passwordResource = new random.RandomPassword(ctx.id("password"), {
      length: 16,
      special: false,
    });
    password = pulumi.secret(passwordResource.result);
  }

  let availabilityZone: pulumi.Input<string>;
  if (args.availabilityZone) {
    availabilityZone = args.availabilityZone;
  } else {
    availabilityZone = pulumi
      .output(args.network.subnetIds[0])
      .apply(async (id) => {
        if (!id) {
          throw new Error("No subnet IDs provided");
        }
        const subnet = await aws.ec2.getSubnet({ id });
        return subnet.availabilityZone;
      });
  }

  const name = args.name ?? "main";

  const engine = args.engine ?? "postgres";

  const version = args.version ?? "17";

  const parameterGroup = new aws.rds.ParameterGroup(ctx.id("params"), {
    family: pulumi.interpolate`${engine}${version}`,
    parameters: params,
    tags: ctx.tags(),
  });

  const instance = new aws.rds.Instance(ctx.id(), {
    identifierPrefix: ctx.id(""),
    allocatedStorage: 30,
    applyImmediately: true,
    availabilityZone,
    backupRetentionPeriod: 7,
    copyTagsToSnapshot: true,
    dbName: name,
    dbSubnetGroupName: subnetGroup.name,
    deletionProtection: !args.noDeletionProtection,
    engine,
    engineVersion: version,
    skipFinalSnapshot: false,
    finalSnapshotIdentifier: ctx.id("instance-snapshot"),
    deleteAutomatedBackups: false,
    caCertIdentifier: "rds-ca-rsa2048-g1",
    instanceClass: args.instanceType ?? "db.t4g.micro",
    port,
    username,
    password,
    storageEncrypted: true,
    autoMinorVersionUpgrade: false,
    parameterGroupName: parameterGroup.name,
    vpcSecurityGroupIds: [securityGroup.id],
    tags: ctx.tags(),
  });

  const url = pulumi.interpolate`${engine}://${username}:${password}@${instance.address}:${instance.port}/${name}`;

  return { instance, url };
}

export function databaseToIds(database: DatabaseOutput) {
  return {
    instance: database.instance.id,
    url: database.url,
  };
}
