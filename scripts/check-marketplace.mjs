import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const marketplacePath = resolve(root, ".agents/plugins/marketplace.json");
const marketplace = await readJson(marketplacePath);

assert.match(marketplace.name, /^[A-Za-z0-9_-]+$/, "invalid marketplace name");
assert.ok(Array.isArray(marketplace.plugins), "marketplace.plugins must be an array");

const names = new Set();
for (const entry of marketplace.plugins) {
  assert.match(entry.name, /^[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)*$/, "invalid plugin name");
  assert.ok(!names.has(entry.name), `duplicate plugin entry: ${entry.name}`);
  names.add(entry.name);

  assert.equal(entry.source?.source, "local", `${entry.name}: source must be local`);
  assert.equal(
    entry.source?.path,
    `./plugins/${entry.name}`,
    `${entry.name}: source path must match the plugin name`,
  );
  assert.ok(
    ["NOT_AVAILABLE", "AVAILABLE", "INSTALLED_BY_DEFAULT"].includes(
      entry.policy?.installation,
    ),
    `${entry.name}: invalid installation policy`,
  );
  assert.ok(
    ["ON_INSTALL", "ON_USE"].includes(entry.policy?.authentication),
    `${entry.name}: invalid authentication policy`,
  );
  assert.equal(typeof entry.category, "string", `${entry.name}: category is required`);

  const pluginRoot = resolve(root, entry.source.path);
  const manifest = await readJson(resolve(pluginRoot, ".codex-plugin/plugin.json"));
  assert.equal(manifest.name, entry.name, `${entry.name}: manifest name mismatch`);

  if (manifest.mcpServers) {
    await readJson(resolve(pluginRoot, manifest.mcpServers));
  }
  await readJson(resolve(pluginRoot, "hooks/hooks.json"));
  await access(resolve(pluginRoot, "README.md"));
}

console.log(`Marketplace validation passed: ${marketplace.plugins.length} plugin(s)`);

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}
