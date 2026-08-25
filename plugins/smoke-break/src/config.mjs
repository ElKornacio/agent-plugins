import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { DEFAULT_INTERVAL_MS } from "./turn-tracker.mjs";

export const DEFAULT_CONFIG_FILE = join(homedir(), ".smoke-break.env");

export function readTurnConfig({
  env = process.env,
  configFile = resolveConfigFile(env.SMOKE_BREAK_CONFIG_FILE),
  readFile = readFileSync,
} = {}) {
  const warnings = [];
  let fileValues = {};

  try {
    fileValues = parseEnvFile(readFile(configFile, "utf8"));
  } catch (error) {
    if (error?.code !== "ENOENT") {
      warnings.push(`Could not read ${configFile}: ${error.message}`);
    }
  }

  const candidates = [
    [configFile, fileValues.SMOKE_BREAK_INTERVAL_MS],
    ["process environment", env.SMOKE_BREAK_INTERVAL_MS],
  ];

  for (const [source, rawValue] of candidates) {
    if (rawValue === undefined) continue;

    const intervalMs = Number(rawValue);
    if (Number.isSafeInteger(intervalMs) && intervalMs > 0) {
      return { intervalMs, configFile, warnings };
    }
    warnings.push(
      `Ignoring invalid SMOKE_BREAK_INTERVAL_MS=${JSON.stringify(rawValue)} from ${source}`,
    );
  }

  return { intervalMs: DEFAULT_INTERVAL_MS, configFile, warnings };
}

export function parseEnvFile(content) {
  const values = {};

  for (const rawLine of content.split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (line === "" || line.startsWith("#")) continue;

    const match = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/u.exec(line);
    if (!match) continue;

    const [, key, rawValue] = match;
    values[key] = unquote(rawValue.trim());
  }

  return values;
}

function resolveConfigFile(rawPath) {
  if (typeof rawPath !== "string" || rawPath.trim() === "") {
    return DEFAULT_CONFIG_FILE;
  }

  const path = rawPath.trim();
  if (path === "~") return homedir();
  if (path.startsWith("~/") || path.startsWith("~\\")) {
    return join(homedir(), path.slice(2));
  }
  return resolve(path);
}

function unquote(value) {
  if (value.length >= 2) {
    const first = value[0];
    const last = value.at(-1);
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
      return value.slice(1, -1);
    }
  }
  return value;
}
