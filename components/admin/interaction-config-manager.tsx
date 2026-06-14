"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BookOpen,
  Briefcase,
  Check,
  Edit2,
  Grid,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { BulkActionBar } from "@/components/admin/bulk-action-bar";
import { Modal } from "@/components/primitives/modal";
import { useToast } from "@/components/primitives/toast";
import { saveInteractionConfig } from "@/lib/actions/interaction-config";
import {
  addSubReasonToReason,
  addToLobStringList,
  ensureLobFlatLists,
  getLobDffOptions,
  getSubReasonsForReason,
  prepareLobReasonMap,
  removeFromLobStringList,
  removeSubReasonFromReason,
} from "@/lib/audit/lob-flat-lists";
import type { BusinessType, InteractionConfig, LOBConfig } from "@/lib/audit/types";
import { useBulkSelection } from "@/lib/hooks/use-bulk-selection";
import { cn } from "@/lib/utils";

const TABS = [
  { id: "businessTypes", label: "Business types", icon: Briefcase },
  { id: "lobs", label: "LOBs & reasons", icon: BookOpen },
] as const;

type TabId = (typeof TABS)[number]["id"];

type InteractionConfigManagerProps = {
  initialConfig: InteractionConfig;
  canManage: boolean;
  updatedAt?: string;
  configVersion?: number;
};

type DeleteTarget =
  | { type: "supervisor"; value: string }
  | { type: "auditor"; value: string }
  | { type: "businessType"; value: string }
  | { type: "lob"; businessType: BusinessType; name: string }
  | { type: "sublob"; lobIndex: number; name: string }
  | { type: "subReason"; lobIndex: number; reasonName: string; name: string }
  | { type: "dff"; lobIndex: number; name: string };

function sortNames(values: string[]) {
  return [...values].sort((a, b) => a.localeCompare(b));
}

function cloneConfig(config: InteractionConfig): InteractionConfig {
  return {
    agents: [...config.agents],
    supervisors: [...config.supervisors],
    auditors: [...config.auditors],
    businessTypes: [...config.businessTypes],
    lobs: config.lobs.map((lob) => {
      const prepared = prepareLobReasonMap(lob);
      return {
        ...prepared,
        sublobs: [...prepared.sublobs],
        sublobReasons: Object.fromEntries(
          Object.entries(prepared.sublobReasons ?? {}).map(([key, values]) => [
            key,
            [...values],
          ])
        ),
        subReasonsList: [...(prepared.subReasonsList ?? [])],
        dffList: [...(prepared.dffList ?? [])],
        sublobReasonSubReasons: undefined,
        reasonSubReasons: undefined,
        reasons: undefined,
      };
    }),
  };
}

function deleteTargetLabel(target: DeleteTarget): string {
  switch (target.type) {
    case "supervisor":
      return `supervisor "${target.value}"`;
    case "auditor":
      return `auditor "${target.value}"`;
    case "businessType":
      return `business type "${target.value}"`;
    case "lob":
      return `LOB "${target.name}" (${target.businessType})`;
    case "sublob":
      return `reason "${target.name}"`;
    case "subReason":
      return `sub-reason "${target.name}" under "${target.reasonName}"`;
    case "dff":
      return `DFF "${target.name}"`;
  }
}

const SAVE_DEBOUNCE_MS = 400;
const SAVE_RETRY_ATTEMPTS = 3;

type SaveState = "saved" | "pending" | "saving" | "error";

export function InteractionConfigManager({
  initialConfig,
  canManage,
  updatedAt,
  configVersion = 0,
}: InteractionConfigManagerProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [config, setConfig] = useState(initialConfig);
  const [lastSavedAt, setLastSavedAt] = useState(updatedAt);
  const configVersionRef = useRef(configVersion);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFlushingRef = useRef(false);
  const resavePendingRef = useRef(false);
  const savesInFlightRef = useRef(0);
  const configRef = useRef(initialConfig);
  const [tab, setTab] = useState<TabId>("businessTypes");
  const [search, setSearch] = useState("");
  const [newItemText, setNewItemText] = useState("");
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingText, setEditingText] = useState("");
  const [businessType, setBusinessType] = useState<BusinessType>(
    initialConfig.businessTypes[0] ?? "Sales"
  );
  const [selectedLobIndex, setSelectedLobIndex] = useState(0);
  const [newLobName, setNewLobName] = useState("");
  const [newSublobText, setNewSublobText] = useState("");
  const [newReasonText, setNewReasonText] = useState("");
  const [newSubReasonText, setNewSubReasonText] = useState("");
  const [selectedReasonName, setSelectedReasonName] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [bulkListDeleteOpen, setBulkListDeleteOpen] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (savesInFlightRef.current > 0 || saveTimerRef.current) return;
    setConfig(initialConfig);
    configRef.current = initialConfig;
    setLastSavedAt(updatedAt);
    configVersionRef.current = configVersion;
  }, [initialConfig, updatedAt, configVersion]);

  useEffect(() => {
    configRef.current = config;
  }, [config]);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (
      config.businessTypes.length > 0 &&
      !config.businessTypes.includes(businessType)
    ) {
      setBusinessType(config.businessTypes[0]);
    }
  }, [config.businessTypes, businessType]);

  async function flushSave() {
    if (!canManage) return;

    if (isFlushingRef.current) {
      resavePendingRef.current = true;
      return;
    }

    isFlushingRef.current = true;
    resavePendingRef.current = false;
    savesInFlightRef.current += 1;
    setIsSaving(true);
    setSaveState("saving");

    const versionSnapshot = configVersionRef.current;
    const payload = cloneConfig(configRef.current);
    payload.agents = [];
    payload.supervisors = [];
    payload.auditors = [];

    try {
      for (let attempt = 0; attempt < SAVE_RETRY_ATTEMPTS; attempt += 1) {
        const result = await saveInteractionConfig(payload, {
          expectedVersion: versionSnapshot,
        });

        if (result.ok) {
          configVersionRef.current = result.configVersion;
          setLastSavedAt(result.updatedAt);
          setSaveState("saved");
          return;
        }

        if (result.conflict) {
          setSaveState("error");
          toast(result.error, "error");
          router.refresh();
          return;
        }

        if (attempt < SAVE_RETRY_ATTEMPTS - 1) {
          await new Promise((resolve) =>
            setTimeout(resolve, 400 * (attempt + 1))
          );
          continue;
        }

        setSaveState("error");
        toast(result.error, "error");
      }
    } finally {
      isFlushingRef.current = false;
      savesInFlightRef.current = Math.max(0, savesInFlightRef.current - 1);
      setIsSaving(
        savesInFlightRef.current > 0 || saveTimerRef.current !== null
      );

      if (resavePendingRef.current) {
        resavePendingRef.current = false;
        void flushSave();
      } else if (saveTimerRef.current) {
        setSaveState("pending");
      }
    }
  }

  function persist(next: InteractionConfig) {
    if (!canManage) return;
    configRef.current = next;
    setConfig(next);
    setSaveState("pending");

    if (isFlushingRef.current) {
      resavePendingRef.current = true;
      return;
    }

    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }

    saveTimerRef.current = setTimeout(() => {
      saveTimerRef.current = null;
      void flushSave();
    }, SAVE_DEBOUNCE_MS);
  }

  function listForTab(): string[] {
    return config.businessTypes;
  }

  function updateListForTab(values: string[], base = configRef.current) {
    const next = cloneConfig(base);
    next.businessTypes = values;
    return next;
  }

  function handleAddItem(e: React.FormEvent) {
    e.preventDefault();
    const value = newItemText.trim();
    if (!value || tab === "lobs") return;
    const list = listForTab();
    if (list.some((item) => item.toLowerCase() === value.toLowerCase())) {
      toast("This name already exists.", "error");
      return;
    }
    persist(updateListForTab(sortNames([...list, value])));
    setNewItemText("");
  }

  function startEdit(index: number, value: string) {
    setEditingIndex(index);
    setEditingText(value);
  }

  function saveEdit(index: number) {
    const value = editingText.trim();
    if (!value || tab === "lobs") return;
    const list = listForTab();
    if (list.some((item, i) => i !== index && item.toLowerCase() === value.toLowerCase())) {
      toast("This name already exists.", "error");
      return;
    }
    const nextList = [...list];
    const previousValue = nextList[index];
    nextList[index] = value;
    const next = updateListForTab(sortNames(nextList));
    if (tab === "businessTypes" && previousValue !== value) {
      next.lobs = next.lobs.map((lob) =>
        lob.businessType === previousValue
          ? { ...lob, businessType: value }
          : lob
      );
      if (businessType === previousValue) {
        setBusinessType(value);
      }
    }
    persist(next);
    setEditingIndex(null);
    setEditingText("");
  }

  function requestDeleteListItem(value: string) {
    if (config.lobs.some((lob) => lob.businessType === value)) {
      toast("Remove or reassign LOBs under this business type first.", "error");
      return;
    }
    if (config.businessTypes.length <= 1) {
      toast("At least one business type is required.", "error");
      return;
    }
    setDeleteTarget({ type: "businessType", value });
  }

  const filteredList = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = listForTab();
    if (!q) return list;
    return list.filter((item) => item.toLowerCase().includes(q));
  }, [config, search, tab]);

  const listSelectionItems = useMemo(
    () => filteredList.map((value) => ({ id: value })),
    [filteredList]
  );

  const listSelection = useBulkSelection(listSelectionItems);

  const lobsForType = useMemo(
    () => config.lobs.filter((lob) => lob.businessType === businessType),
    [config.lobs, businessType]
  );

  useEffect(() => {
    if (lobsForType.length === 0) {
      setSelectedLobIndex(0);
      return;
    }
    if (selectedLobIndex >= lobsForType.length) {
      setSelectedLobIndex(Math.max(0, lobsForType.length - 1));
    }
  }, [lobsForType.length, selectedLobIndex]);

  const activeLob = lobsForType[selectedLobIndex] ?? lobsForType[0] ?? null;

  const activeLobFlat = useMemo(
    () => (activeLob ? prepareLobReasonMap(activeLob) : null),
    [activeLob]
  );

  useEffect(() => {
    if (!activeLobFlat) {
      setSelectedReasonName("");
      return;
    }
    if (
      selectedReasonName &&
      activeLobFlat.sublobs.includes(selectedReasonName)
    ) {
      return;
    }
    setSelectedReasonName(activeLobFlat.sublobs[0] ?? "");
  }, [activeLobFlat, selectedReasonName]);

  const activeSubReasonsList = useMemo(
    () =>
      getSubReasonsForReason(activeLobFlat ?? undefined, selectedReasonName),
    [activeLobFlat, selectedReasonName]
  );

  const activeDffList = useMemo(
    () => getLobDffOptions(activeLobFlat ?? undefined),
    [activeLobFlat]
  );

  const globalLobIndex = useMemo(() => {
    if (!activeLob) return -1;
    return config.lobs.findIndex(
      (lob) =>
        lob.name === activeLob.name && lob.businessType === businessType
    );
  }, [activeLob, businessType, config.lobs]);

  function handleAddLob(e: React.FormEvent) {
    e.preventDefault();
    const name = newLobName.trim();
    if (!name) return;
    if (
      config.lobs.some(
        (lob) =>
          lob.name.toLowerCase() === name.toLowerCase() &&
          lob.businessType === businessType
      )
    ) {
      toast("LOB already exists for this business type.", "error");
      return;
    }
    const next = cloneConfig(configRef.current);
    next.lobs.push(
      prepareLobReasonMap({
        name,
        businessType,
        sublobs: [],
        sublobReasons: {},
        subReasonsList: [],
        dffList: [],
      })
    );
    persist(next);
    setNewLobName("");
    setSelectedLobIndex(lobsForType.length);
  }

  function updateLobAt(
    index: number,
    updater: (lob: LOBConfig) => LOBConfig | null
  ) {
    if (index < 0) return;
    const next = cloneConfig(configRef.current);
    const updated = updater(next.lobs[index]);
    if (updated === null) return;
    next.lobs[index] = updated;
    persist(next);
  }

  function handleAddSublob(e: React.FormEvent) {
    e.preventDefault();
    const value = newSublobText.trim();
    if (!value || globalLobIndex < 0) return;
    updateLobAt(globalLobIndex, (lob) => {
      const prepared = prepareLobReasonMap(lob);
      const nextList = addToLobStringList(prepared.sublobs, value);
      if (!nextList) {
        toast("Reason already exists.", "error");
        return null;
      }
      return {
        ...prepared,
        sublobs: nextList,
        sublobReasons: {
          ...(prepared.sublobReasons ?? {}),
          [value]: prepared.sublobReasons?.[value] ?? [],
        },
      };
    });
    setNewSublobText("");
    setSelectedReasonName(value);
  }

  function handleAddReason(e: React.FormEvent) {
    e.preventDefault();
    const value = newReasonText.trim();
    if (!value || globalLobIndex < 0) return;
    if (!selectedReasonName) {
      toast("Select a reason first.", "error");
      return;
    }
    updateLobAt(globalLobIndex, (lob) => {
      const prepared = prepareLobReasonMap(lob);
      const updated = addSubReasonToReason(prepared, selectedReasonName, value);
      if (!updated) {
        toast("Sub-reason already exists for this reason.", "error");
        return null;
      }
      return updated;
    });
    setNewReasonText("");
  }

  function handleAddSubReason(e: React.FormEvent) {
    e.preventDefault();
    const value = newSubReasonText.trim();
    if (!value || globalLobIndex < 0) return;
    updateLobAt(globalLobIndex, (lob) => {
      const flat = ensureLobFlatLists(lob);
      const current = flat.dffList ?? [];
      const nextList = addToLobStringList(current, value);
      if (!nextList) {
        toast("DFF already exists.", "error");
        return null;
      }
      return { ...flat, dffList: nextList };
    });
    setNewSubReasonText("");
  }

  function confirmBulkListDelete() {
    const values = new Set(
      filteredList.filter((item) => listSelection.isSelected(item))
    );
    if (values.size === 0) return;

    const next = cloneConfig(configRef.current);
    if (tab === "businessTypes") {
      const blocked = next.lobs.some((lob) => values.has(lob.businessType));
      if (blocked) {
        toast("Remove LOBs under selected business types first.", "error");
        return;
      }
      if (next.businessTypes.length - values.size < 1) {
        toast("At least one business type is required.", "error");
        return;
      }
      next.businessTypes = next.businessTypes.filter((item) => !values.has(item));
    }

    persist(next);
    listSelection.clearSelection();
    setBulkListDeleteOpen(false);
  }

  function confirmDelete() {
    if (!deleteTarget) return;
    const next = cloneConfig(configRef.current);

    if (deleteTarget.type === "businessType") {
      next.businessTypes = next.businessTypes.filter(
        (item) => item !== deleteTarget.value
      );
      if (businessType === deleteTarget.value) {
        setBusinessType(next.businessTypes[0] ?? "Sales");
      }
    } else if (deleteTarget.type === "lob") {
      next.lobs = next.lobs.filter(
        (lob) =>
          !(
            lob.name === deleteTarget.name &&
            lob.businessType === deleteTarget.businessType
          )
      );
      setSelectedLobIndex(0);
    } else if (deleteTarget.type === "sublob") {
      const lob = next.lobs[deleteTarget.lobIndex];
      if (lob) {
        const prepared = prepareLobReasonMap(lob);
        const { [deleteTarget.name]: _removed, ...remainingReasons } =
          prepared.sublobReasons ?? {};
        next.lobs[deleteTarget.lobIndex] = prepareLobReasonMap({
          ...prepared,
          sublobs: removeFromLobStringList(prepared.sublobs, deleteTarget.name),
          sublobReasons: remainingReasons,
        });
        if (selectedReasonName === deleteTarget.name) {
          const remaining = removeFromLobStringList(
            prepared.sublobs,
            deleteTarget.name
          );
          setSelectedReasonName(remaining[0] ?? "");
        }
      }
    } else if (deleteTarget.type === "subReason") {
      const lob = next.lobs[deleteTarget.lobIndex];
      if (lob) {
        next.lobs[deleteTarget.lobIndex] = removeSubReasonFromReason(
          prepareLobReasonMap(lob),
          deleteTarget.reasonName,
          deleteTarget.name
        );
      }
    } else if (deleteTarget.type === "dff") {
      const lob = next.lobs[deleteTarget.lobIndex];
      if (lob) {
        const flat = ensureLobFlatLists(lob);
        next.lobs[deleteTarget.lobIndex] = {
          ...flat,
          dffList: removeFromLobStringList(flat.dffList ?? [], deleteTarget.name),
        };
      }
    }

    persist(next);
    setDeleteTarget(null);
  }

  return (
    <div className="platform-settings">
      {!canManage && (
        <div className="platform-settings__notice">
          <p>
            You can browse interaction options here. Only super administrators can
            add, edit, or delete entries in Settings.
          </p>
        </div>
      )}

      {canManage && (
        <div className="platform-settings__save-bar" aria-live="polite">
          <span
            className={cn(
              "platform-settings__save-pill",
              saveState === "saved" && "platform-settings__save-pill--saved",
              saveState === "pending" && "platform-settings__save-pill--pending",
              saveState === "saving" && "platform-settings__save-pill--saving",
              saveState === "error" && "platform-settings__save-pill--error"
            )}
          >
            {saveState === "saved" && lastSavedAt
              ? `Saved · ${new Date(lastSavedAt).toLocaleString()}`
              : null}
            {saveState === "pending" && "Unsaved changes…"}
            {saveState === "saving" && "Saving…"}
            {saveState === "error" && "Save failed — retrying on next edit"}
          </span>
        </div>
      )}

      <div className="platform-settings__tabs" role="tablist">
        {TABS.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={tab === item.id}
              className={
                tab === item.id
                  ? "platform-settings__tab platform-settings__tab--active"
                  : "platform-settings__tab"
              }
              onClick={() => {
                setTab(item.id);
                setSearch("");
                setEditingIndex(null);
                listSelection.clearSelection();
              }}
            >
              <Icon size={15} aria-hidden />
              {item.label}
            </button>
          );
        })}
      </div>

      {tab !== "lobs" && (
        <>
          <div className="platform-settings__toolbar">
            <div className="platform-settings__search-wrap">
              <Search size={16} className="platform-settings__search-icon" aria-hidden />
              <input
                type="search"
                className="platform-settings__search"
                placeholder={`Search ${tab}…`}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            {canManage && (
              <form className="platform-settings__add-form" onSubmit={handleAddItem}>
                <input
                  type="text"
                  className="platform-settings__search"
                  placeholder="Add business type…"
                  value={newItemText}
                  disabled={isSaving}
                  onChange={(e) => setNewItemText(e.target.value)}
                />
                <button
                  type="submit"
                  className="ui-btn ui-btn--primary ui-btn--sm"
                  disabled={isSaving}
                >
                  <Plus size={15} aria-hidden />
                  Add
                </button>
              </form>
            )}
          </div>

          {canManage && (
            <BulkActionBar
              selectedCount={listSelection.selectedCount}
              onClear={listSelection.clearSelection}
              onDelete={() => setBulkListDeleteOpen(true)}
              isPending={isSaving}
            />
          )}

          <div className="platform-settings__panel">
            {canManage && filteredList.length > 0 && (
              <label className="platform-settings__select-all">
                <input
                  type="checkbox"
                  checked={listSelection.allVisibleSelected}
                  ref={(el) => {
                    if (el) {
                      el.indeterminate = listSelection.someVisibleSelected;
                    }
                  }}
                  disabled={isSaving}
                  onChange={listSelection.toggleAllVisible}
                />
                Select all visible
              </label>
            )}
            <ul className="platform-settings__list platform-settings__list--manage">
              {filteredList.length === 0 ? (
                <li className="platform-settings__empty">No matches found.</li>
              ) : (
                filteredList.map((item) => {
                  const rawIndex = listForTab().indexOf(item);
                  const isEditing = editingIndex === rawIndex;
                  return (
                    <li key={item} className="platform-settings__item">
                      {canManage && !isEditing && (
                        <input
                          type="checkbox"
                          className="platform-settings__item-check"
                          aria-label={`Select ${item}`}
                          checked={listSelection.isSelected(item)}
                          disabled={isSaving}
                          onChange={() => listSelection.toggleOne(item)}
                        />
                      )}
                      {isEditing ? (
                        <div className="platform-settings__edit-row">
                          <input
                            className="platform-settings__search"
                            value={editingText}
                            onChange={(e) => setEditingText(e.target.value)}
                            autoFocus
                          />
                          <button
                            type="button"
                            className="platform-settings__icon-btn platform-settings__icon-btn--save"
                            onClick={() => saveEdit(rawIndex)}
                          >
                            <Check size={15} />
                          </button>
                          <button
                            type="button"
                            className="platform-settings__icon-btn"
                            onClick={() => setEditingIndex(null)}
                          >
                            <X size={15} />
                          </button>
                        </div>
                      ) : (
                        <>
                          <span>{item}</span>
                          {canManage && (
                            <div className="platform-settings__item-actions">
                              <button
                                type="button"
                                className="platform-settings__icon-btn"
                                onClick={() => startEdit(rawIndex, item)}
                                title="Edit"
                              >
                                <Edit2 size={14} />
                              </button>
                              <button
                                type="button"
                                className="platform-settings__icon-btn platform-settings__icon-btn--danger"
                                onClick={() => requestDeleteListItem(item)}
                                title="Delete"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          )}
                        </>
                      )}
                    </li>
                  );
                })
              )}
            </ul>
          </div>
        </>
      )}

      {tab === "lobs" && (
        <div className="platform-settings__lob-layout">
          <div className="platform-settings__lob-sidebar">
            <p className="platform-settings__lob-sidebar-label">Business type</p>
            <div className="platform-settings__lob-type">
              {config.businessTypes.map((type) => (
                <button
                  key={type}
                  type="button"
                  className={cn(
                    "platform-settings__type-btn",
                    businessType === type && "platform-settings__type-btn--active"
                  )}
                  onClick={() => {
                    setBusinessType(type);
                    setSelectedLobIndex(0);
                  }}
                >
                  {type}
                </button>
              ))}
            </div>

            {canManage && (
              <form
                className="platform-settings__add-form platform-settings__add-form--block"
                onSubmit={handleAddLob}
              >
                <input
                  type="text"
                  className="platform-settings__search"
                  placeholder="New LOB name…"
                  value={newLobName}
                  onChange={(e) => setNewLobName(e.target.value)}
                />
                <button type="submit" className="ui-btn ui-btn--primary ui-btn--sm">
                  <Plus size={15} />
                  Add LOB
                </button>
              </form>
            )}

            <p className="platform-settings__lob-sidebar-label">LOBs</p>
            <ul className="platform-settings__lob-nav">
              {lobsForType.length === 0 ? (
                <li className="platform-settings__empty platform-settings__empty--list">
                  No LOBs for {businessType}.
                </li>
              ) : (
                lobsForType.map((lob, index) => (
                  <li key={`${lob.businessType}-${lob.name}`} className="platform-settings__lob-nav-item">
                    <button
                      type="button"
                      className={cn(
                        "platform-settings__lob-link",
                        selectedLobIndex === index && "platform-settings__lob-link--active"
                      )}
                      onClick={() => setSelectedLobIndex(index)}
                    >
                      <Grid size={14} aria-hidden />
                      <span className="platform-settings__lob-link-text">{lob.name}</span>
                    </button>
                    {canManage && (
                      <button
                        type="button"
                        className="platform-settings__icon-btn platform-settings__icon-btn--danger platform-settings__icon-btn--compact"
                        aria-label={`Delete LOB ${lob.name}`}
                        onClick={() =>
                          setDeleteTarget({
                            type: "lob",
                            businessType,
                            name: lob.name,
                          })
                        }
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </li>
                ))
              )}
            </ul>
          </div>

          <div className="platform-settings__lob-detail">
            {!activeLob ? (
              <p className="platform-settings__empty">Select or create a LOB.</p>
            ) : (
              <>
                <header className="platform-settings__lob-head">
                  <div className="platform-settings__lob-head-main">
                    <h3>{activeLob.name}</h3>
                    <span className="platform-settings__lob-badge">
                      {activeLob.businessType}
                    </span>
                  </div>
                </header>

                <section className="platform-settings__sub-section">
                  <div className="platform-settings__section-head">
                    <h4>Reason</h4>
                  </div>
                  {canManage && (
                    <form
                      className="platform-settings__add-form platform-settings__add-form--block"
                      onSubmit={handleAddSublob}
                    >
                      <input
                        type="text"
                        className="platform-settings__search"
                        placeholder="Add reason…"
                        value={newSublobText}
                        onChange={(e) => setNewSublobText(e.target.value)}
                      />
                      <button type="submit" className="ui-btn ui-btn--secondary ui-btn--sm">
                        <Plus size={14} />
                        Add
                      </button>
                    </form>
                  )}
                  <ul className="platform-settings__reason-list">
                    {!activeLobFlat || activeLobFlat.sublobs.length === 0 ? (
                      <li className="platform-settings__empty platform-settings__empty--list">
                        No reasons yet.
                      </li>
                    ) : (
                      activeLobFlat.sublobs.map((sublob) => (
                        <li key={sublob} className="platform-settings__reason-item">
                          <button
                            type="button"
                            className={cn(
                              "platform-settings__reason-select",
                              selectedReasonName === sublob &&
                                "platform-settings__reason-select--active"
                            )}
                            onClick={() => setSelectedReasonName(sublob)}
                          >
                            {sublob}
                          </button>
                          {canManage && (
                            <button
                              type="button"
                              className="platform-settings__icon-btn platform-settings__icon-btn--danger platform-settings__icon-btn--compact"
                              aria-label={`Delete reason ${sublob}`}
                              onClick={() =>
                                setDeleteTarget({
                                  type: "sublob",
                                  lobIndex: globalLobIndex,
                                  name: sublob,
                                })
                              }
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </li>
                      ))
                    )}
                  </ul>
                </section>

                <section className="platform-settings__sub-section">
                  <div className="platform-settings__section-head">
                    <h4>Sub-reason</h4>
                    {selectedReasonName ? (
                      <span className="platform-settings__section-context">
                        {selectedReasonName}
                      </span>
                    ) : null}
                  </div>
                  {canManage && (
                    <form
                      className="platform-settings__add-form platform-settings__add-form--block"
                      onSubmit={handleAddReason}
                    >
                      <input
                        type="text"
                        className="platform-settings__search"
                        placeholder={
                          selectedReasonName
                            ? `Add sub-reason for "${selectedReasonName}"…`
                            : "Select a reason first…"
                        }
                        value={newReasonText}
                        disabled={!selectedReasonName || isSaving}
                        onChange={(e) => setNewReasonText(e.target.value)}
                      />
                      <button
                        type="submit"
                        className="ui-btn ui-btn--secondary ui-btn--sm"
                        disabled={!selectedReasonName || isSaving}
                      >
                        <Plus size={14} />
                        Add
                      </button>
                    </form>
                  )}
                  <ul className="platform-settings__reason-list">
                    {!selectedReasonName ? (
                      <li className="platform-settings__empty platform-settings__empty--list">
                        Select a reason to manage sub-reasons.
                      </li>
                    ) : activeSubReasonsList.length === 0 ? (
                      <li className="platform-settings__empty platform-settings__empty--list">
                        No sub-reasons for this reason yet.
                      </li>
                    ) : (
                      activeSubReasonsList.map((subReason) => (
                        <li key={subReason} className="platform-settings__reason-item">
                          <span className="platform-settings__reason-label">
                            {subReason}
                          </span>
                          {canManage && (
                            <button
                              type="button"
                              className="platform-settings__icon-btn platform-settings__icon-btn--danger"
                              aria-label={`Delete sub-reason ${subReason}`}
                              onClick={() =>
                                setDeleteTarget({
                                  type: "subReason",
                                  lobIndex: globalLobIndex,
                                  reasonName: selectedReasonName,
                                  name: subReason,
                                })
                              }
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </li>
                      ))
                    )}
                  </ul>
                </section>

                <section className="platform-settings__sub-section">
                  <div className="platform-settings__section-head">
                    <h4>DFF</h4>
                  </div>
                  {canManage && (
                    <form
                      className="platform-settings__add-form platform-settings__add-form--block"
                      onSubmit={handleAddSubReason}
                    >
                      <input
                        type="text"
                        className="platform-settings__search"
                        placeholder="Add DFF…"
                        value={newSubReasonText}
                        onChange={(e) => setNewSubReasonText(e.target.value)}
                      />
                      <button type="submit" className="ui-btn ui-btn--secondary ui-btn--sm">
                        <Plus size={14} />
                        Add
                      </button>
                    </form>
                  )}
                  <ul className="platform-settings__reason-list">
                    {activeDffList.length === 0 ? (
                      <li className="platform-settings__empty platform-settings__empty--list">
                        No DFF entries yet.
                      </li>
                    ) : (
                      activeDffList.map((subReason) => (
                        <li key={subReason} className="platform-settings__reason-item">
                          <span className="platform-settings__reason-label">
                            {subReason}
                          </span>
                          {canManage && (
                            <button
                              type="button"
                              className="platform-settings__icon-btn platform-settings__icon-btn--danger"
                              aria-label={`Delete DFF ${subReason}`}
                              onClick={() =>
                                setDeleteTarget({
                                  type: "dff",
                                  lobIndex: globalLobIndex,
                                  name: subReason,
                                })
                              }
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </li>
                      ))
                    )}
                  </ul>
                </section>
              </>
            )}
          </div>
        </div>
      )}

      <Modal
        open={deleteTarget !== null}
        onClose={() => !isSaving && setDeleteTarget(null)}
        title="Confirm delete"
        description={
          deleteTarget
            ? `Remove ${deleteTargetLabel(deleteTarget)} from audit form dropdowns? Existing saved audits are not changed.`
            : undefined
        }
      >
        <div className="platform-settings__confirm-actions">
          <button
            type="button"
            className="ui-btn ui-btn--secondary"
            onClick={() => setDeleteTarget(null)}
            disabled={isSaving}
          >
            Cancel
          </button>
          <button
            type="button"
            className="ui-btn ui-btn--danger"
            onClick={confirmDelete}
            disabled={isSaving}
          >
            {isSaving ? "Deleting…" : "Delete"}
          </button>
        </div>
      </Modal>

      <Modal
        open={bulkListDeleteOpen}
        onClose={() => !isSaving && setBulkListDeleteOpen(false)}
        title="Delete selected"
        description={`Remove ${listSelection.selectedCount} selected ${tab} from audit form dropdowns? Existing audits are not changed.`}
      >
        <div className="platform-settings__confirm-actions">
          <button
            type="button"
            className="ui-btn ui-btn--secondary"
            disabled={isSaving}
            onClick={() => setBulkListDeleteOpen(false)}
          >
            Cancel
          </button>
          <button
            type="button"
            className="ui-btn ui-btn--danger"
            disabled={isSaving}
            onClick={confirmBulkListDelete}
          >
            Delete selected
          </button>
        </div>
      </Modal>
    </div>
  );
}
