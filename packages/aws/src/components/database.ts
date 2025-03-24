import { Context } from "@/context.js";
import { getVpcAttributes, getVpcId, Network, VpcInput } from "./vpc.js";
import * as pulumi from '@pulumi/pulumi';
import * as aws from '@pulumi/aws';
import * as random from '@pulumi/random';

export interface DatabaseSecurityGroupArgs {
  vpc: VpcInput;
  port?: pulumi.Input<number>;
  noPrefix?: boolean;
}

export function databaseSecurityGroup(ctx: Context, args: DatabaseSecurityGroupArgs) {
  if (!args.noPrefix) {
    ctx = ctx.prefix('security-group');
  }
  const vpcAttrs = getVpcAttributes(args.vpc);
  const group = new aws.ec2.SecurityGroup(ctx.id(), {
    vpcId: getVpcId(vpcAttrs.id),
    tags: ctx.tags()
  });
  const port = args.port ?? 5432;
  new aws.ec2.SecurityGroupRule(ctx.id('ingress'), {
    type: 'ingress',
    securityGroupId: group.id,
    protocol: 'tcp',
    fromPort: port,
    toPort: port,
    cidrBlocks: [vpcAttrs.cidrBlock],
    ipv6CidrBlocks: vpcAttrs.ipv6CidrBlock.apply((v) => v ? [v] : [])
  }, {
    deleteBeforeReplace: true
  });
  return group;
}

export interface DatabaseArgs {
  network: Network;
  availabilityZone?: pulumi.Input<string>;
  engine?: pulumi.Input<'postgres'>;
  version?: pulumi.Input<string>;
  port?: pulumi.Input<number>;
  name?: pulumi.Input<string>;
  username?: pulumi.Input<string>;
  password?: pulumi.Input<string>;
  instanceType?: pulumi.Input<string>;
  noDeletionProtection?: boolean;
  noPrefix?: boolean;
}

export function database(ctx: Context, args: DatabaseArgs) {
  if (!args.noPrefix) {
    ctx = ctx.prefix('database');
  }
  const port = args.port ?? 5432;

  const subnetGroup = new aws.rds.SubnetGroup(ctx.id('subnet-group'), {
    subnetIds: args.network.subnetIds,
    tags: ctx.tags()
  });

  const securityGroup = databaseSecurityGroup(ctx, { vpc: args.network.vpc, port });

  const params: aws.types.input.rds.ParameterGroupParameter[] = [
    {
      name: 'rds.force_ssl',
      value: '1',
      applyMethod: 'immediate',
    },
  ];

  const parameterGroup = new aws.rds.ParameterGroup(ctx.id('params'), {
    family: 'postgres13',
    namePrefix: ctx.id('params'),
    parameters: params,
    tags: ctx.tags(),
  });
  
  const username = args.username ?? 'root';

  let password: pulumi.Output<string>;
  if (args.password) {
    password = pulumi.secret(args.password);
  } else {
    const passwordResource = new random.RandomPassword(ctx.id('password'), {
      length: 16,
      special: false
    });
    password = pulumi.secret(passwordResource.result)
  }

  let availabilityZone: pulumi.Input<string>;
  if (args.availabilityZone) {
    availabilityZone = args.availabilityZone;
  } else {
    availabilityZone = pulumi.output(args.network.subnetIds[0]).apply(async (id) => {
      if (!id) {
        throw new Error('No subnet IDs provided');
      }
      const subnet = await aws.ec2.getSubnet({ id });
      return subnet.availabilityZone;
    })
  }

  const name = args.name ?? 'main';

  const instance = new aws.rds.Instance(ctx.id(), {
    allocatedStorage: 30,
    applyImmediately: true,
    availabilityZone,
    backupRetentionPeriod: 7,
    copyTagsToSnapshot: true,
    dbName: name,
    dbSubnetGroupName: subnetGroup.name,
    deletionProtection: !args.noDeletionProtection,
    engine: args.engine,
    engineVersion: args.version,
    skipFinalSnapshot: false,
    finalSnapshotIdentifier: ctx.id('instance-snapshot'),
    deleteAutomatedBackups: false,
    caCertIdentifier: 'rds-ca-rsa2048-g1',
    instanceClass: args.instanceType ?? 't3.micro',
    port,
    username,
    password,
    storageEncrypted: true,
    autoMinorVersionUpgrade: false,
    parameterGroupName: parameterGroup.name,
    vpcSecurityGroupIds: [securityGroup.id],
    tags: ctx.tags(),
  });

  const url = pulumi.interpolate`${args.engine}://${username}:${password}@${instance.address}:${instance.port}/${name}`

  return { instance, url };
}
