'use client';

// ==========================================
// 1. IMPORTS & CONFIGURATION
// ==========================================
import { supabase } from '@/lib/supabase';
import React, { useState, useEffect, useRef } from 'react';
import Dexie, { type Table } from 'dexie';
import ExcelJS from 'exceljs';
// @ts-ignore
import { saveAs } from 'file-saver';
import { 
  Info, Database, Settings, PlusCircle, Trash2, 
  X, CheckSquare, Camera, ChevronRight, FileDown, 
  Filter, Square, CheckSquare as CheckIcon, Search, Eye, Tag, Wifi, WifiOff, RefreshCcw, 
  LayoutGrid, ListFilter, Edit3, ArrowLeft, ArrowRight, AlertTriangle
} from 'lucide-react';

// --- Offline Database Schema (Dexie) ---
class SeismicDB extends Dexie {
  outbox!: Table<{ id?: number; building_id: string; full_data: any; timestamp: number }>;
  constructor() {
    super('SeismicDB');
    this.version(1).stores({ outbox: '++id, building_id, timestamp' });
  }
}
const localDB = new SeismicDB();

// --- Types ---
type FieldType = 'text' | 'select' | 'checkbox' | 'image';

interface CustomField { 
  id: string; 
  label: string; 
  type: FieldType; 
  tooltip: string; 
  options?: string[]; 
}

interface ImageObject { 
  url: string; 
  label: string; 
  isLocal?: boolean; 
}

interface BuildingReport { 
  id: string; 
  building_id: string; 
  created_at: string; 
  full_data: Record<string, any>; 
}

// ==========================================
// 2. SUB-COMPONENTS
// ==========================================

// --- High-Contrast Tooltip ---
const Tooltip = ({ text }: { text: string }) => {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <span className="relative ml-2 inline-flex items-center z-10">
      <button type="button" onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}
        className={`w-5 h-5 md:w-6 md:h-6 rounded-full flex items-center justify-center transition-all shadow-sm ${isOpen ? 'bg-[#FFDC00] text-[#111111] ring-2 ring-[#111111]' : 'bg-[#AAAAAA] text-[#111111] hover:bg-[#FFDC00]'}`}>
        <Info size={12} strokeWidth={3} />
      </button>
      {isOpen && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 w-48 md:w-64 p-3 md:p-4 bg-[#FFDC00] text-[#111111] rounded-xl shadow-[0_10px_40px_rgba(0,0,0,0.5)] text-xs font-bold leading-relaxed border-2 border-[#111111] animate-in fade-in zoom-in-95">
          <p className="border-b-2 border-[#111111]/20 pb-1 mb-1 uppercase font-black text-[9px] tracking-widest">Guidance</p>
          {text}
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-[#FFDC00]" />
        </div>
      )}
    </span>
  );
};

// --- R2 Image Upload (Offline Capable) ---
const ImageUpload = ({ label, value, onChange }: { label: string, value: ImageObject[], onChange: (imgs: ImageObject[]) => void }) => {
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setUploading(true);
    const newItems = [...value];

    for (const file of files) {
      if (navigator.onLine) {
        const formData = new FormData();
        formData.append('file', file);
        try {
          const res = await fetch('/api/upload', { method: 'POST', body: formData });
          if (!res.ok) throw new Error("API Error");
          const data = await res.json();
          newItems.push({ url: data.url, label: `Capture ${newItems.length + 1}`, isLocal: false });
        } catch (err) {
          console.warn("Cloud upload failed, switching to local.");
          saveLocally(file, newItems);
        }
      } else {
        saveLocally(file, newItems);
      }
    }
    
    if (navigator.onLine) {
        onChange(newItems);
        setUploading(false);
    }
  };

  const saveLocally = (file: File, items: ImageObject[]) => {
    const reader = new FileReader();
    reader.onloadend = () => {
        if (reader.result) {
            items.push({ url: reader.result as string, label: `Offline Img ${items.length + 1}`, isLocal: true });
            onChange([...items]); 
            setUploading(false);
        }
    };
    reader.readAsDataURL(file);
  };

  const updateLabel = (index: number, newText: string) => {
    const updated = [...value];
    updated[index].label = newText;
    onChange(updated);
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-2">
        {value.map((img, i) => (
          <div key={i} className={`flex gap-3 p-2 rounded-lg border items-center ${img.isLocal ? 'bg-orange-50 border-orange-300' : 'bg-[#DDDDDD] border-[#AAAAAA]'}`}>
            <div className="w-16 h-16 rounded-md overflow-hidden border border-[#111111] flex-shrink-0 relative">
              <img src={img.url} className="w-full h-full object-cover" alt="" />
              {img.isLocal && <div className="absolute bottom-0 inset-x-0 bg-orange-600 text-white text-[8px] font-bold text-center">LOCAL</div>}
            </div>
            <div className="flex-1 min-w-0">
              <input type="text" value={img.label} onChange={(e) => updateLabel(i, e.target.value)} 
                className="w-full bg-[#FFFFFF] p-2 rounded border border-[#AAAAAA] text-[#111111] text-xs font-bold outline-none focus:border-[#85144B]" 
                placeholder="Label..." />
            </div>
            <button onClick={() => onChange(value.filter((_, idx) => idx !== i))} className="text-red-500 p-2 hover:bg-red-50 rounded-full"><Trash2 size={16} /></button>
          </div>
        ))}
      </div>
      <button type="button" onClick={() => fileInputRef.current?.click()} 
        disabled={uploading}
        className={`w-full py-4 md:py-6 border-2 border-dashed rounded-xl flex flex-col items-center justify-center gap-1 transition-all ${uploading ? 'bg-slate-50 border-blue-400' : 'bg-[#FFFFFF] border-[#AAAAAA] hover:bg-slate-50 hover:border-[#85144B]'}`}>
        <Camera size={20} className={uploading ? 'animate-pulse text-blue-600' : 'text-[#111111]'} />
        <span className="text-[10px] md:text-xs font-black uppercase tracking-widest text-[#111111]">
          {uploading ? 'Processing...' : 'Add Photos'}
        </span>
        <input type="file" multiple accept="image/*" className="hidden" ref={fileInputRef} onChange={handleImageChange} />
      </button>
    </div>
  );
};

// ==========================================
// 3. MAIN COMPONENT LOGIC
// ==========================================
export default function BuildingForm() {
  // --- STATE ---
  const [isOnline, setIsOnline] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  
  const [isAdmin, setIsAdmin] = useState(false);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [password, setPassword] = useState('');

  const [fields, setFields] = useState<CustomField[]>([]);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [reports, setReports] = useState<BuildingReport[]>([]);
  
  // Admin Features
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDistrict, setFilterDistrict] = useState('All');
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [editingReport, setEditingReport] = useState<BuildingReport | null>(null);
  const [viewingImages, setViewingImages] = useState<ImageObject[] | null>(null); // NEW: Image Viewer State
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 8;

  // Schema Editor
  const [newFieldLabel, setNewFieldLabel] = useState('');
  const [newFieldType, setNewFieldType] = useState<FieldType>('text');
  const [newFieldTooltip, setNewFieldTooltip] = useState('');
  const [newOptions, setNewOptions] = useState<string[]>(['']);

  // --- LIFECYCLE ---
  useEffect(() => {
    loadSchema();
    loadReports();
    
    const update = () => setIsOnline(navigator.onLine);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    
    checkPending();
    const interval = setInterval(checkPending, 3000);

    return () => { 
      window.removeEventListener('online', update); 
      window.removeEventListener('offline', update);
      clearInterval(interval);
    };
  }, []);

  const checkPending = async () => setPendingCount(await localDB.outbox.count());
  
  const loadSchema = async () => { 
    const { data } = await supabase.from('survey_schema').select('fields').limit(1).single(); 
    if(data) setFields(data.fields); 
  };
  
  const loadReports = async () => { 
    const { data } = await supabase.from('building_reports').select('*').order('created_at', {ascending: false}); 
    if(data) setReports(data); 
  };

  // --- SMART SYNC LOGIC ---
  const runSync = async () => {
    if (!isOnline || syncing) return;
    setSyncing(true);
    try {
      const pending = await localDB.outbox.toArray();
      
      for (const report of pending) {
        const processedData = JSON.parse(JSON.stringify(report.full_data));
        
        for (const key in processedData) {
            const val = processedData[key];
            if (Array.isArray(val) && val.length > 0 && typeof val[0] === 'object' && val[0].isLocal) {
                const uploadedImages: ImageObject[] = [];
                
                for (const img of val) {
                    if (img.isLocal) {
                        const res = await fetch(img.url);
                        const blob = await res.blob();
                        const file = new File([blob], `offline-${Date.now()}.jpg`, { type: "image/jpeg" });
                        
                        const formData = new FormData();
                        formData.append('file', file);
                        
                        const uploadRes = await fetch('/api/upload', { method: 'POST', body: formData });
                        const uploadData = await uploadRes.json();
                        
                        if (uploadData.url) {
                            uploadedImages.push({ url: uploadData.url, label: img.label, isLocal: false });
                        }
                    } else {
                        uploadedImages.push(img);
                    }
                }
                processedData[key] = uploadedImages;
            }
        }

        const { error } = await supabase.from('building_reports').insert([{ 
          building_id: report.building_id, 
          full_data: processedData,
          created_at: new Date(report.timestamp).toISOString()
        }]);

        if (!error) await localDB.outbox.delete(report.id!);
      }
      
      await checkPending(); 
      loadReports(); 
      alert(`Sync Complete! ${pending.length} reports uploaded.`);
    } catch (e) {
      console.error(e);
      alert("Sync interrupted. Check connection.");
    } finally {
      setSyncing(false);
    }
  };

  const submitReport = async () => {
    if (!formData['Building ID']) return alert("Critical: Building ID Required.");
    const entry = { building_id: formData['Building ID'], full_data: formData, timestamp: Date.now() };

    if (isOnline) {
      try {
          const { error } = await supabase.from('building_reports').insert([{ 
            building_id: entry.building_id, 
            full_data: entry.full_data 
          }]);
          if (!error) { 
            alert("Survey Packet Uploaded!"); 
            setFormData({}); 
            loadReports(); 
          } else { throw new Error("DB Error"); }
      } catch (e) {
          await localDB.outbox.add(entry);
          await checkPending();
          alert("Connection unstable. Saved Locally.");
          setFormData({});
      }
    } else {
      await localDB.outbox.add(entry);
      await checkPending();
      alert("Offline Mode: Saved to Vault.");
      setFormData({});
    }
  };

  // --- ADMIN LOGIC ---
  const deleteSelected = async () => {
    const count = selectedRows.size;
    if (!window.confirm(`Swiss Protocol: Permanently purge ${count} records and their R2 images?`)) return;
    
    const filesToPurge: string[] = [];
    reports.filter(r => selectedRows.has(r.id)).forEach(report => {
      Object.values(report.full_data).forEach(val => {
        if (Array.isArray(val)) val.forEach((i: any) => { 
            if(i.url && i.url.includes('r2')) filesToPurge.push(i.url.split('/').pop()!); 
        });
      });
    });

    if (filesToPurge.length > 0) {
      await fetch('/api/delete-file', { method: 'POST', body: JSON.stringify({ keys: filesToPurge }) });
    }

    await supabase.from('building_reports').delete().in('id', Array.from(selectedRows));
    setSelectedRows(new Set()); 
    loadReports();
    alert("System Cleaned.");
  };

  const saveEditedReport = async () => {
    if (!editingReport) return;
    const { error } = await supabase.from('building_reports').update({ 
      full_data: editingReport.full_data,
      building_id: editingReport.full_data['Building ID'] || editingReport.building_id
    }).eq('id', editingReport.id);

    if (!error) {
      alert("Changes Saved.");
      setEditingReport(null);
      loadReports();
    }
  };

  const addField = async () => {
    if (!newFieldLabel) return;
    const newField: CustomField = {
      id: Date.now().toString(), label: newFieldLabel, type: newFieldType,
      tooltip: newFieldTooltip || 'Observation required.',
      options: newFieldType === 'select' ? newOptions.filter(o => o.trim() !== '') : undefined,
    };
    const updated = [...fields, newField];
    setFields(updated);
    await supabase.from('survey_schema').update({ fields: updated }).filter('id', 'neq', '00000000-0000-0000-0000-000000000000');
    setNewFieldLabel(''); setNewOptions(['']);
  };

  const removeField = async (id: string) => {
    if(!window.confirm("Remove this field? Data may be hidden.")) return;
    const updated = fields.filter(f => f.id !== id);
    setFields(updated);
    await supabase.from('survey_schema').update({ fields: updated }).filter('id', 'neq', '00000000-0000-0000-0000-000000000000');
  };

  // --- EXCEL EXPORT (Fixed Corruption Issue) ---
  const exportToExcel = async (subset?: BuildingReport[]) => {
    const dataToExport = subset || reports;
    if (dataToExport.length === 0) return alert("No data.");

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Data');
    
    const textHeaders = new Set<string>();
    const imageFields = new Map<string, number>();

    dataToExport.forEach(r => {
      Object.entries(r.full_data).forEach(([k, v]) => {
        if (Array.isArray(v) && v.length > 0 && typeof v[0] === 'object' && v[0].url) {
          imageFields.set(k, Math.max(imageFields.get(k) || 0, v.length));
        } else {
          textHeaders.add(k);
        }
      });
    });

    const columns: any[] = [{ header: 'DATE', key: 'date', width: 15 }, { header: 'ID', key: 'id', width: 20 }];
    textHeaders.forEach(h => columns.push({ header: h.toUpperCase(), key: h, width: 25 }));
    imageFields.forEach((max, label) => {
      for (let i = 1; i <= max; i++) columns.push({ header: `${label.toUpperCase()} ${i}`, key: `${label}_${i}`, width: 30 });
    });

    worksheet.columns = columns;

    dataToExport.forEach(r => {
      const row: any = { date: new Date(r.created_at).toLocaleDateString(), id: r.building_id };
      textHeaders.forEach(h => row[h] = r.full_data[h]);
      imageFields.forEach((max, label) => {
        const photos = r.full_data[label];
        if (Array.isArray(photos)) photos.forEach((p, idx) => {
          row[`${label}_${idx+1}`] = { text: p.label || `Photo ${idx+1}`, hyperlink: p.url, tooltip: 'View' };
        });
      });
      worksheet.addRow(row);
    });

    worksheet.eachRow((row, i) => {
      row.eachCell(c => {
        c.alignment = { vertical: 'middle', horizontal: 'center' };
        c.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        if (i === 1) { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF001F3F' } }; c.font = { color: { argb: 'FF39CCCC' }, bold: true }; }
      });
      row.height = 30;
    });

    // FIX: ADDED CORRECT MIME TYPE
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    saveAs(blob, `Report_${Date.now()}.xlsx`);
  };

  const filteredReports = reports.filter(r => {
    const searchLower = searchQuery.toLowerCase();
    const matchesID = r.building_id.toLowerCase().includes(searchLower);
    const matchesData = Object.values(r.full_data).some(v => String(v).toLowerCase().includes(searchLower));
    return matchesID || matchesData;
  });

  const paginatedReports = filteredReports.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  return (
    <div className="max-w-screen-lg mx-auto px-4 pb-32 pt-4 space-y-6 min-h-screen bg-[#F8F9FA]">
      
      {/* 1. STATUS BAR */}
      <div className={`p-4 rounded-xl border-2 flex items-center justify-between shadow-sm ${isOnline ? 'bg-green-50 border-green-200' : 'bg-orange-50 border-orange-200'}`}>
        <div className="flex items-center gap-2">
          {isOnline ? <Wifi className="text-green-700" size={20} /> : <WifiOff className="text-orange-700" size={20} />}
          <span className={`text-xs font-black uppercase ${isOnline ? 'text-green-900' : 'text-orange-900'}`}>
            {isOnline ? 'System Online' : 'Offline Vault Active'}
          </span>
        </div>
        {pendingCount > 0 && isOnline && (
          <button onClick={runSync} disabled={syncing} className="bg-[#85144B] text-white px-4 py-2 rounded-lg text-xs font-black animate-pulse flex items-center gap-2 shadow-md">
            <RefreshCcw size={14} className={syncing ? 'animate-spin' : ''} /> PUSH {pendingCount}
          </button>
        )}
      </div>

      {/* 2. HEADER & ADMIN TOGGLE */}
      <div className="flex justify-between items-center bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
        {!isAdmin && <button onClick={() => exportToExcel()} className="text-[10px] font-black bg-white px-3 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-[#001F3F] hover:text-[#39CCCC] transition-colors flex items-center gap-2">
          <FileDown size={14} /> EXCEL
        </button>}
        <button onClick={() => isAdmin ? setIsAdmin(false) : setShowAdminPanel(!showAdminPanel)} className="text-[10px] font-black text-slate-400 hover:text-blue-600 uppercase tracking-wider">
          {isAdmin ? 'Exit Admin' : 'Admin'}
        </button>
      </div>

      {/* 3. AUTH PANEL */}
      {showAdminPanel && !isAdmin && (
        <div className="bg-slate-100 p-6 rounded-2xl border-2 border-dashed border-slate-300 max-w-sm mx-auto text-center">
          <input type="password" placeholder="Passcode" className="w-full p-3 rounded-xl border text-center font-bold text-lg mb-3" value={password} onChange={(e) => setPassword(e.target.value)} />
          <button onClick={() => password === 'swiss2026' ? (setIsAdmin(true), setShowAdminPanel(false), setPassword('')) : alert('Denied')} className="w-full bg-[#001F3F] text-[#39CCCC] p-3 rounded-xl font-black text-xs uppercase">Login</button>
        </div>
      )}

      {/* 4. ADMIN DASHBOARD */}
      {isAdmin && (
        <div className="space-y-6 animate-in slide-in-from-top-4">
          <div className="bg-white p-6 rounded-3xl border-2 border-[#001F3F] shadow-xl space-y-4">
            <div className="flex justify-between items-center pb-4 border-b">
              <h3 className="text-xs font-black uppercase text-[#001F3F] flex items-center gap-2"><ListFilter size={16} /> Data</h3>
              <div className="flex gap-2">
                <button onClick={() => exportToExcel(reports.filter(r => selectedRows.has(r.id)))} disabled={selectedRows.size === 0} className="bg-[#001F3F] text-[#39CCCC] px-3 py-1.5 rounded-lg text-[10px] font-bold disabled:opacity-50">EXPORT</button>
                <button onClick={deleteSelected} disabled={selectedRows.size === 0} className="bg-red-600 text-white px-3 py-1.5 rounded-lg text-[10px] font-bold disabled:opacity-50">DELETE</button>
              </div>
            </div>
            
            <input type="text" placeholder="Search..." className="w-full p-3 bg-slate-50 rounded-xl font-bold text-sm border focus:border-[#001F3F] outline-none" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
            
            <div className="overflow-hidden rounded-xl border border-slate-200">
              <table className="w-full text-left text-sm">
                <thead className="bg-[#001F3F] text-[#39CCCC] text-[10px] uppercase font-black">
                  <tr>
                    <th className="p-3 w-10">Select</th>
                    <th className="p-3">ID</th>
                    <th className="p-3">Region</th>
                    <th className="p-3">Evidence</th>
                    <th className="p-3">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedReports.map(r => {
                    // Find if there are images
                    const hasPhotos = Object.values(r.full_data).some(v => Array.isArray(v) && v.length > 0 && typeof v[0] === 'object' && v[0].url);
                    const photos = hasPhotos ? Object.values(r.full_data).flatMap(v => (Array.isArray(v) && v.length > 0 && typeof v[0] === 'object' && v[0].url) ? v : []) as ImageObject[] : null;

                    return (
                      <tr key={r.id} className="border-b last:border-0 hover:bg-slate-50">
                        <td className="p-3"><input type="checkbox" className="accent-[#85144B]" checked={selectedRows.has(r.id)} onChange={() => { const n = new Set(selectedRows); n.has(r.id) ? n.delete(r.id) : n.add(r.id); setSelectedRows(n); }} /></td>
                        <td className="p-3 font-bold">{r.building_id}</td>
                        <td className="p-3 text-xs text-slate-500 uppercase">{r.full_data['District'] || '-'}</td>
                        <td className="p-3">
                          {photos && photos.length > 0 ? (
                            <button onClick={() => setViewingImages(photos)} className="flex items-center gap-1 text-[#001F3F] font-bold text-xs hover:underline">
                              <Eye size={14} /> {photos.length}
                            </button>
                          ) : <span className="text-slate-300 text-xs">None</span>}
                        </td>
                        <td className="p-3"><button onClick={() => setEditingReport(r)} className="text-[#001F3F] hover:bg-slate-200 p-1 rounded"><Edit3 size={16} /></button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div className="bg-slate-100 p-2 flex justify-between items-center text-[10px] font-bold text-slate-500">
                <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} className="p-1 disabled:opacity-30"><ArrowLeft size={14} /></button>
                <span>PAGE {currentPage}</span>
                <button disabled={paginatedReports.length < ITEMS_PER_PAGE} onClick={() => setCurrentPage(p => p + 1)} className="p-1 disabled:opacity-30"><ArrowRight size={14} /></button>
              </div>
            </div>
          </div>

          <div className="bg-[#001F3F] p-6 rounded-3xl text-white space-y-3 shadow-lg">
            <h3 className="text-xs font-black uppercase text-[#39CCCC]">Schema Manager</h3>
            <div className="grid grid-cols-2 gap-3">
              <input type="text" placeholder="Label" className="p-2 bg-white/10 rounded-lg text-xs font-bold border border-white/10" value={newFieldLabel} onChange={(e) => setNewFieldLabel(e.target.value)} />
              <select className="p-2 bg-white/10 rounded-lg text-xs font-bold border border-white/10" value={newFieldType} onChange={(e) => setNewFieldType(e.target.value as FieldType)}>
                <option value="text">Text</option><option value="select">Dropdown</option><option value="checkbox">Check</option><option value="image">Photo</option>
              </select>
            </div>
            {newFieldType === 'select' && (
              <div className="space-y-2 bg-black/20 p-2 rounded-lg">
                {newOptions.map((o, i) => (
                  <div key={i} className="flex gap-2"><input type="text" className="flex-1 p-1 bg-white/10 rounded text-xs" value={o} onChange={(e) => { const u = [...newOptions]; u[i] = e.target.value; setNewOptions(u); }} /><button onClick={() => setNewOptions(newOptions.filter((_, x) => x !== i))} className="text-red-400 font-bold">X</button></div>
                ))}
                <button onClick={() => setNewOptions([...newOptions, ''])} className="text-[10px] text-[#39CCCC] font-bold">+ Option</button>
              </div>
            )}
            <button onClick={addField} className="w-full bg-[#39CCCC] text-[#001F3F] p-3 rounded-xl font-black text-xs uppercase tracking-widest mt-2">Add Field</button>
          </div>
        </div>
      )}

      {/* 5. FORM RENDERER */}
      <div className="space-y-4">
        {fields.map(f => (
          <div key={f.id} className="bg-white p-5 rounded-2xl border-2 border-slate-100 shadow-sm relative">
            <div className="flex justify-between items-center mb-2">
              <label className="text-[11px] font-black uppercase text-[#111111] tracking-wider flex items-center gap-1">
                {f.label} <Tooltip text={f.tooltip} />
              </label>
              {isAdmin && <button onClick={() => removeField(f.id)} className="text-slate-300 hover:text-red-500"><Trash2 size={16} /></button>}
            </div>
            
            {f.type === 'text' && <input type="text" className="w-full p-3 bg-slate-50 rounded-xl font-bold border-2 border-transparent focus:border-[#001F3F] focus:bg-white outline-none text-[#111111]" placeholder="..." value={formData[f.label] || ''} onChange={(e) => setFormData({...formData, [f.label]: e.target.value})} />}
            
            {f.type === 'select' && (
              <div className="relative">
                <select className="w-full p-3 bg-slate-50 rounded-xl font-bold border-2 border-transparent focus:border-[#001F3F] appearance-none text-[#111111] outline-none" value={formData[f.label] || ''} onChange={(e) => setFormData({...formData, [f.label]: e.target.value})}>
                  <option value="">Select...</option>
                  {f.options?.map((o, i) => <option key={i} value={o}>{o}</option>)}
                </select>
                <ChevronRight className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
              </div>
            )}

            {f.type === 'image' && <ImageUpload label={f.label} value={formData[f.label] || []} onChange={(imgs) => setFormData({...formData, [f.label]: imgs})} />}

            {f.type === 'checkbox' && (
              <label className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl cursor-pointer hover:bg-slate-100 transition-colors">
                <input type="checkbox" className="w-5 h-5 accent-[#2ECC40] rounded" checked={!!formData[f.label]} onChange={(e) => setFormData({...formData, [f.label]: e.target.checked})} />
                <span className="text-xs font-bold uppercase text-[#111111]">Confirm</span>
              </label>
            )}
          </div>
        ))}
      </div>

      {/* 6. SUBMIT BUTTON */}
      {!isAdmin && (
        <button onClick={submitReport} className="w-full bg-[#85144B] text-[#FFFFFF] font-black py-5 rounded-[2rem] shadow-xl hover:scale-[1.01] active:scale-[0.98] transition-all flex items-center justify-center gap-3 uppercase tracking-widest text-xs sticky bottom-6 z-10 border-4 border-white">
          <CheckSquare size={18} /> {isOnline ? 'SUBMIT REPORT' : 'SAVE LOCALLY'}
        </button>
      )}

      {/* 7. EDIT MODAL */}
      {editingReport && (
        <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg max-h-[80vh] overflow-y-auto rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b pb-2">
              <h3 className="font-black text-lg text-[#001F3F]">EDIT REPORT</h3>
              <button onClick={() => setEditingReport(null)}><X /></button>
            </div>
            {fields.map(f => f.type === 'text' && (
              <div key={f.id} className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-slate-400">{f.label}</label>
                <input type="text" className="w-full p-3 bg-slate-50 rounded-xl font-bold border" value={editingReport.full_data[f.label] || ''} onChange={(e) => setEditingReport({ ...editingReport, full_data: { ...editingReport.full_data, [f.label]: e.target.value } })} />
              </div>
            ))}
            <button onClick={saveEditedReport} className="w-full bg-[#001F3F] text-[#39CCCC] py-4 rounded-xl font-black uppercase text-sm">Update Data</button>
          </div>
        </div>
      )}

      {/* 8. IMAGE VIEWER MODAL */}
      {viewingImages && (
        <div className="fixed inset-0 z-[150] bg-black/90 backdrop-blur-lg flex items-center justify-center p-4">
          <button onClick={() => setViewingImages(null)} className="absolute top-4 right-4 text-white bg-white/20 p-2 rounded-full"><X /></button>
          <div className="max-w-4xl w-full grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[80vh] overflow-y-auto">
            {viewingImages.map((img, i) => (
              <div key={i} className="space-y-2">
                <img src={img.url} className="w-full rounded-xl shadow-2xl border-2 border-[#39CCCC]" alt="Proof" />
                <p className="text-center text-[#39CCCC] font-bold text-xs uppercase bg-black/50 p-2 rounded-lg">{img.label}</p>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}