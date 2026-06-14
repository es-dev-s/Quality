import React, { useMemo } from 'react';
import { 
  ArrowLeft, 
  Save, 
  FileDown, 
  Printer, 
  AlertTriangle,
  CheckCircle2,
  Trophy,
  ArrowRight,
  TrendingDown,
  History as HistoryIcon,
  Award,
  Info
} from 'lucide-react';
import { motion } from 'motion/react';
import { AuditRecord } from '../types';
import { cn, getScoreColor, getGrade, getBadgeClass } from '../lib/utils';
import { useAudit } from '../contexts/AuditContext';

interface ScoreOutputProps {
  data: AuditRecord;
  onBack: () => void;
  onSave: () => void;
  isSaving?: boolean;
}

export default function ScoreOutput({ data, onBack, onSave, isSaving }: ScoreOutputProps) {
  const { auditHistory, currentUser } = useAudit();
  
  const canSave = currentUser?.role === 'Admin' || (data.id.toString().startsWith('AUD-IMPORT') ? currentUser?.canCreate : currentUser?.canEdit || currentUser?.canCreate);
  // Actually simpler: if they reached the score output from a form, they already passed the Form's disabled check.
  // But let's be safe.
  const hasPermission = currentUser?.role === 'Admin' || currentUser?.canEdit || currentUser?.canCreate;
  
  const scoreAnimation = {
    initial: { scale: 0.8, opacity: 0 },
    animate: { scale: 1, opacity: 1 },
    transition: { type: "spring", stiffness: 260, damping: 20 }
  };

  return (
    <div className="p-4 lg:p-8 max-w-6xl mx-auto space-y-8 pb-32">
      <div className="flex items-center justify-between">
        <button 
          onClick={onBack}
          className="flex items-center gap-2 text-sm font-semibold text-gray-500 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Edit Form
        </button>
        <div className="flex gap-2">
            <button className="p-2 text-gray-500 hover:bg-gray-100 rounded-xl transition-colors border border-gray-200 bg-white">
              <Printer className="w-4 h-4" />
            </button>
            <button className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors shadow-sm">
              <FileDown className="w-4 h-4" />
              Export
            </button>
            <button 
              onClick={onSave}
              disabled={isSaving || !hasPermission}
              className="flex items-center gap-2 px-6 py-2 text-sm font-bold text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {isSaving ? "Saving..." : "Save to History"}
            </button>
        </div>
      </div>

      {/* Fatal Alert */}
      {data.hasFatal && (
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-red-50 border-l-4 border-red-500 p-6 rounded-2xl flex items-start gap-4"
        >
          <div className="bg-red-100 p-2 rounded-xl text-red-600">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-red-900 font-bold text-lg">Critical Error: Audit FAILED</h3>
            <p className="text-red-700 text-sm mt-1">
              Final score overridden to 0% due to the following fatal errors: 
              <span className="font-bold ml-1">{data.fatalList.join(", ")}</span>.
            </p>
          </div>
        </motion.div>
      )}

      {/* Main Score Board */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <motion.div {...scoreAnimation} className="bg-white p-8 rounded-3xl border border-gray-200 shadow-xl shadow-gray-200/50 text-center relative overflow-hidden">
             {/* Decorative Background */}
             <div className={cn(
               "absolute top-0 left-0 w-full h-2",
               data.hasFatal ? "bg-red-500" : data.finalPct >= 75 ? "bg-green-500" : "bg-amber-500"
             )} />
             
             <p className="text-xs font-bold text-gray-400 uppercase tracking-[0.2em] mb-4">Final Score</p>
             <div className={cn(
               "text-7xl lg:text-8xl font-black tracking-tighter mb-4",
               data.hasFatal ? "text-red-600" : data.finalPct >= 90 ? "text-green-600" : data.finalPct >= 75 ? "text-green-500" : "text-amber-500"
             )}>
               {data.hasFatal ? "FAIL" : `${data.finalPct}%`}
             </div>
             
             <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-gray-50 border border-gray-100 mb-6">
                {data.finalPct >= 75 && !data.hasFatal ? (
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                ) : (
                  <TrendingDown className="w-4 h-4 text-amber-600" />
                )}
                <span className="text-sm font-bold text-gray-700 italic">{data.grade}</span>
             </div>

             <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden mb-2">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${data.hasFatal ? 0 : data.finalPct}%` }}
                  transition={{ delay: 0.5, duration: 1 }}
                  className={cn(
                    "h-full rounded-full",
                    data.finalPct >= 75 ? "bg-green-500" : "bg-amber-500"
                  )}
                />
             </div>
             <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-loose">
               Total: {data.totalScored} / {data.totalMax} Points
             </p>
          </motion.div>

          <div className="bg-blue-600 p-6 rounded-3xl text-white shadow-xl shadow-blue-200/50 relative overflow-hidden">
             <Trophy className="absolute -bottom-4 -right-4 w-32 h-32 text-blue-500/30 rotate-12" />
             <div className="relative z-10">
                <p className="text-[10px] font-bold text-blue-100 uppercase tracking-[0.2em] mb-2 text-center">Quality Performance</p>
                <div className="text-4xl font-black text-center mb-4">{data.qualityPct}%</div>
                <div className="space-y-3">
                  <div className="flex justify-between text-xs font-semibold px-2">
                    <span className="opacity-80">Excl. Fatal Overrides</span>
                    <Award className="w-3.5 h-3.5" />
                  </div>
                  <div className="h-1.5 bg-blue-700/50 rounded-full overflow-hidden">
                    <div className="h-full bg-white rounded-full" style={{ width: `${data.qualityPct}%` }} />
                  </div>
                </div>
                <p className="text-[10px] text-blue-100 mt-4 italic text-center font-medium leading-relaxed"> This represents the agent's behavioral skills performance independent of critical compliance outcome. </p>
             </div>
          </div>
        </div>

        <div className="lg:col-span-3 space-y-6">
           <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
             <h3 className="text-xs font-bold text-gray-400 uppercase tracking-[0.15em] mb-4 flex items-center gap-2">
               <Info className="w-3.5 h-3.5" /> 
               Assessment Summary
             </h3>
             <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-y-4 gap-x-8">
                {[
                  { label: "Agent Name", val: data.agent },
                  { label: "Supervisor Name", val: data.supervisor },
                  { label: "Call Date", val: data.callDate },
                  { label: "Audit Date", val: data.auditDate },
                  { label: "Interaction Type", val: data.type },
                  { label: "LOB", val: data.lob },
                  { label: "Sub-LOB", val: data.sublob },
                  { label: "Mobile Number", val: data.mobile },
                  { label: "Reason for Call", val: data.reason },
                  { label: "Agent's Response", val: data.response },
                  { label: "Quality Auditor", val: data.auditor },
                  { label: "Feedback Status", val: data.feedbackStatus || 'Pending' }
                ].filter(i => i.val).map(item => (
                  <div key={item.label}>
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">{item.label}</p>
                    <p className="text-sm font-bold text-gray-900 truncate">{item.val}</p>
                  </div>
                ))}
             </div>
           </div>

           <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
                <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider">Category Breakdown</h3>
              </div>
              <div className="divide-y divide-gray-100">
                 {Object.entries(data.catScores).map(([cat, score]) => {
                   const pct = Math.round((score.scored / score.max) * 100);
                   return (
                     <div key={cat} className="px-6 py-4 flex items-center justify-between group hover:bg-gray-50 transition-colors">
                        <div className="space-y-1">
                          <p className="text-sm font-bold text-gray-900 leading-none">{cat}</p>
                          <p className="text-[10px] text-gray-400 font-medium">{score.scored} / {score.max} pts scored</p>
                        </div>
                        <div className="text-right space-y-1">
                           <p className={cn("text-sm font-black", getScoreColor(pct, false))}>{pct}%</p>
                           <div className="w-20 lg:w-32 h-1 bg-gray-100 rounded-full overflow-hidden">
                              <div className={cn("h-full rounded-full", pct >= 75 ? "bg-emerald-500" : pct >= 60 ? "bg-amber-500" : "bg-red-500")} style={{ width: `${pct}%` }} />
                           </div>
                        </div>
                     </div>
                   );
                 })}
              </div>
           </div>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden mb-12">
        <div className="px-8 py-5 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-bold text-gray-900">Parameter level breakdown</h3>
          <div className="flex gap-4">
             <span className="flex items-center gap-1.5 text-[10px] font-bold text-green-600 uppercase italic"><CheckCircle2 className="w-3 h-3" /> Met</span>
             <span className="flex items-center gap-1.5 text-[10px] font-bold text-amber-600 uppercase italic"><TrendingDown className="w-3 h-3" /> Area for Imp</span>
             <span className="flex items-center gap-1.5 text-[10px] font-bold text-red-600 uppercase italic"><AlertTriangle className="w-3 h-3" /> Fatal/Not Met</span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
             <thead className="bg-gray-50/50 text-[10px] font-bold text-gray-400 uppercase tracking-widest border-b border-gray-100">
               <tr>
                 <th className="px-8 py-4">Category / Parameter</th>
                 <th className="px-4 py-4 text-center">Selection</th>
                 <th className="px-4 py-4 text-center">Score</th>
                 <th className="px-4 py-4 text-center">Status</th>
               </tr>
             </thead>
             <tbody className="divide-y divide-gray-50 text-sm">
                {data.rows.map((r, i) => (
                  <tr key={i} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-8 py-4">
                      <p className="text-[10px] text-gray-400 font-bold leading-none mb-1">{r.cat}</p>
                      <p className="font-bold text-gray-800">{r.name}</p>
                    </td>
                    <td className="px-4 py-4 text-center">
                       <span className="px-3 py-1 rounded-lg bg-gray-100 text-gray-600 text-[11px] font-bold">
                         {r.sel}
                       </span>
                    </td>
                    <td className="px-4 py-4 text-center">
                       <span className={cn(
                         "text-sm font-black",
                         r.fatal ? "text-red-600" : r.score === r.max ? "text-green-600" : "text-amber-600"
                       )}>
                         {r.fatal ? "FATAL" : `${r.score}/${r.max}`}
                       </span>
                    </td>
                    <td className="px-4 py-4 text-center flex justify-center">
                       <div className={cn(
                         "w-2.5 h-2.5 rounded-full shadow-sm",
                         r.fatal || r.score === 0 ? "bg-red-500" : r.score === r.max ? "bg-emerald-500" : "bg-amber-400"
                       )} />
                    </td>
                  </tr>
                ))}
             </tbody>
          </table>
        </div>
      </div>

      <div className="fixed bottom-0 inset-x-0 bg-white/80 backdrop-blur-md border-t border-gray-100 p-4 lg:hidden z-50">
          <button 
            onClick={onSave}
            disabled={isSaving || !hasPermission}
            className="w-full flex items-center justify-center gap-2 py-4 text-lg font-bold text-white bg-blue-600 rounded-2xl hover:bg-blue-700 transition-all shadow-xl shadow-blue-200 disabled:opacity-50"
          >
            <HistoryIcon className="w-5 h-5" />
            {isSaving ? "Saving..." : "Commit Audit to History"}
          </button>
      </div>
    </div>
  );
}
