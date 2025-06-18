/**
 * @packageDocumentation
 * 
 * RDS database components for creating PostgreSQL database instances with secure networking.
 * 
 * Creates RDS instances with subnet groups, parameter groups, and security groups for database access.
 * Includes automatic password generation, encryption at rest, and deletion protection by default.
 */

import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";
import * as random from "@pulumi/random";
import { Context } from "../context.js";
import { singlePortIngressSecurityGroup } from "../security-groups.js";
import { Network } from "./vpc.js";

/**
 * Configuration arguments for creating an RDS database instance.
 */
export interface DatabaseArgs {
  /** The network configuration (VPC and subnets) for the database */
  network: Network;
  /** Specific availability zone for the database instance */
  availabilityZone?: pulumi.Input<string>;
  /** Security group ID that should be allowed to access the database */
  sourceSecurityGroupId?: pulumi.Input<string>;
  /** Database engine type (currently only postgres is supported) */
  engine?: pulumi.Input<"postgres">;
  /** Database engine version (defaults to "17" for postgres) */
  version?: pulumi.Input<string>;
  /** Port number for database connections (defaults to 5432) */
  port?: pulumi.Input<number>;
  /** Name of the database to create (defaults to "main") */
  name?: pulumi.Input<string>;
  /** Master username for the database (defaults to "root") */
  username?: pulumi.Input<string>;
  /** Master password for the database (auto-generated if not provided) */
  password?: pulumi.Input<string>;
  /** RDS instance type (defaults to "db.t4g.micro") */
  instanceType?: pulumi.Input<string>;
  /** Whether to disable deletion protection */
  noDeletionProtection?: boolean;
  /** Whether to skip adding a prefix to the resource name */
  noPrefix?: boolean;
}

/**
 * Output from creating a database, containing the instance and connection URL.
 */
export interface DatabaseOutput {
  /** The RDS instance resource */
  instance: aws.rds.Instance;
  /** Connection URL for the database */
  url: pulumi.Output<string>;
}

/**
 * Creates an RDS database instance with security group, subnet group, and parameter group.
 * @param ctx - The context for resource naming and tagging
 * @param args - Configuration arguments for the database
 * @returns Database output containing the instance and connection URL
 */
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

  const protocol = pulumi
    .output(engine)
    .apply((val) => (val === "postgres" ? "postgresql" : val));

  const url = pulumi.interpolate`${protocol}://${username}:${password}@${instance.address}:${instance.port}/${name}`;

  return { instance, url };
}

/**
 * Converts a DatabaseOutput to a structure containing just the instance ID and URL.
 * @param database - The database output to convert
 * @returns Object with instance ID and URL
 */
export function databaseToIds(database: DatabaseOutput) {
  return {
    instance: database.instance.id,
    url: database.url,
  };
}
