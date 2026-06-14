import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { AuditRecord, AuditTemplate, AppUser, InteractionConfig } from "../types";
import { DEFAULT_TEMPLATE, PRELOADED_RECORDS, AGENTS, SUPERVISORS, AUDITORS, LOB_MAP, REASON_MAP, SUB_LOB_REASON_MAP } from "../lib/constants";

export interface MenuItem {
  id: string;
  label: string;
  icon: string;
  visible: boolean;
  order: number;
}

// Helper to build default LOB config with sublobReasons populated
const buildDefaultLob = (name: string, businessType: 'Sales' | 'Support') => {
  const sublobs = LOB_MAP[name] || [];
  const reasons = REASON_MAP[name] || [];
  const sublobReasons: Record<string, string[]> = {};
  
  sublobs.forEach(sub => {
    sublobReasons[sub] = SUB_LOB_REASON_MAP[sub] || [];
  });

  return {
    name,
    sublobs,
    reasons,
    businessType,
    sublobReasons
  };
};

export const DEFAULT_INTERACTION_CONFIG: InteractionConfig = {
  agents: AGENTS,
  supervisors: SUPERVISORS,
  auditors: AUDITORS,
  lobs: [
    buildDefaultLob("CORE LOB", "Sales"),
    buildDefaultLob("POSTPAY", "Sales"),
    buildDefaultLob("PREPAID", "Sales"),
    buildDefaultLob("OTHERS", "Sales"),
    buildDefaultLob("GRACE", "Sales"),
    buildDefaultLob("CORE LOB", "Support"),
    buildDefaultLob("POSTPAY", "Support"),
    buildDefaultLob("PREPAID", "Support"),
    buildDefaultLob("OTHERS", "Support"),
    buildDefaultLob("GRACE", "Support")
  ]
};

interface AuditContextType {
  auditHistory: AuditRecord[];
  templates: AuditTemplate[];
  activeTemplate: AuditTemplate;
  users: AppUser[];
  menuConfig: MenuItem[];
  pendingRequests: any[];
  currentUser: AppUser | null;
  interactionConfig: InteractionConfig;
  addAudit: (record: AuditRecord) => void;
  deleteAudit: (id: string | number) => void;
  updateAudit: (record: AuditRecord) => void;
  setActiveTemplateById: (id: string) => void;
  saveTemplate: (template: AuditTemplate) => void;
  deleteTemplate: (id: string) => void;
  updateUser: (user: AppUser) => void;
  deleteUser: (uid: string) => void;
  updateMenuConfig: (config: MenuItem[]) => void;
  addAudits: (records: AuditRecord[]) => void;
  deleteAudits: (ids: (string | number)[]) => void;
  updateInteractionConfig: (config: InteractionConfig) => void;
}

const AuditContext = createContext<AuditContextType | undefined>(undefined);

export function AuditProvider({ children }: { children: React.ReactNode }) {
  const [auditHistory, setAuditHistory] = useState<AuditRecord[]>([]);
  const [templates, setTemplates] = useState<AuditTemplate[]>([DEFAULT_TEMPLATE]);
  const [activeTemplateId, setActiveTemplateId] = useState<string>("default");
  const [users, setUsers] = useState<AppUser[]>([]);
  const [menuConfig, setMenuConfig] = useState<MenuItem[]>([
    { id: 'dashboard', label: 'Overview', icon: 'LayoutDashboard', visible: true, order: 0 },
    { id: 'form', label: 'Audit Form', icon: 'FileText', visible: true, order: 1 },
    { id: 'history', label: 'Audit History', icon: 'History', visible: true, order: 2 },
    { id: 'analytics', label: 'Analytics', icon: 'BarChart3', visible: true, order: 3 },
    { id: 'templates', label: 'Quality Config', icon: 'Settings2', visible: true, order: 4 },
    { id: 'users', label: 'Auditor Management', icon: 'UserCircle', visible: true, order: 5 },
    { id: 'import', label: 'Data Sync', icon: 'RefreshCcw', visible: true, order: 6 },
    { id: 'interaction-config', label: 'Interaction Config', icon: 'Settings2', visible: true, order: 7 },
  ]);
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [interactionConfig, setInteractionConfig] = useState<InteractionConfig>(DEFAULT_INTERACTION_CONFIG);
  const [currentUser, setCurrentUser] = useState<AppUser | null>({
    uid: 'USR-ADMIN',
    name: 'Admin User',
    email: 'admin@qa.local',
    role: 'Admin',
    status: 'active',
    pwdHash: 'admin',
    viewAll: true,
    canCreate: true,
    canEdit: true,
    canDelete: true,
    allowedMenus: ['dashboard', 'form', 'history', 'analytics', 'import', 'templates', 'users', 'interaction-config'],
    createdAt: new Date().toLocaleDateString(),
    lastLogin: new Date().toLocaleString()
  });

  const [isLoaded, setIsLoaded] = useState(false);

  // Load from LocalStorage
  useEffect(() => {
    const savedHistory = localStorage.getItem("qa_history");
    const savedTemplates = localStorage.getItem("qa_audit_templates");
    const savedActiveTpl = localStorage.getItem("qa_active_template");
    const savedUsers = localStorage.getItem("qa_um_users");
    const savedMenu = localStorage.getItem("qa_menu_config");
    const savedInteractionConfig = localStorage.getItem("qa_interaction_config");

    if (savedHistory) setAuditHistory(JSON.parse(savedHistory));
    else setAuditHistory(PRELOADED_RECORDS);

    if (savedTemplates) {
      const parsed = JSON.parse(savedTemplates);
      if (!parsed.find((t: any) => t.id === "default")) {
        setTemplates([DEFAULT_TEMPLATE, ...parsed]);
      } else {
        setTemplates(parsed);
      }
    }

    if (savedActiveTpl) setActiveTemplateId(savedActiveTpl);
    
    if (savedUsers) setUsers(JSON.parse(savedUsers));
    
    if (savedMenu) {
      const parsedMenu = JSON.parse(savedMenu);
      // Ensure interaction-config is included if we upgraded
      if (!parsedMenu.find((m: any) => m.id === 'interaction-config')) {
        parsedMenu.push({ id: 'interaction-config', label: 'Interaction Config', icon: 'Settings2', visible: true, order: 7 });
      }
      setMenuConfig(parsedMenu);
    }
    
    if (savedInteractionConfig) {
      const parsed = JSON.parse(savedInteractionConfig);
      const hasOldLobs = parsed.lobs?.some((l: any) => l.name === 'Sales' || l.name === 'Support');
      const hasMissingBusinessType = parsed.lobs?.some((l: any) => !l.businessType);
      if (hasOldLobs || hasMissingBusinessType) {
        setInteractionConfig(DEFAULT_INTERACTION_CONFIG);
        localStorage.setItem("qa_interaction_config", JSON.stringify(DEFAULT_INTERACTION_CONFIG));
      } else {
        // Hydrate sublobReasons if missing, to prevent old configurations from lacking mapped values
        const lobsWithSublobReasons = (parsed.lobs || []).map((l: any) => {
          if (!l.sublobReasons) {
            const sublobReasons: Record<string, string[]> = {};
            (l.sublobs || []).forEach((sub: string) => {
              sublobReasons[sub] = SUB_LOB_REASON_MAP[sub] || [];
            });
            return { ...l, sublobReasons };
          }
          return l;
        });
        setInteractionConfig({ ...parsed, lobs: lobsWithSublobReasons });
      }
    } else {
      setInteractionConfig(DEFAULT_INTERACTION_CONFIG);
    }
    
    setIsLoaded(true);
  }, []);

  // Save to LocalStorage - only after initial load to prevent overwriting with []
  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem("qa_history", JSON.stringify(auditHistory));
    }
  }, [auditHistory, isLoaded]);

  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem("qa_audit_templates", JSON.stringify(templates));
    }
  }, [templates, isLoaded]);

  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem("qa_active_template", activeTemplateId);
    }
  }, [activeTemplateId, isLoaded]);

  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem("qa_um_users", JSON.stringify(users));
    }
  }, [users, isLoaded]);

  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem("qa_menu_config", JSON.stringify(menuConfig));
    }
  }, [menuConfig, isLoaded]);

  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem("qa_interaction_config", JSON.stringify(interactionConfig));
    }
  }, [interactionConfig, isLoaded]);

  const addAudit = useCallback((record: AuditRecord) => {
    setAuditHistory(prev => [record, ...prev]);
  }, []);

  const addAudits = useCallback((records: AuditRecord[]) => {
    setAuditHistory(prev => [...records, ...prev]);
  }, []);

  const updateAudit = useCallback((record: AuditRecord) => {
    setAuditHistory(prev => prev.map(a => a.id === record.id ? record : a));
  }, []);

  const deleteAudit = useCallback((id: string | number) => {
    setAuditHistory(prev => prev.filter(a => String(a.id) !== String(id)));
  }, []);

  const deleteAudits = useCallback((ids: (string | number)[]) => {
    const stringIds = new Set(ids.map(id => String(id)));
    setAuditHistory(prev => prev.filter(a => !stringIds.has(String(a.id))));
  }, []);

  const setActiveTemplateById = useCallback((id: string) => {
    setActiveTemplateId(id);
  }, []);

  const saveTemplate = useCallback((template: AuditTemplate) => {
    setTemplates(prev => {
      const exists = prev.find(t => t.id === template.id);
      if (exists) return prev.map(t => t.id === template.id ? template : t);
      return [...prev, template];
    });
  }, []);

  const deleteTemplate = useCallback((id: string) => {
    if (id === "default") return;
    setTemplates(prev => prev.filter(t => t.id !== id));
    if (activeTemplateId === id) setActiveTemplateId("default");
  }, [activeTemplateId]);

  const updateUser = useCallback((user: AppUser) => {
    setUsers(prev => {
      const exists = prev.find(u => u.uid === user.uid);
      if (exists) return prev.map(u => u.uid === user.uid ? user : u);
      return [...prev, user];
    });
  }, []);

  const deleteUser = useCallback((uid: string) => {
    setUsers(prev => prev.filter(u => u.uid !== uid));
  }, []);

  const updateMenuConfig = useCallback((config: MenuItem[]) => {
    setMenuConfig(config);
  }, []);

  const updateInteractionConfig = useCallback((config: InteractionConfig) => {
    setInteractionConfig(config);
  }, []);

  const activeTemplate = templates.find(t => t.id === activeTemplateId) || DEFAULT_TEMPLATE;

  return (
    <AuditContext.Provider
      value={{
        auditHistory,
        templates,
        activeTemplate,
        users,
        menuConfig,
        pendingRequests,
        currentUser,
        interactionConfig,
        addAudit,
        deleteAudit,
        updateAudit,
        setActiveTemplateById,
        saveTemplate,
        deleteTemplate,
        updateUser,
        deleteUser,
        updateMenuConfig,
        addAudits,
        deleteAudits,
        updateInteractionConfig
      }}
    >
      {children}
    </AuditContext.Provider>
  );
}

export function useAudit() {
  const context = useContext(AuditContext);
  if (context === undefined) {
    throw new Error("useAudit must be used within an AuditProvider");
  }
  return context;
}
