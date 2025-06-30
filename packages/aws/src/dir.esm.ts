import * as path from "node:path";
import * as url from "node:url";

export const rootDir = path.dirname(url.fileURLToPath(import.meta.url));
