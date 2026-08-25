import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import test from "node:test";

test("serves lifecycle events over MCP stdio", async (t) => {
  const child = spawn(process.execPath, ["src/server.mjs"], {
    cwd: new URL("..", import.meta.url),
    env: { ...process.env, SMOKE_BREAK_INTERVAL_MS: "100" },
    stdio: ["pipe", "pipe", "pipe"],
  });
  const client = createClient(child);

  t.after(() => {
    child.stdin.end();
    child.kill();
  });

  const initialized = await client.request("initialize", {
    protocolVersion: "2025-06-18",
    capabilities: {},
    clientInfo: { name: "test", version: "1.0.0" },
  });
  assert.equal(initialized.serverInfo.name, "smoke-break");

  const listed = await client.request("tools/list", {});
  assert.deepEqual(listed.tools.map((tool) => tool.name), ["on_event"]);

  await client.request("tools/call", {
    name: "on_event",
    arguments: { event: "turn_start", sessionId: "s1", turnId: "t1" },
  });

  const early = await client.request("tools/call", {
    name: "on_event",
    arguments: { event: "tool_end", sessionId: "s1", turnId: "t1" },
  });
  assert.deepEqual(early.structuredContent, {});

  await new Promise((resolve) => setTimeout(resolve, 120));
  const reminder = await client.request("tools/call", {
    name: "on_event",
    arguments: { event: "tool_end", sessionId: "s1", turnId: "t1" },
  });
  assert.equal(reminder.structuredContent.hookSpecificOutput.hookEventName, "PostToolUse");
  assert.match(reminder.structuredContent.hookSpecificOutput.additionalContext, /Smoke break/);

  const duplicate = await client.request("tools/call", {
    name: "on_event",
    arguments: { event: "tool_end", sessionId: "s1", turnId: "t1" },
  });
  assert.deepEqual(duplicate.structuredContent, {});
});

function createClient(child) {
  let nextId = 1;
  const pending = new Map();
  const lines = createInterface({ input: child.stdout, crlfDelay: Infinity });

  lines.on("line", (line) => {
    const message = JSON.parse(line);
    const waiter = pending.get(message.id);
    if (!waiter) return;
    pending.delete(message.id);
    if (message.error) waiter.reject(new Error(message.error.message));
    else waiter.resolve(message.result);
  });

  child.once("exit", (code, signal) => {
    const error = new Error(`MCP server exited unexpectedly (${code ?? signal})`);
    for (const waiter of pending.values()) waiter.reject(error);
    pending.clear();
  });

  return {
    request(method, params) {
      const id = nextId++;
      const promise = new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
      });
      child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`);
      return promise;
    },
  };
}
