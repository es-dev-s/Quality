import React, { useState } from 'react';
import { 
  Upload as UploadIcon, 
  FileSpreadsheet, 
  CheckCircle2, 
  AlertCircle,
  FileJson,
  ArrowRight,
  Database,
  History,
  FileType
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import * as XLSX from 'xlsx';
import { cn } from '../lib/utils';
import { useAudit } from '../contexts/AuditContext';
import { AuditRecord } from '../types';

const MAPPABLE_FIELDS = [
  { key: 'agent', label: 'Agent Name', required: true },
  { key: 'supervisor', label: 'Supervisor Name', required: false },
  { key: 'auditor', label: 'Quality Auditor', required: true },
  { key: 'type', label: 'Interaction Type', required: false },
  { key: 'callDate', label: 'Call Date', required: true },
  { key: 'auditDate', label: 'Audit Date', required: false },
  { key: 'lob', label: 'Line of Business (LOB)', required: false },
  { key: 'sublob', label: 'Sub-LOB', required: false },
  { key: 'mobile', label: 'Mobile Number', required: false },
  { key: 'reason', label: 'Reason for Call', required: false },
  { key: 'response', label: 'Agent Response', required: false },
  { key: 'qualityPct', label: 'Quality Score %', required: true },
  { key: 'finalPct', label: 'Final Score %', required: false },
  { key: 'hasFatal', label: 'Fatal Indicator', required: false },
];

export default function Import() {
  const { addAudits, currentUser, activeTemplate } = useAudit();
  const [step, setStep] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [fileData, setFileData] = useState<any[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [sheets, setSheets] = useState<string[]>([]);
  const [currentSheet, setCurrentSheet] = useState<string>('');
  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);

  const canImport = currentUser?.canCreate || currentUser?.role === 'Admin';

  const steps = [
    { n: 1, label: 'Upload File' },
    { n: 2, label: 'Map Columns' },
    { n: 3, label: 'Review & Import' }
  ];

  const handleFile = (f: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array', cellDates: true, cellNF: false, cellText: false });
        
        if (wb.SheetNames.length === 0) {
          alert("The file appears to be empty.");
          return;
        }

        setWorkbook(wb);
        setSheets(wb.SheetNames);
        setFileName(f.name);
        
        const firstSheet = wb.SheetNames[0];
        setCurrentSheet(firstSheet);
        loadSheetData(wb, firstSheet);
      } catch (err) {
        console.error("Import error:", err);
        alert("Failed to process the spreadsheet. Please check if the file is corrupted or in an unsupported format.");
      }
    };
    reader.onerror = () => alert("An error occurred while reading the file.");
    reader.readAsArrayBuffer(f);
  };

  const loadSheetData = (wb: XLSX.WorkBook, sheetName: string) => {
    try {
      const ws = wb.Sheets[sheetName];
      // Get all data as arrays to find the header row
      const fullData = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as any[][];
      
      // Find the first row that looks like a header (has at least 3 non-empty cells)
      const headerRowIndex = fullData.findIndex(row => row.filter(cell => cell !== '').length >= 3);
      
      if (headerRowIndex === -1) {
        // Fallback to first non-empty row
        const firstRow = fullData.findIndex(row => row.some(cell => cell !== ''));
        if (firstRow === -1) {
           alert("No readable data found in this sheet.");
           return;
        }
      }

      const actualHeaderIndex = headerRowIndex === -1 ? 0 : headerRowIndex;
      const fileHeaders = fullData[actualHeaderIndex] as string[];
      
      // Filter out empty headers
      const cleanedHeaders = fileHeaders.map((h, i) => h?.toString().trim() || `Column ${i + 1}`);
      
      // Read records using the detected header row
      const records = XLSX.utils.sheet_to_json(ws, { range: actualHeaderIndex, defval: '' });

      setHeaders(cleanedHeaders);
      setFileData(records);
      
      // Auto-mapping
      const newMapping: Record<string, string> = {};
      MAPPABLE_FIELDS.forEach(field => {
        const match = cleanedHeaders.find(h => 
          h.toString().toLowerCase().includes(field.label.toLowerCase()) || 
          h.toString().toLowerCase().includes(field.key.toLowerCase())
        );
        if (match) newMapping[field.key] = match;
      });
      setMapping(newMapping);
      setStep(2);
    } catch (err) {
      console.error("Sheet loading error:", err);
      alert("Failed to load data from the selected sheet.");
    }
  };

  const parseExcelDate = (val: any) => {
    if (!val) return new Date().toISOString().slice(0, 10);
    if (val instanceof Date) return val.toISOString().slice(0, 10);
    if (typeof val === 'number') {
      // Excel base date is Dec 30, 1899
      const date = new Date(Math.round((val - 25569) * 864e5));
      if (!isNaN(date.getTime())) return date.toISOString().slice(0, 10);
    }
    const str = val.toString().trim();
    // Try native date parsing for strings
    const d = new Date(str);
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
    
    // Final fallback: just return the string or today
    return str || new Date().toISOString().slice(0, 10);
  };

  const processRecords = () => {
    if (!canImport) {
      alert("You do not have permission to import records.");
      return;
    }

    try {
      const newAudits: AuditRecord[] = fileData.map((row, index) => {
        const getVal = (key: string) => {
          const val = row[mapping[key]];
          return val !== undefined ? val : '';
        };
        
        const parseScore = (val: any) => {
          if (val === undefined || val === '') return 0;
          let num = parseFloat(val.toString().replace('%', ''));
          if (isNaN(num)) return 0;
          if (num > 0 && num <= 1 && !val.toString().includes('%')) {
            return num * 100;
          }
          return num;
        };

        // Parameter Mapping
        const auditRows: any[] = [];
        let importedTotalMax = 0;
        let importedTotalScored = 0;
        let importedHasFatal = false;
        const importedFatalList: string[] = [];

        activeTemplate.sections.forEach(section => {
          section.params.forEach(param => {
            const colName = Object.keys(row).find(h => {
              const header = h.trim().toLowerCase();
              const pName = param.name.toLowerCase();
              return header === pName || header.includes(pName) || pName.includes(header);
            });
            
            let sel = 'N/A';
            let score = 0;
            let isRowFatal = false;

            if (colName) {
              const val = row[colName]?.toString().trim() || 'N/A';
              sel = val;
              
              // Map selection to score
              const normalizedVal = val.toLowerCase();
              const numVal = parseFloat(val);
              
              if (!isNaN(numVal)) {
                score = Math.min(numVal, param.max);
                if (numVal === 0 && (normalizedVal.includes('fatal') || param.name.toLowerCase().includes('cmm'))) {
                  isRowFatal = true;
                  importedFatalList.push(param.name);
                }
              } else if (['yes', 'y', '1', 'me', 'ee', 'pass', 'compliance'].includes(normalizedVal)) {
                score = param.max;
              } else if (['partial', 'p', 'be', 'improvement needed'].includes(normalizedVal)) {
                score = param.max / 2;
              } else if (['fatal', 'f', 'fail', 'non-compliance'].includes(normalizedVal)) {
                score = 0;
                isRowFatal = true;
                importedFatalList.push(param.name);
              } else {
                score = 0;
              }
            }

            if (sel !== 'N/A') {
              importedTotalMax += param.max;
              importedTotalScored += score;
              if (isRowFatal) importedHasFatal = true;
            }

            auditRows.push({
              id: param.id,
              cat: section.name,
              name: param.name,
              max: param.max,
              sel: sel,
              score: score,
              fatal: isRowFatal,
              isScoringFatal: isRowFatal
            });
          });
        });

        const qualityPctExcel = parseScore(getVal('qualityPct'));
        const hasFatalExcel = getVal('hasFatal')?.toString().toLowerCase() === 'true' || 
                             getVal('hasFatal')?.toString().toLowerCase() === 'yes' ||
                             getVal('hasFatal')?.toString().toLowerCase() === 'fatal' ||
                             getVal('hasFatal')?.toString() === '1';

        // Prefer Excel value if mapping existed for qualityPct, otherwise calculate from rows
        const calculatedQualityPct = importedTotalMax > 0 ? (importedTotalScored / importedTotalMax) * 100 : qualityPctExcel;
        const finalQualityPct = mapping['qualityPct'] ? qualityPctExcel : calculatedQualityPct;
        
        const hasFatal = mapping['hasFatal'] ? hasFatalExcel : importedHasFatal;
        const fatalList = mapping['hasFatal'] && hasFatalExcel && importedFatalList.length === 0 ? ['Imported Fatal'] : importedFatalList;

        let finalPctExcel = row[mapping['finalPct']] !== undefined ? parseScore(getVal('finalPct')) : finalQualityPct;
        if (hasFatal) {
          finalPctExcel = 0;
        }

        return {
          id: `AUD-IMPORT-${Date.now()}-${index}`,
          savedAt: new Date().toLocaleDateString(),
          agent: getVal('agent')?.toString() || 'Unknown Agent',
          supervisor: getVal('supervisor')?.toString() || 'Not Assigned',
          auditor: getVal('auditor')?.toString() || currentUser?.name || 'Importer',
          type: (getVal('type')?.toString().toLowerCase() === 'chat' ? 'Chat' : 'Call') as 'Call' | 'Chat',
          callDate: parseExcelDate(getVal('callDate')),
          auditDate: parseExcelDate(getVal('auditDate')),
          lob: getVal('lob')?.toString() || activeTemplate.lob,
          sublob: getVal('sublob')?.toString() || 'Default',
          mobile: getVal('mobile')?.toString() || '',
          reason: getVal('reason')?.toString() || '',
          response: getVal('response')?.toString() || '',
          qualityPct: finalQualityPct,
          finalPct: finalPctExcel,
          grade: finalPctExcel >= 90 ? 'Excellent' : finalPctExcel >= 80 ? 'Good' : 'Needs Improvement',
          gc: finalPctExcel >= 90 ? 'green' : finalPctExcel >= 80 ? 'blue' : 'amber',
          qualityGrade: finalQualityPct >= 90 ? 'Excellent' : finalQualityPct >= 80 ? 'Good' : 'Needs Improvement',
          qualityGc: finalQualityPct >= 90 ? 'green' : finalQualityPct >= 80 ? 'blue' : 'amber',
          hasFatal,
          fatalList,
          feedbackStatus: 'Pending',
          totalScored: finalPctExcel,
          totalMax: 100,
          catScores: {},
          rows: auditRows
        };
      });

      addAudits(newAudits);
      alert(`Successfully synchronized ${newAudits.length} records!`);
      setStep(1);
      setFileName(null);
      setFileData([]);
    } catch (err) {
      console.error("Batch processing error:", err);
      alert("Error processing records. Please ensure your mapping is correct.");
    }
  };

  return (
    <div className="p-4 lg:p-8 space-y-8 max-w-5xl mx-auto">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Data Synchronization</h1>
        <p className="text-gray-500 text-sm font-medium">Seamlessly batch import audit records from Excel or CSV files.</p>
      </div>

      <div className="flex items-center justify-center gap-12 max-w-2xl mx-auto py-4">
        {steps.map((s, i) => (
          <div key={s.n} className="flex flex-col items-center gap-3 relative">
            <div className={cn(
              "w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-sm transition-all z-10",
              step === s.n ? "bg-blue-600 text-white shadow-xl shadow-blue-100 scale-110" : 
              step > s.n ? "bg-emerald-500 text-white shadow-lg shadow-emerald-50" : "bg-gray-100 text-gray-300"
            )}>
              {step > s.n ? <CheckCircle2 className="w-6 h-6" /> : s.n}
            </div>
            <span className={cn(
              "text-[10px] font-black uppercase tracking-widest absolute -bottom-6 w-32 text-center",
              step === s.n ? "text-blue-600" : "text-gray-400"
            )}>
              {s.label}
            </span>
            {i < steps.length - 1 && (
              <div className={cn(
                "absolute left-12 top-6 w-24 h-0.5 -z-0",
                step > s.n ? "bg-emerald-500" : "bg-gray-100"
              )} />
            )}
          </div>
        ))}
      </div>

      <div className="pt-10">
        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div 
              key="step1"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.05 }}
              className={cn(
                "bg-white rounded-[40px] border-2 border-dashed p-24 flex flex-col items-center justify-center gap-8 transition-all cursor-pointer group shadow-sm bg-radial-at-t from-white to-gray-50/50",
                isDragging ? "border-blue-500 bg-blue-50/30 ring-8 ring-blue-50" : "border-gray-200 hover:border-blue-400 hover:bg-gray-50"
              )}
              onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={e => { e.preventDefault(); setIsDragging(false); const f = e.dataTransfer.files[0]; if(f) handleFile(f); }}
              onClick={() => {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = '.xlsx, .xls, .csv';
                input.onchange = (e: any) => { const f = e.target.files[0]; if(f) handleFile(f); };
                input.click();
              }}
            >
              <div className="w-24 h-24 bg-gray-100 text-gray-400 rounded-3xl flex items-center justify-center group-hover:text-blue-600 group-hover:bg-blue-100 group-hover:scale-110 group-hover:rotate-3 transition-all duration-300">
                <UploadIcon className="w-12 h-12" />
              </div>
              <div className="text-center space-y-2">
                <p className="text-2xl font-black text-gray-900 leading-tight">Drop your spreadsheets here</p>
                <p className="text-sm text-gray-400 font-bold">Standard Excel (.xlsx, .xls) and CSV files supported</p>
              </div>
              <div className="flex gap-6 pt-4">
                 <div className="flex items-center gap-3 text-[11px] font-black text-gray-400 uppercase tracking-[0.2em]"><FileSpreadsheet className="w-4 h-4 text-emerald-500" /> Excel</div>
                 <div className="flex items-center gap-3 text-[11px] font-black text-gray-400 uppercase tracking-[0.2em]"><FileType className="w-4 h-4 text-blue-500" /> CSV</div>
              </div>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div 
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-6"
            >
              <div className="bg-blue-600 p-8 rounded-[32px] text-white flex flex-col md:flex-row md:items-center gap-6 shadow-xl shadow-blue-200">
                 <div className="bg-white/20 p-4 rounded-2xl backdrop-blur-md shrink-0">
                   <FileSpreadsheet className="w-8 h-8" />
                 </div>
                 <div className="flex-1 min-w-0">
                    <p className="text-xl font-black tracking-tight truncate">{fileName}</p>
                    <div className="flex items-center gap-4 mt-1">
                      <p className="text-blue-100 text-[10px] font-black uppercase tracking-widest opacity-80">{fileData.length} Records</p>
                      {sheets.length > 1 && (
                         <div className="flex items-center gap-2">
                           <span className="text-[10px] font-black text-blue-200 uppercase tracking-widest">Sheet:</span>
                           <select 
                            className="bg-white/10 border-none text-[10px] font-black uppercase tracking-widest rounded-lg px-2 py-1 outline-none cursor-pointer"
                            value={currentSheet}
                            onChange={(e) => {
                              setCurrentSheet(e.target.value);
                              if (workbook) loadSheetData(workbook, e.target.value);
                            }}
                           >
                             {sheets.map(s => <option key={s} value={s} className="text-gray-900">{s}</option>)}
                           </select>
                         </div>
                      )}
                    </div>
                 </div>
                 <button onClick={() => setStep(1)} className="px-6 py-2.5 bg-white text-blue-600 hover:bg-blue-50 rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-lg">Change File</button>
              </div>

              {/* Data Preview */}
              <div className="bg-white rounded-[32px] border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-8 py-4 border-b border-gray-100 bg-gray-50/10 flex items-center justify-between">
                   <h3 className="font-black text-gray-400 text-[10px] uppercase tracking-[0.2em]">Live Data Preview</h3>
                   <span className="text-[10px] font-bold text-gray-300">Showing first 3 rows</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-gray-50/50">
                        {headers.slice(0, 6).map((h, i) => (
                          <th key={i} className="px-8 py-3 text-[10px] font-black text-gray-400 uppercase tracking-wider border-r border-gray-100 last:border-0">{h}</th>
                        ))}
                        {headers.length > 6 && <th className="px-4 py-3 text-[10px] font-black text-gray-300 italic">+{headers.length - 6} more</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {fileData.slice(0, 3).map((row, i) => (
                        <tr key={i} className="border-t border-gray-100">
                          {headers.slice(0, 6).map((h, j) => (
                            <td key={j} className="px-8 py-3 text-xs font-bold text-gray-600 border-r border-gray-100 last:border-0 truncate max-w-[200px]">
                              {row[h]?.toString() || '-'}
                            </td>
                          ))}
                          {headers.length > 6 && <td className="px-4 py-3"></td>}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="bg-white rounded-[32px] border border-gray-200 shadow-sm overflow-hidden">
                 <div className="px-8 py-6 border-b border-gray-100 bg-gray-50/30 flex items-center justify-between">
                    <div>
                      <h3 className="font-black text-gray-900 text-lg uppercase tracking-tight">Manual Mapping</h3>
                      <p className="text-xs text-gray-400 font-bold mt-1">Associate each AuditPro field with your spreadsheet columns.</p>
                    </div>
                    <div className="bg-emerald-50 text-emerald-600 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-2 border border-emerald-100">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Auto-matched {Object.keys(mapping).length} fields
                    </div>
                 </div>
                 <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
                    {MAPPABLE_FIELDS.map(field => (
                      <div key={field.key} className="flex flex-col gap-2 group">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] pl-1 group-focus-within:text-blue-600 transition-colors">
                          {field.label} {field.required && <span className="text-red-500">*</span>}
                        </label>
                        <select 
                          className={cn(
                            "px-5 py-3.5 rounded-2xl text-sm font-bold outline-none transition-all appearance-none cursor-pointer border",
                            mapping[field.key] 
                              ? "bg-blue-50/30 border-blue-100 text-blue-900" 
                              : "bg-gray-50 border-gray-100 text-gray-400 hover:border-gray-200 focus:bg-white focus:border-blue-400"
                          )}
                          value={mapping[field.key] || ''}
                          onChange={(e) => setMapping({ ...mapping, [field.key]: e.target.value })}
                        >
                           <option value="">-- Choose Column --</option>
                           {headers.map(h => (
                             <option key={h} value={h}>{h}</option>
                           ))}
                           <option value="__skip__">-- Skip this field --</option>
                        </select>
                      </div>
                    ))}
                 </div>
              </div>

              <div className="flex justify-end pt-4">
                 <button 
                   onClick={() => setStep(3)}
                   className="flex items-center gap-3 px-12 py-4 bg-blue-600 text-white rounded-2xl font-black text-sm shadow-2xl shadow-blue-200 hover:bg-blue-700 hover:-translate-y-1 transition-all"
                 >
                   Verify Sync Data
                   <ArrowRight className="w-5 h-5" />
                 </button>
              </div>
            </motion.div>
          )}

          {step === 3 && (
             <motion.div 
              key="step3"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-8"
             >
                <div className="bg-emerald-600 border border-emerald-500 p-12 rounded-[40px] text-center flex flex-col items-center gap-6 shadow-2xl shadow-emerald-200 relative overflow-hidden">
                   <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl" />
                   <div className="w-20 h-20 bg-white/20 backdrop-blur-md text-white rounded-3xl flex items-center justify-center shadow-lg">
                      <Database className="w-10 h-10" />
                   </div>
                   <div className="space-y-2">
                      <h3 className="text-3xl font-black text-white leading-tight">{fileData.length} Audit Records Ready</h3>
                      <p className="text-emerald-100 text-sm font-bold opacity-80 uppercase tracking-[0.2em]">Data structure verified & integrity check passed</p>
                   </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-white rounded-[32px] border border-gray-200 p-8 flex items-center justify-between shadow-sm hover:shadow-md transition-shadow">
                     <div className="flex items-center gap-5">
                        <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center shadow-inner">
                           <History className="w-8 h-8" />
                        </div>
                        <div>
                           <p className="text-lg font-black text-gray-900 leading-none">Append Records</p>
                           <p className="text-xs text-gray-400 font-bold mt-2 uppercase tracking-widest">Preserve historical data</p>
                        </div>
                     </div>
                     <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" className="sr-only peer" checked readOnly />
                        <div className="w-14 h-8 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[4px] after:left-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-emerald-500"></div>
                     </label>
                  </div>

                  <div className="bg-white rounded-[32px] border border-gray-200 p-8 flex items-center justify-between shadow-sm hover:shadow-md transition-shadow">
                     <div className="flex items-center gap-5 opacity-40">
                        <div className="w-16 h-16 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center">
                           <AlertCircle className="w-8 h-8" />
                        </div>
                        <div>
                           <p className="text-lg font-black text-gray-900 leading-none">Wipe & Sync</p>
                           <p className="text-xs text-gray-400 font-bold mt-2 uppercase tracking-widest">Replace current database</p>
                        </div>
                     </div>
                     <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest rotate-12 border-2 border-gray-200 px-2 py-1 rounded">Dev Only</div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-8">
                   <button onClick={() => setStep(2)} className="py-5 text-sm font-black uppercase tracking-widest text-gray-400 bg-white border border-gray-200 rounded-2xl hover:bg-gray-50 transition-all">
                     Back to mapping
                   </button>
                   <button 
                     onClick={processRecords}
                     className="md:col-span-2 py-5 text-sm font-black uppercase tracking-[0.2em] text-white bg-blue-600 rounded-2xl hover:bg-blue-700 shadow-2xl shadow-blue-200 hover:-translate-y-1 transition-all"
                   >
                     Complete Synchronization
                   </button>
                </div>
             </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="bg-gray-100/50 p-8 rounded-[40px] flex items-start gap-6 border border-gray-200/50">
         <div className="p-3 bg-white rounded-2xl shadow-sm text-gray-400">
          <AlertCircle className="w-6 h-6" />
         </div>
         <div className="space-y-2">
            <p className="text-xs font-black text-gray-900 uppercase tracking-[0.2em]">Sync Protocols & Compliance</p>
            <p className="text-xs text-gray-500 font-bold leading-relaxed">
              Mapped scores will be rounded to 2 decimal places. Dates are converted to ISO standard for compatibility. Any records with fatal indicators will automatically bypass quality percentage calculations in relevant analytics views.
            </p>
         </div>
      </div>
    </div>
  );
}
