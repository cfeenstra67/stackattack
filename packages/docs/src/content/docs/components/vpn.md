---
title: vpn
description: vpn component documentation
---

# vpn

```typescript
function vpn(ctx: Context, args: VpnArgs): { clientConfig: Output<string>; vpnEndpoint: Endpoint }
```

### Parameters

- **`ctx`** (`Context`) - The context for resource naming and tagging
- **`args`** (`VpnArgs`) - Configuration options for the VPN endpoint

## Interfaces

### VPNCertificateArgs

Configuration options for generating VPN certificates.


### Properties

- **`clientName?`** (`Input<string>`) - Client certificate name
- **`commonName?`** (`Input<string>`) - Common name for the certificate authority
- **`noPrefix?`** (`boolean`) - Skip adding prefix to the resource context
- **`serverName?`** (`Input<string>`) - Server certificate name

### VPNCertificateOutput

Output structure containing generated VPN certificates and keys.


### Properties

- **`ca`** (`string`) - Certificate Authority (CA) certificate
- **`clientCrt`** (`string`) - Client certificate
- **`clientPrivateKey`** (`string`) - Client private key
- **`serverCrt`** (`string`) - Server certificate
- **`serverPrivateKey`** (`string`) - Server private key

## Functions

### clientConfigFile

```typescript
function clientConfigFile(args: GenerateClientConfigArgs): Output<string>
```

### Parameters

- **`args`** (`GenerateClientConfigArgs`) - Configuration parameters for the client config

### vpnCertificate

```typescript
function vpnCertificate(ctx: Context, args?: VPNCertificateArgs): Output<VPNCertificateOutput>
```

### Parameters

- **`ctx`** (`Context`) - The context for resource naming and tagging
- **`args?`** (`VPNCertificateArgs`) - Optional configuration for certificate generation

