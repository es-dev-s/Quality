import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Users, 
  UserSquare2, 
  ShieldCheck, 
  Settings2, 
  Plus, 
  Trash2, 
  Edit2, 
  Check, 
  X, 
  Search,
  BookOpen,
  HelpCircle,
  Save,
  Grid,
  AlertTriangle
} from 'lucide-react';
import { useAudit } from '../contexts/AuditContext';
import { cn } from '../lib/utils';
import { InteractionConfig, LOBConfig } from '../types';
import { SUB_LOB_REASON_MAP } from '../lib/constants';

export default function InteractionConfigView() {
  const { interactionConfig, updateInteractionConfig, currentUser } = useAudit();
  const [activeTab, setActiveTab] = useState<'agents' | 'supervisors' | 'auditors' | 'lobs'>('agents');
  
  // Search state
  const [searchTerm, setSearchTerm] = useState('');

  // Form states for adding items
  const [newItemText, setNewItemText] = useState('');
  const [newLOBName, setNewLOBName] = useState('');

  // Edit states
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingText, setEditingText] = useState('');

  // LOB Detail State
  const [selectedBusinessType, setSelectedBusinessType] = useState<'Sales' | 'Support'>('Sales');
  const [selectedLobIndex, setSelectedLobIndex] = useState<number>(0);
  const [selectedSubLOB, setSelectedSubLOB] = useState<string>('');
  const [newSubLOBText, setNewSubLOBText] = useState('');
  const [newReasonText, setNewReasonText] = useState('');
  const [editingSubLOBIndex, setEditingSubLOBIndex] = useState<number | null>(null);
  const [editingSubLOBText, setEditingSubLOBText] = useState('');
  const [editingReasonIndex, setEditingReasonIndex] = useState<number | null>(null);
  const [editingReasonText, setEditingReasonText] = useState('');
  const [editingLobIndex, setEditingLobIndex] = useState<number | null>(null);
  const [editingLobText, setEditingLobText] = useState('');

  // Delete Confirmation State
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [deleteConfig, setDeleteConfig] = useState<{
    type: 'agent' | 'supervisor' | 'auditor' | 'lob' | 'sublob' | 'reason';
    title: string;
    message: string;
    targetValue: any;
  } | null>(null);

  // -------------------------
  // Handlers for Agents
  // -------------------------
  const handleAddAgent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemText.trim()) return;
    if (interactionConfig.agents.includes(newItemText.trim())) {
      alert("This agent name already exists.");
      return;
    }
    const updated = {
      ...interactionConfig,
      agents: [...interactionConfig.agents, newItemText.trim()].sort()
    };
    updateInteractionConfig(updated);
    setNewItemText('');
  };

  const handleDeleteAgent = (agent: string) => {
    setDeleteConfig({
      type: 'agent',
      title: 'Delete Agent',
      message: `Are you sure you want to delete agent "${agent}"? This will remove them from the selection menu.`,
      targetValue: agent
    });
    setShowConfirmModal(true);
  };

  const handleEditAgent = (index: number, currentName: string) => {
    setEditingIndex(index);
    setEditingText(currentName);
  };

  const handleSaveAgent = (index: number) => {
    if (!editingText.trim()) return;
    const oldName = interactionConfig.agents[index];
    const newAgents = [...interactionConfig.agents];
    newAgents[index] = editingText.trim();
    
    const updated = {
      ...interactionConfig,
      agents: newAgents.sort()
    };
    updateInteractionConfig(updated);
    setEditingIndex(null);
    setEditingText('');
  };

  // -------------------------
  // Handlers for Supervisors
  // -------------------------
  const handleAddSupervisor = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemText.trim()) return;
    if (interactionConfig.supervisors.includes(newItemText.trim())) {
      alert("This supervisor name already exists.");
      return;
    }
    const updated = {
      ...interactionConfig,
      supervisors: [...interactionConfig.supervisors, newItemText.trim()].sort()
    };
    updateInteractionConfig(updated);
    setNewItemText('');
  };

  const handleDeleteSupervisor = (supervisor: string) => {
    setDeleteConfig({
      type: 'supervisor',
      title: 'Delete Supervisor',
      message: `Are you sure you want to delete supervisor "${supervisor}"? This will remove them from the selection menu.`,
      targetValue: supervisor
    });
    setShowConfirmModal(true);
  };

  const handleSaveSupervisor = (index: number) => {
    if (!editingText.trim()) return;
    const newSups = [...interactionConfig.supervisors];
    newSups[index] = editingText.trim();
    
    const updated = {
      ...interactionConfig,
      supervisors: newSups.sort()
    };
    updateInteractionConfig(updated);
    setEditingIndex(null);
    setEditingText('');
  };

  // -------------------------
  // Handlers for Auditors
  // -------------------------
  const handleAddAuditor = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemText.trim()) return;
    if (interactionConfig.auditors.includes(newItemText.trim())) {
      alert("This auditor name already exists.");
      return;
    }
    const updated = {
      ...interactionConfig,
      auditors: [...interactionConfig.auditors, newItemText.trim()].sort()
    };
    updateInteractionConfig(updated);
    setNewItemText('');
  };

  const handleDeleteAuditor = (auditor: string) => {
    setDeleteConfig({
      type: 'auditor',
      title: 'Delete Auditor',
      message: `Are you sure you want to delete auditor "${auditor}"? This will remove them from the selection menu.`,
      targetValue: auditor
    });
    setShowConfirmModal(true);
  };

  const handleSaveAuditor = (index: number) => {
    if (!editingText.trim()) return;
    const newAuds = [...interactionConfig.auditors];
    newAuds[index] = editingText.trim();
    
    const updated = {
      ...interactionConfig,
      auditors: newAuds.sort()
    };
    updateInteractionConfig(updated);
    setEditingIndex(null);
    setEditingText('');
  };

  // -------------------------
  // Handlers for LOBs, SubLOBs & Reasons
  // -------------------------
  const handleAddLOB = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLOBName.trim()) return;
    if (interactionConfig.lobs.some(l => l.name.toLowerCase() === newLOBName.trim().toLowerCase() && (l.businessType || 'Sales') === selectedBusinessType)) {
      alert("This LOB already exists under " + selectedBusinessType + ".");
      return;
    }
    const updated = {
      ...interactionConfig,
      lobs: [...interactionConfig.lobs, { name: newLOBName.trim(), sublobs: [], reasons: [], businessType: selectedBusinessType }]
    };
    updateInteractionConfig(updated);
    setNewLOBName('');
    const typedCount = updated.lobs.filter(l => (l.businessType || 'Sales') === selectedBusinessType).length;
    setSelectedLobIndex(typedCount - 1);
  };

  const handleDeleteLOB = (index: number, name: string) => {
    const globalIdx = interactionConfig.lobs.findIndex(l => l.name === name && (l.businessType || 'Sales') === selectedBusinessType);
    if (globalIdx === -1) return;
    setDeleteConfig({
      type: 'lob',
      title: 'Delete LOB',
      message: `Are you sure you want to delete the "${name}" Line of Business from ${selectedBusinessType}? All associated Sub-LOBs and reasons will be permanently deleted.`,
      targetValue: { index: globalIdx, name }
    });
    setShowConfirmModal(true);
  };

  const handleSaveLOBName = (typedIndex: number) => {
    if (!editingLobText.trim()) return;
    const targetLOB = lobsForType[typedIndex];
    if (!targetLOB) return;
    const globalIdx = interactionConfig.lobs.findIndex(l => l === targetLOB);
    if (globalIdx === -1) return;

    const updatedLobs = [...interactionConfig.lobs];
    updatedLobs[globalIdx].name = editingLobText.trim();
    
    updateInteractionConfig({
      ...interactionConfig,
      lobs: updatedLobs
    });
    setEditingLobIndex(null);
    setEditingLobText('');
  };

  const handleAddSubLOB = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubLOBText.trim() || globalLobIndex === -1) return;
    const updatedLobs = [...interactionConfig.lobs];
    const currentLob = updatedLobs[globalLobIndex];
    if (currentLob.sublobs.includes(newSubLOBText.trim())) {
      alert("This Sub-LOB already exists under this LOB.");
      return;
    }
    currentLob.sublobs = [...currentLob.sublobs, newSubLOBText.trim()].sort();
    
    updateInteractionConfig({
      ...interactionConfig,
      lobs: updatedLobs
    });
    setNewSubLOBText('');
  };

  const handleDeleteSubLOB = (sublobIndex: number) => {
    if (globalLobIndex === -1) return;
    const sublobName = interactionConfig.lobs[globalLobIndex]?.sublobs[sublobIndex] || '';
    setDeleteConfig({
      type: 'sublob',
      title: 'Delete Sub-LOB',
      message: `Are you sure you want to delete "${sublobName}" from the Sub-LOB list?`,
      targetValue: sublobIndex
    });
    setShowConfirmModal(true);
  };

  const handleSaveSubLOB = (sublobIndex: number) => {
    if (!editingSubLOBText.trim() || globalLobIndex === -1) return;
    const updatedLobs = [...interactionConfig.lobs];
    const currentLob = updatedLobs[globalLobIndex];
    currentLob.sublobs[sublobIndex] = editingSubLOBText.trim();
    currentLob.sublobs.sort();
    
    updateInteractionConfig({
      ...interactionConfig,
      lobs: updatedLobs
    });
    setEditingSubLOBIndex(null);
    setEditingSubLOBText('');
  };

  const handleAddReason = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newReasonText.trim() || globalLobIndex === -1 || !activeSubLOB) return;
    const updatedLobs = [...interactionConfig.lobs];
    const currentLob = updatedLobs[globalLobIndex];
    
    if (!currentLob.sublobReasons) {
      currentLob.sublobReasons = {};
    }
    const subReasons = currentLob.sublobReasons[activeSubLOB] || [];
    if (subReasons.includes(newReasonText.trim())) {
      alert("This Reason for Call already exists under this Sub-LOB.");
      return;
    }
    
    const updatedSubReasons = [...subReasons, newReasonText.trim()].sort();
    currentLob.sublobReasons[activeSubLOB] = updatedSubReasons;
    
    // Maintain fallback flat database array in sync
    currentLob.reasons = Array.from(new Set([...(currentLob.reasons || []), newReasonText.trim()])).sort();
    
    updateInteractionConfig({
      ...interactionConfig,
      lobs: updatedLobs
    });
    setNewReasonText('');
  };

  const handleDeleteReason = (reasonIndex: number) => {
    if (globalLobIndex === -1 || !activeSubLOB) return;
    const reasonName = activeReasons[reasonIndex] || '';
    setDeleteConfig({
      type: 'reason',
      title: 'Delete Reason for Call',
      message: `Are you sure you want to delete "${reasonName}" from the Reasons list for sub-LOB "${activeSubLOB}"?`,
      targetValue: reasonIndex
    });
    setShowConfirmModal(true);
  };

  const handleSaveReason = (reasonIndex: number) => {
    if (!editingReasonText.trim() || globalLobIndex === -1 || !activeSubLOB) return;
    const updatedLobs = [...interactionConfig.lobs];
    const currentLob = updatedLobs[globalLobIndex];
    
    if (!currentLob.sublobReasons) {
      currentLob.sublobReasons = {};
    }
    const subReasons = [...(currentLob.sublobReasons[activeSubLOB] || [])];
    const oldVal = subReasons[reasonIndex];
    subReasons[reasonIndex] = editingReasonText.trim();
    subReasons.sort();
    currentLob.sublobReasons[activeSubLOB] = subReasons;
    
    // Update global list in sync
    currentLob.reasons = (currentLob.reasons || []).map(r => r === oldVal ? editingReasonText.trim() : r).sort();
    
    updateInteractionConfig({
      ...interactionConfig,
      lobs: updatedLobs
    });
    setEditingReasonIndex(null);
    setEditingReasonText('');
  };

  const confirmDelete = () => {
    if (!deleteConfig) return;
    const { type, targetValue } = deleteConfig;

    if (type === 'agent') {
      const updated = {
        ...interactionConfig,
        agents: interactionConfig.agents.filter(a => a !== targetValue)
      };
      updateInteractionConfig(updated);
    } else if (type === 'supervisor') {
      const updated = {
        ...interactionConfig,
        supervisors: interactionConfig.supervisors.filter(s => s !== targetValue)
      };
      updateInteractionConfig(updated);
    } else if (type === 'auditor') {
      const updated = {
        ...interactionConfig,
        auditors: interactionConfig.auditors.filter(a => a !== targetValue)
      };
      updateInteractionConfig(updated);
    } else if (type === 'lob') {
      const { index } = targetValue;
      const updatedLobs = interactionConfig.lobs.filter((_, i) => i !== index);
      const updated = {
        ...interactionConfig,
        lobs: updatedLobs
      };
      updateInteractionConfig(updated);
      setSelectedLobIndex(0);
    } else if (type === 'sublob') {
      const updatedLobs = [...interactionConfig.lobs];
      const currentLob = updatedLobs[globalLobIndex];
      if (currentLob) {
        const sublobToDelete = currentLob.sublobs[targetValue];
        currentLob.sublobs = currentLob.sublobs.filter((_, i) => i !== targetValue);
        
        // Clean up mappings for deleted sublob to save Space
        if (currentLob.sublobReasons) {
          delete currentLob.sublobReasons[sublobToDelete];
        }
        
        updateInteractionConfig({
          ...interactionConfig,
          lobs: updatedLobs
        });
      }
    } else if (type === 'reason') {
      const updatedLobs = [...interactionConfig.lobs];
      const currentLob = updatedLobs[globalLobIndex];
      if (currentLob && activeSubLOB) {
        if (!currentLob.sublobReasons) {
          currentLob.sublobReasons = {};
        }
        const subReasons = currentLob.sublobReasons[activeSubLOB] || [];
        const reasonNameToDelete = subReasons[targetValue];
        
        const updatedSubReasons = subReasons.filter((_, i) => i !== targetValue);
        currentLob.sublobReasons[activeSubLOB] = updatedSubReasons;
        
        // Remove from flat reasons list if no other sublob is still using it
        const stillUsed = Object.entries(currentLob.sublobReasons).some(([key, val]) => 
          key !== activeSubLOB && Array.isArray(val) && val.includes(reasonNameToDelete)
        );
        if (!stillUsed) {
          currentLob.reasons = (currentLob.reasons || []).filter(r => r !== reasonNameToDelete);
        }
        
        updateInteractionConfig({
          ...interactionConfig,
          lobs: updatedLobs
        });
      }
    }

    setShowConfirmModal(false);
    setDeleteConfig(null);
  };

  // Filter items based on search term
  const filteredAgents = useMemo(() => {
    return interactionConfig.agents.filter(a => 
      a.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [interactionConfig.agents, searchTerm]);

  const filteredSupervisors = useMemo(() => {
    return interactionConfig.supervisors.filter(s => 
      s.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [interactionConfig.supervisors, searchTerm]);

  const filteredAuditors = useMemo(() => {
    return interactionConfig.auditors.filter(a => 
      a.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [interactionConfig.auditors, searchTerm]);

  const lobsForType = useMemo(() => {
    return interactionConfig.lobs.filter(l => (l.businessType || 'Sales') === selectedBusinessType);
  }, [interactionConfig.lobs, selectedBusinessType]);

  const activeLOBPlan = lobsForType[selectedLobIndex] || lobsForType[0] || null;

  const globalLobIndex = useMemo(() => {
    if (!activeLOBPlan) return -1;
    return interactionConfig.lobs.findIndex(l => l.name === activeLOBPlan.name && (l.businessType || 'Sales') === selectedBusinessType);
  }, [interactionConfig.lobs, activeLOBPlan, selectedBusinessType]);

  const activeSubLOB = useMemo(() => {
    if (!activeLOBPlan) return '';
    if (activeLOBPlan.sublobs.includes(selectedSubLOB)) {
      return selectedSubLOB;
    }
    return activeLOBPlan.sublobs[0] || '';
  }, [activeLOBPlan, selectedSubLOB]);

  const activeReasons = useMemo(() => {
    if (!activeLOBPlan || !activeSubLOB) return [];
    
    // Ensure nested sublobReasons structure exists on local reference
    const sublobReasons = activeLOBPlan.sublobReasons || {};
    if (sublobReasons[activeSubLOB]) {
      return sublobReasons[activeSubLOB];
    }
    
    // Fallback to static mapping
    if (SUB_LOB_REASON_MAP[activeSubLOB]) {
      return SUB_LOB_REASON_MAP[activeSubLOB];
    }
    
    // Otherwise fallback to the entire LOB plan's flat reasons list
    return activeLOBPlan.reasons || [];
  }, [activeLOBPlan, activeSubLOB]);

  return (
    <div className="p-4 lg:p-8 space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Interaction Config</h1>
        <p className="text-gray-500 text-sm mt-1">
          Add, modify, or delete metadata options that populate the standard Audit Form dropdowns.
        </p>
      </div>

      {/* Navigation tabs */}
      <div className="flex bg-gray-100 p-1 rounded-xl w-fit">
        <button 
          onClick={() => { setActiveTab('agents'); setSearchTerm(''); setEditingIndex(null); }} 
          className={cn(
            "px-6 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2", 
            activeTab === 'agents' ? "bg-white text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-700"
          )}
        >
          <Users className="w-3.5 h-3.5" /> Agent Names
        </button>
        <button 
          onClick={() => { setActiveTab('supervisors'); setSearchTerm(''); setEditingIndex(null); }} 
          className={cn(
            "px-6 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2", 
            activeTab === 'supervisors' ? "bg-white text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-700"
          )}
        >
          <UserSquare2 className="w-3.5 h-3.5" /> Supervisors
        </button>
        <button 
          onClick={() => { setActiveTab('auditors'); setSearchTerm(''); setEditingIndex(null); }} 
          className={cn(
            "px-6 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2", 
            activeTab === 'auditors' ? "bg-white text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-700"
          )}
        >
          <ShieldCheck className="w-3.5 h-3.5" /> Quality Auditors
        </button>
        <button 
          onClick={() => { setActiveTab('lobs'); setSearchTerm(''); setEditingIndex(null); }} 
          className={cn(
            "px-6 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2", 
            activeTab === 'lobs' ? "bg-white text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-700"
          )}
        >
          <Grid className="w-3.5 h-3.5" /> LOBs & Reasons
        </button>
      </div>

      {/* Content wrapper */}
      <div className="space-y-6">
        {/* Search for Agents, Supervisors, Auditors */}
        {activeTab !== 'lobs' && (
          <div className="flex flex-col sm:flex-row items-center gap-4 bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input 
                type="text" 
                placeholder={`Search current list of ${activeTab}...`}
                className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-transparent rounded-xl text-sm focus:bg-white focus:border-blue-500 outline-none transition-all"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
            
            {/* Create Item form */}
            <form 
              onSubmit={
                activeTab === 'agents' ? handleAddAgent : 
                activeTab === 'supervisors' ? handleAddSupervisor : 
                handleAddAuditor
              }
              className="flex items-center gap-2 w-full sm:w-auto"
            >
              <input 
                type="text" 
                placeholder={`Add new ${activeTab.substring(0, activeTab.length - 1)}...`}
                className="flex-1 sm:w-64 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:bg-white focus:border-blue-500 transition-all"
                value={newItemText}
                onChange={e => setNewItemText(e.target.value)}
              />
              <button 
                type="submit"
                className="px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-all flex items-center justify-center shadow-md shadow-blue-200"
              >
                <Plus className="w-4 h-4" />
              </button>
            </form>
          </div>
        )}

        {/* Dynamic Lists Grid for AGENTS / SUPERVISORS / AUDITORS */}
        {activeTab === 'agents' && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden p-6">
            <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4">Agents List ({filteredAgents.length})</h3>
            {filteredAgents.length === 0 ? (
              <div className="text-center py-10 text-gray-400">
                <Users className="w-12 h-12 mx-auto stroke-1 mb-2 opacity-50" />
                No agents found matching "{searchTerm}"
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {filteredAgents.map((agent, i) => {
                  const rawIndex = interactionConfig.agents.indexOf(agent);
                  const isEditing = editingIndex === rawIndex;
                  return (
                    <div 
                      key={agent} 
                      className="flex items-center justify-between p-3 rounded-xl border border-gray-100 bg-gray-50/50 hover:bg-white hover:border-blue-100 hover:shadow-sm transition-all"
                    >
                      {isEditing ? (
                        <div className="flex items-center gap-1.5 flex-1">
                          <input 
                            type="text" 
                            className="w-full px-2 py-1 bg-white border border-blue-500 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-100"
                            value={editingText}
                            onChange={e => setEditingText(e.target.value)}
                            autoFocus
                          />
                          <button onClick={() => handleSaveAgent(rawIndex)} className="p-1 text-green-600 hover:bg-green-50 rounded" title="Save">
                            <Check className="w-4 h-4" />
                          </button>
                          <button onClick={() => setEditingIndex(null)} className="p-1 text-red-500 hover:bg-red-50 rounded" title="Cancel">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <>
                          <span className="text-sm font-medium text-gray-800 truncate">{agent}</span>
                          <div className="flex items-center gap-1">
                            <button 
                              onClick={() => handleEditAgent(rawIndex, agent)} 
                              className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                              title="Edit name"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button 
                              onClick={() => handleDeleteAgent(agent)} 
                              className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                              title="Delete"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* SUPERVISORS TAB */}
        {activeTab === 'supervisors' && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden p-6">
            <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4">Supervisors List ({filteredSupervisors.length})</h3>
            {filteredSupervisors.length === 0 ? (
              <div className="text-center py-10 text-gray-400">
                <UserSquare2 className="w-12 h-12 mx-auto stroke-1 mb-2 opacity-50" />
                No supervisors found matching "{searchTerm}"
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {filteredSupervisors.map((sup, i) => {
                  const rawIndex = interactionConfig.supervisors.indexOf(sup);
                  const isEditing = editingIndex === rawIndex;
                  return (
                    <div 
                      key={sup} 
                      className="flex items-center justify-between p-3 rounded-xl border border-gray-100 bg-gray-50/50 hover:bg-white hover:border-blue-100 hover:shadow-sm transition-all"
                    >
                      {isEditing ? (
                        <div className="flex items-center gap-1.5 flex-1">
                          <input 
                            type="text" 
                            className="w-full px-2 py-1 bg-white border border-blue-500 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-100"
                            value={editingText}
                            onChange={e => setEditingText(e.target.value)}
                            autoFocus
                          />
                          <button onClick={() => handleSaveSupervisor(rawIndex)} className="p-1 text-green-600 hover:bg-green-50 rounded" title="Save">
                            <Check className="w-4 h-4" />
                          </button>
                          <button onClick={() => setEditingIndex(null)} className="p-1 text-red-500 hover:bg-red-50 rounded" title="Cancel">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <>
                          <span className="text-sm font-medium text-gray-800 truncate">{sup}</span>
                          <div className="flex items-center gap-1">
                            <button 
                              onClick={() => { setEditingIndex(rawIndex); setEditingText(sup); }} 
                              className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                              title="Edit name"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button 
                              onClick={() => handleDeleteSupervisor(sup)} 
                              className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                              title="Delete"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* AUDITORS TAB */}
        {activeTab === 'auditors' && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden p-6">
            <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4">Quality Auditors List ({filteredAuditors.length})</h3>
            {filteredAuditors.length === 0 ? (
              <div className="text-center py-10 text-gray-400">
                <ShieldCheck className="w-12 h-12 mx-auto stroke-1 mb-2 opacity-50" />
                No auditors found matching "{searchTerm}"
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {filteredAuditors.map((aud, i) => {
                  const rawIndex = interactionConfig.auditors.indexOf(aud);
                  const isEditing = editingIndex === rawIndex;
                  return (
                    <div 
                      key={aud} 
                      className="flex items-center justify-between p-3 rounded-xl border border-gray-100 bg-gray-50/50 hover:bg-white hover:border-blue-100 hover:shadow-sm transition-all"
                    >
                      {isEditing ? (
                        <div className="flex items-center gap-1.5 flex-1">
                          <input 
                            type="text" 
                            className="w-full px-2 py-1 bg-white border border-blue-500 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-100"
                            value={editingText}
                            onChange={e => setEditingText(e.target.value)}
                            autoFocus
                          />
                          <button onClick={() => handleSaveAuditor(rawIndex)} className="p-1 text-green-600 hover:bg-green-50 rounded" title="Save">
                            <Check className="w-4 h-4" />
                          </button>
                          <button onClick={() => setEditingIndex(null)} className="p-1 text-red-500 hover:bg-red-50 rounded" title="Cancel">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <>
                          <span className="text-sm font-medium text-gray-800 truncate">{aud}</span>
                          <div className="flex items-center gap-1">
                            <button 
                              onClick={() => { setEditingIndex(rawIndex); setEditingText(aud); }} 
                              className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                              title="Edit name"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button 
                              onClick={() => handleDeleteAuditor(aud)} 
                              className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                              title="Delete"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* LOBS / SUB LOBS / REASONS FOR CALL TAB */}
        {activeTab === 'lobs' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Left Column: LOB Selection List */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Line of Business (LOB)</h3>
              </div>

              {/* Type Category Selection (Sales vs Support) */}
              <div className="flex bg-gray-100 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => { setSelectedBusinessType('Sales'); setSelectedLobIndex(0); }}
                  className={cn(
                    "flex-1 flex items-center justify-center py-2 rounded-lg text-xs font-bold transition-all",
                    selectedBusinessType === 'Sales' ? "bg-white text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-700"
                  )}
                >
                  Sales
                </button>
                <button
                  type="button"
                  onClick={() => { setSelectedBusinessType('Support'); setSelectedLobIndex(0); }}
                  className={cn(
                    "flex-1 flex items-center justify-center py-2 rounded-lg text-xs font-bold transition-all",
                    selectedBusinessType === 'Support' ? "bg-white text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-700"
                  )}
                >
                  Support
                </button>
              </div>

              {/* Add LOB form */}
              <form onSubmit={handleAddLOB} className="flex gap-2">
                <input 
                  type="text" 
                  placeholder={`Create LOB under ${selectedBusinessType}`}
                  className="flex-1 px-3 py-2 bg-gray-55/50 border border-gray-200 rounded-xl text-xs outline-none focus:bg-white focus:ring-2 focus:ring-blue-100"
                  value={newLOBName}
                  onChange={e => setNewLOBName(e.target.value)}
                />
                <button type="submit" className="p-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shrink-0 shadow-sm">
                  <Plus className="w-4 h-4" />
                </button>
              </form>

              {/* LOB list */}
              <div className="space-y-1.5 max-h-[400px] overflow-y-auto pr-1">
                {lobsForType.map((lob, idx) => {
                  const isEditingLob = editingLobIndex === idx;
                  const isActive = selectedLobIndex === idx;
                  return (
                    <div 
                      key={lob.name}
                      onClick={() => !isEditingLob && setSelectedLobIndex(idx)}
                      className={cn(
                        "flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer",
                        isActive 
                          ? "bg-blue-50/50 border-blue-200 text-blue-900 font-bold" 
                          : "bg-gray-50/30 border-gray-100 hover:bg-gray-50 hover:border-gray-200 text-gray-700"
                      )}
                    >
                      {isEditingLob ? (
                        <div className="flex items-center gap-1.5 flex-1 edit-lob-form">
                          <input 
                            type="text" 
                            className="w-full px-2 py-1 bg-white border border-blue-500 rounded-lg text-xs outline-none"
                            value={editingLobText}
                            onChange={e => setEditingLobText(e.target.value)}
                            onClick={e => e.stopPropagation()}
                            autoFocus
                          />
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleSaveLOBName(idx); }} 
                            className="p-1 text-green-600 hover:bg-green-50 rounded"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button 
                            onClick={(e) => { e.stopPropagation(); setEditingLobIndex(null); }} 
                            className="p-1 text-red-500 hover:bg-red-50 rounded"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <>
                          <span className="text-sm truncate">{lob.name}</span>
                          <div className="flex items-center gap-0.5" onClick={e => e.stopPropagation()}>
                            <button 
                              onClick={() => { setEditingLobIndex(idx); setEditingLobText(lob.name); }} 
                              className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                              title="Rename LOB"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button 
                              onClick={() => handleDeleteLOB(idx, lob.name)} 
                              className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                              title="Delete LOB"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right details panel (Sub-LOBs and Reasons for call) */}
            <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Box 1: Sub-LOB list */}
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
                <div className="border-b border-gray-100 pb-3">
                  <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">
                    {activeLOBPlan ? `Sub-LOBs for "${activeLOBPlan.name}"` : 'Select an LOB'}
                  </h3>
                </div>

                {activeLOBPlan ? (
                  <>
                    {/* Add SubLOB Form */}
                    <form onSubmit={handleAddSubLOB} className="flex gap-2">
                      <input 
                        type="text" 
                        placeholder="Add sub-LOB option..."
                        className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs outline-none focus:bg-white focus:ring-2 focus:ring-blue-100"
                        value={newSubLOBText}
                        onChange={e => setNewSubLOBText(e.target.value)}
                      />
                      <button type="submit" className="p-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm">
                        <Plus className="w-4 h-4" />
                      </button>
                    </form>

                    {/* SubLOB Table/List */}
                    <div className="space-y-1 max-h-[300px] overflow-y-auto pr-1">
                      {activeLOBPlan.sublobs.length === 0 ? (
                        <p className="text-xs text-gray-400 text-center py-6">No Sub-LOBs specified yet.</p>
                      ) : (
                        activeLOBPlan.sublobs.map((sub, sidx) => {
                          const isEditingSub = editingSubLOBIndex === sidx;
                          const isSubActive = sub === activeSubLOB;
                          return (
                            <div 
                              key={sub} 
                              onClick={() => !isEditingSub && setSelectedSubLOB(sub)}
                              className={cn(
                                "flex items-center justify-between p-2 rounded-xl border transition-all cursor-pointer",
                                isSubActive 
                                  ? "bg-blue-50/70 border-blue-200 text-blue-900 font-semibold" 
                                  : "bg-gray-50/50 border-transparent hover:bg-white hover:border-blue-100"
                              )}
                            >
                              {isEditingSub ? (
                                <div className="flex items-center gap-1.5 flex-1" onClick={e => e.stopPropagation()}>
                                  <input 
                                    type="text" 
                                    className="w-full px-2 py-0.5 bg-white border border-blue-500 rounded text-xs outline-none"
                                    value={editingSubLOBText}
                                    onChange={e => setEditingSubLOBText(e.target.value)}
                                    autoFocus
                                  />
                                  <button onClick={() => handleSaveSubLOB(sidx)} className="p-0.5 text-green-600 hover:bg-green-55 rounded">
                                    <Check className="w-3.5 h-3.5" />
                                  </button>
                                  <button onClick={() => setEditingSubLOBIndex(null)} className="p-0.5 text-red-500 hover:bg-red-55 rounded">
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              ) : (
                                <>
                                  <span className="text-xs text-gray-800 font-medium truncate">{sub}</span>
                                  <div className="flex items-center gap-0.5" onClick={e => e.stopPropagation()}>
                                    <button 
                                      onClick={() => { setEditingSubLOBIndex(sidx); setEditingSubLOBText(sub); }} 
                                      className="p-1 text-gray-400 hover:text-blue-600 rounded transition-colors"
                                      title="Edit"
                                    >
                                      <Edit2 className="w-3 h-3" />
                                    </button>
                                    <button 
                                      onClick={() => handleDeleteSubLOB(sidx)} 
                                      className="p-1 text-gray-400 hover:text-red-600 rounded transition-colors"
                                      title="Delete"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  </div>
                                </>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </>
                ) : (
                  <p className="text-xs text-gray-400 py-6 text-center">Add or select an LOB on the left to configure sub-LOB alternatives.</p>
                )}
              </div>

              {/* Box 2: Reason list */}
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
                <div className="border-b border-gray-100 pb-3">
                  <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">
                    {activeLOBPlan && activeSubLOB 
                      ? `${activeLOBPlan.name} > ${activeSubLOB} Reasons` 
                      : activeLOBPlan 
                        ? `Reasons for "${activeLOBPlan.name}"` 
                        : 'Select an LOB'}
                  </h3>
                </div>

                {activeLOBPlan ? (
                  <>
                    {/* Add Reason Form */}
                    <form onSubmit={handleAddReason} className="flex gap-2">
                      <input 
                        type="text" 
                        placeholder={activeSubLOB ? `Add reason for "${activeSubLOB}"...` : "Select a Sub-LOB first..."}
                        disabled={!activeSubLOB}
                        className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs outline-none focus:bg-white focus:ring-2 focus:ring-blue-100 disabled:opacity-50"
                        value={newReasonText}
                        onChange={e => setNewReasonText(e.target.value)}
                      />
                      <button 
                        type="submit" 
                        disabled={!activeSubLOB}
                        className="p-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm disabled:opacity-50"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </form>

                    {/* Reason Table/List */}
                    <div className="space-y-1 max-h-[300px] overflow-y-auto pr-1">
                      {!activeSubLOB ? (
                        <p className="text-xs text-gray-400 text-center py-6">Please select a Sub-LOB to manage its Reasons.</p>
                      ) : activeReasons.length === 0 ? (
                        <p className="text-xs text-gray-400 text-center py-6">No Reasons specified yet for this Sub-LOB.</p>
                      ) : (
                        activeReasons.map((reason, ridx) => {
                          const isEditingReason = editingReasonIndex === ridx;
                          return (
                            <div key={reason} className="flex items-center justify-between p-2 rounded-xl bg-gray-50/50 hover:bg-white border border-transparent hover:border-blue-100 transition-colors">
                              {isEditingReason ? (
                                <div className="flex items-center gap-1.5 flex-1">
                                  <input 
                                    type="text" 
                                    className="w-full px-2 py-0.5 bg-white border border-blue-500 rounded text-xs outline-none"
                                    value={editingReasonText}
                                    onChange={e => setEditingReasonText(e.target.value)}
                                    autoFocus
                                  />
                                  <button onClick={() => handleSaveReason(ridx)} className="p-0.5 text-green-600 hover:bg-green-55 rounded">
                                    <Check className="w-3.5 h-3.5" />
                                  </button>
                                  <button onClick={() => setEditingReasonIndex(null)} className="p-0.5 text-red-500 hover:bg-red-55 rounded">
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              ) : (
                                <>
                                  <span className="text-xs text-gray-800 font-medium truncate">{reason}</span>
                                  <div className="flex items-center gap-0.5">
                                    <button 
                                      onClick={() => { setEditingReasonIndex(ridx); setEditingReasonText(reason); }} 
                                      className="p-1 text-gray-400 hover:text-blue-600 rounded transition-colors"
                                      title="Edit"
                                    >
                                      <Edit2 className="w-3 h-3" />
                                    </button>
                                    <button 
                                      onClick={() => handleDeleteReason(ridx)} 
                                      className="p-1 text-gray-400 hover:text-red-600 rounded transition-colors"
                                      title="Delete"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  </div>
                                </>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </>
                ) : (
                  <p className="text-xs text-gray-400 py-6 text-center">Add or select an LOB on the left to configure reason listings.</p>
                )}
              </div>

            </div>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {showConfirmModal && deleteConfig && (
          <div className="fixed inset-0 z-55 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => { setShowConfirmModal(false); setDeleteConfig(null); }}
              className="absolute inset-0 bg-gray-950/60 backdrop-blur-sm"
            />
            
            {/* Modal Body */}
            <motion.div
              initial={{ scale: 0.95, y: 15, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.95, y: 15, opacity: 0 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              className="relative bg-white rounded-2xl border border-gray-100 shadow-2xl w-full max-w-md p-6 overflow-hidden mx-auto"
            >
              <div className="flex gap-4 items-start">
                <div className="p-3 bg-red-50 text-red-600 rounded-full shrink-0">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-base font-bold text-gray-900 tracking-tight">
                    {deleteConfig.title}
                  </h3>
                  <p className="text-sm text-gray-500 leading-relaxed font-normal">
                    {deleteConfig.message}
                  </p>
                </div>
              </div>
              
              {/* Actions Footer */}
              <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => { setShowConfirmModal(false); setDeleteConfig(null); }}
                  className="px-4 py-2 text-xs font-bold text-gray-500 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmDelete}
                  className="px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl transition-colors shadow-sm"
                >
                  Yes, Delete
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
