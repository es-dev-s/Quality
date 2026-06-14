import React, { useState } from 'react';
import { 
  Plus, 
  Copy, 
  Trash2, 
  Edit, 
  Check, 
  ChevronRight, 
  GripVertical,
  X,
  PlusCircle,
  FileBadge,
  Settings2,
  Save,
  ArrowLeft
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAudit } from '../contexts/AuditContext';
import { cn } from '../lib/utils';
import { AuditTemplate, Section, Parameter } from '../types';

export default function Templates() {
  const { templates, activeTemplate, setActiveTemplateById, saveTemplate, deleteTemplate, currentUser } = useAudit();
  const [editingTemplate, setEditingTemplate] = useState<AuditTemplate | null>(null);

  const canEdit = currentUser?.canEdit || currentUser?.role === 'Admin';
  const canCreate = currentUser?.canCreate || currentUser?.role === 'Admin';
  const canDelete = currentUser?.canDelete || currentUser?.role === 'Admin';

  const startEditing = (tpl: AuditTemplate) => {
    setEditingTemplate(JSON.parse(JSON.stringify(tpl))); // Deep copy
  };

  const createNewTemplate = () => {
    const newTpl: AuditTemplate = {
      id: `tpl-${Date.now()}`,
      name: 'New Custom Template',
      type: 'Call / Chat',
      lob: '',
      desc: '',
      isDefault: false,
      createdAt: new Date().toLocaleDateString(),
      sections: [
        { id: `s-${Date.now()}`, name: 'New Section', isFatal: false, params: [] }
      ]
    };
    setEditingTemplate(newTpl);
  };

  const handleSave = () => {
    if (editingTemplate) {
      saveTemplate(editingTemplate);
      setEditingTemplate(null);
    }
  };

  if (editingTemplate) {
    return <TemplateEditor 
      template={editingTemplate} 
      onChange={setEditingTemplate} 
      onSave={handleSave} 
      onCancel={() => setEditingTemplate(null)} 
    />;
  }

  return (
    <div className="p-4 lg:p-8 space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight text-center md:text-left">Audit Templates</h1>
          <p className="text-gray-500 text-sm mt-1 text-center md:text-left">Manage your scoring forms, parameters, and weighted sections.</p>
        </div>
        {canCreate && (
          <button 
            onClick={createNewTemplate}
            className="flex items-center justify-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-xl font-bold text-sm shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all"
          >
            <Plus className="w-5 h-5" />
            Create Template
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {templates.map((tpl) => {
           const isActive = tpl.id === activeTemplate.id;
           return (
             <div 
               key={tpl.id}
               className={cn(
                 "bg-white rounded-2xl border-2 transition-all p-6 flex flex-col h-full",
                 isActive ? "border-blue-600 ring-4 ring-blue-50 shadow-lg" : "border-gray-100 hover:border-gray-200"
               )}
             >
               <div className="flex justify-between items-start mb-4">
                 <div className={cn(
                   "p-2.5 rounded-xl",
                   isActive ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-400"
                 )}>
                   <Settings2 className="w-5 h-5" />
                 </div>
                 {tpl.isDefault && (
                   <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest bg-gray-50 px-2 py-0.5 rounded border border-gray-100">System Default</span>
                 )}
               </div>

               <div className="flex-1">
                  <h3 className="font-bold text-gray-900 leading-tight mb-1">{tpl.name}</h3>
                  <p className="text-xs text-gray-400 font-medium mb-4">{tpl.desc || 'No description provided.'}</p>
                  
                  <div className="flex flex-wrap gap-2 mb-6">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-600 border border-blue-100">{tpl.type}</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-600 border border-emerald-100">{tpl.sections.length} Sections</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-gray-50 text-gray-500 border border-gray-100">v1.2</span>
                  </div>
               </div>

               <div className="grid grid-cols-2 gap-2 mt-auto">
                 <button 
                   onClick={() => setActiveTemplateById(tpl.id)}
                   disabled={isActive}
                   className={cn(
                     "flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all border",
                     isActive 
                       ? "bg-blue-50 text-blue-600 border-blue-100 cursor-default" 
                       : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                   )}
                 >
                   {isActive ? <Check className="w-3.5 h-3.5" /> : null}
                   {isActive ? "Currently Active" : "Set Active"}
                 </button>
                 <div className="flex gap-1.5">
                   {canEdit && (
                     <button 
                       onClick={() => startEditing(tpl)}
                       className="flex-1 flex items-center justify-center p-2 bg-gray-50 text-gray-500 rounded-lg hover:bg-gray-100 transition-colors border border-gray-100"
                       title="Edit Template"
                     >
                       <Edit className="w-3.5 h-3.5" />
                     </button>
                   )}
                   {canDelete && !tpl.isDefault && (
                     <button 
                       onClick={() => deleteTemplate(tpl.id)}
                       className="flex-1 flex items-center justify-center p-2 bg-red-50 text-red-500 rounded-lg hover:bg-red-100 transition-colors border border-red-100"
                       title="Delete Template"
                     >
                       <Trash2 className="w-3.5 h-3.5" />
                     </button>
                   )}
                 </div>
               </div>
             </div>
           );
        })}
      </div>
    </div>
  );
}

function TemplateEditor({ 
  template, 
  onChange, 
  onSave, 
  onCancel 
}: { 
  template: AuditTemplate, 
  onChange: (t: AuditTemplate) => void, 
  onSave: () => void, 
  onCancel: () => void 
}) {
  
  const addSection = () => {
    const newSection: Section = {
      id: `s-${Date.now()}`,
      name: 'New Section',
      isFatal: false,
      params: []
    };
    onChange({ ...template, sections: [...template.sections, newSection] });
  };

  const updateSection = (sId: string, updates: Partial<Section>) => {
    const sections = template.sections.map(s => 
      s.id === sId ? { ...s, ...updates } : s
    );
    onChange({ ...template, sections });
  };

  const removeSection = (sId: string) => {
    onChange({ ...template, sections: template.sections.filter(s => s.id !== sId) });
  };

  const addParam = (sId: string) => {
    const newParam: Parameter = {
      id: `p-${Date.now()}`,
      name: 'New Parameter',
      max: 5,
      cat: template.sections.find(s => s.id === sId)?.name || '',
      scoring: 'Y/N/NA'
    };
    const sections = template.sections.map(s => 
      s.id === sId ? { ...s, params: [...s.params, newParam] } : s
    );
    onChange({ ...template, sections });
  };

  return (
    <div className="p-4 lg:p-8 max-w-5xl mx-auto space-y-8 pb-32">
       <div className="flex items-center justify-between">
          <button onClick={onCancel} className="flex items-center gap-2 text-sm font-bold text-gray-500 hover:text-gray-900 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back to Templates
          </button>
          <button 
            onClick={onSave}
            className="flex items-center gap-2 px-8 py-2.5 bg-blue-600 text-white rounded-xl font-bold text-sm shadow-xl shadow-blue-200/50 hover:bg-blue-700"
          >
            <Save className="w-5 h-5" /> Save Changes
          </button>
       </div>

       <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm flex flex-col md:flex-row gap-6">
          <div className="flex-1 space-y-4">
            <div className="space-y-1">
               <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1">Template Name</label>
               <input 
                 type="text"
                 className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-lg font-bold focus:bg-white focus:border-blue-500 outline-none transition-all"
                 value={template.name}
                 onChange={e => onChange({...template, name: e.target.value})}
               />
            </div>
            <div className="space-y-1">
               <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1">Description</label>
               <textarea 
                 rows={2}
                 className="w-full px-4 py-2 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:bg-white focus:border-blue-500 outline-none transition-all resize-none"
                 value={template.desc}
                 onChange={e => onChange({...template, desc: e.target.value})}
                 placeholder="Explain the purpose of this audit template..."
               />
            </div>
          </div>
          <div className="w-full md:w-64 space-y-4">
            <div className="space-y-1">
               <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1">Type</label>
               <select 
                 className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-sm font-bold focus:bg-white focus:border-blue-500 outline-none transition-all appearance-none"
                 value={template.type}
                 onChange={e => onChange({...template, type: e.target.value})}
                >
                  <option>Call</option>
                  <option>Chat</option>
                  <option>Call / Chat</option>
                  <option>Email</option>
               </select>
            </div>
            <div className="space-y-1">
               <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1">LOB Affiliation</label>
               <input 
                 type="text"
                 className="w-full px-4 py-2 bg-gray-50 border border-gray-100 rounded-xl text-sm font-bold focus:bg-white focus:border-blue-500 outline-none transition-all"
                 value={template.lob}
                 onChange={e => onChange({...template, lob: e.target.value})}
                 placeholder="e.g. Sales, CS"
               />
            </div>
          </div>
       </div>

       <div className="space-y-6">
          {template.sections.map((sec, sIdx) => (
            <div key={sec.id} className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
               <div className="bg-gray-50/50 px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                  <div className="flex items-center gap-4 flex-1">
                    <div className="cursor-grab text-gray-300">
                      <GripVertical className="w-4 h-4" />
                    </div>
                    <input 
                      type="text"
                      className="bg-transparent font-bold text-gray-900 border-b border-transparent hover:border-gray-300 focus:border-blue-500 outline-none transition-all py-0.5 flex-1 max-w-sm"
                      value={sec.name}
                      onChange={e => updateSection(sec.id, { name: e.target.value })}
                    />
                    <label className="flex items-center gap-2 cursor-pointer ml-4">
                       <input 
                         type="checkbox" 
                         className="w-3.5 h-3.5 rounded accent-red-500" 
                         checked={sec.isFatal}
                         onChange={e => updateSection(sec.id, { isFatal: e.target.checked })}
                       />
                       <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Fatal Section</span>
                    </label>
                  </div>
                  <button 
                    onClick={() => removeSection(sec.id)}
                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                  >
                    <X className="w-4 h-4" />
                  </button>
               </div>
               
               <div className="p-6">
                  {sec.params.length > 0 ? (
                    <div className="space-y-3">
                      {sec.params.map((p, pIdx) => (
                        <div key={p.id} className="flex flex-col md:flex-row items-center gap-3 p-3 bg-gray-50/30 border border-gray-100 rounded-xl group transition-all">
                           <div className="flex-1 w-full">
                              <input 
                                type="text"
                                className="w-full bg-transparent text-sm font-semibold text-gray-700 outline-none"
                                value={p.name}
                                onChange={e => {
                                   const params = [...sec.params];
                                   params[pIdx].name = e.target.value;
                                   updateSection(sec.id, { params });
                                }}
                              />
                           </div>
                           <div className="flex items-center gap-4 w-full md:w-auto">
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] font-bold text-gray-400 uppercase">Max:</span>
                                <input 
                                  type="number"
                                  className="w-12 px-2 py-1 bg-white border border-gray-200 rounded-lg text-xs font-bold text-center outline-none"
                                  value={p.max}
                                  onChange={e => {
                                    const params = [...sec.params];
                                    params[pIdx].max = parseInt(e.target.value) || 0;
                                    updateSection(sec.id, { params });
                                  }}
                                />
                              </div>
                              <select 
                                className="bg-white border border-gray-200 rounded-lg text-[10px] font-bold text-gray-600 px-2 py-1 outline-none"
                                value={p.scoring}
                                onChange={e => {
                                  const params = [...sec.params];
                                  params[pIdx].scoring = e.target.value as any;
                                  updateSection(sec.id, { params });
                                }}
                              >
                                <option value="Y/N/NA">Y / N / N/A</option>
                                <option value="Y/N/Fatal/NA">Y / N / Fatal / N/A</option>
                                <option value="EE/ME/BE/NA">EE / ME / BE</option>
                                <option value="Y/N-CMM">CMM Fatal</option>
                              </select>
                              <button 
                                onClick={() => {
                                  const params = sec.params.filter((_, i) => i !== pIdx);
                                  updateSection(sec.id, { params });
                                }}
                                className="p-1 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                           </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 border-2 border-dashed border-gray-100 rounded-2xl">
                       <p className="text-sm text-gray-400 font-medium">No parameters defined for this section yet</p>
                    </div>
                  )}

                  <button 
                    onClick={() => addParam(sec.id)}
                    className="mt-4 flex items-center gap-1.5 px-4 py-2 border border-blue-100 bg-blue-50/30 text-blue-600 rounded-xl text-xs font-bold hover:bg-blue-50 transition-colors"
                  >
                    <PlusCircle className="w-3.5 h-3.5" /> Add Parameter
                  </button>
               </div>
            </div>
          ))}

          <button 
            onClick={addSection}
            className="w-full flex flex-col items-center justify-center gap-2 py-12 border-2 border-dashed border-gray-200 rounded-3xl hover:border-blue-400 hover:bg-blue-50/20 transition-all group"
          >
             <div className="p-4 bg-gray-100 text-gray-400 rounded-full group-hover:bg-blue-200 group-hover:text-blue-600 transition-all">
               <Plus className="w-8 h-8" />
             </div>
             <span className="font-bold text-gray-400 group-hover:text-blue-700">Add New Scoping Section</span>
          </button>
       </div>
    </div>
  );
}
