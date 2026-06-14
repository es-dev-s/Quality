import React, { useState, useMemo } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line 
} from 'recharts';
import { 
  FileText, 
  Printer, 
  Download, 
  Calendar, 
  Filter,
  CheckCircle2,
  AlertTriangle,
  Users,
  Search
} from 'lucide-react';
import { useAudit } from '../contexts/AuditContext';
import { cn, getBadgeClass } from '../lib/utils';

export default function Report() {
  const { auditHistory } = useAudit();
  const [dateRange, setDateRange] = useState({ 
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10), 
    end: new Date().toISOString().slice(0, 10) 
  });

  const reportData = useMemo(() => {
    return auditHistory.filter(a => a.callDate >= dateRange.start && a.callDate <= dateRange.end);
  }, [auditHistory, dateRange]);

  const stats = useMemo(() => {
    if (!reportData.length) return null;
    const total = reportData.length;
    const avgQ = Math.round(reportData.reduce((s, a) => s + a.qualityPct, 0) / total);
    const pass = reportData.filter(a => !a.hasFatal && a.qualityPct >= 75).length;
    const fatals = reportData.filter(a => a.hasFatal).length;
    return { total, avgQ, passRate: Math.round(pass/total*100), fatals };
  }, [reportData]);

  return (
    <div className="p-4 lg:p-8 space-y-8 max-w-6xl mx-auto pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Executive Performance Report</h1>
          <p className="text-gray-500 text-sm mt-1 font-medium">Exportable snapshot of organizational quality metrics.</p>
        </div>
        <div className="flex gap-2">
            <button className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors shadow-sm">
              <Printer className="w-4 h-4" />
              Print PDF
            </button>
            <button className="flex items-center gap-2 px-6 py-2 text-sm font-bold text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-200">
              <Download className="w-4 h-4" />
              Spreadsheet (.xlsx)
            </button>
        </div>
      </div>

      <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm flex flex-col md:flex-row items-center gap-6">
        <div className="flex-1 w-full grid grid-cols-1 md:grid-cols-2 gap-4">
           <div className="space-y-1">
             <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1">Start Date</label>
             <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input type="date" value={dateRange.start} onChange={e => setDateRange({...dateRange, start: e.target.value})} className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-sm outline-none focus:bg-white focus:border-blue-500 transition-all" />
             </div>
           </div>
           <div className="space-y-1">
             <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1">End Date</label>
             <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input type="date" value={dateRange.end} onChange={e => setDateRange({...dateRange, end: e.target.value})} className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-sm outline-none focus:bg-white focus:border-blue-500 transition-all" />
             </div>
           </div>
        </div>
        <div className="h-10 w-[1px] bg-gray-100 hidden md:block" />
        <button className="px-10 py-2.5 bg-gray-900 text-white font-bold text-sm rounded-xl hover:bg-black transition-colors shrink-0">
          Apply Filters
        </button>
      </div>

      {!stats ? (
        <div className="py-20 text-center bg-white rounded-3xl border border-gray-100 italic text-gray-400">
           No audit records found for the selected date range.
        </div>
      ) : (
        <div id="printable-report" className="space-y-8">
           <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: "Total Audits", val: stats.total, icon: FileText, color: "text-blue-600 bg-blue-50" },
                { label: "Quality Score", val: `${stats.avgQ}%`, icon: CheckCircle2, color: "text-emerald-600 bg-emerald-50" },
                { label: "Pass Rate", val: `${stats.passRate}%`, icon: Users, color: "text-indigo-600 bg-indigo-50" },
                { label: "Critical Fail", val: stats.fatals, icon: AlertTriangle, color: "text-red-600 bg-red-50" }
              ].map(k => (
                <div key={k.label} className="bg-white p-5 rounded-2xl border border-gray-100 text-center">
                   <div className={cn("w-10 h-10 rounded-xl mx-auto flex items-center justify-center mb-3", k.color)}>
                     <k.icon className="w-5 h-5" />
                   </div>
                   <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{k.label}</p>
                   <p className="text-xl font-black text-gray-900">{k.val}</p>
                </div>
              ))}
           </div>

           <div className="bg-white rounded-3xl border border-gray-200 overflow-hidden">
             <div className="p-8 border-b border-gray-100 flex items-center justify-between">
                <h3 className="font-bold text-gray-900 tracking-tight">Audit Summary Table</h3>
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest bg-gray-50 px-3 py-1 rounded-full border border-gray-100">Showing {reportData.length} Records</span>
             </div>
             <div className="overflow-x-auto">
               <table className="w-full text-left border-collapse">
                 <thead className="bg-gray-50/50 text-[10px] font-bold text-gray-400 uppercase border-b border-gray-100">
                   <tr>
                     <th className="px-8 py-4">Agent</th>
                     <th className="px-4 py-4">Auditor</th>
                     <th className="px-4 py-4 text-center">Date</th>
                     <th className="px-4 py-4 text-center">Quality</th>
                     <th className="px-4 py-4 text-center">Final</th>
                     <th className="px-4 py-4 text-center">Grade</th>
                   </tr>
                 </thead>
                 <tbody className="divide-y divide-gray-50 text-sm">
                    {reportData.map((a, i) => (
                      <tr key={i} className="hover:bg-gray-50/30 transition-colors">
                        <td className="px-8 py-4 font-bold text-gray-900">{a.agent}</td>
                        <td className="px-4 py-4 text-gray-500 font-medium">{a.auditor}</td>
                        <td className="px-4 py-4 text-center text-[11px] font-bold text-gray-400">{a.callDate}</td>
                        <td className="px-4 py-4 text-center font-black text-blue-600">{a.qualityPct}%</td>
                        <td className="px-4 py-4 text-center font-black text-gray-800">{a.hasFatal ? '0%' : `${a.finalPct}%`}</td>
                        <td className="px-4 py-4 text-center">
                          <span className={cn("px-2 py-0.5 rounded text-[10px] font-bold border", getBadgeClass(a.qualityPct, a.hasFatal))}>
                            {a.grade}
                          </span>
                        </td>
                      </tr>
                    ))}
                 </tbody>
               </table>
             </div>
           </div>
        </div>
      )}
    </div>
  );
}
