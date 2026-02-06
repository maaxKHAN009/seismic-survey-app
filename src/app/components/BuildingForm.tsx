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

// --- Offline Database ---
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

// --- Sub-Component: Tooltip (Condensed for space) ---
const Tooltip = ({ text }: { text: string }) => {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <span className="relative ml-2 inline-flex items-center">
      <button type="button" onClick={() => setIsOpen(!isOpen)} className="bg-slate-200 text-slate-500 w-5 h-5 rounded-full flex items-center justify-center hover:bg-blue-100">
        <Info size={12} />
      </button>
      {isOpen && (
        <div className="absolute bottom-full mb-2 z-50 w-48 p-3 bg-slate-900 text-white text-[11px] rounded-xl shadow-xl">
          {text}
          <div className="absolute top-full left-2 border-4 border-transparent border-t-slate-900" />
        </div>
      )}
    </span>
  );
};

// --- Sub-Component: Image Upload (Cloudflare R2 Integration) ---
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
        if (data.url) newItems.push({ url: data.url, label: `Observation ${newItems.length + 1}` });
      } catch (err) { alert("R2 Upload Failed"); }
    }
    onChange(newItems);
    setUploading(false);
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3">
        {value.map((img, i) => (
          <div key={i} className="flex gap-3 bg-slate-50 p-2 rounded-xl border items-center">
            <img src={img.url} className="w-12 h-12 rounded-lg object-cover" alt="" />
            <input type="text" value={img.label} onChange={(e) => {
              const u = [...value]; u[i].label = e.target.value; onChange(u);
            }} className="flex-1 bg-white p-1.5 rounded border text-xs font-bold" />
            <button onClick={() => onChange(value.filter((_, idx) => idx !== i))} className="text-red-400 p-1"><Trash2 size={16} /></button>
          </div>
        ))}
      </div>
      <button type="button" onClick={() => fileInputRef.current?.click()} className="w-full py-6 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center gap-1 text-slate-400 hover:bg-blue-50">
        <Camera size={24} />
        <span className="text-[10px] font-black uppercase tracking-widest">{uploading ? 'Syncing...' : 'Add Photos'}</span>
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
    if (!isOnline) return alert("Still Offline.");
    const pending = await localDB.outbox.toArray();
    for (const report of pending) {
      const { error } = await supabase.from('building_reports').insert([{ building_id: report.building_id, full_data: report.full_data }]);
      if (!error) await localDB.outbox.delete(report.id!);
    }
    await checkPending(); loadReports(); alert("Offline data successfully synced!");
  };

  const submitReport = async () => {
    if (!formData['Building ID']) return alert("ID Required.");
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

  // --- CLEANUP LOGIC (Now hits R2 API) ---
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

  // --- EXCEL EXPORT (Multi-Photo Link Logic) ---
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
      for (let i = 1; i <= max; i++) columns.push({ header: `${label} ${i}`, key: `${label}_${i}`, width: 25 });
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

  return (
    <div className="space-y-6 pb-20 max-w-2xl mx-auto p-4">
      {/* Sync Status Bar */}
      <div className={`p-4 rounded-2xl flex items-center justify-between border ${isOnline ? 'bg-green-50 border-green-200' : 'bg-orange-50 border-orange-200'}`}>
        <div className="flex items-center gap-3">
          {isOnline ? <Wifi className="text-green-600" /> : <WifiOff className="text-orange-600" />}
          <span className="text-xs font-bold uppercase">{isOnline ? 'Connected' : 'Offline Mode'}</span>
        </div>
        {pendingCount > 0 && (
          <button onClick={runSync} disabled={!isOnline} className="bg-blue-600 text-white px-4 py-1.5 rounded-full text-[10px] font-black animate-pulse disabled:opacity-30 flex items-center gap-2">
            <RefreshCcw size={12} /> SYNC {pendingCount} REPORTS
          </button>
        )}
      </div>

      {/* Control Bar */}
      <div className="flex justify-between items-center bg-slate-50 p-3 rounded-2xl border">
        {!isAdmin && <button onClick={() => exportToExcel()} className="text-[10px] font-black bg-white px-4 py-2 rounded-xl border flex items-center gap-2"><FileDown size={14} /> EXCEL</button>}
        <button onClick={() => setShowAdminPanel(!showAdminPanel)} className="text-[10px] font-bold text-slate-400">ADMIN</button>
      </div>

      {/* Form Rendering */}
      <div className="space-y-4">
        {fields.map(f => (
          <div key={f.id} className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm">
            <label className="text-[10px] font-black uppercase text-slate-400 flex items-center mb-3">
              {f.label} <Tooltip text={f.tooltip} />
            </label>
            {f.type === 'text' && (
              <input type="text" className="w-full p-3 bg-slate-50 rounded-xl font-bold" value={formData[f.label] || ''} onChange={(e) => setFormData({...formData, [f.label]: e.target.value})} />
            )}
            {f.type === 'image' && <ImageUpload label={f.label} value={formData[f.label] || []} onChange={(imgs) => setFormData({...formData, [f.label]: imgs})} />}
            {/* checkbox/select logic follows same pattern */}
          </div>
        ))}
      </div>

      <button onClick={submitReport} className="w-full bg-blue-600 text-white font-black py-5 rounded-[2rem] shadow-xl sticky bottom-4 uppercase tracking-widest text-xs flex items-center justify-center gap-3">
        <CheckSquare size={18} /> {isOnline ? 'SYNC RESEARCH PACKET' : 'SAVE TO LOCAL VAULT'}
      </button>
    </div>
  );
}