import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

function sh(cmd, opts = {}) {
  return execSync(cmd, {
    stdio: ["ignore", "pipe", "pipe"],
    encoding: "utf8",
    ...opts,
  }).trim();
}

function pkgJson(path) {
  return JSON.parse(readFileSync(join(path, "package.json"), "utf8"));
}

function npmViewVersion(name, registry) {
  try {
    const cmd = registry
      ? `npm view "${name}" versions --registry="${registry}" --json`
      : `npm view "${name}" versions --json`;
    const result = sh(cmd);
    return JSON.parse(result).at(-1);
  } catch {
    // package not found on registry yet
    return null;
  }
}

const registry =
  process.env.npm_config_registry ||
  process.env.NPM_CONFIG_REGISTRY ||
  process.env.NPM_REGISTRY;

// list all workspace packages (depth -1 = only leaf packages)
const out = sh(`pnpm ls -r --depth -1 --json`);
const nodes = JSON.parse(out);

// read each package.json to get accurate fields
const pkgs = nodes.map((n) => {
  const pj = pkgJson(n.path);
  return {
    name: pj.name,
    version: pj.version,
    private: !!pj.private,
  };
});

// determine if any public package has a local version not on the registry
let needsPublish = false;
for (const p of pkgs) {
  if (!p.name || p.private) continue;
  const published = npmViewVersion(p.name, registry);
  if (published === null) {
    needsPublish = true;
    break;
  }
  if (published !== p.version) {
    needsPublish = true;
    break;
  }
}

// expose for GitHub Actions and print for humans
console.log(`needs_publish=${needsPublish}`);
