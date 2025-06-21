import * as fs from "node:fs";
import * as path from "node:path";

/**
 * Recursively walks a directory and yields relative file paths.
 * @param dir - The directory path to walk
 * @yields Relative file paths from the directory
 */
export function* walkFiles(dir: string): Generator<[string, string]> {
  if (!fs.existsSync(dir)) {
    return;
  }

  const stat = fs.statSync(dir);

  if (!stat.isDirectory()) {
    yield [path.basename(dir), dir];
    return;
  }

  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!item.isDirectory()) {
      yield [item.name, path.join(dir, item.name)];
      continue;
    }

    for (const [name, filePath] of walkFiles(path.join(dir, item.name))) {
      yield [path.join(item.name, name), filePath];
    }
  }
}
