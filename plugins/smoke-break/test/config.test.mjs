import assert from "node:assert/strict";
import test from "node:test";
import { parseEnvFile, readTurnConfig } from "../src/config.mjs";

test("the home config file overrides the MCP process environment", () => {
  const config = readTurnConfig({
    env: { SMOKE_BREAK_INTERVAL_MS: "300000" },
    configFile: "/home/test/.smoke-break.env",
    readFile: () => "SMOKE_BREAK_INTERVAL_MS=60000\n",
  });

  assert.equal(config.intervalMs, 60_000);
  assert.deepEqual(config.warnings, []);
});

test("a missing config file falls back to the MCP process environment", () => {
  const missing = new Error("missing");
  missing.code = "ENOENT";

  const config = readTurnConfig({
    env: { SMOKE_BREAK_INTERVAL_MS: "120000" },
    configFile: "/home/test/.smoke-break.env",
    readFile: () => {
      throw missing;
    },
  });

  assert.equal(config.intervalMs, 120_000);
  assert.deepEqual(config.warnings, []);
});

test("an invalid file value falls back and reports a warning", () => {
  const config = readTurnConfig({
    env: { SMOKE_BREAK_INTERVAL_MS: "300000" },
    configFile: "/home/test/.smoke-break.env",
    readFile: () => "SMOKE_BREAK_INTERVAL_MS=soon\n",
  });

  assert.equal(config.intervalMs, 300_000);
  assert.equal(config.warnings.length, 1);
});

test("the env parser supports comments, export, and quoted values", () => {
  assert.deepEqual(
    parseEnvFile('# comment\nexport SMOKE_BREAK_INTERVAL_MS="45000"\nIGNORED=yes\n'),
    { SMOKE_BREAK_INTERVAL_MS: "45000", IGNORED: "yes" },
  );
});
