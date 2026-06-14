import React, { useMemo, useState } from 'react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Cell,
  LineChart,
  Line,
  AreaChart,
  Area
} from 'recharts';
import { 
  Users, 
  CheckCircle2, 
  AlertTriangle, 
  TrendingUp, 
  Target, 
  Award,
  ArrowUpRight,
  ArrowDownRight,
  ClipboardList,
  Calendar,
  Filter
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAudit } from '../contexts/AuditContext';
import { cn, getScoreColor } from '../lib/utils';
import { 
  format, 
  subMonths, 
  startOfMonth, 
  isSameMonth, 
  isToday, 
  isYesterday, 
  isThisWeek, 
  startOfDay, 
  subDays,
  isAfter,
  parseISO,
  startOfWeek
} from 'date-fns';

const KPICard = ({ 
  label, 
  value, 
  subValue, 
  icon: Icon, 
  trend, 
  color 
}: { 
  label: string, 
  value: string | number, 
  subValue?: string, 
  icon: any, 
  trend?: { val: string, up: boolean },
  color: string 
}) => (
  <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
    <div className="flex items-start justify-between">
      <div className={cn("p-2.5 rounded-xl", color)}>
        <Icon className="w-5 h-5" />
      </div>
      {trend && (
        <div className={cn(
          "flex items-center gap-0.5 text-[10px] font-bold px-2 py-0.5 rounded-full",
          trend.up ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600"
        )}>
          {trend.up ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
          {trend.val}
        </div>
      )}
    </div>
    <div className="mt-4">
      <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">{label}</h3>
      <div className="flex items-baseline gap-2 mt-1">
        <span className="text-2xl font-bold text-gray-900">{value}</span>
        {subValue && <span className="text-[10px] text-gray-400 font-medium">{subValue}</span>}
      </div>
    </div>
  </div>
);

type Period = 'today' | 'yesterday' | 'week' | 'month' | 'overall';

export default function Dashboard() {
  const { auditHistory } = useAudit();
  const [period, setPeriod] = useState<Period>('overall');
  const [trendView, setTrendView] = useState<'day' | 'week' | 'month'>('month');
  const [trendRange, setTrendRange] = useState<'6m' | '1y' | 'custom'>('6m');

  const filteredHistory = useMemo(() => {
    const now = new Date();
    return auditHistory.filter(a => {
      const date = parseISO(a.callDate);
      if (period === 'today') return isToday(date);
      if (period === 'yesterday') return isYesterday(date);
      if (period === 'week') return isThisWeek(date, { weekStartsOn: 1 });
      if (period === 'month') return isSameMonth(date, now);
      return true;
    });
  }, [auditHistory, period]);

  const stats = useMemo(() => {
    const total = filteredHistory.length;
    const nonFatals = filteredHistory.filter(a => !a.hasFatal);
    
    // Quality Score (Including Fatal - assume 0 if fatal?)
    // Usually "Including Fatal" means the fatal items contribute 0 to the average
    const avgInclFatal = total > 0 
      ? Math.round(filteredHistory.reduce((sum, a) => sum + (a.finalPct ?? (a.hasFatal ? 0 : a.qualityPct)), 0) / total)
      : 0;
      
    // Quality Score (Excluding Fatal)
    const avgExclFatal = total > 0
      ? Math.round(filteredHistory.reduce((sum, a) => sum + a.qualityPct, 0) / total)
      : 0;

    const fatals = filteredHistory.filter(a => a.hasFatal).length;
    const uniqueAgents = new Set(filteredHistory.map(a => a.agent)).size;

    return { total, avgInclFatal, avgExclFatal, fatals, uniqueAgents };
  }, [filteredHistory]);

  const topAgents = useMemo(() => {
    const agMap: Record<string, { sum: number, cnt: number }> = {};
    filteredHistory.forEach(a => {
      if (!agMap[a.agent]) agMap[a.agent] = { sum: 0, cnt: 0 };
      agMap[a.agent].sum += a.qualityPct;
      agMap[a.agent].cnt++;
    });

    return Object.entries(agMap)
      .map(([name, data]) => ({
        name,
        avg: data.cnt > 0 ? Math.round(data.sum / data.cnt) : 0,
        count: data.cnt
      }))
      .sort((a, b) => b.avg - a.avg)
      .slice(0, 5);
  }, [filteredHistory]);

  const topFatals = useMemo(() => {
    const errorMap: Record<string, number> = {};
    filteredHistory.forEach(a => {
      a.fatalList.forEach(err => {
        errorMap[err] = (errorMap[err] || 0) + 1;
      });
    });

    return Object.entries(errorMap)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [filteredHistory]);

  // Target Calculations
  // Per agent: 20 per month
  // Per auditor: Distributed cumulative agent target
  const targetStats = useMemo(() => {
    const now = new Date();
    const currentMonthAudits = auditHistory.filter(a => isSameMonth(parseISO(a.callDate), now));
    
    const uniqueAgents = new Set(auditHistory.map(a => a.agent)).size;
    const uniqueAuditorsList = Array.from(new Set(auditHistory.map(a => a.auditor)));
    const uniqueAuditors = uniqueAuditorsList.length || 1;
    
    const individualAgentTarget = 20;
    const totalGoal = uniqueAgents * individualAgentTarget;
    const totalAchieved = currentMonthAudits.length;
    
    const perAuditorTarget = Math.ceil(totalGoal / uniqueAuditors);

    // Calculate Average Scores for Agents and Auditors in Current Month
    const agentScores = currentMonthAudits.reduce((acc, a) => {
        if (!acc[a.agent]) acc[a.agent] = { sum: 0, cnt: 0 };
        acc[a.agent].sum += a.qualityPct;
        acc[a.agent].cnt++;
        return acc;
    }, {} as Record<string, { sum: number, cnt: number }>);

    const auditorScores = currentMonthAudits.reduce((acc, a) => {
        if (!acc[a.auditor]) acc[a.auditor] = { sum: 0, cnt: 0 };
        acc[a.auditor].sum += a.qualityPct;
        acc[a.auditor].cnt++;
        return acc;
    }, {} as Record<string, { sum: number, cnt: number }>);

    const avgAgentScore = currentMonthAudits.length > 0 
        ? Math.round(currentMonthAudits.reduce((s, a) => s + a.qualityPct, 0) / currentMonthAudits.length)
        : 0;

    const avgAuditorScore = avgAgentScore; // In this context it's the same pool of audits
    
    return {
      totalGoal,
      totalAchieved,
      percentAchieved: totalGoal > 0 ? Math.round((totalAchieved / totalGoal) * 100) : 0,
      perAuditorTarget,
      individualAgentTarget,
      avgAgentScore,
      avgAuditorScore,
      auditors: uniqueAuditorsList.map(name => ({
          name,
          achieved: currentMonthAudits.filter(a => a.auditor === name).length,
          avg: auditorScores[name]?.cnt > 0 ? Math.round(auditorScores[name].sum / auditorScores[name].cnt) : 0
      }))
    };
  }, [auditHistory]);

  const chartData = useMemo(() => {
    if (trendView === 'month') {
      const monthsCount = trendRange === '6m' ? 6 : 12;
      return Array.from({ length: monthsCount }).map((_, i) => {
        const date = subMonths(new Date(), i);
        const mStr = format(date, 'MMM');
        const filtered = auditHistory.filter(a => isSameMonth(parseISO(a.callDate), date));
        const avg = filtered.length > 0 
          ? Math.round(filtered.reduce((s, x) => s + (x.finalPct ?? (x.hasFatal ? 0 : x.qualityPct)), 0) / filtered.length)
          : 0;
        return { name: mStr, score: avg };
      }).reverse();
    } else if (trendView === 'week') {
      return Array.from({ length: 8 }).map((_, i) => {
        const date = subDays(new Date(), i * 7);
        const wStr = `W${format(date, 'w')}`;
        const weekStart = startOfWeek(date, { weekStartsOn: 1 });
        const filtered = auditHistory.filter(a => {
          const aDate = parseISO(a.callDate);
          return isAfter(aDate, weekStart) && isAfter(addDays(weekStart, 7), aDate);
        });
        const avg = filtered.length > 0 
          ? Math.round(filtered.reduce((s, x) => s + (x.finalPct ?? (x.hasFatal ? 0 : x.qualityPct)), 0) / filtered.length)
          : 0;
        return { name: wStr, score: avg };
      }).reverse();
    } else {
      // Day view
      return Array.from({ length: 14 }).map((_, i) => {
        const date = subDays(new Date(), i);
        const dStr = format(date, 'MMM dd');
        const filtered = auditHistory.filter(a => startOfDay(parseISO(a.callDate)).getTime() === startOfDay(date).getTime());
        const avg = filtered.length > 0 
          ? Math.round(filtered.reduce((s, x) => s + (x.finalPct ?? (x.hasFatal ? 0 : x.qualityPct)), 0) / filtered.length)
          : 0;
        return { name: dStr, score: avg };
      }).reverse();
    }
  }, [auditHistory, trendView, trendRange]);

  function addDays(date: Date, days: number) {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }

  return (
    <div className="p-4 lg:p-8 space-y-8 max-w-7xl mx-auto pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">Executive Summary</h1>
          <p className="text-gray-500 text-sm mt-1">Comprehensive quality performance overview.</p>
        </div>
        <div className="flex items-center gap-2 bg-white p-1 rounded-xl border border-gray-100 shadow-sm">
          {(['today', 'yesterday', 'week', 'month', 'overall'] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={cn(
                "px-3 py-1.5 text-xs font-bold rounded-lg transition-all capitalize",
                period === p 
                  ? "bg-gray-900 text-white shadow-md" 
                  : "text-gray-500 hover:bg-gray-50"
              )}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6">
        <KPICard 
          label="Total Audits" 
          value={stats.total} 
          icon={ClipboardList} 
          color="bg-blue-50 text-blue-600" 
        />
        <KPICard 
          label="Quality (Incl. Fatal)" 
          value={`${stats.avgInclFatal}%`} 
          icon={Award} 
          color="bg-emerald-50 text-emerald-600" 
        />
        <KPICard 
          label="Quality (Excl. Fatal)" 
          value={`${stats.avgExclFatal}%`} 
          icon={CheckCircle2} 
          color="bg-indigo-50 text-indigo-600" 
        />
        <KPICard 
          label="Fatal Errors" 
          value={stats.fatals} 
          icon={AlertTriangle} 
          color="bg-red-50 text-red-600" 
        />
        <KPICard 
          label="Unique Agents" 
          value={stats.uniqueAgents} 
          icon={Users} 
          color="bg-amber-50 text-amber-600" 
        />
      </div>

      {/* Performance Trend */}
      <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h3 className="font-bold text-gray-900 text-lg">Performance Trend</h3>
            <p className="text-xs text-gray-400 mt-1">Standardized quality score tracking over time.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
             <div className="flex items-center gap-1 bg-gray-50 p-1 rounded-lg border border-gray-100">
               {(['day', 'week', 'month'] as const).map(v => (
                 <button
                   key={v}
                   onClick={() => setTrendView(v)}
                   className={cn(
                     "px-3 py-1 text-[10px] font-bold rounded-md transition-all capitalize",
                     trendView === v ? "bg-white text-blue-600 shadow-sm" : "text-gray-400 hover:text-gray-600"
                   )}
                 >
                   {v}
                 </button>
               ))}
             </div>
             <div className="flex items-center gap-1 bg-gray-50 p-1 rounded-lg border border-gray-100">
               {(['6m', '1y', 'custom'] as const).map(r => (
                 <button
                   key={r}
                   onClick={() => setTrendRange(r)}
                   className={cn(
                     "px-3 py-1 text-[10px] font-bold rounded-md transition-all uppercase",
                     trendRange === r ? "bg-white text-blue-600 shadow-sm" : "text-gray-400 hover:text-gray-600"
                   )}
                 >
                   {r}
                 </button>
               ))}
             </div>
             {trendRange === 'custom' && (
                <div className="flex items-center gap-2 bg-gray-50 p-1 rounded-lg border border-gray-100 min-w-[200px]">
                   <input 
                     type="date" 
                     className="bg-transparent text-[10px] font-bold outline-none text-gray-600 px-2"
                   />
                   <span className="text-gray-400 text-[10px]">-</span>
                   <input 
                     type="date" 
                     className="bg-transparent text-[10px] font-bold outline-none text-gray-600 px-2"
                   />
                </div>
             )}
          </div>
        </div>
        <div className="h-[350px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis 
                dataKey="name" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 11, fill: '#94a3b8', fontWeight: 500 }} 
                dy={10}
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 11, fill: '#94a3b8', fontWeight: 500 }} 
                domain={[0, 100]}
                dx={-10}
              />
              <Tooltip 
                cursor={{ stroke: '#3b82f6', strokeWidth: 1 }}
                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
              />
              <Area 
                type="monotone" 
                dataKey="score" 
                stroke="#3b82f6" 
                strokeWidth={3}
                fillOpacity={1} 
                fill="url(#colorScore)" 
                animationDuration={1500}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Target Tracking Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Audit Targets */}
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm h-full flex flex-col">
          <div className="flex items-center justify-between mb-8">
            <h3 className="font-bold text-gray-900 flex items-center gap-2">
              <Target className="w-5 h-5 text-blue-600" />
              Audit Targets (Monthly)
            </h3>
            <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full uppercase tracking-wider">
              {format(new Date(), 'MMMM yyyy')}
            </span>
          </div>
          
          <div className="space-y-8 flex-1">
            {/* Per Agent */}
            <div className="space-y-3">
              <div className="flex justify-between items-end">
                <div>
                  <p className="text-sm font-bold text-gray-900">Per Agent Target</p>
                  <p className="text-xs text-gray-400 font-medium">Standard: {targetStats.individualAgentTarget} Audits/Mo</p>
                </div>
                <div className="text-right">
                  <span className="text-xl font-black text-gray-900">{targetStats.avgAgentScore}%</span>
                  <span className="text-[10px] text-gray-400 block font-bold">AVG AGENT SCORE</span>
                </div>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-blue-500 rounded-full transition-all duration-1000 shadow-[0_0_8px_rgba(59,130,246,0.5)]" 
                  style={{ width: `${Math.min(100, targetStats.percentAchieved)}%` }} 
                />
              </div>
              <p className="text-[10px] text-gray-500 font-bold uppercase tracking-tight">{targetStats.percentAchieved}% Total Monthly Achievement</p>
            </div>

            {/* Per Auditor */}
            <div className="space-y-3 pt-2">
              <div className="flex justify-between items-end">
                <div>
                  <p className="text-sm font-bold text-gray-900">Per Auditor Target</p>
                  <p className="text-xs text-gray-400 font-medium">Equally Distributed: {targetStats.perAuditorTarget} Audits/Mo</p>
                </div>
                <div className="text-right">
                  <span className="text-xl font-black text-emerald-600">{targetStats.avgAuditorScore}%</span>
                  <span className="text-[10px] text-gray-400 block font-bold">AVG AUDITOR SCORE</span>
                </div>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div 
                    className="h-full bg-emerald-500 rounded-full transition-all duration-1000 shadow-[0_0_8px_rgba(16,185,129,0.5)]" 
                    style={{ width: `${Math.min(100, targetStats.percentAchieved)}%` }} 
                />
              </div>
              <p className="text-[10px] text-gray-500 font-bold uppercase tracking-tight">Cumulative Audit Progress ({targetStats.totalAchieved} / {targetStats.totalGoal})</p>
            </div>

            {/* Cumulative */}
            <div className="pt-6 border-t border-gray-50">
               <div className="bg-gray-900 rounded-2xl p-6 text-white overflow-hidden relative">
                  <div className="relative z-10">
                    <div className="flex justify-between items-center mb-4">
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-widest text">Cumulative Monthly</p>
                      <span className="text-2xl font-black text-white">{targetStats.percentAchieved}%</span>
                    </div>
                    <div className="flex items-baseline gap-2 mb-6">
                      <span className="text-4xl font-black">{targetStats.totalAchieved}</span>
                      <span className="text-lg text-gray-400 font-bold">/ {targetStats.totalGoal}</span>
                    </div>
                    <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${targetStats.percentAchieved}%` }}
                        className="h-full bg-blue-400"
                      />
                    </div>
                  </div>
                  <Target className="absolute -bottom-8 -right-8 w-32 h-32 text-white/5 rotate-12" />
               </div>
            </div>
          </div>
        </div>

        {/* Top Lists */}
        <div className="space-y-8">
           {/* Top Agents */}
           <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
             <div className="flex items-center gap-2 mb-6">
               <Award className="w-5 h-5 text-amber-500" />
               <h3 className="font-bold text-gray-900">Top Performing Agents</h3>
             </div>
             <div className="space-y-3">
               {topAgents.map((agent, i) => (
                 <div key={agent.name} className="flex items-center justify-between p-3 rounded-xl bg-gray-50 border border-transparent hover:border-gray-200 transition-all">
                   <div className="flex items-center gap-3">
                     <div className={cn(
                       "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shadow-sm",
                       i === 0 ? "bg-amber-100 text-amber-700" : 
                       i === 1 ? "bg-slate-100 text-slate-700" : 
                       i === 2 ? "bg-orange-100 text-orange-700" : "bg-white text-gray-500"
                     )}>
                       {i + 1}
                     </div>
                     <div>
                       <p className="text-sm font-bold text-gray-900">{agent.name}</p>
                       <p className="text-[10px] text-gray-400 font-bold uppercase tracking-tighter">{agent.count} audits</p>
                     </div>
                   </div>
                   <p className="text-lg font-black text-gray-900">{agent.avg}%</p>
                 </div>
               ))}
             </div>
           </div>

           {/* Top Fatal Errors */}
           <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
             <div className="flex items-center gap-2 mb-6 text-red-600">
               <AlertTriangle className="w-5 h-5" />
               <h3 className="font-bold">Top Fatal Errors</h3>
             </div>
             <div className="space-y-3">
               {topFatals.map((f) => (
                 <div key={f.name} className="flex items-center justify-between p-3 rounded-xl border border-red-50 border-l-4 border-l-red-500 bg-red-50/30 group hover:bg-red-50/50 transition-all">
                   <div className="flex-1 min-w-0">
                     <p className="text-sm font-bold text-gray-900 truncate pr-4">{f.name}</p>
                   </div>
                   <div className="flex items-center gap-3 shrink-0">
                      <span className="text-[10px] font-black text-red-600 bg-red-100 px-2 py-0.5 rounded-full">{f.count} OCCURRENCES</span>
                   </div>
                 </div>
               ))}
               {topFatals.length === 0 && (
                 <div className="flex flex-col items-center justify-center py-8 text-gray-300">
                    <CheckCircle2 className="w-8 h-8 mb-2 opacity-20" />
                    <p className="text-xs font-bold uppercase tracking-widest">No Fatal Errors Detected</p>
                 </div>
               )}
             </div>
           </div>
        </div>
      </div>
    </div>
  );
}
