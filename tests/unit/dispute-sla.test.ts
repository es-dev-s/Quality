import { describe, expect, it } from "vitest";
import {
  agentAcknowledgeDeadline,
  canRaiseDisputeAt,
  disputeWindowDeadline,
  formatDeadlineRemaining,
  getDisputeState,
  isDisputeOpen,
  parseTlRemark,
} from "@/lib/audit/dispute";

const H = 60 * 60 * 1000;
const t0 = new Date("2026-11-20T10:00:00.000Z");
const at = (hours: number) => new Date(t0.getTime() + hours * H);

describe("dispute window", () => {
  it("allows a dispute within 48h of shared feedback", () => {
    expect(canRaiseDisputeAt(t0, at(47.9))).toEqual({ ok: true });
    expect(canRaiseDisputeAt(t0, at(48))).toEqual({ ok: true });
  });

  it("rejects after 48h or when feedback was never shared", () => {
    const late = canRaiseDisputeAt(t0, at(48.1));
    expect(late.ok).toBe(false);
    expect(canRaiseDisputeAt(null, t0).ok).toBe(false);
    expect(canRaiseDisputeAt("not-a-date", t0).ok).toBe(false);
  });

  it("derives 48h deadlines for dispute and agent acknowledgement", () => {
    expect(disputeWindowDeadline(t0)).toEqual(at(48));
    expect(agentAcknowledgeDeadline(t0.toISOString())).toEqual(at(48));
  });
});

describe("getDisputeState", () => {
  const base = {
    disputeStage: null,
    disputeRaisedAt: null,
    disputeTlRemarkAt: null,
    disputeResharedAt: null,
  } as const;

  it("returns null when there is no dispute", () => {
    expect(getDisputeState(base, t0)).toBeNull();
  });

  it("awaiting team lead: 24h from the dispute", () => {
    const timeline = {
      ...base,
      disputeStage: "AWAITING_TL_REMARK" as const,
      disputeRaisedAt: t0,
    };
    const open = getDisputeState(timeline, at(23))!;
    expect(open.label).toBe("Disputed – Awaiting Supervisor Remark");
    expect(open.waitingOn).toBe("team_lead");
    expect(open.deadlineAt).toEqual(at(24));
    expect(open.overdue).toBe(false);
    expect(getDisputeState(timeline, at(25))!.overdue).toBe(true);
  });

  it("awaiting QM: 24h from the team-lead remark", () => {
    const timeline = {
      ...base,
      disputeStage: "AWAITING_QM_REVIEW" as const,
      disputeRaisedAt: t0,
      disputeTlRemarkAt: at(10),
    };
    const state = getDisputeState(timeline, at(20))!;
    expect(state.waitingOn).toBe("quality_manager");
    expect(state.deadlineAt).toEqual(at(34));
    expect(state.overdue).toBe(false);
    expect(getDisputeState(timeline, at(35))!.overdue).toBe(true);
  });

  it("final ack: 24h from reshare; expiry flags escalation", () => {
    const timeline = {
      ...base,
      disputeStage: "AWAITING_FINAL_ACK" as const,
      disputeResharedAt: at(30),
    };
    expect(getDisputeState(timeline, at(50))!.escalationExpired).toBe(false);
    const expired = getDisputeState(timeline, at(55))!;
    expect(expired.overdue).toBe(true);
    expect(expired.escalationExpired).toBe(true);
  });

  it("a closed dispute is never overdue", () => {
    const state = getDisputeState(
      { ...base, disputeStage: "CLOSED", disputeRaisedAt: t0 },
      at(999)
    )!;
    expect(state.overdue).toBe(false);
    expect(state.waitingOn).toBeNull();
    expect(isDisputeOpen("CLOSED")).toBe(false);
    expect(isDisputeOpen("AWAITING_QM_REVIEW")).toBe(true);
    expect(isDisputeOpen(null)).toBe(false);
  });
});

describe("formatting and parsing", () => {
  it("formats remaining and overdue time", () => {
    expect(formatDeadlineRemaining(at(24), at(20.5))).toBe("3h 30m left");
    expect(formatDeadlineRemaining(at(24), at(26))).toBe("Overdue by 2h 0m");
    expect(formatDeadlineRemaining(null)).toBe("");
  });

  it("parses only well-formed team-lead remarks", () => {
    const ok = { assessment: "PARTIAL", findings: "f", recommendation: "r" };
    expect(parseTlRemark(ok)).toEqual(ok);
    expect(parseTlRemark({ ...ok, assessment: "MAYBE" })).toBeNull();
    expect(parseTlRemark({ assessment: "AGREE" })).toBeNull();
    expect(parseTlRemark(null)).toBeNull();
  });
});
