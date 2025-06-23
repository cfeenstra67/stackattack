import * as crypto from "node:crypto";
import * as pulumi from "@pulumi/pulumi";

/**
 * Core context interface for resource naming and tagging in AWS infrastructure.
 */
export interface Context {
  /** Generates a resource ID by combining the context prefix with an optional value */
  id: (value?: string) => string;
  /** Generates a short ID with a hash suffix for uniqueness */
  shortId: (value: string) => string;
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
  /** Optional prefix for resource naming (defaults to project-stack combination) */
  prefix?: string | null;
  /** Optional tags to apply to all resources created with this context */
  tags?: Record<string, string>;
}

function defaultContextPrefix(): string {
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

  const tagsObj = opts?.tags ?? {};

  const id = (value?: string) =>
    [prefix, value].filter((v) => v !== undefined && v !== null).join("-");

  const shortId = (value: string) => {
    const hashVal = crypto
      .createHash("sha1")
      .update(id(value))
      .digest("hex")
      .slice(0, 6);
    return `${value}-${hashVal}`;
  };

  const tags: Context["tags"] = (others) => ({ ...tagsObj, ...others });

  return {
    id,
    shortId,
    tags,
    prefix: (value) => context({ prefix: id(value), tags: tagsObj }),
    withTags: (others) => context({ prefix, tags: tags(others) }),
  };
}
