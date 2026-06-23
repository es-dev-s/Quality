"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/primitives/button";
import { Field, Input, Label, Select } from "@/components/primitives/field";
import { useToast } from "@/components/primitives/toast";
import { saveAuditSubmission, updateAuditSubmission } from "@/lib/actions/audit";
import { calculateResults } from "@/lib/audit/calculate-results";
import { getScoringOptions } from "@/lib/audit/scoring-options";
import {
  buildDefaultScores,
  getEffectiveScore,
  mergeTemplateDefaultScores,
} from "@/lib/audit/score-state";
import {
  getSubReasonsForReason,
} from "@/lib/audit/interaction-options";
import { getScoreTone, toneClass } from "@/lib/audit/score-visual";
import type { AuditReferenceOption } from "@/lib/actions/audit";
import type { TemplateListItem } from "@/lib/actions/templates";
import type {
  AuditFormData,
  BusinessType,
  InteractionConfig,
  InteractionType,
  ScoresMap,
} from "@/lib/audit/types";
import { cn } from "@/lib/utils";
import { MessageSquare, Phone } from "lucide-react";
import {
  FEEDBACK_SECURITY_OPTIONS,
  FEEDBACK_SEVERITY_LABEL,
  FEEDBACK_STATUS_OPTIONS,
  defaultAuditFeedback,
} from "@/lib/audit/feedback";
import type { FeedbackSecurity, FeedbackStatus } from "@/lib/audit/feedback";
import { AuditScorePanel } from "@/components/forms/audit-score-panel";
import { QmsEmpty } from "@/components/analytics/qms-primitives";
import { ReferenceUrlField } from "@/components/forms/reference-url-field";
import { resolveAuditorNameForSession } from "@/lib/audit/auditor-name";
import { normalizeFatalYnScoreValue } from "@/lib/audit/fatal-yn-params";
import { normalizeProbingPreferredModeScoreValue } from "@/lib/audit/probing-preferred-mode-swap";
import { createRandomUUID } from "@/lib/random-id";
import {
  getCallInteractionDefaultWarnings,
  validateChatInteractionDetails,
} from "@/lib/audit/interaction-form-validation";
import {
  AUDIT_FORM_NOTICE,
  AUDIT_FORM_TOAST,
} from "@/lib/audit/form-validation-messages";
import { validateScoringSectionsComplete } from "@/lib/audit/scoring-form-validation";

const INTERACTION_FIELD_IDS: Partial<Record<keyof AuditFormData, string>> = {
  supervisor: "supervisor",
  agent: "agent",
  auditor: "auditor",
  callDate: "callDate",
  businessType: "businessType",
  lob: "lob",
  sublob: "sublob",
  reason: "reason",
  mobile: "mobile",
  referenceUrl: "referenceUrl",
  response: "response",
};

function templateInteractionType(templateId: string): InteractionType | null {
  if (templateId === "chat") return "Chat";
  if (templateId === "call" || templateId === "default") return "Call";
  return null;
}

function resolveInteractionType(
  templateId: string,
  templates: TemplateListItem[],
  fallback: InteractionType
): InteractionType {
  const fromBuiltin = templateInteractionType(templateId);
  if (fromBuiltin) return fromBuiltin;

  const row = templates.find((template) => template.id === templateId);
  if (row?.type === "Chat" || row?.type === "Call") {
    return row.type;
  }

  return fallback;
}

function templateIdForType(
  type: InteractionType,
  templates: TemplateListItem[]
): string {
  const preferred = type === "Chat" ? "chat" : "call";
  if (templates.some((template) => template.id === preferred)) {
    return preferred;
  }

  const byType = templates.find((template) => template.type === type);
  if (byType) return byType.id;

  return templates[0]?.id ?? preferred;
}

function todayISO() {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function createInitialFormData(): AuditFormData {
  return {
    agent: "",
    supervisor: "",
    auditor: "",
    type: "Call",
    businessType: "",
    callDate: todayISO(),
    auditDate: todayISO(),
    lob: "",
    sublob: "",
    mobile: "",
    referenceUrl: "",
    reason: "",
    subReason: "",
    response: "",
    ...defaultAuditFeedback(),
    agentFeedback: "",
  };
}

type AuditFormProps = {
  auditors: string[];
  /** Logged-in user display name — pre-fills Quality Analyst on new audits. */
  currentAuditorName?: string;
  interactionConfig: InteractionConfig;
  templates: TemplateListItem[];
  auditReferenceOptions?: AuditReferenceOption[];
  initialTemplateId: string;
  initialType?: InteractionType;
  editAuditId?: string;
  editAuditCode?: string;
  initialFormData?: AuditFormData;
  initialScores?: ScoresMap;
  successRedirect?: string;
  cancelHref?: string;
  /** Supervisor name → agents linked via provisioning and audit history. */
  supervisorAgentMap?: Record<string, string[]>;
};

function scoringMaxForTemplate(template: TemplateListItem): number {
  return template.sections
    .filter((section) => !section.isFatal)
    .flatMap((section) => section.params)
    .filter((param) => param.scoring !== "Y/N-CMM")
    .reduce((sum, param) => sum + param.max, 0);
}

export function AuditForm({
  auditors,
  currentAuditorName = "",
  interactionConfig,
  templates,
  auditReferenceOptions = [],
  initialTemplateId,
  initialType = "Call",
  editAuditId,
  editAuditCode,
  initialFormData,
  initialScores,
  successRedirect = "/audit-logs",
  cancelHref,
  supervisorAgentMap = {},
}: AuditFormProps) {
  const isEditMode = Boolean(editAuditId);
  const router = useRouter();
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();
  const submissionKeyRef = useRef<string | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState(initialTemplateId);
  const [formData, setFormData] = useState<AuditFormData>(() => {
    if (initialFormData) {
      return initialFormData;
    }
    const auditor = currentAuditorName
      ? resolveAuditorNameForSession(currentAuditorName, auditors)
      : "";
    return {
      ...createInitialFormData(),
      type: resolveInteractionType(initialTemplateId, templates, initialType),
      auditor,
    };
  });

  const [scores, setScores] = useState<ScoresMap>(() => {
    const template =
      templates.find((t) => t.id === initialTemplateId) ?? templates[0];
    if (!template) {
      return initialScores ?? {};
    }
    if (initialScores) {
      return mergeTemplateDefaultScores(template, initialScores);
    }
    return buildDefaultScores(template);
  });
  const [highlightedFieldIds, setHighlightedFieldIds] = useState<string[]>([]);
  const [highlightedScoreParamIds, setHighlightedScoreParamIds] = useState<
    string[]
  >([]);
  const [interactionNotice, setInteractionNotice] = useState<string | null>(
    null
  );

  useEffect(() => {
    if (!isEditMode && !submissionKeyRef.current) {
      submissionKeyRef.current = createRandomUUID();
    }
  }, [isEditMode]);

  useEffect(() => {
    if (isEditMode) return;
    const today = todayISO();
    setFormData((prev) =>
      prev.auditDate === today ? prev : { ...prev, auditDate: today }
    );
  }, [isEditMode]);
  const config = interactionConfig;

  const activeTemplate = useMemo(() => {
    return (
      templates.find((template) => template.id === selectedTemplateId) ??
      templates[0]
    );
  }, [templates, selectedTemplateId]);

  const templateMaxScore = useMemo(
    () => (activeTemplate ? scoringMaxForTemplate(activeTemplate) : 0),
    [activeTemplate]
  );

  const previewRecordContext = useMemo(
    () => ({
      id: editAuditCode ?? "AUD-PREVIEW",
      feedbackSecurity: formData.feedbackSecurity,
      feedbackStatus: formData.feedbackStatus,
      feedbackDate: formData.feedbackDate,
    }),
    [
      editAuditCode,
      formData.feedbackSecurity,
      formData.feedbackStatus,
      formData.feedbackDate,
    ]
  );

  const isCallInteraction = formData.type === "Call";
  const isChatInteraction = formData.type === "Chat";
  const feedbackDateRequired = formData.feedbackStatus !== "Pending";

  const selectableLOBs = useMemo(
    () =>
      config.lobs.filter(
        (lob) => (lob.businessType || "Sales") === formData.businessType
      ),
    [config.lobs, formData.businessType]
  );

  const matchedLOB = useMemo(
    () =>
      config.lobs.find(
        (l) =>
          l.name === formData.lob && l.businessType === formData.businessType
      ),
    [config.lobs, formData.lob, formData.businessType]
  );

  const subLOBs = matchedLOB?.sublobs ?? [];
  const businessTypes = useMemo(
    () =>
      config.businessTypes.length > 0 ? config.businessTypes : ["Sales", "Support"],
    [config.businessTypes]
  );

  const agentOptions = useMemo(() => {
    const supervisor = formData.supervisor.trim();
    if (!supervisor) {
      return formData.agent.trim() ? [formData.agent.trim()] : [];
    }
    const linked = supervisorAgentMap[supervisor] ?? [];
    const names = new Set(linked);
    if (formData.agent.trim()) {
      names.add(formData.agent.trim());
    }
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [supervisorAgentMap, formData.supervisor, formData.agent]);

  const supervisorOptions = useMemo(() => {
    const names = new Set(config.supervisors);
    if (formData.supervisor.trim()) {
      names.add(formData.supervisor.trim());
    }
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [config.supervisors, formData.supervisor]);

  const auditorOptions = useMemo(() => {
    const names = new Set(auditors);
    if (formData.auditor.trim()) {
      names.add(formData.auditor.trim());
    }
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [auditors, formData.auditor]);

  useEffect(() => {
    if (businessTypes.length === 0) return;
    if (!formData.businessType.trim()) return;
    if (!businessTypes.includes(formData.businessType)) {
      setFormData((prev) => ({
        ...prev,
        businessType: "",
        lob: "",
        sublob: "",
        reason: "",
      }));
    }
  }, [businessTypes, formData.businessType]);

  const reasons = useMemo(
    () => getSubReasonsForReason(matchedLOB, formData.sublob),
    [matchedLOB, formData.sublob]
  );

  const fieldAttentionClass = useCallback(
    (fieldId: string, baseClassName = "audit-field") =>
      cn(
        baseClassName,
        highlightedFieldIds.includes(fieldId) && "audit-field--attention"
      ),
    [highlightedFieldIds]
  );

  const updateForm = useCallback((patch: Partial<AuditFormData>) => {
    setFormData((prev) => ({ ...prev, ...patch }));
    const touchedFieldIds = Object.keys(patch)
      .map((key) => INTERACTION_FIELD_IDS[key as keyof AuditFormData])
      .filter((fieldId): fieldId is string => Boolean(fieldId));
    if (touchedFieldIds.length > 0) {
      setHighlightedFieldIds((ids) =>
        ids.filter((id) => !touchedFieldIds.includes(id))
      );
    }
  }, []);

  const handleBusinessType = (businessType: BusinessType) => {
    updateForm({ businessType, lob: "", sublob: "", reason: "" });
  };

  const handleSupervisorChange = (supervisor: string) => {
    const linked = supervisorAgentMap[supervisor] ?? [];
    const currentAgent = formData.agent.trim();
    const agentStillValid = !currentAgent || linked.includes(currentAgent);
    updateForm({
      supervisor,
      agent: agentStillValid ? formData.agent : "",
    });
  };

  const handleLOB = (lob: string) => {
    updateForm({ lob, sublob: "", reason: "" });
  };

  const handleSubLOB = (sublob: string) => {
    updateForm({ sublob, reason: "" });
  };

  const handleReason = (reason: string) => {
    updateForm({ reason });
  };

  const handleFeedbackStatus = (feedbackStatus: FeedbackStatus) => {
    if (feedbackStatus === "Pending") {
      updateForm({ feedbackStatus, feedbackDate: "" });
      return;
    }

    updateForm({
      feedbackStatus,
      feedbackDate: formData.feedbackDate || todayISO(),
    });
  };

  const handleScore = (paramId: string, value: string) => {
    setScores((prev) => ({ ...prev, [paramId]: value }));
    setHighlightedScoreParamIds((ids) => ids.filter((id) => id !== paramId));
  };

  const handleResetScores = () => {
    setScores(buildDefaultScores(activeTemplate));
    setHighlightedScoreParamIds([]);
  };

  const handleInteractionType = (type: InteractionType) => {
    if (type === formData.type || isEditMode) return;
    const nextTemplateId = templateIdForType(type, templates);
    const nextTemplate =
      templates.find((template) => template.id === nextTemplateId) ??
      templates[0];
    setScores(nextTemplate ? buildDefaultScores(nextTemplate) : {});
    updateForm({ type });
    setSelectedTemplateId(templateIdForType(type, templates));
    setHighlightedFieldIds([]);
    setHighlightedScoreParamIds([]);
    setInteractionNotice(null);
  };

  const handleCalculate = () => {
    const calc = calculateResults(
      formData,
      scores,
      activeTemplate,
      previewRecordContext
    );
    if (!calc.ok) {
      toast(calc.error, "error");
      return;
    }
    const { record } = calc;
    const label =
      record.totalMax === 0 && !record.hasFatal
        ? "Rate scoring parameters to compute quality %"
        : `${record.finalPct}% — ${record.grade}`;
    toast(`Score calculated: ${label}`);
  };

  const handleSave = () => {
    startTransition(async () => {
      try {
        const submitFormData = isEditMode
          ? formData
          : { ...formData, auditDate: todayISO() };

        if (isChatInteraction) {
          const chatValidation = validateChatInteractionDetails(
            submitFormData,
            reasons.length
          );
          if (!chatValidation.ok) {
            setHighlightedFieldIds(chatValidation.fieldIds);
            setHighlightedScoreParamIds([]);
            setInteractionNotice(AUDIT_FORM_NOTICE.requiredFields);
            toast(AUDIT_FORM_TOAST.requiredFields, "error");
            return;
          }
        }

        const scoringValidation = validateScoringSectionsComplete(
          activeTemplate,
          scores
        );
        if (!scoringValidation.ok) {
          setHighlightedFieldIds([]);
          setHighlightedScoreParamIds(scoringValidation.paramIds);
          setInteractionNotice(null);
          toast(AUDIT_FORM_TOAST.scoreAllParameters, "error");
          requestAnimationFrame(() => {
            document
              .getElementById(`score-param-${scoringValidation.paramIds[0]}`)
              ?.scrollIntoView({ behavior: "smooth", block: "center" });
          });
          return;
        }

        setInteractionNotice(null);
        setHighlightedFieldIds([]);
        setHighlightedScoreParamIds([]);

        if (isCallInteraction) {
          const callWarnings = getCallInteractionDefaultWarnings(
            submitFormData,
            reasons.length
          );
          if (callWarnings.fieldIds.length > 0) {
            setHighlightedFieldIds(callWarnings.fieldIds);
            setInteractionNotice(AUDIT_FORM_NOTICE.callOptional);
            toast(AUDIT_FORM_TOAST.reviewHighlights, "warning");
          }
        }

        const calc = calculateResults(
          submitFormData,
          scores,
          activeTemplate,
          previewRecordContext
        );
        if (!calc.ok) {
          toast(calc.error, "error");
          return;
        }

        const res = isEditMode
          ? await updateAuditSubmission(
              editAuditId!,
              submitFormData,
              scores,
              activeTemplate.id
            )
          : await saveAuditSubmission(submitFormData, scores, activeTemplate.id, {
              submissionKey: submissionKeyRef.current ?? undefined,
            });

        if ("error" in res && res.error) {
          toast(res.error, "error");
          return;
        }

        toast(
          isEditMode ? "Audit updated successfully" : "Audit saved successfully"
        );
        router.push(successRedirect);
      } catch {
        toast(
          "Could not save the audit. Sign out and sign in again, then retry.",
          "error"
        );
      }
    });
  };

  const scoringParamCount = useMemo(
    () =>
      activeTemplate.sections
        .filter((s) => !s.isFatal)
        .reduce(
          (n, s) => n + s.params.filter((p) => p.scoring !== "Y/N-CMM").length,
          0
        ),
    [activeTemplate.sections]
  );

  const ratedScoringCount = useMemo(() => {
    let count = 0;
    for (const sec of activeTemplate.sections) {
      if (sec.isFatal) continue;
      for (const param of sec.params) {
        if (param.scoring === "Y/N-CMM") continue;
        const val = getEffectiveScore(scores, param.id, false, param.scoring);
        if (val !== "NA") count++;
      }
    }
    return count;
  }, [scores, activeTemplate.sections]);

  const liveResult = useMemo(() => {
    if (!activeTemplate) return null;
    const calc = calculateResults(
      formData,
      scores,
      activeTemplate,
      previewRecordContext
    );
    return calc.ok ? calc.record : null;
  }, [formData, scores, activeTemplate, previewRecordContext]);

  if (!activeTemplate) {
    return (
      <QmsEmpty message="No audit template is available. Ask an admin to assign template access, or refresh the page." />
    );
  }

  return (
    <div className="audit-form-page audit-form-page--fixed-aside">
      <div className="audit-form-page__chrome">
        <div className="audit-form-page__inner">
      <header className="audit-form__toolbar audit-form__toolbar--compact">
        <div className="audit-form__toolbar-left">
          <h2 className="audit-form__toolbar-title">
            {isEditMode ? `Edit audit · ${editAuditCode}` : "Quality audit"}
          </h2>
          <p className="audit-form__toolbar-hint">
            {formData.type} · {activeTemplate.name}
            {templateMaxScore > 0 ? ` · ${templateMaxScore} pts` : ""}
          </p>
        </div>
        <div className="audit-form__toolbar-actions">
          {cancelHref ? (
            <Link href={cancelHref} className="ui-btn ui-btn--ghost ui-btn--sm">
              Cancel
            </Link>
          ) : null}
          <Button variant="ghost" size="sm" onClick={handleResetScores}>
            Reset
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleCalculate}
          >
            Calculate Score
          </Button>
          <Button
            size="sm"
            loading={pending}
            onClick={handleSave}
          >
            {isEditMode ? "Save changes" : "Save to History"}
          </Button>
        </div>
      </header>
        </div>
      </div>

      <div className="audit-form-page__workspace">
        <div className="audit-form-scroll">
          <div className="audit-form-page__inner">
        <div className="audit-form">
          <section className="audit-panel">
            <header className="audit-panel__head">
              <span className="audit-panel__step">01</span>
              <div className="audit-panel__head-main">
                <div className="audit-panel__head-row">
                  <h2 className="audit-panel__title">Interaction Details</h2>
                </div>
              </div>
            </header>

            <div className="audit-panel__body">
              <div className="audit-details">
                {interactionNotice ? (
                  <div
                    className={cn(
                      "audit-panel__notice",
                      isChatInteraction && "audit-panel__notice--error"
                    )}
                    role={isChatInteraction ? "alert" : "status"}
                  >
                    {interactionNotice}
                  </div>
                ) : null}

                <div className="audit-details__row audit-details__row--full">
                  <div className="audit-type-switch">
                    <span className="audit-type-switch__label">Interaction type</span>
                    <div
                      className="audit-segment audit-segment--details"
                      role="group"
                      aria-label="Interaction type"
                    >
                      {(["Call", "Chat"] as InteractionType[]).map((type) => {
                        const selected = formData.type === type;
                        return (
                        <button
                          key={type}
                          type="button"
                          className={cn(
                            "audit-segment__btn",
                            selected && "audit-segment__btn--active"
                          )}
                          aria-pressed={selected}
                          disabled={isEditMode || pending}
                          onClick={() => handleInteractionType(type)}
                        >
                          {type === "Call" ? (
                            <Phone size={15} aria-hidden />
                          ) : (
                            <MessageSquare size={15} aria-hidden />
                          )}
                          {type}
                        </button>
                      );
                      })}
                    </div>
                    <p className="audit-type-switch__hint">
                      {isCallInteraction
                        ? "Call rubric — voice interaction scoring parameters below."
                        : "Chat rubric — messaging interaction scoring parameters below."}
                    </p>
                  </div>
                </div>

                <div className="audit-details__row">
                  <Field className={fieldAttentionClass("supervisor")}>
                    <Label htmlFor="supervisor">
                      Supervisor
                      {isChatInteraction ? (
                        <span className="audit-required"> *</span>
                      ) : null}
                    </Label>
                    <Select
                      id="supervisor"
                      className="audit-control"
                      value={formData.supervisor}
                      disabled={pending}
                      onChange={(e) => handleSupervisorChange(e.target.value)}
                    >
                      <option value="">Select supervisor</option>
                      {supervisorOptions.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </Select>
                  </Field>

                  <Field className={fieldAttentionClass("agent")}>
                    <Label htmlFor="agent">
                      Agent
                      {isChatInteraction ? (
                        <span className="audit-required"> *</span>
                      ) : null}
                    </Label>
                    <Select
                      id="agent"
                      className="audit-control"
                      value={formData.agent}
                      disabled={!formData.supervisor.trim() || pending}
                      onChange={(e) => updateForm({ agent: e.target.value })}
                    >
                      <option value="">
                        {!formData.supervisor.trim()
                          ? "Select supervisor first"
                          : agentOptions.length === 0
                            ? "No agents assigned to this supervisor"
                            : "Select agent"}
                      </option>
                      {agentOptions.map((a) => (
                        <option key={a} value={a}>
                          {a}
                        </option>
                      ))}
                    </Select>
                  </Field>

                  <Field className={fieldAttentionClass("auditor")}>
                    <Label htmlFor="auditor">
                      Quality Analyst
                      {isChatInteraction ? (
                        <span className="audit-required"> *</span>
                      ) : null}
                    </Label>
                    <Select
                      id="auditor"
                      className="audit-control"
                      value={formData.auditor}
                      onChange={(e) => updateForm({ auditor: e.target.value })}
                    >
                      <option value="">Select Quality Analyst</option>
                      {auditorOptions.map((a) => (
                        <option key={a} value={a}>
                          {a}
                        </option>
                      ))}
                    </Select>
                  </Field>
                </div>

                <div className="audit-details__row">
                  <Field className={fieldAttentionClass("callDate")}>
                    <Label htmlFor="callDate">
                      {isCallInteraction ? "Call date" : "Chat date"}
                      {isChatInteraction ? (
                        <span className="audit-required"> *</span>
                      ) : null}
                    </Label>
                    <Input
                      id="callDate"
                      className="audit-control"
                      type="date"
                      value={formData.callDate}
                      onChange={(e) => updateForm({ callDate: e.target.value })}
                    />
                  </Field>

                  <Field className={fieldAttentionClass("businessType")}>
                    <Label htmlFor="businessType">
                      Business Type
                      {isChatInteraction ? (
                        <span className="audit-required"> *</span>
                      ) : null}
                    </Label>
                    <Select
                      id="businessType"
                      className="audit-control"
                      value={formData.businessType}
                      onChange={(e) => handleBusinessType(e.target.value)}
                    >
                      <option value="">Select Business Type</option>
                      {businessTypes.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </Select>
                  </Field>

                  <Field className="audit-field audit-field--audit-date">
                    <Label htmlFor="auditDate">Audit date</Label>
                    <Input
                      id="auditDate"
                      className="audit-control audit-control--readonly"
                      type="date"
                      value={formData.auditDate}
                      readOnly
                      tabIndex={-1}
                      aria-readonly="true"
                    />
                    <p className="audit-field-hint">
                      {isEditMode
                        ? "Original audit date."
                        : "Set automatically to today."}
                    </p>
                  </Field>
                </div>

                <div className="audit-details__row">
                  <Field className={fieldAttentionClass("lob")}>
                    <Label htmlFor="lob">
                      LOB
                      {isChatInteraction ? (
                        <span className="audit-required"> *</span>
                      ) : null}
                    </Label>
                    <Select
                      id="lob"
                      className="audit-control"
                      value={formData.lob}
                      disabled={!formData.businessType}
                      onChange={(e) => handleLOB(e.target.value)}
                    >
                      <option value="">
                        {formData.businessType
                          ? "Select LOB"
                          : "Select business type first"}
                      </option>
                      {selectableLOBs.map((l) => (
                        <option
                          key={`${l.businessType}-${l.name}`}
                          value={l.name}
                        >
                          {l.name}
                        </option>
                      ))}
                    </Select>
                  </Field>

                  <Field className={fieldAttentionClass("sublob")}>
                    <Label htmlFor="sublob">
                      Reason
                      {isChatInteraction ? (
                        <span className="audit-required"> *</span>
                      ) : null}
                    </Label>
                    <Select
                      id="sublob"
                      className="audit-control"
                      value={formData.sublob}
                      disabled={!formData.lob}
                      onChange={(e) => handleSubLOB(e.target.value)}
                    >
                      <option value="">
                        {formData.lob ? "Select Reason" : "Select LOB first"}
                      </option>
                      {subLOBs.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </Select>
                  </Field>

                  <Field className={fieldAttentionClass("reason")}>
                    <Label htmlFor="reason">
                      Sub-reason
                      {isChatInteraction && reasons.length > 0 ? (
                        <span className="audit-required"> *</span>
                      ) : null}
                    </Label>
                    <Select
                      id="reason"
                      className="audit-control"
                      value={formData.reason}
                      disabled={!formData.sublob || reasons.length === 0}
                      onChange={(e) => handleReason(e.target.value)}
                    >
                      <option value="">
                        {!formData.sublob
                          ? "Select Reason first"
                          : reasons.length === 0
                            ? "No sub-reasons for this reason"
                            : "Select Sub-reason"}
                      </option>
                      {reasons.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </Select>
                  </Field>
                </div>

                <div className="audit-details__row audit-details__row--pair audit-details__row--contact">
                  <Field
                    className={fieldAttentionClass(
                      "mobile",
                      "audit-field audit-contact-field"
                    )}
                  >
                    <div className="audit-contact-field__label-row">
                      <Label htmlFor="mobile">
                        {formData.type === "Call" ? "Mobile number" : "Number / name"}
                        {isChatInteraction ? (
                          <span className="audit-required"> *</span>
                        ) : null}
                      </Label>
                    </div>
                    <Input
                      id="mobile"
                      className="audit-control"
                      type={formData.type === "Call" ? "tel" : "text"}
                      inputMode={formData.type === "Call" ? "tel" : "text"}
                      autoComplete={formData.type === "Call" ? "tel" : "off"}
                      placeholder={
                        formData.type === "Call"
                          ? "e.g. 916393540300"
                          : "e.g. guest name, ticket ID, or phone number"
                      }
                      value={formData.mobile}
                      onChange={(e) => updateForm({ mobile: e.target.value })}
                    />
                    <p className="audit-field__hint ui-hint">
                      {isChatInteraction
                        ? "Required — guest name, ticket ID, or phone number"
                        : `Optional — ${
                            formData.type === "Call"
                              ? "customer phone number for this call"
                              : "identifier for this chat (name, number, or ticket ID)"
                          }`}
                    </p>
                  </Field>

                  <ReferenceUrlField
                    value={formData.referenceUrl}
                    interactionType={formData.type}
                    inline
                    required={false}
                    fieldClassName={fieldAttentionClass(
                      "referenceUrl",
                      "audit-field audit-reference-field audit-contact-field"
                    )}
                    auditReferenceOptions={auditReferenceOptions}
                    onChange={(referenceUrl) => updateForm({ referenceUrl })}
                  />
                </div>

                <div className="audit-details__row audit-details__row--full">
                  <Field className={fieldAttentionClass("response")}>
                    <Label htmlFor="response">
                      Agent&apos;s Response
                      {isChatInteraction ? (
                        <span className="audit-required"> *</span>
                      ) : null}
                    </Label>
                    <textarea
                      id="response"
                      className="audit-control audit-textarea"
                      rows={3}
                      placeholder="Briefly describe the outcome..."
                      value={formData.response}
                      onChange={(e) => updateForm({ response: e.target.value })}
                    />
                  </Field>
                </div>
              </div>
            </div>
          </section>

          {activeTemplate.sections.map((section, index) => {
            const sectionMax = section.params.reduce((sum, p) => sum + p.max, 0);
            const sectionRated = section.isFatal
              ? section.params.filter(
                  (p) => getEffectiveScore(scores, p.id, true) === "Y"
                ).length
              : section.params.filter(
                  (p) =>
                    getEffectiveScore(scores, p.id, false, p.scoring) !== "NA"
                ).length;
            const sectionHasMissingScores = section.params.some((param) =>
              highlightedScoreParamIds.includes(param.id)
            );

            return (
              <section
                key={`${selectedTemplateId}-${section.id}`}
                className={cn(
                  "audit-panel",
                  sectionRated > 0 && "audit-panel--rated",
                  sectionHasMissingScores && "audit-panel--attention"
                )}
              >
                <header className="audit-panel__head">
                  <span className="audit-panel__step">
                    {String(index + 2).padStart(2, "0")}
                  </span>
                  <div className="audit-panel__head-main">
                    <div className="audit-panel__head-row">
                      <h2 className="audit-panel__title">{section.name}</h2>
                      {section.isFatal ? (
                        <span className="audit-panel__tag audit-panel__tag--fatal">
                          Fatal
                        </span>
                      ) : section.params.every((p) => p.scoring === "Y/N-CMM") ? (
                        <span className="audit-panel__tag">
                          No score impact
                        </span>
                      ) : (
                        <span className="audit-panel__tag">
                          MAX: {sectionMax} PTS
                        </span>
                      )}
                    </div>
                  </div>
                </header>

                {sectionHasMissingScores ? (
                  <div className="audit-panel__notice" role="alert">
                    {AUDIT_FORM_NOTICE.scoreParameters}
                  </div>
                ) : null}

                <div className="audit-score-list">
                  <div className="audit-score-list__head">
                    <span>Parameter</span>
                    <span>Score</span>
                  </div>
                  {section.params.map((param) => {
                    const options = getScoringOptions(param.scoring, param.max, {
                      points: param.points,
                      fatalOptionLabel: param.fatalOptionLabel,
                    });
                    const current = normalizeProbingPreferredModeScoreValue(
                      param.id,
                      normalizeFatalYnScoreValue(
                        param.id,
                        getEffectiveScore(
                          scores,
                          param.id,
                          section.isFatal,
                          param.scoring
                        )
                      ),
                      param.max
                    );
                    const tone = getScoreTone(
                      current,
                      param.scoring,
                      param.max,
                      section.isFatal
                    );
                    const isRated =
                      section.isFatal || current !== "NA";

                    return (
                      <div
                        key={param.id}
                        id={`score-param-${param.id}`}
                        className={cn(
                          "audit-score-row",
                          toneClass(tone, "audit-score-row"),
                          isRated && tone !== "na" && "audit-score-row--active",
                          highlightedScoreParamIds.includes(param.id) &&
                            "audit-score-row--attention"
                        )}
                      >
                        <div className="audit-score-row__info">
                          <span className="audit-score-row__name">
                            {param.name}
                            {param.max > 0 && (
                              <span className="audit-score-row__max-inline">
                                {" "}
                                (max {param.max})
                              </span>
                            )}
                          </span>
                        </div>
                        <div className="audit-score-row__field">
                          <span className="audit-score-row__field-label">
                            Score
                          </span>
                          <Select
                            className={cn(
                              "audit-control audit-score-row__select",
                              toneClass(tone, "audit-control")
                            )}
                            value={current}
                            onChange={(e) =>
                              handleScore(param.id, e.target.value)
                            }
                          >
                            {options.map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </Select>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}

          <section className="audit-panel">
            <header className="audit-panel__head">
              <span className="audit-panel__step">
                {String(activeTemplate.sections.length + 2).padStart(2, "0")}
              </span>
              <div className="audit-panel__head-main">
                <div className="audit-panel__head-row">
                  <h2 className="audit-panel__title">Feedback</h2>
                </div>
              </div>
            </header>

            <div className="audit-panel__body">
              <div className="audit-details">
                <div className="audit-details__row">
                  <Field className="audit-field">
                    <Label htmlFor="feedbackSecurity">{FEEDBACK_SEVERITY_LABEL}</Label>
                    <Select
                      id="feedbackSecurity"
                      className="audit-control"
                      value={formData.feedbackSecurity}
                      onChange={(e) =>
                        updateForm({
                          feedbackSecurity: e.target.value as FeedbackSecurity,
                        })
                      }
                    >
                      {FEEDBACK_SECURITY_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </Select>
                  </Field>

                  <Field className="audit-field">
                    <Label htmlFor="feedbackStatus">Feedback Status</Label>
                    <Select
                      id="feedbackStatus"
                      className="audit-control"
                      value={formData.feedbackStatus}
                      onChange={(e) =>
                        handleFeedbackStatus(e.target.value as FeedbackStatus)
                      }
                    >
                      {FEEDBACK_STATUS_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </Select>
                  </Field>

                  <Field className="audit-field">
                    <Label htmlFor="feedbackDate">
                      Feedback Date
                      {feedbackDateRequired ? (
                        <span className="audit-required"> *</span>
                      ) : null}
                    </Label>
                    <Input
                      id="feedbackDate"
                      className="audit-control"
                      type="date"
                      value={formData.feedbackDate}
                      disabled={formData.feedbackStatus === "Pending"}
                      required={feedbackDateRequired}
                      onChange={(e) =>
                        updateForm({ feedbackDate: e.target.value })
                      }
                    />
                    <p className="audit-field__hint">
                      {formData.feedbackStatus === "Pending"
                        ? "Set when feedback is shared with the agent."
                        : "Date feedback was shared or acknowledged."}
                    </p>
                  </Field>
                </div>

                <div className="audit-details__row audit-details__row--full">
                  <Field className="audit-field">
                    <Label htmlFor="agentFeedback">Feedback for the agent</Label>
                    <textarea
                      id="agentFeedback"
                      className="audit-control audit-textarea"
                      rows={4}
                      placeholder="Write feedback to share with the agent..."
                      value={formData.agentFeedback}
                      onChange={(e) =>
                        updateForm({ agentFeedback: e.target.value })
                      }
                    />
                  </Field>
                </div>
              </div>
            </div>
          </section>
        </div>
          </div>
        </div>

        <AuditScorePanel
          result={liveResult}
          ratedCount={ratedScoringCount}
          totalScoringParams={scoringParamCount}
          fixed
        />
      </div>
    </div>
  );
}
