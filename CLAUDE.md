# StackAttack - AWS + Pulumi Toolkit

## Project Overview

StackAttack is a production-ready AWS infrastructure toolkit built on top of Pulumi. It provides opinionated, secure-by-default components for common AWS infrastructure patterns, designed for simplicity and production use.

**Philosophy**: 
- Composition over inheritance
- Opinionated resources with reasonable defaults
- Primary extension method: composition or copy/paste
- Goal: fully deployed applications with VPN, SSH access, DB, etc. in <100 LOC

## Repository Structure

```
stackattack/
├── packages/
│   ├── aws/           # Main AWS components package (@stackattack/aws)
│   └── docs/          # Documentation website (@stackattack/docs)
├── examples/
│   └── simple-api/    # Example application using the components
└── TASKS.md          # Current development tasks
```

## Core Package: @stackattack/aws (v0.1.0-dev.46)

**Location**: `packages/aws/`
**Description**: TypeScript library providing AWS infrastructure components for Pulumi
**License**: MIT

### Dependencies
- `@pulumi/aws` (^6.73.0) - Core AWS provider
- `@pulumi/aws-native` (^1.26.0) - Native AWS provider
- `@pulumi/pulumi` (^3.157.0) - Pulumi SDK
- `@pulumi/command` (^1.0.2) - Command provider
- `@pulumi/random` (^4.18.0) - Random provider
- `mime-types` (^2.1.35) - MIME type utilities

### Architecture

#### Core Utilities (`src/`)
- `context.ts` - Configuration context and tagging system
- `select.ts` - Resource selection utilities
- `stack-ref.ts` - Cross-stack references
- `policies.js` - Common IAM policies
- `security-groups.ts` - Security group utilities
- `arns.ts` - ARN construction helpers

#### Infrastructure Components (`src/components/`)

**Networking & Security**:
- `vpc.ts` - VPC with multi-AZ subnets, internet gateways, route tables
- `vpn.ts` - VPN connections and configurations
- `certificate.ts` - SSL/TLS certificate management
- `load-balancer.ts` - Application and Network Load Balancers

**Compute & Services**:
- `cluster.ts` - ECS clusters and capacity providers
- `service.ts` - ECS services with task definitions and health checks
- `logs.ts` - CloudWatch log groups and streams

**Storage & Data**:
- `bucket.ts` - S3 buckets with encryption, versioning, CORS, lifecycle rules
- `database.ts` - RDS databases (PostgreSQL, MySQL, etc.)
- `redis.ts` - ElastiCache Redis clusters
- `s3-firehose.ts` - Kinesis Data Firehose for S3

**Integration & Domains**:
- `email-domain.ts` - Email domain configuration
- `gmail-domain.ts` - Gmail domain integration
- `vercel-domain.ts` - Vercel domain configuration
- `static-site.ts` - Static website hosting
- `topic-webhook.ts` - SNS topic webhooks
- `github-role.ts` - GitHub Actions IAM roles

#### Functions (`src/functions/`)
- `walk-files.ts` - File system traversal utilities
- `ec2-instance-connect-cidr.ts` - EC2 Instance Connect CIDR helpers

### Component Architecture Pattern

Each component follows a consistent pattern:
1. **Type Definitions**: Input types, output types, union types for flexibility
2. **Helper Functions**: Extract IDs, attributes from various input formats
3. **Configuration Interfaces**: Strongly typed configuration options
4. **Resource Creation**: Pulumi resource definitions with secure defaults
5. **Output Types**: Structured return values with all necessary attributes

Example component structure (bucket.ts):
- `BucketInput` - Union type for various bucket references
- `getBucketId()` - Extract bucket ID from different input types
- `BucketArgs` - Configuration interface
- `bucket()` - Main creation function
- `BucketOutput` - Return type with all attributes

### Security Defaults

All components implement security best practices by default:
- S3 buckets: Encryption enabled, public access blocked, versioning available
- VPCs: Private subnets, proper routing, flow logs
- ECS: Task role separation, log aggregation
- RDS: Encryption at rest, automated backups, private subnets

## Documentation Package: @stackattack/docs

**Location**: `packages/docs/`
**Technology**: Astro + Starlight
**Site**: https://stackattack.camfeenstra.com

### Documentation Structure
- **Getting Started**: Introduction, installation, quick start
- **Working with Pulumi**: Backend selection, stack structuring
- **Concepts**: Context system explanation
- **Components**: Auto-generated from component files (18 components)
- **Utilities**: ARNs, security groups, stack references

### Build Process
1. `pnpm generate` - Generates TypeDoc documentation
2. `pnpm build-only` - Builds Astro site
3. Deployed via Pulumi infrastructure

## Development Workflow

### Commands
- `pnpm build` - Build all packages
- `pnpm check` - Run linting and type checking
- `pnpm changeset publish` - Publish releases

### Component Development
1. Add component to `src/components/`
2. Export from `src/index.ts`
3. Add documentation to `packages/docs/src/content/docs/components/`
4. Update examples if needed

## Current State & Usage

The package is in active development (pre-1.0, dev releases). Components are production-ready but APIs may change. Used for deploying complete application stacks including networking, compute, storage, and monitoring in minimal code.

**Target Use Case**: Deploy production-ready applications (like Metabase with VPN, SSH, DB) in under 100 lines of code using composable, secure-by-default components.