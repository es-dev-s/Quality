import { describe, expect, it } from "vitest";
import {
  DEFAULT_REVERT_WINDOW_DAYS,
  getAgentTransferRevertWindowDays,
  isAgentTransferRevertEnabled,
  revertWindowEndsAt,
} from "@/lib/agent-transfer/config";

describe("agent transfer revert flags", () => {
  it("is enabled by default", () => {
    expect(isAgentTransferRevertEnabled({})).toBe(true);
    expect(isAgentTransferRevertEnabled({ AGENT_TRANSFER_REVERT_ENABLED: "" })).toBe(true);
    expect(isAgentTransferRevertEnabled({ AGENT_TRANSFER_REVERT_ENABLED: "true" })).toBe(true);
  });

  it.each(["false", "0", "off", "no", "disabled", " FALSE "])("is disabled by %j", (value) => {
    expect(isAgentTransferRevertEnabled({ AGENT_TRANSFER_REVERT_ENABLED: value })).toBe(false);
  });

  it("parses the revert window with default and cap", () => {
    expect(getAgentTransferRevertWindowDays({})).toBe(DEFAULT_REVERT_WINDOW_DAYS);
    expect(getAgentTransferRevertWindowDays({ AGENT_TRANSFER_REVERT_WINDOW_DAYS: "abc" })).toBe(7);
    expect(getAgentTransferRevertWindowDays({ AGENT_TRANSFER_REVERT_WINDOW_DAYS: "-3" })).toBe(7);
    expect(getAgentTransferRevertWindowDays({ AGENT_TRANSFER_REVERT_WINDOW_DAYS: "14.9" })).toBe(14);
    expect(getAgentTransferRevertWindowDays({ AGENT_TRANSFER_REVERT_WINDOW_DAYS: "365" })).toBe(90);
  });

  it("computes the window end", () => {
    const start = new Date("2026-10-01T00:00:00.000Z");
    expect(revertWindowEndsAt(start, 7).toISOString()).toBe("2026-10-08T00:00:00.000Z");
  });
});
