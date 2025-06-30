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
 * const vpnEndpoint = saws.vpn(ctx, { vpc });
 *
 * export const vpnClientConfig = vpnEndpoint.clientConfig;
 * ```
 *
 * ## Usage
 *
 * After deployment, use the AWS CLI to download the client configuration:
 *
 * ```bash
 * # Export the client config from Pulumi outputs
 * pulumi stack output vpnClientConfig --show-secrets > client.ovpn
 *
 * # Connect using OpenVPN client
 * sudo openvpn --config client.ovpn
 *
 * # Or use AWS CLI to manage the VPN endpoint
 * aws ec2 describe-client-vpn-endpoints
 * aws ec2 describe-client-vpn-connections --client-vpn-endpoint-id cvpn-endpoint-123
 * ```
 *
 * The generated `.ovpn` configuration file includes embedded certificates and can be used with any OpenVPN-compatible client (OpenVPN Connect, Tunnelblick, etc.).
 *
 * ## Costs
 *
 * **Warning**: Using this component is quite expensive relative to other options. It's a simple way to connect to private resources in AWS, but be careful using this approach if you are cost-sensitive.
 *
 * Client VPN pricing includes both endpoint charges and connection hours:
 * - **Endpoint charge**: $0.10/hour (~$73/month) whether connections are active or not
 * - **Connection charge**: $0.05/hour per concurrent connection (~$36/month per user)
 * - **Data transfer**: Standard AWS data transfer rates apply
 *
 * Cost optimization strategies:
 * - Use split tunneling (enabled by default) to avoid routing all traffic through AWS
 * - Consider AWS Site-to-Site VPN for persistent office connections instead of multiple Client VPN connections
 * - Monitor concurrent connections and implement automatic disconnection policies
 * - Use security groups and authorization rules to limit access scope
 *
 * See the [AWS VPC Pricing](https://aws.amazon.com/vpn/pricing/) for current rates.
 *
 */

import * as path from "node:path";
import * as aws from "@pulumi/aws";
import * as command from "@pulumi/command";
import * as pulumi from "@pulumi/pulumi";
import { rootDir } from "#dir";
import { Context } from "../context.js";
import {
  CidrAllocator,
  VpcInput,
  getVpcAttributes,
  getVpcDefaultSecurityGroup,
  getVpcDnsServer,
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
interface GenerateClientConfigArgs {
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
}: GenerateClientConfigArgs): pulumi.Output<string> {
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
interface VpnArgs {
  /** VPC where the VPN endpoint will be created */
  vpc: pulumi.Input<VpcInput>;
  /** Private subnet IDs for VPN network associations */
  privateSubnetIds: pulumi.Input<string>[];
  /** Public subnet IDs (currently unused but part of interface) */
  publicSubnetIds: pulumi.Input<string>[];
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
