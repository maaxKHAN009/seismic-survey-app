'use client';

import { supabase } from '@/lib/supabase';
import React, { useState, useEffect, useRef } from 'react';
import Dexie, { type Table } from 'dexie';
import ExcelJS from 'exceljs';
// @ts-ignore
import { saveAs } from 'file-saver';
import { 
  Info, Database, Settings, PlusCircle, Trash2, 
  X, CheckSquare, Camera, ChevronRight, FileDown, 
  Filter, Square, CheckSquare as CheckIcon, Search, Eye, Tag, Wifi, WifiOff, RefreshCcw, LayoutGrid, ListFilter
} from 'lucide-react';

// --- 1. IndexedDB Vault Configuration ---
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
interface CustomField { id: string; label: string; type: FieldType; tooltip: string; options?: string[]; }
interface ImageObject { url: string; label: string; }
interface BuildingReport { id: string; building_id: string; created_at: string; full_data: Record<string, any>; }

// --- 2. High-Contrast Tooltip ---
const Tooltip = ({ text }: { text: string }) => {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <span className="relative ml-2 inline-flex items-center">
      <button type="button" onClick={() => setIsOpen(!isOpen)} 
        className={`w-7 h-7 rounded-full flex items-center justify-center transition-all shadow-sm ${isOpen ? 'bg-blue-700 text-white ring-4 ring-blue-100' : 'bg-slate-300 text-slate-800 hover:bg-slate-400'}`}>
        <Info size={14} strokeWidth={3} />
      </button>
      {isOpen && (
        <div className="absolute bottom-full mb-3 z-50 w-64 p-5 bg-slate-900 text-white rounded-[1.5rem] shadow-2xl text-[12px] font-medium leading-relaxed border border-white/10 animate-in fade-in slide-in-from-bottom-2">
          <p className="border-b border-white/10 pb-2 mb-2 uppercase font-black text-[10px] tracking-widest text-blue-400">Engineering Guidance</p>
          {text}
          <div className="absolute top-full left-3 border-8 border-transparent border-t-slate-900" />
        </div>
      )}
    </span>
  );
};

// --- 3. Cloudflare R2 Upload Component ---
const ImageUpload = ({ label, value, onChange }: { label: string, value: ImageObject[], onChange: (imgs: ImageObject[]) => void }) => {
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setUploading(true);
    const newItems = [...value];

    for (const file of files) {
      const formData = new FormData();
      formData.append('file', file);
      try {
        const res = await fetch('/api/upload', { method: 'POST', body: formData });
        const data = await res.json();
        if (data.url) newItems.push({ url: data.url, label: `Capture ${newItems.length + 1}` });
      } catch (err) { alert("R2 Linkage Failed. Check your API Route."); }
    }
    onChange(newItems);
    setUploading(false);
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-4">
        {value.map((img, i) => (
          <div key={i} className="flex gap-4 bg-slate-100 p-4 rounded-[1.5rem] border-2 border-slate-200 items-center shadow-inner group">
            <div className="w-20 h-20 rounded-2xl overflow-hidden shadow-md border-2 border-white flex-shrink-0">
              <img src={img.url} className="w-full h-full object-cover" alt="" />
            </div>
            <div className="flex-1">
              <p className="text-[10px] font-black uppercase text-slate-500 mb-1 tracking-widest">Evidence Label</p>
              <input type="text" value={img.label} onChange={(e) => {
                const u = [...value]; u[i].label = e.target.value; onChange(u);
              }} className="w-full bg-white p-3 rounded-xl border-2 border-slate-200 text-slate-900 font-black outline-none focus:border-blue-600 transition-all" />
            </div>
            <button onClick={() => onChange(value.filter((_, idx) => idx !== i))} className="text-red-600 p-3 hover:bg-red-100 rounded-full transition-colors"><Trash2 size={24} /></button>
          </div>
        ))}
      </div>
      <button type="button" onClick={() => fileInputRef.current?.click()} className="w-full py-12 border-4 border-dashed border-slate-300 rounded-[3rem] flex flex-col items-center justify-center gap-3 text-slate-500 hover:bg-blue-50 hover:border-blue-400 hover:text-blue-600 transition-all group">
        <Camera size={40} className={`transition-transform group-hover:scale-110 ${uploading ? 'animate-pulse text-blue-600' : 'text-slate-400'}`} />
        <span className="text-sm font-black uppercase tracking-[0.2em]">{uploading ? 'Archiving to R2...' : 'Add Scientific Photos'}</span>
        <input type="file" multiple accept="image/*" className="hidden" ref={fileInputRef} onChange={handleImageChange} />
      </button>
    </div>
  );
};

// --- 4. Main Component ---
export default function BuildingForm() {
  // Connection & Offline State
  const [isOnline, setIsOnline] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);

  // Admin & Auth State
  const [isAdmin, setIsAdmin] = useState(false);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [password, setPassword] = useState('');
  
  // Data State
  const [fields, setFields] = useState<CustomField[]>([]);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [reports, setReports] = useState<BuildingReport[]>([]);
  
  // Admin Search/Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDistrict, setFilterDistrict] = useState('All');
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());

  // Schema Editor State
  const [newFieldLabel, setNewFieldLabel] = useState('');
  const [newFieldType, setNewFieldType] = useState<FieldType>('text');
  const [newFieldTooltip, setNewFieldTooltip] = useState('');
  const [newOptions, setNewOptions] = useState<string[]>(['']);

  useEffect(() => {
    loadSchema(); loadReports();
    const update = () => setIsOnline(navigator.onLine);
    window.addEventListener('online', update); window.addEventListener('offline', update);
    checkPending();
    return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update); };
  }, []);

  const checkPending = async () => setPendingCount(await localDB.outbox.count());
  const loadSchema = async () => { const { data } = await supabase.from('survey_schema').select('fields').single(); if(data) setFields(data.fields); };
  const loadReports = async () => { const { data } = await supabase.from('building_reports').select('*').order('created_at', {ascending: false}); if(data) setReports(data); };

  // --- SYNC LOGIC ---
  const runSync = async () => {
    if (!isOnline || syncing) return;
    setSyncing(true);
    const pending = await localDB.outbox.toArray();
    for (const report of pending) {
      const { error } = await supabase.from('building_reports').insert([{ building_id: report.building_id, full_data: report.full_data }]);
      if (!error) await localDB.outbox.delete(report.id!);
    }
    await checkPending(); loadReports(); setSyncing(false); alert("Swiss Cloud Successfully Synced!");
  };

  const submitReport = async () => {
    if (!formData['Building ID']) return alert("Critical: Building ID Required.");
    const entry = { building_id: formData['Building ID'], full_data: formData, timestamp: Date.now() };

    if (isOnline) {
      const { error } = await supabase.from('building_reports').insert([{ building_id: entry.building_id, full_data: entry.full_data }]);
      if (!error) { alert("Survey Packet Uploaded!"); setFormData({}); loadReports(); }
    } else {
      await localDB.outbox.add(entry);
      await checkPending();
      alert("No Signal: Saved to Local Vault. Sync later.");
      setFormData({});
    }
  };

  // --- ADMIN COMMANDS ---
  const addField = async () => {
    if (!newFieldLabel) return;
    const newField: CustomField = {
      id: Date.now().toString(), label: newFieldLabel, type: newFieldType,
      tooltip: newFieldTooltip || 'Professional observation required.',
      options: newFieldType === 'select' ? newOptions.filter(o => o.trim() !== '') : undefined,
    };
    const updated = [...fields, newField];
    setFields(updated);
    await supabase.from('survey_schema').update({ fields: updated }).filter('id', 'neq', '00000000-0000-0000-0000-000000000000');
    setNewFieldLabel(''); setNewFieldTooltip(''); setNewOptions(['']);
  };

  const removeField = async (id: string) => {
    if (!window.confirm("Permanent: Remove this parameter from future forms?")) return;
    const updatedFields = fields.filter(f => f.id !== id);
    setFields(updatedFields);
    await supabase.from('survey_schema').update({ fields: updatedFields }).filter('id', 'neq', '00000000-0000-0000-0000-000000000000');
  };

  const deleteSelected = async () => {
    const count = selectedRows.size;
    if (!window.confirm(`Swiss Protocol: Permanently purge ${count} records and their R2 images?`)) return;
    
    // 1. Scan for R2 filenames to purge
    const filesToPurge: string[] = [];
    reports.filter(r => selectedRows.has(r.id)).forEach(report => {
      Object.values(report.full_data).forEach(val => {
        if (Array.isArray(val)) val.forEach((i: any) => { if(i.url) filesToPurge.push(i.url.split('/').pop()!); });
      });
    });

    // 2. Clear Cloudflare R2 via API
    if (filesToPurge.length > 0) {
      await fetch('/api/delete-file', { method: 'POST', body: JSON.stringify({ keys: filesToPurge }) });
    }

    // 3. Clear Supabase
    await supabase.from('building_reports').delete().in('id', Array.from(selectedRows));
    setSelectedRows(new Set()); loadReports();
    alert("System Cleaned.");
  };

  const exportToExcel = async (subset?: BuildingReport[]) => {
    const dataToExport = subset || reports;
    if (dataToExport.length === 0) return alert("No data to export.");

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Seismic Research Data');
    
    // Header Logic
    const textHeaders = new Set<string>();
    const imageFields = new Map<string, number>();

    dataToExport.forEach(r => {
      Object.entries(r.full_data).forEach(([k, v]) => {
        if (Array.isArray(v) && v.length > 0 && v[0].url) {
          imageFields.set(k, Math.max(imageFields.get(k) || 0, v.length));
        } else textHeaders.add(k);
      });
    });

    const columns: any[] = [
      { header: 'TIMESTAMP', key: 'date', width: 20 },
      { header: 'BUILDING ID', key: 'id', width: 20 }
    ];
    textHeaders.forEach(h => columns.push({ header: h.toUpperCase(), key: h, width: 25 }));
    imageFields.forEach((max, label) => {
      for (let i = 1; i <= max; i++) {
        columns.push({ header: `${label.toUpperCase()} ${i}`, key: `${label}_${i}`, width: 30 });
      }
    });

    worksheet.columns = columns;

    dataToExport.forEach(r => {
      const row: any = { date: new Date(r.created_at).toLocaleString(), id: r.building_id };
      textHeaders.forEach(h => row[h] = r.full_data[h]);
      imageFields.forEach((max, label) => {
        const photos = r.full_data[label];
        if (Array.isArray(photos)) photos.forEach((p, idx) => {
          row[`${label}_${idx+1}`] = { text: p.label || 'View Evidence', hyperlink: p.url };
        });
      });
      worksheet.addRow(row);
    });

    // High-End Formatting
    worksheet.eachRow((row, i) => {
      row.eachCell(c => {
        c.alignment = { vertical: 'middle', horizontal: 'center' };
        c.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        if (i === 1) {
          c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } };
          c.font = { color: { argb: 'FFFFFFFF' }, bold: true };
        }
      });
      row.height = 35;
    });

    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), `Seismic_Survey_Final_${Date.now()}.xlsx`);
  };

  // --- FILTERING LOGIC ---
  const filteredReports = reports.filter(r => {
    const matchesDistrict = filterDistrict === 'All' || r.full_data['District'] === filterDistrict;
    const searchLower = searchQuery.toLowerCase();
    const matchesID = r.building_id.toLowerCase().includes(searchLower);
    const matchesGeneric = Object.values(r.full_data).some(v => String(v).toLowerCase().includes(searchLower));
    return matchesDistrict && (matchesID || matchesGeneric);
  });

  return (
    <div className="space-y-12 pb-32 max-w-5xl mx-auto p-6 bg-white min-h-screen">
      
      {/* 1. Global Status Bar */}
      <div className={`p-8 rounded-[3rem] flex items-center justify-between border-4 transition-all shadow-2xl ${isOnline ? 'bg-green-100 border-green-600' : 'bg-orange-100 border-orange-600'}`}>
        <div className="flex items-center gap-5">
          {isOnline ? <Wifi className="text-green-800" size={36} /> : <WifiOff className="text-orange-800" size={36} />}
          <div>
            <p className="text-[11px] font-black uppercase text-slate-500 tracking-[0.2em]">Peshawar Transmission</p>
            <p className={`text-2xl font-black ${isOnline ? 'text-green-950' : 'text-orange-950'}`}>
              {isOnline ? 'Cloud Synchronized' : 'Offline Vault Active'}
            </p>
          </div>
        </div>
        {pendingCount > 0 && isOnline && (
          <button onClick={runSync} disabled={syncing} className="bg-blue-700 text-white px-10 py-4 rounded-full font-black text-sm animate-bounce shadow-xl flex items-center gap-3">
            <RefreshCcw size={20} className={syncing ? 'animate-spin' : ''} />
            SYNC {pendingCount} REPORTS
          </button>
        )}
      </div>

      {/* 2. Top Navigation */}
      <div className="flex justify-between items-center bg-slate-100 p-6 rounded-[2.5rem] border-2 border-slate-200 shadow-sm">
        <button onClick={() => exportToExcel()} className="text-[11px] font-black bg-white px-8 py-4 rounded-2xl border-2 border-slate-300 text-slate-900 hover:border-blue-700 hover:bg-blue-50 transition-all flex items-center gap-3 shadow-sm">
          <FileDown size={20} /> DOWNLOAD MASTER REPOSITORY
        </button>
        <button onClick={() => isAdmin ? setIsAdmin(false) : setShowAdminPanel(!showAdminPanel)} className="text-[11px] font-black text-slate-900 bg-slate-200 px-6 py-4 rounded-2xl hover:bg-slate-300">
          {isAdmin ? 'EXIT ADMIN MODE' : 'ADMIN CONTROL'}
        </button>
      </div>

      {/* 3. Auth Gate */}
      {showAdminPanel && !isAdmin && (
        <div className="bg-white p-12 rounded-[4rem] border-8 border-dashed border-slate-200 max-w-md mx-auto shadow-2xl animate-in zoom-in-95 duration-300">
          <div className="flex justify-center mb-6 text-slate-400"><Database size={48} /></div>
          <h2 className="text-center font-black text-slate-900 uppercase mb-6 tracking-widest text-sm">Security Gateway</h2>
          <input type="password" placeholder="••••••••" className="w-full p-8 rounded-[2.5rem] border-4 border-slate-100 mb-8 text-center font-black text-3xl outline-none focus:border-blue-700 text-slate-950 shadow-inner" value={password} onChange={(e) => setPassword(e.target.value)} />
          <button onClick={() => password === 'swiss2026' ? (setIsAdmin(true), setShowAdminPanel(false), setPassword('')) : alert('Unauthorized Access Attempted')} className="w-full bg-slate-950 text-white p-8 rounded-[2.5rem] font-black uppercase tracking-[0.3em] shadow-2xl active:scale-95 transition-all">Unlock Dashboard</button>
        </div>
      )}

      {/* 4. RESTORED & IMPROVED ADMIN COMMAND CENTER */}
      {isAdmin && (
        <div className="space-y-12 animate-in slide-in-from-top-10 duration-500">
          
          {/* SEARCH & FILTER PORTAL */}
          <div className="bg-white p-10 rounded-[4rem] border-4 border-slate-900 shadow-2xl space-y-8">
            <div className="flex justify-between items-center border-b-4 border-slate-100 pb-8">
              <h3 className="text-sm font-black uppercase tracking-[0.3em] text-slate-900 flex items-center gap-4">
                <ListFilter size={24} /> Data Management Suite
              </h3>
              <div className="flex gap-4">
                <button onClick={() => exportToExcel(reports.filter(r => selectedRows.has(r.id)))} disabled={selectedRows.size === 0} className="bg-blue-700 text-white px-8 py-3 rounded-full text-[10px] font-black disabled:opacity-30">EXPORT SELECTED</button>
                <button onClick={deleteSelected} disabled={selectedRows.size === 0} className="bg-red-600 text-white px-8 py-3 rounded-full text-[10px] font-black disabled:opacity-30 flex items-center gap-2"><Trash2 size={16} /> PURGE DATA</button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="relative">
                <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400" size={24} />
                <input type="text" placeholder="Search Building ID or Metadata..." className="w-full pl-16 pr-8 py-6 bg-slate-100 rounded-3xl font-black text-slate-900 outline-none border-4 border-transparent focus:border-blue-700 transition-all" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
              </div>
              <div className="flex gap-4 items-center bg-slate-100 px-8 py-6 rounded-3xl border-4 border-transparent">
                <Filter size={20} className="text-slate-400" />
                <select className="bg-transparent text-sm font-black text-slate-900 outline-none flex-1 appearance-none" value={filterDistrict} onChange={(e) => setFilterDistrict(e.target.value)}>
                  <option value="All">All Research Regions</option>
                  <option value="Peshawar">Peshawar Division</option>
                  <option value="Swat">Swat Valley</option>
                  <option value="Chitral">Chitral District</option>
                </select>
                <ChevronRight className="rotate-90 text-slate-400" />
              </div>
            </div>

            <div className="overflow-hidden rounded-[3rem] border-4 border-slate-100">
              <table className="w-full text-left">
                <thead className="bg-slate-950 text-white text-[11px] font-black uppercase tracking-[0.2em]">
                  <tr>
                    <th className="p-8 w-10">
                      <button onClick={() => selectedRows.size === filteredReports.length ? setSelectedRows(new Set()) : setSelectedRows(new Set(filteredReports.map(r => r.id)))}>
                        {selectedRows.size === filteredReports.length ? <CheckIcon className="text-blue-400" /> : <Square className="text-slate-700" />}
                      </button>
                    </th>
                    <th className="p-8">Building ID</th>
                    <th className="p-8">Assigned Region</th>
                    <th className="p-8">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y-4 divide-slate-50">
                  {filteredReports.map(r => (
                    <tr key={r.id} className={`transition-colors cursor-pointer ${selectedRows.has(r.id) ? 'bg-blue-50' : 'hover:bg-slate-50'}`} onClick={() => {
                      const n = new Set(selectedRows); n.has(r.id) ? n.delete(r.id) : n.add(r.id); setSelectedRows(n);
                    }}>
                      <td className="p-8">{selectedRows.has(r.id) ? <CheckIcon className="text-blue-700" size={24} /> : <Square className="text-slate-200" size={24} />}</td>
                      <td className="p-8 font-black text-slate-950 text-lg">{r.building_id}</td>
                      <td className="p-8 text-slate-600 font-black uppercase text-xs">{r.full_data['District'] || 'General'}</td>
                      <td className="p-8">
                        <span className="bg-green-100 text-green-700 px-4 py-1.5 rounded-full text-[10px] font-black uppercase">Stored in Cloud</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* PROTOCOL ARCHITECTURE (Schema Editor) */}
          <div className="bg-slate-950 p-12 rounded-[4rem] text-white space-y-10 shadow-2xl">
            <h3 className="text-sm font-black uppercase tracking-[0.3em] text-blue-400 flex items-center gap-4">
              <PlusCircle size={28} /> Advanced Protocol Management
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <p className="text-[10px] font-black uppercase text-blue-200/40 ml-4">Parameter Name</p>
                <input type="text" placeholder="e.g., Seismic Joint Width" className="w-full p-6 bg-white/10 rounded-3xl border-4 border-white/5 text-white font-black outline-none focus:border-blue-500 transition-all" value={newFieldLabel} onChange={(e) => setNewFieldLabel(e.target.value)} />
              </div>
              <div className="space-y-4">
                <p className="text-[10px] font-black uppercase text-blue-200/40 ml-4">Data Input Type</p>
                <select className="w-full p-6 bg-white/10 rounded-3xl border-4 border-white/5 text-white font-black outline-none appearance-none" value={newFieldType} onChange={(e) => setNewFieldType(e.target.value as FieldType)}>
                  <option value="text">Observation Text</option>
                  <option value="select">Dropdown Choices</option>
                  <option value="checkbox">Binary (Verified/No)</option>
                  <option value="image">Scientific Image Capture</option>
                </select>
              </div>
            </div>
            <div className="space-y-4">
              <p className="text-[10px] font-black uppercase text-blue-200/40 ml-4">Engineering Guidelines (Pop-up Tooltip)</p>
              <textarea placeholder="Describe the professional procedure for this field..." className="w-full p-6 bg-white/10 rounded-3xl border-4 border-white/5 text-white font-bold outline-none focus:border-blue-500 min-h-[100px]" value={newFieldTooltip} onChange={(e) => setNewFieldTooltip(e.target.value)} />
            </div>

            {newFieldType === 'select' && (
              <div className="bg-white/5 p-8 rounded-[3rem] border-4 border-white/5 space-y-4">
                <p className="text-[10px] font-black uppercase text-blue-400 mb-2">Available Options</p>
                {newOptions.map((o, i) => (
                  <div key={i} className="flex gap-4">
                    <input type="text" className="flex-1 p-4 bg-white/10 rounded-2xl text-white font-bold border-2 border-white/10" value={o} onChange={(e) => { const u = [...newOptions]; u[i] = e.target.value; setNewOptions(u); }} />
                    <button onClick={() => setNewOptions(newOptions.filter((_, idx) => idx !== i))} className="text-red-400 p-3 hover:bg-red-400/20 rounded-full transition-all"><Trash2 size={20} /></button>
                  </div>
                ))}
                <button onClick={() => setNewOptions([...newOptions, ''])} className="text-xs font-black text-blue-400 hover:text-white transition-all">+ APPEND NEW CHOICE</button>
              </div>
            )}
            <button onClick={addField} className="w-full bg-blue-600 text-white p-8 rounded-[3rem] font-black uppercase tracking-[0.3em] hover:bg-blue-500 transition-all shadow-2xl flex items-center justify-center gap-4">
              <LayoutGrid size={24} /> DEPLOY SYSTEM PARAMETER
            </button>
          </div>
        </div>
      )}

      {/* 5. HIGH-VISIBILITY FIELD RENDERER */}
      <div className="grid grid-cols-1 gap-10">
        <div className="flex items-center gap-4 px-6 border-l-8 border-slate-900">
          <h2 className="text-[12px] font-black text-slate-950 uppercase tracking-[0.3em]">Scientific Collection Protocol</h2>
        </div>
        
        {fields.map(f => (
          <div key={f.id} className="bg-white p-12 rounded-[4rem] border-4 border-slate-100 shadow-sm hover:border-blue-300 hover:shadow-xl transition-all relative group">
            <div className="flex justify-between items-start mb-8">
              <label className="text-[14px] font-black uppercase text-slate-950 tracking-wider flex items-center">
                {f.label} <Tooltip text={f.tooltip} />
              </label>
              {isAdmin && (
                <button onClick={() => removeField(f.id)} className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-600 p-3 transition-all">
                  <Trash2 size={24} />
                </button>
              )}
            </div>
            
            {f.type === 'text' && (
              <input type="text" className="w-full p-8 bg-slate-50 rounded-[2.5rem] font-black text-2xl border-4 border-transparent focus:border-blue-600 focus:bg-white outline-none transition-all text-slate-950 placeholder-slate-300 shadow-inner" 
                placeholder={`Input ${f.label} details...`} value={formData[f.label] || ''} 
                onChange={(e) => setFormData({...formData, [f.label]: e.target.value})} />
            )}
            
            {f.type === 'select' && (
              <div className="relative">
                <select className="w-full p-8 bg-slate-50 rounded-[2.5rem] font-black text-2xl border-4 border-transparent appearance-none text-slate-950 shadow-inner focus:border-blue-600 focus:bg-white transition-all outline-none" 
                  value={formData[f.label] || ''} onChange={(e) => setFormData({...formData, [f.label]: e.target.value})}>
                  <option value="">Select Condition</option>
                  {f.options?.map((o, i) => <option key={i} value={o}>{o}</option>)}
                </select>
                <ChevronRight className="absolute right-10 top-1/2 -translate-y-1/2 rotate-90 text-slate-400" size={32} />
              </div>
            )}

            {f.type === 'image' && <ImageUpload label={f.label} value={formData[f.label] || []} onChange={(imgs) => setFormData({...formData, [f.label]: imgs})} />}

            {f.type === 'checkbox' && (
              <label className="flex items-center gap-8 p-10 bg-slate-50 rounded-[3rem] cursor-pointer border-4 border-transparent hover:border-blue-600 hover:bg-white transition-all shadow-inner">
                <input type="checkbox" className="w-10 h-10 accent-blue-700 rounded-2xl shadow-md" checked={!!formData[f.label]} onChange={(e) => setFormData({...formData, [f.label]: e.target.checked})} />
                <span className="text-lg font-black uppercase text-slate-950 tracking-[0.2em]">Verified Observation</span>
              </label>
            )}
          </div>
        ))}
      </div>

      {/* 6. GLOBAL SUBMISSION BUTTON */}
      {!isAdmin && (
        <button onClick={submitReport} className="w-full bg-blue-700 text-white font-black py-10 rounded-[4rem] shadow-2xl hover:bg-blue-800 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-5 uppercase tracking-[0.3em] text-lg sticky bottom-10 z-10 border-[12px] border-white ring-4 ring-slate-100">
          <CheckSquare size={32} /> {isOnline ? 'ARCHIVE TO CLOUD' : 'LOCK IN LOCAL VAULT'}
        </button>
      )}

      {/* Photo Viewer (Overlay) */}
      {false && (
        <div className="fixed inset-0 z-[200] bg-slate-950/95 backdrop-blur-3xl flex items-center justify-center p-10 animate-in fade-in duration-300">
          <button className="absolute top-10 right-10 text-white bg-white/10 p-5 rounded-full hover:bg-white/20 transition-all"><X size={32} /></button>
          <div className="max-w-6xl w-full grid grid-cols-1 md:grid-cols-2 gap-10 max-h-[90vh] overflow-y-auto p-10 custom-scrollbar">
            {/* Map photos here */}
          </div>
        </div>
      )}

    </div>
  );
}