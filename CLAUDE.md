# Stackattack - AWS + Pulumi Toolkit

## Project Overview

Stackattack is an AWS infrastructure toolkit built on top of Pulumi. It provides opinionated, secure-by-default components for common AWS infrastructure patterns, designed for simplicity and production use.

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

### ⚠️ CRITICAL: Documentation Generation Process

**The `packages/docs/src/content/docs/components/` directory is ENTIRELY AUTO-GENERATED!**

- Component documentation is generated from TypeDoc comments in `packages/aws/src/components/*.ts`
- Any manual edits to `.md` files in `/content/docs/components/` will be overwritten
- To improve component documentation, edit the TypeDoc comments in the source `.ts` files
- The generation happens via `pnpm generate` which runs `tsx generate.ts`

### Import Convention
- Always use `import * as saws from '@stackattack/aws'` NOT individual imports
- This is the standard convention throughout the codebase

### Documentation Structure
- **Getting Started**: Introduction, installation, quick start (manually maintained)
- **Working with Pulumi**: Backend selection, stack structuring (manually maintained)
- **Concepts**: Context system explanation (manually maintained)
- **Components**: Auto-generated from TypeDoc comments in source files
- **Utilities**: ARNs, security groups, stack references (manually maintained)

### Build Process
1. `pnpm generate` - Generates TypeDoc documentation from source comments
2. `pnpm build-only` - Builds Astro site
3. Deployed via Pulumi infrastructure

### Component Documentation Conventions
**FINALIZED PATTERN** (based on successful bucket.ts implementation):

**Structure for @packageDocumentation in each component file:**

```typescript
/**
 * @packageDocumentation
 *
 * [High-level purpose statement describing what this AWS resource is used for]
 *
 * ```typescript
 * import * as saws from "@stackattack/aws";
 * 
 * const ctx = saws.context();
 * const [resourceName] = saws.[componentName](ctx);
 * 
 * export const [resourceName]Url = [resourceName].url;
 * ```
 *
 * ## Usage
 *
 * [Post-deployment usage examples with AWS CLI and SDK]
 *
 * ## Costs
 * 
 * [Real-world cost considerations and optimization strategies]
 */
```

**Required Elements:**
1. **High-level purpose statement** - Start with what the AWS resource is for (e.g., "S3 buckets in AWS are the standard way to store files...")
2. **One minimal code example:**
   - Always use `import * as saws from "@stackattack/aws";`
   - Always call `saws.context()` with NO arguments (show default usage)
   - Keep example as minimal as possible - no unnecessary configuration
   - Export pattern: `export const [resourceName]Url = [resourceName].url;`
   - **Do NOT mention** naming/tagging conventions (standard for all components)
3. **## Usage section** - Show practical post-deployment usage with AWS CLI and SDK
4. **## Costs section** - Focus on real-world cost drivers, gotchas, and optimization strategies with cross-references to related components

**Critical Rules:**
- **Edit only the @packageDocumentation section** - individual function docs should remain simple
- **DO NOT use @example blocks** - they don't render due to generate.ts limitations  
- **Never edit generated .md files** - they're completely auto-generated and .gitignored
- Run `pnpm generate` after changes to regenerate documentation
- Keep individual function documentation minimal (just basic purpose, params, return value)

**Section Naming Conventions:**
- Use `## Usage` (not "Usage After Deployment")
- Use `## Costs` (not "Pricing Information")

This pattern produces clean, focused documentation that prioritizes practical usage and real-world cost considerations.

### Maintenance Notes
- **Always update this CLAUDE.md when you discover new patterns or make changes**
- **CRITICAL**: The entire `packages/docs/src/content/docs/components/` directory is .gitignored and completely auto-generated - NO manual files can be created there, including index.md
- The components index page must be generated programmatically if needed, not created manually
- Check `packages/docs/generate.ts` to understand the generation process
- @example blocks in TypeDoc comments do not render in the generated documentation due to generate.ts limitations

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