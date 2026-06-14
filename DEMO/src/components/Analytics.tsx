import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from 'recharts';
import { 
  TrendingUp, Award, AlertTriangle, Info, Layout
} from 'lucide-react';
import { useAudit } from '../contexts/AuditContext';
import { cn } from '../lib/utils';

export default function Analytics() {
  const { auditHistory } = useAudit();
  const [view, setView] = useState<'overview' | 'params' | 'agents' | 'supervisors' | 'auditors' | 'reasons'>('overview');

  const stats = useMemo(() => {
    const categories = {
      agents: {} as Record<string, any>,
      supervisors: {} as Record<string, any>,
      auditors: {} as Record<string, any>,
      reasons: {} as Record<string, any>
    };

    const initEntry = () => ({ q: [] as number[], f: [] as number[], fatals: 0, count: 0, fatalDetails: [] as string[] });

    auditHistory.forEach(a => {
      const keys = [
        { cat: 'agents', val: a.agent },
        { cat: 'supervisors', val: a.supervisor || 'Unassigned' },
        { cat: 'auditors', val: a.auditor },
        { cat: 'reasons', val: a.reason || 'Not Specified' }
      ];

      keys.forEach(({ cat, val }) => {
        if (!categories[cat as keyof typeof categories][val]) {
          categories[cat as keyof typeof categories][val] = initEntry();
        }
        const entry = categories[cat as keyof typeof categories][val];
        entry.q.push(a.qualityPct);
        entry.f.push(a.finalPct);
        entry.count++;
        if (a.hasFatal) {
          entry.fatals++;
          entry.fatalDetails.push(...a.fatalList);
        }
      });
    });

    const process = (obj: Record<string, any>) => {
      return Object.entries(obj)
        .map(([name, v]) => ({
          name,
          quality: Math.round(v.q.reduce((s: number, x: number) => s + x, 0) / (v.q.length || 1)),
          final: Math.round(v.f.reduce((s: number, x: number) => s + x, 0) / (v.f.length || 1)),
          fatals: v.fatals,
          fatalRate: Math.round((v.fatals / v.count) * 100),
          count: v.count,
          fatalDetails: [...new Set(v.fatalDetails)] as string[]
        }))
        .sort((a, b) => b.quality - a.quality);
    };

    return {
      agents: process(categories.agents),
      supervisors: process(categories.supervisors),
      auditors: process(categories.auditors),
      reasons: process(categories.reasons)
    };
  }, [auditHistory]);

  const paramAnalysis = useMemo(() => {
    const totals: Record<string, { scored: number; max: number; cat: string }> = {};
    auditHistory.forEach(a => {
      a.rows.forEach(r => {
        if (r.max === 0) return;
        if (!totals[r.name]) totals[r.name] = { scored: 0, max: 0, cat: r.cat };
        totals[r.name].scored += r.score;
        totals[r.name].max += r.max;
      });
    });

    return Object.entries(totals)
      .map(([name, v]) => ({
        name,
        cat: v.cat,
        pct: Math.round((v.scored / v.max) * 100)
      }))
      .sort((a, b) => a.pct - b.pct);
  }, [auditHistory]);

  const topAreas = paramAnalysis.slice(0, 5);
  const strongAreas = [...paramAnalysis].reverse().slice(0, 5);

  const renderLeaderboard = (data: any[], title: string) => (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/30 flex items-center justify-between">
        <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2 uppercase tracking-widest">
          <Award className="w-4 h-4 text-blue-600" /> {title} Rankings
        </h2>
        <div className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">Sorted by Quality Score</div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead className="bg-gray-50 text-[10px] uppercase font-bold text-gray-400 border-b border-gray-100">
            <tr>
              <th className="px-6 py-3">Rank</th>
              <th className="px-6 py-3">Name</th>
              <th className="px-6 py-3 text-center">Avg Quality</th>
              <th className="px-6 py-3 text-center">Fatal Rate</th>
              <th className="px-6 py-3 text-center">Fatal Volume</th>
              <th className="px-6 py-3 text-center">Audits</th>
              <th className="px-6 py-3">Top Fatal Reasons</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {data.map((item, i) => (
              <tr key={i} className="hover:bg-blue-50/5 text-sm transition-colors">
                <td className="px-6 py-4 font-bold text-gray-400">#{(i+1).toString().padStart(2, '0')}</td>
                <td className="px-6 py-4 font-bold text-gray-900">{item.name}</td>
                <td className="px-6 py-4 text-center font-black text-blue-600">{item.final}%</td>
                <td className={cn(
                  "px-6 py-4 text-center font-bold",
                  item.fatalRate > 10 ? "text-red-600" : "text-gray-600"
                )}>
                  {item.fatalRate}%
                </td>
                <td className="px-6 py-4 text-center font-medium text-red-500 bg-red-50/30">{item.fatals}</td>
                <td className="px-6 py-4 text-center font-medium text-gray-400">{item.count}</td>
                <td className="px-6 py-4">
                  <div className="flex flex-wrap gap-1">
                    {item.fatalDetails.length > 0 ? (
                      item.fatalDetails.slice(0, 2).map((fd: string, idx: number) => (
                        <span key={idx} className="text-[9px] bg-red-50 text-red-700 px-1.5 py-0.5 rounded border border-red-100 font-medium">
                          {fd}
                        </span>
                      ))
                    ) : (
                      <span className="text-[10px] text-gray-300">Clean Records</span>
                    )}
                    {item.fatalDetails.length > 2 && <span className="text-[9px] text-gray-400 font-bold">+{item.fatalDetails.length - 2}</span>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div className="p-4 lg:p-8 space-y-8 max-w-7xl mx-auto pb-20">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Quality Analytics Dashboard</h1>
          <p className="text-gray-500 text-sm mt-1 font-medium">Performance insights and fatal drill-downs across various criteria.</p>
        </div>
        <div className="flex bg-gray-100/80 p-1.5 rounded-2xl border border-gray-200">
           {(['overview', 'params', 'agents', 'supervisors', 'auditors', 'reasons'] as const).map(v => (
             <button 
               key={v}
               onClick={() => setView(v)}
               className={cn(
                 "px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                 view === v ? "bg-white text-blue-600 shadow-md ring-1 ring-black/5" : "text-gray-400 hover:text-gray-600"
               )}
             >
               {v}
             </button>
           ))}
        </div>
      </div>

      <AnimatePresence mode="wait">
        {view === 'overview' && (
          <motion.div 
            key="overview"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="grid grid-cols-1 lg:grid-cols-2 gap-8"
          >
             <div className="bg-white p-8 rounded-3xl border border-gray-200 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-red-50 rounded-bl-full opacity-50" />
                <div className="flex items-center gap-3 mb-8">
                  <div className="p-2.5 bg-red-100 rounded-2xl text-red-600 shadow-sm">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <div>
                     <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest leading-none">Parameter Drill-down</h3>
                     <p className="text-[10px] text-red-400 font-bold mt-1">Bottom 5 performing categories</p>
                  </div>
                </div>
                <div className="space-y-6">
                   {topAreas.length > 0 ? topAreas.map(p => (
                     <div key={p.name} className="group cursor-help">
                       <div className="flex justify-between text-xs mb-2">
                         <span className="font-bold text-gray-700">{p.name} <span className="text-[10px] text-gray-400 font-medium ml-1">[{p.cat}]</span></span>
                         <span className={cn("font-black", p.pct < 50 ? "text-red-600" : "text-amber-600")}>{p.pct}%</span>
                       </div>
                       <div className="h-2.5 bg-gray-50 rounded-full overflow-hidden border border-gray-100 shadow-inner">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${p.pct}%` }}
                            transition={{ duration: 1, ease: "circOut" }}
                            className={cn("h-full rounded-full transition-all shadow-sm", p.pct < 50 ? "bg-red-500" : "bg-amber-500")} 
                          />
                       </div>
                     </div>
                   )) : (
                     <div className="text-center py-8 text-gray-400 italic text-xs">No parameter-level details available</div>
                   )}
                </div>
             </div>

             <div className="bg-white p-8 rounded-3xl border border-gray-200 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-green-50 rounded-bl-full opacity-50" />
                <div className="flex items-center gap-3 mb-8">
                  <div className="p-2.5 bg-green-100 rounded-2xl text-green-600 shadow-sm">
                    <TrendingUp className="w-5 h-5" />
                  </div>
                  <div>
                     <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest leading-none">Excellence Zone</h3>
                     <p className="text-[10px] text-green-400 font-bold mt-1">Top performing compliance parameters</p>
                  </div>
                </div>
                <div className="space-y-6">
                   {strongAreas.length > 0 ? strongAreas.map(p => (
                     <div key={p.name} className="group">
                       <div className="flex justify-between text-xs mb-2">
                         <span className="font-bold text-gray-700">{p.name}</span>
                         <span className="font-black text-green-600">{p.pct}%</span>
                       </div>
                       <div className="h-2.5 bg-gray-50 rounded-full overflow-hidden border border-gray-100 shadow-inner">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${p.pct}%` }}
                            transition={{ duration: 1, ease: "circOut" }}
                            className="h-full bg-emerald-500 rounded-full shadow-sm" 
                          />
                       </div>
                     </div>
                   )) : (
                     <div className="text-center py-8 text-gray-400 italic text-xs">No parameter-level details available</div>
                   )}
                </div>
             </div>

             <div className="lg:col-span-2">
                {renderLeaderboard(stats.agents, 'Agent')}
             </div>
          </motion.div>
        )}

        {view === 'params' && (
          <motion.div 
            key="params"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="bg-white p-8 rounded-3xl border border-gray-200 shadow-sm min-h-[400px]"
          >
             <div className="flex items-center gap-3 mb-8">
               <div className="p-2.5 bg-blue-100 rounded-2xl text-blue-600 shadow-sm">
                 <Layout className="w-5 h-5" />
               </div>
               <div>
                  <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest leading-none">Parameter Distribution</h3>
                  <p className="text-[10px] text-gray-400 font-bold mt-1">Overall compliance performance by specific parameter</p>
               </div>
             </div>
             <div className="h-[600px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={paramAnalysis} layout="vertical" margin={{ left: 50, right: 30 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9" />
                    <XAxis type="number" domain={[0, 100]} hide />
                    <YAxis 
                      dataKey="name" 
                      type="category" 
                      axisLine={false} 
                      tickLine={false}
                      tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }}
                      width={180}
                    />
                    <Tooltip 
                      cursor={{ fill: '#f8fafc' }}
                      contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', padding: '12px' }}
                    />
                    <Bar dataKey="pct" radius={[0, 6, 6, 0]} barSize={24}>
                      {paramAnalysis.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.pct >= 90 ? '#10b981' : entry.pct >= 75 ? '#3b82f6' : entry.pct >= 60 ? '#f59e0b' : '#ef4444'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
             </div>
          </motion.div>
        )}

        {view === 'agents' && (
          <motion.div key="agents" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            {renderLeaderboard(stats.agents, 'Agent')}
          </motion.div>
        )}
        {view === 'supervisors' && (
          <motion.div key="supervisors" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            {renderLeaderboard(stats.supervisors, 'Supervisor')}
          </motion.div>
        )}
        {view === 'auditors' && (
          <motion.div key="auditors" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            {renderLeaderboard(stats.auditors, 'Auditor')}
          </motion.div>
        )}
        {view === 'reasons' && (
          <motion.div key="reasons" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            {renderLeaderboard(stats.reasons, 'Reason for Call')}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
