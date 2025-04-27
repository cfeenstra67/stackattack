import * as path from "node:path";
import * as url from "node:url";
import * as aws from "@pulumi/aws";
import * as command from "@pulumi/command";
import * as pulumi from "@pulumi/pulumi";
import { Context } from "../context.js";
import {
  CidrAllocator,
  VpcInput,
  getVpcAttributes,
  getVpcDnsServer,
} from "./vpc.js";

const dirname = path.dirname(url.fileURLToPath(import.meta.url));

const scriptsDir = path.normalize(path.join(dirname, "../../scripts"));

const easyRsaGeneratePath = path.join(scriptsDir, "easy-rsa-generate.sh");

export interface VPNCertificateArgs {
  commonName?: pulumi.Input<string>;
  serverName?: pulumi.Input<string>;
  clientName?: pulumi.Input<string>;
  noPrefix?: boolean;
}

export interface VPNCertificateOutput {
  ca: string;
  serverCrt: string;
  serverPrivateKey: string;
  clientCrt: string;
  clientPrivateKey: string;
}

export function vpnCertificate(
  ctx: Context,
  args?: VPNCertificateArgs,
): pulumi.Output<VPNCertificateOutput> {
  if (!args?.noPrefix) {
    ctx = ctx.prefix("certificate");
  }
  const cmd = new command.local.Command(ctx.id(), {
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
  });

  return cmd.stdout.apply((data): VPNCertificateOutput => {
    return JSON.parse(data);
  });
}

interface GenerateClientConfigArgs {
  name: pulumi.Input<string>;
  hostname: pulumi.Input<string>;
  certificateChain: pulumi.Input<string>;
  clientCertificate: pulumi.Input<string>;
  clientPrivateKey: pulumi.Input<string>;
}

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

interface VpnArgs {
  vpc: pulumi.Input<VpcInput>;
  privateSubnetIds: pulumi.Input<string>[];
  publicSubnetIds: pulumi.Input<string>[];
  certificate?: pulumi.Input<VPNCertificateOutput>;
  cidrBlock?: pulumi.Input<string>;
  cidrAllocator?: CidrAllocator;
  enableConnectionLogs?: boolean;
  noPrefix?: boolean;
}

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

  const vpnEndpoint = new aws.ec2clientvpn.Endpoint(ctx.id(), {
    serverCertificateArn: serverCertificate.arn,
    clientCidrBlock: cidrBlock,
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
