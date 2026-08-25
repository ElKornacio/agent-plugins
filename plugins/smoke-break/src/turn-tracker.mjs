export const DEFAULT_INTERVAL_MS = 5 * 60 * 1000;
export const DEFAULT_MAX_SESSIONS = 1024;

export class TurnTracker {
  constructor({
    intervalMs = DEFAULT_INTERVAL_MS,
    maxSessions = DEFAULT_MAX_SESSIONS,
    now = Date.now,
  } = {}) {
    if (!Number.isSafeInteger(intervalMs) || intervalMs <= 0) {
      throw new TypeError("intervalMs must be a positive integer");
    }
    if (!Number.isSafeInteger(maxSessions) || maxSessions <= 0) {
      throw new TypeError("maxSessions must be a positive integer");
    }

    this.intervalMs = intervalMs;
    this.maxSessions = maxSessions;
    this.now = now;
    this.turns = new Map();
  }

  handle({ event, sessionId, turnId } = {}) {
    if (event !== "turn_start" && event !== "tool_end") {
      throw new TypeError("event must be turn_start or tool_end");
    }
    if (typeof sessionId !== "string" || sessionId.length === 0) {
      throw new TypeError("sessionId must be a non-empty string");
    }
    if (typeof turnId !== "string" || turnId.length === 0) {
      throw new TypeError("turnId must be a non-empty string");
    }

    return event === "turn_start"
      ? this.#startTurn(sessionId, turnId)
      : this.#finishTool(sessionId, turnId);
  }

  #startTurn(sessionId, turnId) {
    const existing = this.turns.get(sessionId);
    if (existing?.turnId === turnId) {
      return {};
    }

    if (!existing && this.turns.size >= this.maxSessions) {
      const oldestSessionId = this.turns.keys().next().value;
      this.turns.delete(oldestSessionId);
    }

    this.turns.delete(sessionId);
    this.turns.set(sessionId, {
      turnId,
      startedAt: this.now(),
      notifiedBucket: 0,
    });

    return {};
  }

  #finishTool(sessionId, turnId) {
    const state = this.turns.get(sessionId);
    if (!state || state.turnId !== turnId) {
      return {};
    }

    const elapsedMs = Math.max(0, this.now() - state.startedAt);
    const bucket = Math.floor(elapsedMs / this.intervalMs);
    if (bucket === 0 || bucket <= state.notifiedBucket) {
      return {};
    }

    state.notifiedBucket = bucket;
    const elapsedMinutes = Math.max(
      1,
      Math.round((bucket * this.intervalMs) / 60_000),
    );

    return {
      hookSpecificOutput: {
        hookEventName: "PostToolUse",
        additionalContext:
          `Smoke break: this turn has been running for about ${elapsedMinutes} minutes. ` +
          "Step back briefly: verify the goal, assess concrete progress, notice repeated actions or blockers, " +
          "and decide whether to change approach or ask the user.",
      },
    };
  }
}
