'use client';

import { supabase } from '@/lib/supabase';
import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import Dexie, { type Table } from 'dexie';
import ExcelJS from 'exceljs';
// @ts-ignore
import { saveAs } from 'file-saver';
import { 
  Info, Database, Settings, PlusCircle, Trash2, 
  X, CheckSquare, Camera, ChevronRight, FileDown, 
  Filter, Square, CheckSquare as CheckIcon, Search, Eye, Tag, Wifi, WifiOff, RefreshCcw
} from 'lucide-react';

// --- IndexedDB Configuration ---
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

// --- Tooltip Component ---
const Tooltip = ({ text }: { text: string }) => {
  const [isOpen, setIsOpen] = useState(false);
  const iconRef = useRef<HTMLButtonElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  return (
    <span className="relative ml-2 inline-flex items-center">
      <button ref={iconRef} type="button" onClick={() => setIsOpen(!isOpen)} 
        className={`w-5 h-5 rounded-full flex items-center justify-center transition-all ${isOpen ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-500'}`}>
        <Info size={12} strokeWidth={3} />
      </button>
      {isOpen && (
        <div ref={tooltipRef} className="absolute bottom-full mb-3 z-50 w-56 p-4 bg-slate-900 text-white rounded-2xl shadow-2xl text-[11px] leading-relaxed">
          {text}
          <div className="absolute top-full left-2 border-8 border-transparent border-t-slate-900" />
        </div>
      )}
    </span>
  );
};

// --- R2 Image Upload Component ---
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
        else throw new Error("API returned no URL");
      } catch (err) { 
        console.error(err);
        alert(`Failed to upload to R2. Ensure R2_PUBLIC_URL is set in Vercel.`); 
      }
    }
    onChange(newItems);
    setUploading(false);
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3">
        {value.map((img, i) => (
          <div key={i} className="flex gap-4 bg-slate-50 p-3 rounded-2xl border border-slate-100 items-center">
            <img src={img.url} className="w-14 h-14 rounded-xl object-cover border" alt="" />
            <div className="flex-1">
              <p className="text-[10px] font-black uppercase text-slate-400 mb-1">Label</p>
              <input type="text" value={img.label} onChange={(e) => {
                const u = [...value]; u[i].label = e.target.value; onChange(u);
              }} className="w-full bg-white p-2 rounded-lg border text-sm font-bold" />
            </div>
            <button onClick={() => onChange(value.filter((_, idx) => idx !== i))} className="text-red-400 p-2 hover:bg-red-50 rounded-full"><Trash2 size={18} /></button>
          </div>
        ))}
      </div>
      <button type="button" onClick={() => fileInputRef.current?.click()} className="w-full py-8 border-2 border-dashed rounded-[2rem] flex flex-col items-center justify-center gap-1 text-slate-400 hover:bg-blue-50 transition-all">
        <Camera size={28} className={uploading ? 'animate-pulse text-blue-600' : ''} />
        <span className="text-xs font-black uppercase tracking-widest">{uploading ? 'Syncing to Cloud...' : 'Attach Photos'}</span>
        <input type="file" multiple accept="image/*" className="hidden" ref={fileInputRef} onChange={handleImageChange} />
      </button>
    </div>
  );
};

export default function BuildingForm() {
  const [isOnline, setIsOnline] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [password, setPassword] = useState('');
  
  const [fields, setFields] = useState<CustomField[]>([]);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [reports, setReports] = useState<BuildingReport[]>([]);
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDistrict, setFilterDistrict] = useState('All');
  const [viewingImages, setViewingImages] = useState<string[] | null>(null);

  // Admin Field Creation State
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

  const runSync = async () => {
    if (!isOnline) return;
    const pending = await localDB.outbox.toArray();
    for (const report of pending) {
      const { error } = await supabase.from('building_reports').insert([{ building_id: report.building_id, full_data: report.full_data }]);
      if (!error) await localDB.outbox.delete(report.id!);
    }
    await checkPending(); loadReports(); alert("Offline data successfully synced!");
  };

  const submitReport = async () => {
    if (!formData['Building ID']) return alert("Building ID Required.");
    const entry = { building_id: formData['Building ID'], full_data: formData, timestamp: Date.now() };

    if (isOnline) {
      const { error } = await supabase.from('building_reports').insert([{ building_id: entry.building_id, full_data: entry.full_data }]);
      if (!error) { alert("Synced Live!"); setFormData({}); loadReports(); }
    } else {
      await localDB.outbox.add(entry);
      await checkPending();
      alert("Field Saved Locally. Will sync when back in range.");
      setFormData({});
    }
  };

  const deleteSelected = async () => {
    if (!window.confirm(`Purge ${selectedRows.size} entries and R2 photos?`)) return;
    const paths: string[] = [];
    reports.filter(r => selectedRows.has(r.id)).forEach(r => {
      Object.values(r.full_data).forEach(val => {
        if (Array.isArray(val)) val.forEach((i: any) => { if(i.url) paths.push(i.url.split('/').pop()!); });
      });
    });

    if (paths.length > 0) await fetch('/api/delete-file', { method: 'POST', body: JSON.stringify({ keys: paths }) });
    await supabase.from('building_reports').delete().in('id', Array.from(selectedRows));
    setSelectedRows(new Set()); loadReports();
  };

  const addField = async () => {
    if (!newFieldLabel) return;
    const newField: CustomField = {
      id: Date.now().toString(), label: newFieldLabel, type: newFieldType,
      tooltip: newFieldTooltip || 'Guidance required.',
      options: newFieldType === 'select' ? newOptions.filter(o => o.trim() !== '') : undefined,
    };
    const updated = [...fields, newField];
    setFields(updated);
    await supabase.from('survey_schema').update({ fields: updated }).filter('id', 'neq', '00000000-0000-0000-0000-000000000000');
    setNewFieldLabel(''); setNewFieldTooltip(''); setNewOptions(['']);
  };

  const removeField = async (id: string) => {
    const updatedFields = fields.filter(f => f.id !== id);
    setFields(updatedFields);
    await supabase.from('survey_schema').update({ fields: updatedFields }).filter('id', 'neq', '00000000-0000-0000-0000-000000000000');
  };

  const exportToExcel = async (subset?: BuildingReport[]) => {
    const dataToExport = subset || reports;
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Seismic Data');
    const textHeaders = new Set<string>();
    const imageFields = new Map<string, number>();

    dataToExport.forEach(r => {
      Object.entries(r.full_data).forEach(([k, v]) => {
        if (Array.isArray(v) && v.length > 0 && v[0].url) {
          imageFields.set(k, Math.max(imageFields.get(k) || 0, v.length));
        } else textHeaders.add(k);
      });
    });

    const columns: any[] = [{ header: 'DATE', key: 'date', width: 15 }, { header: 'ID', key: 'id', width: 15 }];
    textHeaders.forEach(h => columns.push({ header: h.toUpperCase(), key: h, width: 20 }));
    imageFields.forEach((max, label) => {
      for (let i = 1; i <= max; i++) columns.push({ header: `${label} ${i}`, key: `${label}_${i}`, width: 30 });
    });

    worksheet.columns = columns;
    dataToExport.forEach(r => {
      const row: any = { date: new Date(r.created_at).toLocaleDateString(), id: r.building_id };
      textHeaders.forEach(h => row[h] = r.full_data[h]);
      imageFields.forEach((max, label) => {
        const photos = r.full_data[label];
        if (Array.isArray(photos)) photos.forEach((p, idx) => {
          row[`${label}_${idx+1}`] = { text: p.label || 'View', hyperlink: p.url };
        });
      });
      worksheet.addRow(row);
    });

    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), `Seismic_Report_${Date.now()}.xlsx`);
  };

  const filteredReports = reports.filter(r => {
    const matchesDistrict = filterDistrict === 'All' || r.full_data['District'] === filterDistrict;
    const searchLower = searchQuery.toLowerCase();
    const matchesID = r.building_id.toLowerCase().includes(searchLower);
    return matchesDistrict && matchesID;
  });

  return (
    <div className="space-y-8 pb-24 max-w-4xl mx-auto p-4">
      {/* Offline Status Bar */}
      <div className={`p-4 rounded-[2rem] flex items-center justify-between border-2 transition-all ${isOnline ? 'bg-green-50 border-green-200' : 'bg-orange-50 border-orange-200'}`}>
        <div className="flex items-center gap-3 pl-2">
          {isOnline ? <Wifi className="text-green-600" /> : <WifiOff className="text-orange-600" />}
          <div>
            <p className="text-[10px] font-black uppercase text-slate-400">Network Status</p>
            <p className="text-sm font-bold">{isOnline ? 'Peshawar Cloud Online' : 'Remote Offline Mode'}</p>
          </div>
        </div>
        {pendingCount > 0 && isOnline && (
          <button onClick={runSync} className="bg-blue-600 text-white px-6 py-2 rounded-full text-xs font-black animate-pulse flex items-center gap-2">
            <RefreshCcw size={14} /> SYNC {pendingCount} PENDING
          </button>
        )}
      </div>

      {/* Control Bar */}
      <div className="flex justify-between items-center bg-slate-50 p-4 rounded-3xl border border-slate-200 shadow-sm">
        {!isAdmin && <button onClick={() => exportToExcel()} className="text-[10px] font-black bg-white px-5 py-2.5 rounded-2xl border flex items-center gap-2 hover:border-blue-400 transition-all shadow-sm">
          <FileDown size={16} /> EXPORT RESEARCH DATA
        </button>}
        <button onClick={() => isAdmin ? setIsAdmin(false) : setShowAdminPanel(!showAdminPanel)} className="text-[10px] font-black text-slate-400 hover:text-blue-600 px-4">
          {isAdmin ? 'EXIT ADMIN' : 'ADMIN ACCESS'}
        </button>
      </div>

      {showAdminPanel && !isAdmin && (
        <div className="bg-white p-8 rounded-[2.5rem] border-2 border-dashed border-slate-300 max-w-sm mx-auto shadow-2xl animate-in zoom-in-95">
          <input type="password" placeholder="swiss2026" className="w-full p-5 rounded-2xl border-2 mb-4 text-center font-bold text-xl outline-none focus:border-blue-500" value={password} onChange={(e) => setPassword(e.target.value)} />
          <button onClick={() => password === 'swiss2026' ? (setIsAdmin(true), setShowAdminPanel(false), setPassword('')) : alert('Wrong')} className="w-full bg-blue-600 text-white p-5 rounded-2xl font-black uppercase tracking-widest shadow-xl">Authorize Access</button>
        </div>
      )}

      {/* Admin Panel Logic... (Omitted for brevity, use existing Admin Dashboard code) */}

      {/* Field Renderer - THE FIX: Ensures all fields are reactive */}
      <div className="grid grid-cols-1 gap-6">
        {fields.map(f => (
          <div key={f.id} className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm group hover:border-blue-100 transition-all">
            <div className="flex justify-between items-start mb-4">
              <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center">
                {f.label} <Tooltip text={f.tooltip} />
              </label>
              {isAdmin && <button onClick={() => removeField(f.id)} className="text-slate-200 hover:text-red-500"><Trash2 size={16} /></button>}
            </div>
            
            {f.type === 'text' && (
              <input type="text" className="w-full p-5 bg-slate-50 rounded-2xl font-bold border-2 border-transparent focus:border-blue-500 focus:bg-white outline-none transition-all" 
                placeholder={`Enter ${f.label}...`} value={formData[f.label] || ''} 
                onChange={(e) => setFormData({...formData, [f.label]: e.target.value})} />
            )}
            
            {f.type === 'select' && (
              <div className="relative">
                <select className="w-full p-5 bg-slate-50 rounded-2xl font-bold border-2 border-transparent appearance-none" 
                  value={formData[f.label] || ''} onChange={(e) => setFormData({...formData, [f.label]: e.target.value})}>
                  <option value="">Select Condition</option>
                  {f.options?.map((o, i) => <option key={i} value={o}>{o}</option>)}
                </select>
                <ChevronRight className="absolute right-5 top-1/2 -translate-y-1/2 rotate-90 text-slate-300" />
              </div>
            )}

            {f.type === 'image' && <ImageUpload label={f.label} value={formData[f.label] || []} onChange={(imgs) => setFormData({...formData, [f.label]: imgs})} />}

            {f.type === 'checkbox' && (
              <label className="flex items-center gap-4 p-5 bg-slate-50 rounded-2xl cursor-pointer hover:bg-blue-50 transition-all border-2 border-transparent">
                <input type="checkbox" className="w-6 h-6 accent-blue-600 rounded-lg" checked={!!formData[f.label]} onChange={(e) => setFormData({...formData, [f.label]: e.target.checked})} />
                <span className="text-xs font-black uppercase text-slate-900 tracking-widest">Verify Technical Observation</span>
              </label>
            )}
          </div>
        ))}
      </div>

      {!isAdmin && (
        <button onClick={submitReport} className="w-full bg-blue-600 text-white font-black py-6 rounded-[2.5rem] shadow-2xl hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3 uppercase tracking-widest text-sm sticky bottom-6 z-10 ring-8 ring-white">
          <CheckSquare size={20} /> {isOnline ? 'SYNC RESEARCH PACKET' : 'SAVE TO LOCAL VAULT'}
        </button>
      )}
    </div>
  );
}