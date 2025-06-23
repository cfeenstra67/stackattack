/**
 * @packageDocumentation
 *
 * RDS databases in AWS provide managed relational database instances. StackAttack creates PostgreSQL databases with secure networking, automatic backups, encryption at rest, and SSL connections enabled by default.
 *
 * ```typescript
 * import * as saws from "@stackattack/aws";
 *
 * const ctx = saws.context();
 * const network = saws.vpc(ctx);
 * const db = saws.database(ctx, {
 *   network: network.network("private")
 * });
 *
 * export const dbUrl = db.url;
 * ```
 *
 * ## Usage
 *
 * After deploying a database, you can connect to it using:
 *
 * **AWS CLI:**
 * ```bash
 * # View database instance details
 * aws rds describe-db-instances --db-instance-identifier your-db-identifier
 *
 * # Create a manual snapshot
 * aws rds create-db-snapshot --db-instance-identifier your-db-identifier --db-snapshot-identifier my-snapshot-$(date +%Y%m%d)
 *
 * # View database logs
 * aws rds describe-db-log-files --db-instance-identifier your-db-identifier
 * ```
 *
 * **Direct Connection:**
 * ```bash
 * # Connect using psql (PostgreSQL)
 * psql "postgresql://root:password@your-db-endpoint:5432/main?sslmode=require"
 *
 * # Or using environment variables
 * export PGHOST=your-db-endpoint
 * export PGPORT=5432
 * export PGDATABASE=main
 * export PGUSER=root
 * export PGPASSWORD=your-password
 * psql
 * ```
 *
 * **Application Code:**
 * ```javascript
 * import { Client } from "pg";
 *
 * const client = new Client({
 *   connectionString: "postgresql://root:password@your-db-endpoint:5432/main?sslmode=require"
 * });
 *
 * await client.connect();
 * const result = await client.query("SELECT NOW()");
 * await client.end();
 * ```
 *
 * ## Related Components
 *
 * Databases work together with other StackAttack components:
 * - [vpc](/components/vpc) - Provides secure private networking for database access
 * - [service](/components/service) - Connects to databases for persistent data storage
 *
 * ## Costs
 *
 * RDS costs are **fixed monthly charges** based on instance type plus **usage-based storage**:
 *
 * - **Instance costs** - The default `db.t4g.micro` costs ~$12.41/month if running 24/7. Larger instances like `db.t4g.small` (~$24.82/month) or `db.r7g.large` (~$158.40/month) provide more CPU and memory.
 *
 * - **Storage costs** - General Purpose SSD storage is ~$0.115/GB/month. The default 30GB allocation costs ~$3.45/month. Storage automatically scales as your database grows.
 *
 * - **Backup storage** - StackAttack enables 7-day backup retention. Backups within your allocated storage are free; additional backup storage is ~$0.095/GB/month.
 *
 * - **Data transfer** - Minimal costs for database connections within the same VPC (typically free). Cross-region replication incurs standard AWS data transfer rates.
 *
 * - **Snapshots** - Manual snapshots cost the same as backup storage (~$0.095/GB/month) and persist until manually deleted.
 *
 * Cost optimization strategies:
 * - Use `db.t4g.micro` for development/small workloads
 * - Monitor storage growth and set CloudWatch alerts for unexpected increases
 * - Consider Aurora Serverless for intermittent workloads that can pause/resume
 * - Delete old manual snapshots regularly
 * - Use Multi-AZ only for production workloads requiring high availability
 *
 * See [RDS Pricing](https://aws.amazon.com/rds/pricing/) for current rates.
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
