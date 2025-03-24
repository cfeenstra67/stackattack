import * as fs from "node:fs";
import * as path from "node:path";

export function* walkFiles(dir: string): Generator<string> {
  if (!fs.existsSync(dir)) {
    return;
  }

  const stat = fs.statSync(dir);

  if (!stat.isDirectory()) {
    yield path.basename(dir);
    return;
  }

  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!item.isDirectory()) {
      yield item.name;
      continue;
    }

    for (const name of walkFiles(path.join(dir, item.name))) {
      yield path.join(item.name, name);
    }
  }
}
