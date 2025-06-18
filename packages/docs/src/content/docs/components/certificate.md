---
title: certificate
description: certificate component documentation
---

# certificate

```typescript
function certificate(ctx: Context, args: CertificateArgs): Output<string>
```

### Parameters

- **`ctx`** (`Context`) - The context for resource naming and tagging
- **`args`** (`CertificateArgs`) - Configuration arguments for the certificate

## Interfaces

### CertificateArgs

Configuration arguments for creating an ACM certificate.


### Properties

- **`additionalDomains?`** (`Input<string>[]`) - Additional domain names to include in the certificate
- **`domain`** (`Input<string>`) - The primary domain name for the certificate
- **`noPrefix?`** (`boolean`) - Whether to skip adding a prefix to the resource name
- **`noValidate?`** (`boolean`) - Whether to skip DNS validation (returns certificate ARN immediately)
- **`wildcard?`** (`boolean`) - Whether to include a wildcard subdomain (*.domain)
- **`zone?`** (`Input<string>`) - Specific Route53 zone ID (auto-detected from domain if not provided)

## Functions

### getZoneFromDomain

```typescript
function getZoneFromDomain(domain: Input<string>): Output<string>
```

### Parameters

- **`domain`** (`Input<string>`) - The domain name to find the hosted zone for

