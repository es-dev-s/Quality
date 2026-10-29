import { describe, expect, it } from "vitest";
import {
  callDurationSecondsForType,
  formatCallDuration,
  formatCallDurationForType,
  normalizeCallDurationInput,
  parseCallDuration,
  parseImportedCallDuration,
  sanitizeCallDurationInput,
} from "@/lib/audit/call-duration";
import { auditFormDataSchema } from "@/lib/validation/audit";

describe("call duration", () => {
  it("parses mm:ss and hh:mm:ss", () => {
    expect(parseCallDuration("4:35")).toBe(275);
    expect(parseCallDuration("04:35")).toBe(275);
    expect(parseCallDuration("75:20")).toBe(4520);
    expect(parseCallDuration("1:15:20")).toBe(4520);
    expect(parseCallDuration(" 00:00:09 ")).toBe(9);
  });

  it("rejects empty, malformed, zero and out-of-range values", () => {
    for (const bad of ["", "  ", "abc", "435", "4:60", "1:60:00", "00:00", "25:00:01", "1::2"]) {
      expect(parseCallDuration(bad)).toBeNull();
    }
    expect(parseCallDuration("24:00:00")).toBe(86400);
  });

  it("formats seconds", () => {
    expect(formatCallDuration(275)).toBe("04:35");
    expect(formatCallDuration(4520)).toBe("01:15:20");
    expect(formatCallDuration(null)).toBe("");
    expect(formatCallDuration(0)).toBe("");
  });

  it("normalizes and sanitizes input", () => {
    expect(normalizeCallDurationInput("4:5")).toBe("04:05");
    expect(normalizeCallDurationInput("75:20")).toBe("01:15:20");
    expect(normalizeCallDurationInput("bad")).toBe("bad");
    expect(sanitizeCallDurationInput("04m:35s")).toBe("04:35");
  });

  it("import parser also accepts bare seconds", () => {
    expect(parseImportedCallDuration("332")).toBe(332);
    expect(parseImportedCallDuration("05:32")).toBe(332);
    expect(parseImportedCallDuration("n/a")).toBeNull();
  });

  const base = {
    agent: "a", supervisor: "s", auditor: "q", type: "Call", auditType: "",
    businessType: "Sales", callDate: "2026-10-29", auditDate: "2026-10-29",
    lob: "l", sublob: "", mobile: "9800000000", referenceUrl: "", reason: "",
    subReason: "", response: "r", feedbackSecurity: "Low",
    feedbackStatus: "Pending", feedbackDate: "", agentFeedback: "ok",
  };

  it("is required by the audit form schema for Call audits", () => {
    expect(auditFormDataSchema.safeParse({ ...base, callDuration: "" }).success).toBe(false);
    expect(auditFormDataSchema.safeParse({ ...base, callDuration: "9:99" }).success).toBe(false);
    expect(auditFormDataSchema.safeParse({ ...base }).success).toBe(false);
    expect(auditFormDataSchema.safeParse({ ...base, callDuration: "04:35" }).success).toBe(true);
  });

  it("is not required (and not stored/shown) for Chat audits", () => {
    const chat = { ...base, type: "Chat", mobile: "guest" };
    expect(auditFormDataSchema.safeParse(chat).success).toBe(true);
    expect(auditFormDataSchema.safeParse({ ...chat, callDuration: "" }).success).toBe(true);
    expect(callDurationSecondsForType("Chat", "04:35")).toBeNull();
    expect(callDurationSecondsForType("Call", "04:35")).toBe(275);
    expect(formatCallDurationForType("Chat", 275)).toBe("");
    expect(formatCallDurationForType("Call", 275)).toBe("04:35");
  });
});
