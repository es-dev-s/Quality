import React, { useState, useEffect, useMemo } from 'react';
import { 
  Save, 
  Trash2, 
  RotateCcw, 
  Calculator, 
  Info,
  Calendar,
  User,
  Tags,
  Phone,
  MessageSquare,
  AlertOctagon,
  ChevronRight
} from 'lucide-react';
import { useAudit } from '../contexts/AuditContext';
import { cn } from '../lib/utils';
import { 
  DEFAULT_TEMPLATE,
  SUB_LOB_REASON_MAP
} from '../lib/constants';
import { AuditRecord, AuditRow } from '../types';

interface AuditFormProps {
  onScoreCalculated: (record: AuditRecord) => void;
  initialData?: AuditRecord | null;
}

export default function AuditForm({ onScoreCalculated, initialData }: AuditFormProps) {
  const { activeTemplate, templates, setActiveTemplateById, addAudit, users, currentUser, interactionConfig } = useAudit();
  
  // Interaction Details
  const [formData, setFormData] = useState({
    agent: '',
    supervisor: '',
    auditor: '',
    type: 'Call' as 'Call' | 'Chat',
    businessType: 'Sales' as 'Sales' | 'Support',
    callDate: new Date().toISOString().slice(0, 10),
    auditDate: new Date().toISOString().slice(0, 10),
    lob: '',
    sublob: '',
    mobile: '',
    reason: '',
    response: ''
  });

  useEffect(() => {
    if (!formData.auditor && users.length > 0) {
      setFormData(prev => ({ ...prev, auditor: users[0].name }));
    }
  }, [users, formData.auditor]);

  // Dynamic Score State
  const [scores, setScores] = useState<Record<string, string>>({});

  useEffect(() => {
    if (initialData) {
      setFormData({
        agent: initialData.agent,
        supervisor: initialData.supervisor,
        auditor: initialData.auditor,
        type: initialData.type,
        businessType: initialData.businessType || 'Sales',
        callDate: initialData.callDate,
        auditDate: initialData.auditDate,
        lob: initialData.lob,
        sublob: initialData.sublob,
        mobile: initialData.mobile || '',
        reason: initialData.reason,
        response: initialData.response
      });

      const initialScores: Record<string, string> = {};
      initialData.rows.forEach(r => {
        initialScores[r.id] = r.sel;
      });
      setScores(initialScores);
    }
  }, [initialData]);

  const selectableLOBs = useMemo(() => {
    return interactionConfig.lobs.filter(l => (l.businessType || 'Sales') === formData.businessType);
  }, [interactionConfig.lobs, formData.businessType]);

  const subLOBs = useMemo(() => {
    const matched = interactionConfig.lobs.find(l => l.name === formData.lob && (l.businessType || 'Sales') === formData.businessType);
    return matched ? matched.sublobs : [];
  }, [interactionConfig.lobs, formData.lob, formData.businessType]);

  const reasons = useMemo(() => {
    const matched = interactionConfig.lobs.find(l => l.name === formData.lob && (l.businessType || 'Sales') === formData.businessType);
    if (!matched || !formData.sublob) return [];
    
    if (matched.sublobReasons && matched.sublobReasons[formData.sublob]) {
      return matched.sublobReasons[formData.sublob];
    }
    
    if (SUB_LOB_REASON_MAP[formData.sublob]) {
      return SUB_LOB_REASON_MAP[formData.sublob];
    }
    
    return [];
  }, [interactionConfig.lobs, formData.lob, formData.sublob, formData.businessType]);

  const handleScoreChange = (paramId: string, value: string) => {
    setScores(prev => ({ ...prev, [paramId]: value }));
  };

  const calculateResults = () => {
    // Validation
    if (!formData.agent || !formData.lob) {
      alert("Please fill in Agent and LOB details.");
      return;
    }

    let totalScored = 0;
    let totalMax = 0;
    let hasFatal = false;
    const fatalList: string[] = [];
    const catScores: Record<string, { scored: number; max: number }> = {};
    const rows: AuditRow[] = [];

    activeTemplate.sections.forEach(sec => {
      sec.params.forEach(p => {
        const val = scores[p.id] || (sec.isFatal ? 'Y' : 'NA');
        
        if (sec.isFatal) {
          if (val === 'N' || val.includes('Non-compliance')) {
            hasFatal = true;
            fatalList.push(p.name);
          }
        } else {
          if (val === 'NA') return;
          
          if (val === 'Fatal') {
            hasFatal = true;
            fatalList.push(p.name);
            rows.push({
              id: p.id,
              cat: sec.name,
              name: p.name,
              max: p.max,
              sel: 'Fatal',
              score: 0,
              fatal: true,
              isScoringFatal: true
            });
            return;
          }

          let sc = parseFloat(val) || 0;
          
          // Semantic mappings if string
          if (isNaN(sc)) {
             if (val === 'EE') sc = p.max;
             else if (val === 'ME') sc = Math.ceil(p.max / 2);
             else if (val === 'BE') sc = 0;
             else if (val === 'Y') sc = p.max;
             else if (val === 'N') sc = 0;
          }

          totalScored += sc;
          totalMax += p.max;

          if (!catScores[sec.name]) catScores[sec.name] = { scored: 0, max: 0 };
          catScores[sec.name].scored += sc;
          catScores[sec.name].max += p.max;

          rows.push({
            id: p.id,
            cat: sec.name,
            name: p.name,
            max: p.max,
            sel: val,
            score: sc,
            fatal: false
          });
        }
      });
    });

    const qualityPct = totalMax > 0 ? Math.round((totalScored / totalMax) * 100) : 0;
    const finalPct = hasFatal ? 0 : qualityPct;
    
    const record: AuditRecord = {
      ...formData,
      id: initialData?.id || `AUD-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      savedAt: new Date().toLocaleDateString(),
      qualityPct,
      finalPct,
      grade: hasFatal ? 'Failed' : (qualityPct >= 90 ? 'Excellent' : qualityPct >= 75 ? 'Good' : 'Needs Improvement'),
      gc: hasFatal ? 'red' : (qualityPct >= 75 ? 'green' : 'amber'),
      qualityGrade: (qualityPct >= 90 ? 'Excellent' : qualityPct >= 75 ? 'Good' : 'Needs Improvement'),
      qualityGc: qualityPct >= 75 ? 'green' : 'amber',
      hasFatal,
      fatalList,
      feedbackStatus: initialData?.feedbackStatus || "Pending",
      totalScored,
      totalMax,
      catScores,
      rows
    };

    onScoreCalculated(record);
  };

  const getScoringOptions = (p: any) => {
    switch (p.scoring) {
      case 'Y/N/Fatal/NA':
        return [
          { label: `Y — ${p.max}`, value: String(p.max) },
          { label: 'N — 0', value: '0' },
          { label: 'Fatal', value: 'Fatal' },
          { label: 'N/A', value: 'NA' }
        ];
      case 'Y/N/NA':
        return [
          { label: `Y — ${p.max}`, value: String(p.max) },
          { label: 'N — 0', value: '0' },
          { label: 'N/A', value: 'NA' }
        ];
      case 'EE/ME/BE/NA':
        return [
          { label: `EE — ${p.max}`, value: 'EE' },
          { label: `ME — ${Math.ceil(p.max / 2)}`, value: 'ME' },
          { label: 'BE — 0', value: 'BE' },
          { label: 'N/A', value: 'NA' }
        ];
      case 'Y/N-CMM':
        return [
          { label: 'Y — Compliance', value: 'Y' },
          { label: 'N — Non-compliance', value: 'N' }
        ];
      default:
        return [{ label: 'N/A', value: 'NA' }];
    }
  };

  return (
    <div className="p-4 lg:p-8 max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Audit Form</h1>
          <div className="flex items-center gap-3 mt-1.5">
             <div className="flex items-center gap-2">
               <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Active Template:</span>
               <select 
                 value={activeTemplate.id}
                 onChange={(e) => setActiveTemplateById(e.target.value)}
                 className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-lg border border-blue-100 outline-none cursor-pointer hover:bg-blue-100 transition-colors"
               >
                 {templates.map(t => (
                   <option key={t.id} value={t.id}>{t.name}</option>
                 ))}
               </select>
             </div>
             <p className="text-gray-500 text-xs hidden md:block">Carefully select all parameters to generate a quality score.</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => setScores({})} 
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors shadow-sm"
          >
            <RotateCcw className="w-4 h-4" />
            Reset
          </button>
          <button 
            disabled={!((currentUser?.role === 'Admin') || (initialData ? currentUser?.canEdit : currentUser?.canCreate))}
            onClick={calculateResults}
            className="flex items-center gap-2 px-6 py-2 text-sm font-bold text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Calculator className="w-4 h-4" />
            {initialData ? 'Update Score' : 'Calculate Score'}
          </button>
        </div>
      </div>

      {/* Interaction Details Card */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden transition-all">
        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex items-center gap-2">
          <Info className="w-4 h-4 text-blue-600" />
          <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Interaction Details</h2>
        </div>
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
           <div className="space-y-1.5">
             <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest px-1">Agent Name</label>
             <div className="relative">
               <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
               <select 
                 className="w-full pl-10 pr-4 py-2.5 bg-gray-50/50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all appearance-none"
                 value={formData.agent}
                 onChange={e => setFormData({...formData, agent: e.target.value})}
               >
                 <option value="">Select Agent</option>
                 {interactionConfig.agents.map(a => <option key={a} value={a}>{a}</option>)}
               </select>
             </div>
           </div>

           <div className="space-y-1.5">
             <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest px-1">Supervisor Name</label>
             <select 
               className="w-full px-4 py-2.5 bg-gray-50/50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all appearance-none"
               value={formData.supervisor}
               onChange={e => setFormData({...formData, supervisor: e.target.value})}
             >
               <option value="">Select Supervisor</option>
               {interactionConfig.supervisors.map(s => <option key={s} value={s}>{s}</option>)}
             </select>
           </div>

           <div className="space-y-1.5">
             <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest px-1">Interaction Type</label>
             <div className="flex bg-gray-100 p-1 rounded-xl">
               <button 
                 onClick={() => setFormData({...formData, type: 'Call'})}
                 className={cn(
                   "flex-1 flex items-center justify-center gap-2 py-1.5 rounded-lg text-xs font-bold transition-all",
                   formData.type === 'Call' ? "bg-white text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-700"
                 )}
               >
                 <Phone className="w-3.5 h-3.5" /> Call
               </button>
               <button 
                 onClick={() => setFormData({...formData, type: 'Chat'})}
                 className={cn(
                   "flex-1 flex items-center justify-center gap-2 py-1.5 rounded-lg text-xs font-bold transition-all",
                   formData.type === 'Chat' ? "bg-white text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-700"
                 )}
               >
                 <MessageSquare className="w-3.5 h-3.5" /> Chat
               </button>
             </div>
           </div>

           <div className="space-y-1.5">
             <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest px-1">Type (Sales/Support)</label>
             <div className="flex bg-gray-100 p-1 rounded-xl">
               <button 
                 type="button"
                 onClick={() => setFormData({...formData, businessType: 'Sales', lob: '', sublob: '', reason: ''})}
                 className={cn(
                   "flex-1 flex items-center justify-center gap-2 py-1.5 rounded-lg text-xs font-bold transition-all",
                   formData.businessType === 'Sales' ? "bg-white text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-700"
                 )}
               >
                 Sales
               </button>
               <button 
                 type="button"
                 onClick={() => setFormData({...formData, businessType: 'Support', lob: '', sublob: '', reason: ''})}
                 className={cn(
                   "flex-1 flex items-center justify-center gap-2 py-1.5 rounded-lg text-xs font-bold transition-all",
                   formData.businessType === 'Support' ? "bg-white text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-700"
                 )}
               >
                 Support
               </button>
             </div>
           </div>

           <div className="space-y-1.5">
             <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest px-1">Call Date</label>
             <div className="relative">
               <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
               <input 
                 type="date" 
                 className="w-full pl-10 pr-4 py-2.5 bg-gray-50/50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                 value={formData.callDate}
                 onChange={e => setFormData({...formData, callDate: e.target.value})}
               />
             </div>
           </div>

           <div className="space-y-1.5">
             <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest px-1">Audit Date</label>
             <div className="relative">
               <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
               <input 
                 type="date" 
                 className="w-full pl-10 pr-4 py-2.5 bg-gray-50/50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                 value={formData.auditDate}
                 onChange={e => setFormData({...formData, auditDate: e.target.value})}
               />
             </div>
           </div>

           <div className="space-y-1.5">
             <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest px-1">Quality Auditor</label>
             <div className="relative">
               <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
               <select 
                 className="w-full pl-10 pr-4 py-2.5 bg-gray-50/50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all appearance-none"
                 value={formData.auditor}
                 onChange={e => setFormData({...formData, auditor: e.target.value})}
               >
                 <option value="">Select Auditor</option>
                 {users.length > 0 ? (
                   users.map(u => <option key={u.uid} value={u.name}>{u.name}</option>)
                 ) : (
                   interactionConfig.auditors.map(a => <option key={a} value={a}>{a}</option>)
                 )}
               </select>
             </div>
           </div>

           <div className="space-y-1.5">
             <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest px-1">LOB</label>
             <div className="relative">
               <Tags className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
               <select 
                 className="w-full pl-10 pr-4 py-2.5 bg-gray-50/50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all appearance-none"
                 value={formData.lob}
                 onChange={e => setFormData({...formData, lob: e.target.value, sublob: '', reason: ''})}
               >
                 <option value="">Select LOB</option>
                 {selectableLOBs.map(lob => (
                   <option key={lob.name} value={lob.name}>{lob.name}</option>
                 ))}
               </select>
             </div>
           </div>

           <div className="space-y-1.5">
             <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest px-1">Sub-LOB</label>
             <select 
               className="w-full px-4 py-2.5 bg-gray-50/50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all appearance-none disabled:opacity-50"
               disabled={!formData.lob}
               value={formData.sublob}
               onChange={e => setFormData({...formData, sublob: e.target.value})}
             >
               <option value="">Select Sub-LOB</option>
               {subLOBs.map(s => <option key={s} value={s}>{s}</option>)}
             </select>
           </div>

           <div className="lg:col-span-2 space-y-1.5">
             <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest px-1">Mobile Number</label>
             <input 
               type="text" 
               placeholder="Phone number or CRM URL"
               className="w-full px-4 py-2.5 bg-gray-50/50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
               value={formData.mobile}
               onChange={e => setFormData({...formData, mobile: e.target.value})}
             />
           </div>

           <div className="space-y-1.5">
             <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest px-1">Reason for Call</label>
             <select 
               className="w-full px-4 py-2.5 bg-gray-50/50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all appearance-none disabled:opacity-50"
               disabled={!formData.sublob}
                value={formData.reason}
               onChange={e => setFormData({...formData, reason: e.target.value})}
             >
               <option value="">Select Reason</option>
               {reasons.map(r => <option key={r} value={r}>{r}</option>)}
             </select>
           </div>

           <div className="md:col-span-2 lg:col-span-3 space-y-1.5">
             <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest px-1">Agent's Response</label>
             <textarea 
               rows={2}
               placeholder="Briefly describe the outcome..."
               className="w-full px-4 py-3 bg-gray-50/50 border border-gray-200 rounded-2xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all resize-none"
               value={formData.response}
               onChange={e => setFormData({...formData, response: e.target.value})}
             />
           </div>
        </div>
      </div>

      {/* Dynamic Sections Loop */}
      <div className="space-y-6">
        {activeTemplate.sections.map((sec) => (
          <div key={sec.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden transition-all">
            <div className={cn(
              "px-6 py-4 border-b border-gray-100 flex items-center justify-between",
              sec.isFatal ? "bg-red-50/50" : "bg-gray-50/50"
            )}>
              <div className="flex items-center gap-2">
                {sec.isFatal ? (
                  <AlertOctagon className="w-4 h-4 text-red-600" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                )}
                <h2 className={cn(
                  "text-sm font-bold uppercase tracking-wider",
                  sec.isFatal ? "text-red-900" : "text-gray-900"
                )}>
                  {sec.name}
                </h2>
              </div>
              {!sec.isFatal && (
                <span className="text-[10px] font-bold text-gray-400 bg-white px-2 py-0.5 rounded-full border border-gray-100">
                  MAX: {sec.params.reduce((s, p) => s + p.max, 0)} PTS
                </span>
              )}
            </div>
            
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {sec.params.map((p) => {
                const options = getScoringOptions(p);
                return (
                  <div key={p.id} className="space-y-1.5">
                    <label className="text-xs font-semibold text-gray-700 block min-h-[32px] leading-tight">
                      {p.name} {p.max > 0 && <span className="text-gray-400 font-medium">(max {p.max})</span>}
                    </label>
                    <select 
                      className={cn(
                        "w-full px-3 py-2 border rounded-xl text-xs font-medium outline-none transition-all appearance-none",
                        scores[p.id] === 'Fatal' || scores[p.id] === 'N' || scores[p.id] === 'BE' 
                          ? "bg-red-50 border-red-200 text-red-700" 
                          : scores[p.id] === 'EE' || scores[p.id] === String(p.max) || scores[p.id] === 'Y'
                          ? "bg-green-50 border-green-200 text-green-700"
                          : "bg-gray-50/30 border-gray-200 text-gray-600 focus:border-blue-500"
                      )}
                      value={scores[p.id] || (sec.isFatal ? 'Y' : 'NA')}
                      onChange={e => handleScoreChange(p.id, e.target.value)}
                    >
                      {options.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="pt-4 flex justify-center">
         <button 
           disabled={!((currentUser?.role === 'Admin') || (initialData ? currentUser?.canEdit : currentUser?.canCreate))}
           onClick={calculateResults}
           className="group relative flex items-center gap-3 px-12 py-4 text-lg font-bold text-white bg-blue-600 rounded-2xl hover:bg-blue-700 transition-all shadow-xl hover:shadow-blue-200/50 disabled:opacity-50 disabled:cursor-not-allowed"
         >
           <Calculator className="w-6 h-6 animate-pulse" />
           Generate Quality Output
         </button>
      </div>
    </div>
  );
}
