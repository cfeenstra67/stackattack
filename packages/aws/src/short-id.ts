import * as crypto from "node:crypto";
import type { Context } from "./context.js";

export function shortId(ctx: Context, name: string, maxLength: number): string {
  const fullId = ctx.id(name);
  if (fullId.length <= maxLength) {
    return fullId;
  }
  const fullIdHash = crypto.createHash("sha256").update(fullId).digest("hex");
  return `${name}-${fullIdHash.slice(0, 6)}`;
}
