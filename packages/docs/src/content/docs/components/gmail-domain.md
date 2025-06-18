---
title: gmail-domain
description: gmail-domain component documentation
---

## Interfaces

### GmailDomainArgs

Configuration arguments for setting up Gmail domain verification and MX records.


### Properties

- **`domain`** (`Input<string>`) - The domain name to configure for Gmail
- **`noPrefix?`** (`boolean`) - Whether to skip adding a prefix to the resource name
- **`verificationCode`** (`Input<string>`) - Google verification code for domain ownership
- **`zoneId?`** (`Input<string>`) - Route53 zone ID (auto-detected from domain if not provided)

## Functions

### gmailDomain

```typescript
function gmailDomain(ctx: Context, args: GmailDomainArgs): { mxRecord: Record; verificationRecord: Record }
```

### Parameters

- **`ctx`** (`Context`) - The context for resource naming and tagging
- **`args`** (`GmailDomainArgs`) - Configuration arguments for the Gmail domain setup

