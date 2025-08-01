/**
 * @packageDocumentation
 *
 * AWS Client VPN endpoints provide secure remote access to VPC resources using SSL/TLS certificate-based authentication. They enable secure connections for remote workers, contractors, or administrators who need access to private AWS resources without exposing them to the internet.
 *
 * ```typescript
 * import * as saws from "@stackattack/aws";
 *
 * const ctx = saws.context();
 * const vpc = saws.vpc(ctx);
 * const vpn = saws.vpn(ctx, vpc);
 *
 * // If you'd only like to associate the VPN with a single subnet (cheapest option)
 * // const vpn = saws.vpn(ctx, {
 * //   ...vpc,
 * //   privateSubnetIds: vpc.privateSubnetIds.slice(0, 1)
 * // })
 *
 * export const vpnClientConfig = vpn.clientConfig;
 * ```
 *
 * ## Usage
 *
 * After deployment, you can retrieve your client configuration from your stack output and write it to a file, like so:
 *
 * ```bash
 * # Export the client config from Pulumi outputs
 * pulumi stack output vpnClientConfig --show-secrets > client.ovpn
 * ```
 *
 * You can use the `client.ovpn` file to connect to your VPN using any openvpn-compatible client, such as [OpenVPN Connect](https://openvpn.net/client/) for a desktop app, or on the command line directly:
 * ```
 * # Connect using OpenVPN client
 * sudo openvpn --config client.ovpn
 * ```
 *
 * ## Costs
 *
 * **Warning**: Using this component is quite expensive relative to other options. It's a simple, reliable way to connect to private resources in AWS without any third-party services, but be careful using this approach if you are cost-sensitive.
 *
 * Client VPN pricing includes both endpoint charges and connection hours:
 * - **Endpoint charge**: $0.10/hour (~$73/month) _per subnet association_ whether connections are active or not. A subnet association will be created for each subnet passed in `privateSubnetIds`, so be aware of this and only pass the subnet IDs that you'd like to create subnet associations with.
 * - **Connection charge**: $0.05/hour per concurrent connection (~$36/month per user connected 24 hours a day, prorated based on actual connection time)
 * - **Data transfer**: Standard AWS data transfer rates apply. If you do not use split-tunneling, you will pay for traffic flowing through your NAT gateway.
 *
 * Cost optimization strategies:
 * - Use split tunneling (enabled by default) to avoid routing all traffic through AWS.
 * - AWS [recommends](https://docs.aws.amazon.com/AWSEC2/latest/APIReference/API_AssociateClientVpnTargetNetwork.html) associating your client VPN endpoint with at least two subnets for availability, but you can associate a single subnet if you'd prefer (see example above). You are charged per subnet association per hour, so the number of subnets the VPN is associated with highly correlated with the cost.
 *
 * See the [AWS VPN Pricing](https://aws.amazon.com/vpn/pricing/) for current rates.
 *
 */

import * as path from "node:path";
import * as aws from "@pulumi/aws";
import * as command from "@pulumi/command";
import * as pulumi from "@pulumi/pulumi";
import { rootDir } from "#dir";
import type { Context } from "../context.js";
import {
  type CidrAllocator,
  getVpcAttributes,
  getVpcDefaultSecurityGroup,
  getVpcDnsServer,
  type VpcInput,
} from "./vpc.js";

const scriptsDir = path.normalize(path.join(rootDir, "../scripts"));

const easyRsaGeneratePath = path.join(scriptsDir, "easy-rsa-generate.sh");

/**
 * Configuration options for generating VPN certificates.
 */
export interface VPNCertificateArgs {
  /** Common name for the certificate authority */
  commonName?: pulumi.Input<string>;
  /** Server certificate name */
  serverName?: pulumi.Input<string>;
  /** Client certificate name */
  clientName?: pulumi.Input<string>;
  /** Skip adding prefix to the resource context */
  noPrefix?: boolean;
}

/**
 * Output structure containing generated VPN certificates and keys.
 */
export interface VPNCertificateOutput {
  /** Certificate Authority (CA) certificate */
  ca: string;
  /** Server certificate */
  serverCrt: string;
  /** Server private key */
  serverPrivateKey: string;
  /** Client certificate */
  clientCrt: string;
  /** Client private key */
  clientPrivateKey: string;
}

/**
 * Generates VPN certificates using Easy-RSA for mutual TLS authentication.
 * Creates a certificate authority, server certificate, and client certificate.
 *
 * @param ctx - The context for resource naming and tagging
 * @param args - Optional configuration for certificate generation
 * @returns A promise that resolves to the generated certificates and keys
 */
export function vpnCertificate(
  ctx: Context,
  args?: VPNCertificateArgs,
): pulumi.Output<VPNCertificateOutput> {
  if (!args?.noPrefix) {
    ctx = ctx.prefix("certificate");
  }
  const cmd = new command.local.Command(
    ctx.id(),
    {
      create: easyRsaGeneratePath,
      triggers: [args?.clientName, args?.commonName, args?.serverName],
      environment: {
        ...(args?.clientName && {
          CLIENT_NAME: args.clientName,
        }),
        ...(args?.commonName && {
          COMMON_NAME: args.commonName,
        }),
        ...(args?.serverName && {
          SERVER_NAME: args.serverName,
        }),
      },
    },
    {
      ignoreChanges: ["create"],
      protect: true,
    },
  );

  return cmd.stdout.apply((data): VPNCertificateOutput => {
    return JSON.parse(data);
  });
}

/**
 * Configuration for generating OpenVPN client configuration file.
 */
export interface ClientConfigFileArgs {
  /** Name used for the client configuration */
  name: pulumi.Input<string>;
  /** VPN server hostname (may contain wildcards) */
  hostname: pulumi.Input<string>;
  /** CA certificate chain */
  certificateChain: pulumi.Input<string>;
  /** Client certificate */
  clientCertificate: pulumi.Input<string>;
  /** Client private key */
  clientPrivateKey: pulumi.Input<string>;
}

/**
 * Generates an OpenVPN client configuration file (.ovpn) with embedded certificates.
 * The configuration includes security settings and embedded CA, client cert, and private key.
 *
 * @param args - Configuration parameters for the client config
 * @returns A secret string containing the complete OpenVPN client configuration
 */
export function clientConfigFile({
  name,
  hostname,
  certificateChain,
  clientCertificate,
  clientPrivateKey,
}: ClientConfigFileArgs): pulumi.Output<string> {
  const remote = pulumi
    .all([hostname, name])
    .apply(([h, name]) => h.replace("*", name));

  const config = pulumi.interpolate`client
dev tun
proto udp
remote ${remote} 443
remote-random-hostname
resolv-retry infinite
nobind
remote-cert-tls server
cipher AES-256-GCM
verb 3
<ca>
${certificateChain}
</ca>
<cert>
${clientCertificate}
</cert>
<key>
${clientPrivateKey}
</key>

reneg-sec 0

verify-x509-name server name`;

  return pulumi.secret(config);
}

/**
 * Configuration options for creating an AWS Client VPN endpoint.
 */
export interface VpnArgs {
  /** VPC where the VPN endpoint will be created */
  vpc: pulumi.Input<VpcInput>;
  /** Private subnet IDs for VPN network associations */
  privateSubnetIds: pulumi.Input<string>[];
  /** Pre-generated VPN certificates, will auto-generate if not provided */
  certificate?: pulumi.Input<VPNCertificateOutput>;
  /** Security group IDs to attach to the VPN endpoint */
  securityGroupIds?: pulumi.Input<pulumi.Input<string>[]>;
  /** CIDR block for VPN client IP addresses */
  cidrBlock?: pulumi.Input<string>;
  /** CIDR allocator to automatically assign a CIDR block */
  cidrAllocator?: CidrAllocator;
  /** Enable CloudWatch connection logging (default: true) */
  enableConnectionLogs?: boolean;
  /** Skip adding prefix to the resource context */
  noPrefix?: boolean;
}

/**
 * Creates an AWS Client VPN endpoint with certificate-based authentication.
 * Sets up the VPN endpoint, network associations, authorization rules, and generates client configuration.
 *
 * @param ctx - The context for resource naming and tagging
 * @param args - Configuration options for the VPN endpoint
 * @returns An object containing the VPN endpoint resource and client configuration file
 */
export function vpn(ctx: Context, args: VpnArgs) {
  if (!args.noPrefix) {
    ctx = ctx.prefix("vpn");
  }
  const vpc = getVpcAttributes(args.vpc);

  let cidrBlock: pulumi.Input<string>;
  if (args.cidrBlock) {
    cidrBlock = args.cidrBlock;
  } else if (args.cidrAllocator) {
    cidrBlock = args.cidrAllocator.allocate(22);
  } else {
    throw new Error("cidrBlock or cidrAllocator must be provided");
  }

  let certificate: pulumi.Output<VPNCertificateOutput>;
  if (args.certificate) {
    certificate = pulumi.output(args.certificate);
  } else {
    certificate = vpnCertificate(ctx);
  }

  const clientCertificate = new aws.acm.Certificate(
    ctx.id("client-certificate"),
    {
      privateKey: certificate.clientPrivateKey,
      certificateChain: certificate.ca,
      certificateBody: certificate.clientCrt,
    },
  );

  const serverCertificate = new aws.acm.Certificate(
    ctx.id("server-certificate"),
    {
      privateKey: certificate.serverPrivateKey,
      certificateChain: certificate.ca,
      certificateBody: certificate.serverCrt,
    },
  );

  let connectionLogOptions: aws.ec2clientvpn.EndpointArgs["connectionLogOptions"] =
    {
      enabled: false,
    };
  const enableConnectionLogs = args.enableConnectionLogs ?? true;
  if (enableConnectionLogs) {
    const connectionLogsGroup = new aws.cloudwatch.LogGroup(
      ctx.id("connection-logs"),
      {
        tags: ctx.tags(),
      },
    );

    const connectionLogsStream = new aws.cloudwatch.LogStream(
      ctx.id("connection-logs-stream"),
      {
        logGroupName: connectionLogsGroup.name,
      },
    );

    connectionLogOptions = {
      enabled: true,
      cloudwatchLogGroup: connectionLogsGroup.name,
      cloudwatchLogStream: connectionLogsStream.name,
    };
  }

  const dnsServer = vpc.cidrBlock.apply(getVpcDnsServer);

  let securityGroupIds: pulumi.Input<pulumi.Input<string>[]>;
  if (args.securityGroupIds) {
    securityGroupIds = args.securityGroupIds;
  } else {
    const defaultSecurityGroup = getVpcDefaultSecurityGroup(vpc.id);
    securityGroupIds = [defaultSecurityGroup.id];
  }

  const vpnEndpoint = new aws.ec2clientvpn.Endpoint(ctx.id(), {
    serverCertificateArn: serverCertificate.arn,
    clientCidrBlock: cidrBlock,
    securityGroupIds,
    authenticationOptions: [
      {
        type: "certificate-authentication",
        rootCertificateChainArn: clientCertificate.arn,
      },
    ],
    selfServicePortal: "disabled",
    dnsServers: [dnsServer],
    splitTunnel: true,
    connectionLogOptions,
  });

  let subnetIdx = 0;
  for (const subnetId of args.privateSubnetIds) {
    new aws.ec2clientvpn.NetworkAssociation(
      ctx.id(`association-${subnetIdx}`),
      {
        clientVpnEndpointId: vpnEndpoint.id,
        subnetId,
      },
    );
    subnetIdx++;
  }

  new aws.ec2clientvpn.AuthorizationRule(ctx.id("network-authorization-rule"), {
    clientVpnEndpointId: vpnEndpoint.id,
    targetNetworkCidr: "0.0.0.0/0",
    authorizeAllGroups: true,
  });

  const clientConfig = clientConfigFile({
    name: ctx.id(),
    hostname: vpnEndpoint.dnsName,
    certificateChain: certificate.ca,
    clientCertificate: certificate.clientCrt,
    clientPrivateKey: certificate.clientPrivateKey,
  });

  return {
    vpnEndpoint,
    clientConfig,
  };
}
