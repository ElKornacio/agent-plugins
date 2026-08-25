import assert from "node:assert/strict";
import test from "node:test";
import { TurnTracker } from "../src/turn-tracker.mjs";

function setup(intervalMs = 300_000) {
  let clock = 0;
  const tracker = new TurnTracker({ intervalMs, now: () => clock });
  return {
    tracker,
    advance(ms) {
      clock += ms;
    },
  };
}

test("reminds once in every elapsed interval bucket", () => {
  const { tracker, advance } = setup();
  tracker.handle({ event: "turn_start", sessionId: "s1", turnId: "t1" });

  advance(299_999);
  assert.deepEqual(
    tracker.handle({ event: "tool_end", sessionId: "s1", turnId: "t1" }),
    {},
  );

  advance(1);
  const first = tracker.handle({ event: "tool_end", sessionId: "s1", turnId: "t1" });
  assert.equal(first.hookSpecificOutput.hookEventName, "PostToolUse");
  assert.match(first.hookSpecificOutput.additionalContext, /about 5 minutes/);
  assert.match(first.hookSpecificOutput.additionalContext, /only a gentle checkpoint/i);
  assert.match(first.hookSpecificOutput.additionalContext, /simply continue/i);

  assert.deepEqual(
    tracker.handle({ event: "tool_end", sessionId: "s1", turnId: "t1" }),
    {},
  );

  advance(300_000);
  const second = tracker.handle({ event: "tool_end", sessionId: "s1", turnId: "t1" });
  assert.match(second.hookSpecificOutput.additionalContext, /about 10 minutes/);
});

test("a new turn resets the elapsed timer", () => {
  const { tracker, advance } = setup();
  tracker.handle({ event: "turn_start", sessionId: "s1", turnId: "t1" });
  advance(300_000);
  tracker.handle({ event: "turn_start", sessionId: "s1", turnId: "t2" });

  assert.deepEqual(
    tracker.handle({ event: "tool_end", sessionId: "s1", turnId: "t2" }),
    {},
  );
});

test("a duplicate start for the same turn does not reset the timer", () => {
  const { tracker, advance } = setup();
  tracker.handle({ event: "turn_start", sessionId: "s1", turnId: "t1" });
  advance(200_000);
  tracker.handle({ event: "turn_start", sessionId: "s1", turnId: "t1" });
  advance(100_000);

  const output = tracker.handle({ event: "tool_end", sessionId: "s1", turnId: "t1" });
  assert.match(output.hookSpecificOutput.additionalContext, /about 5 minutes/);
});

test("tool events for an unknown or stale turn are ignored", () => {
  const { tracker, advance } = setup();
  tracker.handle({ event: "turn_start", sessionId: "s1", turnId: "current" });
  advance(300_000);

  assert.deepEqual(
    tracker.handle({ event: "tool_end", sessionId: "missing", turnId: "current" }),
    {},
  );
  assert.deepEqual(
    tracker.handle({ event: "tool_end", sessionId: "s1", turnId: "stale" }),
    {},
  );
});

test("each turn keeps the interval selected when it started", () => {
  const { tracker, advance } = setup();
  tracker.handle({
    event: "turn_start",
    sessionId: "s1",
    turnId: "t1",
    intervalMs: 60_000,
  });
  advance(60_000);

  const output = tracker.handle({ event: "tool_end", sessionId: "s1", turnId: "t1" });
  assert.match(output.hookSpecificOutput.additionalContext, /about 1 minute\./);
});
