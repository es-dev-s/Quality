import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Search, 
  Filter, 
  Download, 
  Trash2, 
  Eye, 
  Edit3,
  Calendar,
  X,
  ChevronDown
} from 'lucide-react';
import { useAudit } from '../contexts/AuditContext';
import { cn, getBadgeClass } from '../lib/utils';
import { 
  format, 
  parseISO, 
  isToday, 
  isYesterday, 
  isThisWeek, 
  isSameMonth, 
  subMonths, 
  isAfter, 
  subDays 
} from 'date-fns';
import { AuditRecord } from '../types';

interface HistoryViewProps {
  onEdit: (record: AuditRecord) => void;
  onView: (record: AuditRecord) => void;
}

type DateRange = 'all' | 'today' | 'yesterday' | 'week' | 'month' | '6m' | '1y';

export default function HistoryView({ onEdit, onView }: HistoryViewProps) {
  const { auditHistory, deleteAudit, deleteAudits, updateAudit, currentUser } = useAudit();
  const [searchTerm, setSearchAgent] = useState('');
  const [typeFilter, setTypeFilter] = useState('All');
  const [lobFilter, setLOBFilter] = useState('All');
  const [dateRange, setDateRange] = useState<DateRange>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string | number>>(new Set());
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<'bulk' | string | number | null>(null);

  const filteredHistory = useMemo(() => {
    return auditHistory
      .filter(a => {
        // Ownership / Visibility filter
        if (currentUser && !currentUser.viewAll) {
          if (a.auditor !== currentUser.name) return false;
        }

        const date = parseISO(a.callDate);
        const now = new Date();
        
        const matchesDate = () => {
          if (dateRange === 'today') return isToday(date);
          if (dateRange === 'yesterday') return isYesterday(date);
          if (dateRange === 'week') return isThisWeek(date, { weekStartsOn: 1 });
          if (dateRange === 'month') return isSameMonth(date, now);
          if (dateRange === '6m') return isAfter(date, subMonths(now, 6));
          if (dateRange === '1y') return isAfter(date, subMonths(now, 12));
          return true;
        };

        const matchesSearch = a.agent.toLowerCase().includes(searchTerm.toLowerCase()) || 
                              a.auditor.toLowerCase().includes(searchTerm.toLowerCase()) ||
                              a.id.toString().toLowerCase().includes(searchTerm.toLowerCase());
        const matchesType = typeFilter === 'All' || a.type === typeFilter;
        const matchesLOB = lobFilter === 'All' || a.lob === lobFilter;
        
        return matchesDate() && matchesSearch && matchesType && matchesLOB;
      });
  }, [auditHistory, searchTerm, typeFilter, lobFilter, dateRange, currentUser]);

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredHistory.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredHistory.map(a => a.id)));
    }
  };

  const toggleSelect = (id: string | number) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const handleBulkDelete = () => {
    setDeleteTarget('bulk');
    setShowConfirmModal(true);
  };

  return (
    <div className="p-4 lg:p-8 space-y-6 max-w-7xl mx-auto pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Audit History</h1>
          <p className="text-gray-500 text-sm mt-1">Review, filter, and manage all saved quality assessments.</p>
        </div>
        <div className="flex items-center gap-3">
          {selectedIds.size > 0 && (
            <button 
              onClick={handleBulkDelete}
              className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-red-600 bg-red-50 border border-red-100 rounded-xl hover:bg-red-100 transition-all shadow-sm active:scale-95"
            >
              <Trash2 className="w-4 h-4" />
              Delete {selectedIds.size} Selected
            </button>
          )}
          <button className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors shadow-sm">
            <Download className="w-4 h-4" />
            Export All (.csv)
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input 
              type="text"
              placeholder="Search by Agent or Auditor..."
              className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all"
              value={searchTerm}
              onChange={e => setSearchAgent(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-2">
             <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-1.5">
               <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tight">Period:</span>
               <select 
                 className="bg-transparent text-xs font-bold outline-none cursor-pointer text-blue-600"
                 value={dateRange}
                 onChange={e => setDateRange(e.target.value as DateRange)}
               >
                 <option value="all">All Time</option>
                 <option value="today">Today</option>
                 <option value="yesterday">Yesterday</option>
                 <option value="week">This Week</option>
                 <option value="month">This Month</option>
                 <option value="6m">Last 6 Months</option>
                 <option value="1y">Last Year</option>
               </select>
             </div>

             <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-1.5 focus-within:border-blue-500 transition-all">
               <select 
                 className="bg-transparent text-xs font-semibold outline-none py-0.5 cursor-pointer"
                 value={typeFilter}
                 onChange={e => setTypeFilter(e.target.value)}
               >
                 <option value="All">All Types</option>
                 <option value="Call">Call</option>
                 <option value="Chat">Chat</option>
               </select>
             </div>

             <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-1.5 focus-within:border-blue-500 transition-all">
               <select 
                 className="bg-transparent text-xs font-semibold outline-none py-0.5 cursor-pointer"
                 value={lobFilter}
                 onChange={e => setLOBFilter(e.target.value)}
               >
                 <option value="All">All LOBs</option>
                 <option value="Sales">Sales</option>
                 <option value="Support">Support</option>
               </select>
             </div>

             {(searchTerm || typeFilter !== 'All' || lobFilter !== 'All' || dateRange !== 'all') && (
               <button 
                 onClick={() => {
                   setSearchAgent('');
                   setTypeFilter('All');
                   setLOBFilter('All');
                   setDateRange('all');
                 }}
                 className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold text-red-600 hover:bg-red-50 rounded-xl transition-all"
               >
                 <X className="w-3 h-3" /> Clear Filters
               </button>
             )}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse min-w-[1000px]">
            <thead className="bg-gray-50/50 text-[10px] font-bold text-gray-400 uppercase tracking-widest border-b border-gray-100">
              <tr>
                <th className="px-6 py-4 w-10">
                  <input 
                    type="checkbox" 
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                    checked={filteredHistory.length > 0 && selectedIds.size === filteredHistory.length}
                    onChange={toggleSelectAll}
                  />
                </th>
                <th className="px-6 py-4">Agent Details</th>
                <th className="px-6 py-4">Type / LOB</th>
                <th className="px-6 py-4 text-center">Score</th>
                <th className="px-6 py-4 text-center">Grade</th>
                <th className="px-6 py-4 text-center">Feedback</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 text-sm">
               {filteredHistory.map((a, i) => (
                 <tr key={a.id} className={cn(
                   "group transition-colors",
                   selectedIds.has(a.id) ? "bg-blue-50/30" : "hover:bg-gray-50"
                 )}>
                   <td className="px-6 py-4">
                     <input 
                       type="checkbox" 
                       className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                       checked={selectedIds.has(a.id)}
                       onChange={() => toggleSelect(a.id)}
                     />
                   </td>
                   <td className="px-6 py-4">
                     <div className="flex items-center gap-3">
                       <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 font-bold text-[10px]">
                         {a.agent.split(' ').map(n => n[0]).join('')}
                       </div>
                       <div className="min-w-0">
                         <p className="font-bold text-gray-900 truncate">{a.agent}</p>
                         <p className="text-[10px] text-gray-500 font-medium truncate flex items-center gap-1">
                           <Calendar className="w-2.5 h-2.5" /> {a.callDate} | ID: {a.id}
                         </p>
                       </div>
                     </div>
                   </td>
                   <td className="px-6 py-4">
                      <div className="flex flex-col gap-1">
                        <span className="inline-flex items-center px-2 py-0.5 rounded bg-gray-100 text-gray-600 text-[10px] font-bold w-fit tracking-tight">
                          {a.type}
                        </span>
                        <p className="text-[11px] font-bold text-gray-400 ml-0.5">{a.lob}</p>
                      </div>
                   </td>
                   <td className="px-6 py-4 text-center font-black text-gray-800">
                      {a.hasFatal ? <span className="text-red-600">FAILED</span> : `${a.finalPct}%`}
                   </td>
                   <td className="px-6 py-4 text-center">
                     <span className={cn(
                       "px-2.5 py-1 rounded-full text-[10px] font-bold border",
                       getBadgeClass(a.qualityPct, a.hasFatal)
                     )}>
                       {a.grade}
                     </span>
                   </td>
                   <td className="px-6 py-4 text-center">
                      <select 
                        value={a.feedbackStatus || 'Pending'}
                        onChange={(e) => {
                          const newStatus = e.target.value as any;
                          updateAudit({ ...a, feedbackStatus: newStatus });
                        }}
                        className={cn(
                          "text-[10px] font-bold px-2 py-1 rounded-lg border outline-none cursor-pointer appearance-none text-center",
                          a.feedbackStatus === 'Pending' ? "bg-gray-50 text-gray-400 border-gray-100" :
                          a.feedbackStatus === 'Shared' ? "bg-blue-50 text-blue-600 border-blue-100" :
                          a.feedbackStatus === 'Acknowledged' ? "bg-emerald-50 text-emerald-600 border-emerald-100" :
                          "bg-red-50 text-red-600 border-red-100"
                        )}
                      >
                         <option value="Pending">Pending</option>
                         <option value="Shared">Shared</option>
                         <option value="Acknowledged">Acknowledged</option>
                         <option value="Disputed">Disputed</option>
                      </select>
                   </td>
                   <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                         <button 
                           onClick={() => onView(a)}
                           className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors border border-transparent hover:border-blue-100" 
                           title="View Results"
                         >
                           <Eye className="w-4 h-4" />
                         </button>
                         {(currentUser?.canEdit || currentUser?.role === 'Admin') && (
                           <button 
                             onClick={() => onEdit(a)}
                             className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all border border-transparent hover:border-emerald-100 shadow-sm" 
                             title="Edit Audit"
                           >
                             <Edit3 className="w-4 h-4" />
                           </button>
                         )}
                         {(currentUser?.canDelete || currentUser?.role === 'Admin') && (
                           <button 
                             onClick={() => {
                               setDeleteTarget(a.id);
                               setShowConfirmModal(true);
                             }}
                             className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-all border border-transparent hover:border-red-100 shadow-sm" 
                             title="Delete"
                           >
                             <Trash2 className="w-4 h-4" />
                           </button>
                         )}
                      </div>
                   </td>
                 </tr>
               ))}
               {filteredHistory.length === 0 && (
                 <tr>
                    <td colSpan={7} className="px-6 py-24 text-center space-y-4">
                       <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto border border-gray-100 mb-2">
                         <Search className="w-8 h-8 text-gray-300" />
                       </div>
                       <p className="text-gray-400 font-medium">No results found matching your criteria</p>
                    </td>
                 </tr>
               )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Custom Confirmation Modal */}
      <AnimatePresence>
        {showConfirmModal && (
          <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl space-y-6"
            >
              <div className="flex items-center gap-4 text-red-600">
                <div className="bg-red-50 p-3 rounded-2xl">
                  <Trash2 className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-black tracking-tight text-gray-900">Confirm Deletion</h3>
              </div>
              
              <p className="text-gray-500 text-sm font-medium leading-relaxed">
                {deleteTarget === 'bulk' 
                  ? `Are you sure you want to delete the ${selectedIds.size} selected quality assessments? This action is permanent.`
                  : 'Are you sure you want to delete this quality assessment? This action is permanent.'
                }
              </p>

              <div className="flex items-center gap-3 justify-end pt-2">
                <button 
                  onClick={() => {
                    setShowConfirmModal(false);
                    setDeleteTarget(null);
                  }}
                  className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-xl text-xs font-black uppercase tracking-widest transition-all"
                >
                  Cancel
                </button>
                <button 
                  onClick={() => {
                    if (deleteTarget === 'bulk') {
                      deleteAudits(Array.from(selectedIds));
                      setSelectedIds(new Set());
                    } else if (deleteTarget !== null) {
                      deleteAudits([deleteTarget]);
                      const nextSel = new Set(selectedIds);
                      nextSel.delete(deleteTarget);
                      setSelectedIds(nextSel);
                    }
                    setShowConfirmModal(false);
                    setDeleteTarget(null);
                  }}
                  className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-lg"
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
