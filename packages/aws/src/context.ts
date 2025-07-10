/**
 * @packageDocumentation
 *
 * The `Context` is a foundational piece of Stackattack. It provides a consistent way to name, tag, and organize your infrastructure resources while avoiding name collisions between resources.
 *
 * ## What is a context?
 * A Context is an object that encapsulates:
 * - **Resource naming patterns** - Consistent prefixes and naming conventions
 * - **Tags** - Common tags applied to all resources
 * - **Hierarchical organization** - Ability to create nested contexts for different parts of your infrastructure
 *
 * The reasoning for having a context is quite simple: it allows you to abstract groups of resources into functions without name collisions. For example, without a context, if you write a function like the following:
 * ```typescript
 * import * as aws from '@pulumi/aws';
 * import * as pulumi from '@pulumi/pulumi';
 *
 * interface DnsRecordArgs {
 *   name: pulumi.Input<string>;
 *   zoneId: pulumi.Input<string>;
 *   ip: pulumi.Input<string>;
 * }
 *
 * function dnsRecord({ name, zoneId, ip }: DnsRecordArgs) {
 *   return new aws.route53.Record("record", {
 *     name,
 *     zoneId,
 *     type: "A",
 *     ttl: 300,
 *     records: [ip]
 *   });
 * }
 * ```
 * It will not work to use it multiple times in a single stack, for example:
 * ```ts
 * const zoneId = aws.route53.getZoneOutput({ name: "mydomain.com" }).id;
 * const ip1 = "71.112.12.111";
 * const ip2 = "32.112.43.22";
 *
 * const record1 = dnsRecord({ name: "server1.mydomain.com", zoneId, ip: ip1 });
 * const record2 = dnsRecord({ name: "server2.mydomain", zoneId, ip: ip2 });
 * ```
 * This code will fail when you run `pulumi up`, because you end up with two `aws.route53.Record` resources with the name "record". You can mitigate this by, for example, passing a prefix to `dnsRecord`, but stackattack's `context` provides a simple, clean way to do this in a consistent manner.
 *
 * Using a context, the function might look like:
 * ```ts
 * function dnsRecord(ctx: saws.Context, { name, zoneId, ip }: DnsRecordArgs) {
 *   return new aws.route53.Record(ctx.id(), {
 *     name,
 *     zoneId,
 *     type: "A",
 *     ttl: 300,
 *     records: [ip]
 *   });
 * }
 * ```
 * And your stack could look like:
 * ```ts
 * import * as saws from '@stackattack/aws';
 *
 * const ctx = saws.context();
 *
 * const zoneId = aws.route53.getZoneOutput({ name: "mydomain.com" }).id;
 * const ip1 = "71.112.12.111";
 * const ip2 = "32.112.43.22";
 *
 * const record1 = dnsRecord(ctx.prefix("record-1"), { name: "server1.mydomain.com", zoneId, ip: ip1 });
 * const record2 = dnsRecord(ctx.prefix("record-2"), { name: "server2.mydomain", zoneId, ip: ip2 });
 * ```
 * This illustrates a key point--contexts are not a Stackattack-specific abstraction! The concept is still useful even if you're writing Pulumi code that doesn't use Stackattack components at all.
 *
 * ## Creating a Context
 *
 * For typical usage, you should simply instantiate a context without any arguments:
 *
 * ```typescript
 * import * as saws from "@stackattack/aws";
 *
 * const ctx = saws.context();
 * ```
 * By default, this context will generate a prefix and default tags based on your project and stack name. This approach works well because your resources will be clearly distinguishable by name in the AWS console, and the tags will make it easy to distinguish what stack and project resources belong to.
 *
 * If you have more specific needs, you can create a context with a custom prefix and/or tags:
 *
 * ```typescript
 * const ctx = saws.context({
 *  prefix: "my-app",
 *  tags: {
 *    Environment: "production",
 *    Team: "platform",
 *    Project: "web-service"
 *  }
 * });
 * ```
 *
 * ## Using Contexts
 *
 * Every Stackattack component takes a Context as its first parameter:
 *
 * ```typescript
 * const storage = saws.bucket(ctx, {
 *   versioned: true,
 * });
 *
 * const vpc = saws.vpc(ctx);
 * ```
 *
 * You can create nested contexts for different parts of your infrastructure:
 *
 * ```typescript
 * const ctx = saws.context();
 *
 * // Each will have appropriate naming: my-app-storage-*, my-app-database-*
 * const s3 = saws.bucket(ctx.prefix("storage"), { versioned: true });
 * const db = saws.database(ctx.prefix("database"), { network: vpc.network("private"), engine: "postgres" });
 * ```
 *
 * _NOTE_: all Stackattack components add default prefixes to the context you pass in by default, so it's never _necessary_ to use `.prefix` unless you're creating multiple instances of a single component with the same context. All components also take `noPrefix: true` to disable to default prefixing behavior.
 *
 * ```typescript
 *
 * ```
 *
 * ## Adding Tags
 *
 * You can add additional tags to a context:
 *
 * ```typescript
 * const baseCtx = saws.context();
 *
 * const prodCtx = baseCtx.withTags({
 *   Environment: "production",
 *   CostCenter: "engineering"
 * });
 * ```
 */
import * as pulumi from "@pulumi/pulumi";

/**
 * Core context interface for resource naming and tagging in AWS infrastructure.
 */
export interface Context {
  /** Generates a resource ID by combining the context prefix with an optional value */
  id: (value?: string) => string;
  /** Returns merged tags combining context tags with optional additional tags */
  tags: (others?: Record<string, string>) => Record<string, string>;
  /** Creates a new Context with an extended prefix */
  prefix: (value: string) => Context;
  /** Creates a new Context with additional tags merged in */
  withTags: (others: Record<string, string>) => Context;
}

/**
 * Configuration options for creating a Context.
 */
export interface ContextOpts {
  /** Optional prefix for resource naming (defaults to project-stack combination). Defaults to `<project>-<stack>`, unless `stack` begins with `project` (e.g. project is named `api` and stack is named `api-prod`), in which case the default will just be `stack` */
  prefix?: string | null;
  /** Optional tags to apply to all resources created with this context. Defaults to `{ Source: "pulumi", Project: <project>, Stack: <stack> }` */
  tags?: Record<string, string>;
}

/** Generates a default set of context tags based on the current project and stack, plus a `Source: "pulumi"` tag. */
export function defaultContextTags(): Record<string, string> {
  const project = pulumi.getProject();
  const stack = pulumi.getStack();
  return {
    Source: "pulumi",
    Project: project,
    Stack: stack,
  };
}

/** Generates a default prefix based on the current project and stack. Defaults to `<project>-<stack>`, unless `stack` begins with `project` (e.g. project is named `api` and stack is named `api-prod`), in which case the default will just be `stack` */
export function defaultContextPrefix(): string {
  const project = pulumi.getProject();
  const stack = pulumi.getStack();
  return stack.startsWith(project) ? stack : `${project}-${stack}`;
}

/**
 * Creates a new Context for consistent resource naming and tagging.
 * @param opts - Optional configuration for prefix and tags
 * @returns A Context instance with id, shortId, tags, prefix, and withTags methods
 */
export function context(opts?: ContextOpts): Context {
  let prefix: string | null;
  if (opts?.prefix !== undefined) {
    prefix = opts.prefix;
  } else {
    prefix = defaultContextPrefix();
  }

  const tagsObj = opts?.tags ?? defaultContextTags();

  const id = (value?: string) =>
    [prefix, value].filter((v) => v !== undefined && v !== null).join("-");

  const tags: Context["tags"] = (others) => ({ ...tagsObj, ...others });

  return {
    id,
    tags,
    prefix: (value) => context({ prefix: id(value), tags: tagsObj }),
    withTags: (others) => context({ prefix, tags: tags(others) }),
  };
}
