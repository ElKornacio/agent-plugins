import { createInterface } from "node:readline";
import { readTurnConfig } from "./config.mjs";
import { TurnTracker } from "./turn-tracker.mjs";

const SERVER_INFO = Object.freeze({ name: "smoke-break", version: "0.1.0" });
const TOOL = Object.freeze({
  name: "on_event",
  title: "Smoke Break lifecycle event",
  description: "Internal Codex hook endpoint for tracking a turn and checking its elapsed time.",
  inputSchema: {
    type: "object",
    properties: {
      event: { type: "string", enum: ["turn_start", "tool_end"] },
      sessionId: { type: "string", minLength: 1 },
      turnId: { type: "string", minLength: 1 },
    },
    required: ["event", "sessionId", "turnId"],
    additionalProperties: false,
  },
  outputSchema: {
    type: "object",
    properties: {
      hookSpecificOutput: {
        type: "object",
        properties: {
          hookEventName: { type: "string" },
          additionalContext: { type: "string" },
        },
        required: ["hookEventName", "additionalContext"],
        additionalProperties: false,
      },
    },
    additionalProperties: false,
  },
});

const tracker = new TurnTracker();
const input = createInterface({ input: process.stdin, crlfDelay: Infinity });

input.on("line", (line) => {
  if (line.trim() === "") return;

  let message;
  try {
    message = JSON.parse(line);
  } catch {
    sendError(null, -32700, "Parse error");
    return;
  }

  void handleMessage(message);
});

async function handleMessage(message) {
  if (!isObject(message) || message.jsonrpc !== "2.0" || typeof message.method !== "string") {
    if (isObject(message) && Object.hasOwn(message, "id")) {
      sendError(message.id, -32600, "Invalid Request");
    }
    return;
  }

  if (!Object.hasOwn(message, "id")) {
    return;
  }

  try {
    const result = dispatch(message.method, message.params);
    send({ jsonrpc: "2.0", id: message.id, result });
  } catch (error) {
    if (error instanceof MethodNotFoundError) {
      sendError(message.id, -32601, error.message);
      return;
    }
    if (error instanceof TypeError) {
      sendError(message.id, -32602, error.message);
      return;
    }

    console.error(error);
    sendError(message.id, -32603, "Internal error");
  }
}

function dispatch(method, params) {
  switch (method) {
    case "initialize": {
      const protocolVersion =
        isObject(params) && typeof params.protocolVersion === "string"
          ? params.protocolVersion
          : "2025-06-18";
      return {
        protocolVersion,
        capabilities: { tools: { listChanged: false } },
        serverInfo: SERVER_INFO,
      };
    }
    case "ping":
      return {};
    case "tools/list":
      return { tools: [TOOL] };
    case "tools/call":
      return callTool(params);
    default:
      throw new MethodNotFoundError(`Method not found: ${method}`);
  }
}

function callTool(params) {
  if (!isObject(params) || params.name !== TOOL.name || !isObject(params.arguments)) {
    throw new TypeError("Expected tools/call for on_event with an arguments object");
  }

  const event = { ...params.arguments };
  if (event.event === "turn_start") {
    const config = readTurnConfig();
    event.intervalMs = config.intervalMs;
    for (const warning of config.warnings) console.error(`Smoke Break: ${warning}`);
  }

  const output = tracker.handle(event);
  return {
    content: [{ type: "text", text: JSON.stringify(output) }],
    structuredContent: output,
  };
}

function sendError(id, code, message) {
  send({ jsonrpc: "2.0", id, error: { code, message } });
}

function send(message) {
  process.stdout.write(`${JSON.stringify(message)}\n`);
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

class MethodNotFoundError extends Error {}
