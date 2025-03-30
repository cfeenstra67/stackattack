import * as crypto from "node:crypto";
import * as pulumi from "@pulumi/pulumi";

export interface Context {
  id: (value?: string) => string;
  shortId: (value: string) => string;
  tags: (others?: Record<string, string>) => Record<string, string>;
  prefix: (value: string) => Context;
  withTags: (others: Record<string, string>) => Context;
}

export interface ContextOpts {
  prefix?: string;
  tags?: Record<string, string>;
}

function defaultContextPrefix(): string {
  const project = pulumi.getProject();
  const stack = pulumi.getStack();
  return stack.startsWith(project) ? stack : `${project}-${stack}`;
}

export function context(opts?: ContextOpts): Context {
  let prefix: string;
  if (opts?.prefix !== undefined) {
    prefix = opts.prefix;
  } else {
    prefix = defaultContextPrefix();
  }

  const tagsObj = opts?.tags ?? {};

  const id = (value?: string) =>
    [prefix, value].filter((v) => v !== undefined).join("-");

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
