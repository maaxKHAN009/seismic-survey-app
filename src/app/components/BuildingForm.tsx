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
  Filter, Square, CheckSquare as CheckIcon, Search, Eye, Tag, Wifi, WifiOff, RefreshCcw, 
  LayoutGrid, ListFilter, Edit3, ArrowLeft, ArrowRight
} from 'lucide-react';

// ==========================================
// 1. OFFLINE VAULT (IndexedDB)
// ==========================================
class SeismicDB extends Dexie {
  outbox!: Table<{ id?: number; building_id: string; full_data: any; timestamp: number }>;
  constructor() {
    super('SeismicDB');
    this.version(1).stores({ outbox: '++id, building_id, timestamp' });
  }
}
const localDB = new SeismicDB();

// ==========================================
// 2. TYPES & INTERFACES
// ==========================================
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
}

interface BuildingReport { 
  id: string; 
  building_id: string; 
  created_at: string; 
  full_data: Record<string, any>; 
}

// ==========================================
// 3. SUB-COMPONENTS
// ==========================================

// --- High-Contrast Tooltip ---
const Tooltip = ({ text }: { text: string }) => {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <span className="relative ml-2 inline-flex items-center z-10">
      <button type="button" onClick={() => setIsOpen(!isOpen)} 
        className={`w-7 h-7 rounded-full flex items-center justify-center transition-all duration-300 shadow-sm ${isOpen ? 'bg-[#FFDC00] text-[#111111] ring-2 ring-[#111111]' : 'bg-[#AAAAAA] text-[#111111] hover:bg-[#FFDC00]'}`}>
        <Info size={16} strokeWidth={2.5} />
      </button>
      {isOpen && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 z-50 w-64 p-5 bg-[#FFDC00] text-[#111111] rounded-[1.5rem] shadow-[0_20px_60px_rgba(0,0,0,0.5)] text-[13px] font-bold leading-relaxed border-4 border-[#111111] animate-in fade-in slide-in-from-bottom-2">
          <p className="border-b-2 border-[#111111]/20 pb-2 mb-2 uppercase font-black text-[10px] tracking-widest">Engineering Guidance</p>
          {text}
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-[#FFDC00]" />
        </div>
      )}
    </span>
  );
};

// --- R2 Image Upload with Progress & Labels ---
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

  const updateLabel = (index: number, newText: string) => {
    const updated = [...value];
    updated[index].label = newText;
    onChange(updated);
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-4">
        {value.map((img, i) => (
          <div key={i} className="flex flex-col sm:flex-row gap-4 bg-[#DDDDDD] p-4 rounded-[1.5rem] border-2 border-[#AAAAAA] items-center shadow-inner group">
            <div className="w-full sm:w-24 h-48 sm:h-24 rounded-2xl overflow-hidden shadow-md border-2 border-[#111111] flex-shrink-0 relative">
              <img src={img.url} className="w-full h-full object-cover" alt="" />
              <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[9px] font-bold text-center py-1">R2 CLOUD</div>
            </div>
            <div className="flex-1 w-full">
              <p className="text-[10px] font-black uppercase text-[#111111] mb-1 tracking-widest flex items-center gap-2"><Tag size={12} /> Evidence Label</p>
              <input type="text" value={img.label} onChange={(e) => updateLabel(i, e.target.value)} 
                className="w-full bg-[#FFFFFF] p-3 rounded-xl border-2 border-[#AAAAAA] text-[#111111] font-black outline-none focus:border-[#85144B] transition-all" />
            </div>
            <button onClick={() => onChange(value.filter((_, idx) => idx !== i))} className="w-full sm:w-auto bg-[#85144B] text-[#FFFFFF] p-3 hover:bg-[#600e35] rounded-xl sm:rounded-full transition-colors shadow-lg flex items-center justify-center gap-2">
              <Trash2 size={20} /> <span className="sm:hidden text-xs font-bold uppercase">Remove</span>
            </button>
          </div>
        ))}
      </div>
      <button type="button" onClick={() => fileInputRef.current?.click()} 
        disabled={uploading}
        className={`w-full py-10 border-4 border-dashed rounded-[3rem] flex flex-col items-center justify-center gap-3 transition-all group ${uploading ? 'bg-slate-100 border-blue-400' : 'bg-[#FFFFFF] border-[#AAAAAA] hover:bg-[#DDDDDD] hover:border-[#85144B]'}`}>
        <Camera size={40} className={`transition-transform group-hover:scale-110 ${uploading ? 'animate-pulse text-blue-600' : 'text-[#111111]'}`} />
        <span className="text-sm font-black uppercase tracking-[0.2em] text-[#111111]">
          {uploading ? 'UPLOADING TO SWISS CLOUD...' : 'ADD SCIENTIFIC PHOTOS'}
        </span>
        <input type="file" multiple accept="image/*" className="hidden" ref={fileInputRef} onChange={handleImageChange} />
      </button>
    </div>
  );
};

// ==========================================
// 4. MAIN APPLICATION
// ==========================================
export default function BuildingForm() {
  // --- STATE MANAGEMENT ---
  const [isOnline, setIsOnline] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  
  // Auth
  const [isAdmin, setIsAdmin] = useState(false);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [password, setPassword] = useState('');

  // Core Data
  const [fields, setFields] = useState<CustomField[]>([]);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [reports, setReports] = useState<BuildingReport[]>([]);
  
  // Admin Dashboard Features
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDistrict, setFilterDistrict] = useState('All');
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [viewingImages, setViewingImages] = useState<ImageObject[] | null>(null);
  const [editingReport, setEditingReport] = useState<BuildingReport | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  // Schema Editor
  const [newFieldLabel, setNewFieldLabel] = useState('');
  const [newFieldType, setNewFieldType] = useState<FieldType>('text');
  const [newFieldTooltip, setNewFieldTooltip] = useState('');
  const [newOptions, setNewOptions] = useState<string[]>(['']);

  // --- INITIALIZATION ---
  useEffect(() => {
    loadSchema();
    loadReports();
    
    // Network Listeners
    const update = () => setIsOnline(navigator.onLine);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    
    // Polling for offline data
    checkPending();
    const interval = setInterval(checkPending, 5000); // Check every 5s

    return () => { 
      window.removeEventListener('online', update); 
      window.removeEventListener('offline', update);
      clearInterval(interval);
    };
  }, []);

  // --- DATABASE HELPERS ---
  const checkPending = async () => setPendingCount(await localDB.outbox.count());
  
  const loadSchema = async () => { 
    const { data } = await supabase.from('survey_schema').select('fields').limit(1).single(); 
    if(data) setFields(data.fields); 
  };
  
  const loadReports = async () => { 
    const { data } = await supabase.from('building_reports').select('*').order('created_at', {ascending: false}); 
    if(data) setReports(data); 
  };

  // --- SYNC & SUBMIT ENGINE ---
  const runSync = async () => {
    if (!isOnline || syncing) return;
    setSyncing(true);
    try {
      const pending = await localDB.outbox.toArray();
      for (const report of pending) {
        const { error } = await supabase.from('building_reports').insert([{ 
          building_id: report.building_id, 
          full_data: report.full_data,
          created_at: new Date(report.timestamp).toISOString()
        }]);
        if (!error) await localDB.outbox.delete(report.id!);
      }
      await checkPending(); 
      loadReports(); 
      alert(`Sync Complete! ${pending.length} reports uploaded.`);
    } catch (e) {
      alert("Sync interrupted. Check connection.");
    } finally {
      setSyncing(false);
    }
  };

  const submitReport = async () => {
    if (!formData['Building ID']) return alert("Critical: Building ID Required.");
    const entry = { building_id: formData['Building ID'], full_data: formData, timestamp: Date.now() };

    if (isOnline) {
      const { error } = await supabase.from('building_reports').insert([{ 
        building_id: entry.building_id, 
        full_data: entry.full_data 
      }]);
      if (!error) { 
        alert("Survey Packet Uploaded!"); 
        setFormData({}); 
        loadReports(); 
      } else {
        // Fallback to local if cloud fails
        await localDB.outbox.add(entry);
        alert("Cloud rejected. Saved Locally.");
        setFormData({});
      }
    } else {
      await localDB.outbox.add(entry);
      await checkPending();
      alert("No Signal: Saved to Local Vault. Sync later.");
      setFormData({});
    }
  };

  // --- ADMIN: SCHEMA MANAGEMENT ---
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

  // --- ADMIN: DATA MANAGEMENT & EDITING ---
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
      alert("Report Modifications Saved.");
      setEditingReport(null);
      loadReports();
    } else {
      alert("Update Failed: " + error.message);
    }
  };

  // --- EXCEL EXPORT ENGINE ---
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
        if (Array.isArray(v) && v.length > 0 && typeof v[0] === 'object' && v[0].url) {
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
        // FIX: CHANGED index to idx to match the parameter
        if (Array.isArray(photos)) photos.forEach((p, idx) => {
          row[`${label}_${idx+1}`] = { text: p.label || `Photo ${idx + 1}`, hyperlink: p.url, tooltip: 'View Evidence' };
        });
      });
      worksheet.addRow(row);
    });

    // Formatting
    worksheet.eachRow((row, i) => {
      row.eachCell(c => {
        c.alignment = { vertical: 'middle', horizontal: 'center' };
        c.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        if (i === 1) {
          c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF001F3F' } }; 
          c.font = { color: { argb: 'FF39CCCC' }, bold: true }; 
        }
      });
      row.height = 35;
    });

    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), `Seismic_Survey_Final_${Date.now()}.xlsx`);
  };

  // --- FILTERING & PAGINATION ---
  const filteredReports = reports.filter(r => {
    const matchesDistrict = filterDistrict === 'All' || r.full_data['District'] === filterDistrict;
    const searchLower = searchQuery.toLowerCase();
    const matchesID = r.building_id.toLowerCase().includes(searchLower);
    const matchesGeneric = Object.values(r.full_data).some(v => String(v).toLowerCase().includes(searchLower));
    return matchesDistrict && (matchesID || matchesGeneric);
  });

  const paginatedReports = filteredReports.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  return (
    <div className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8 pb-32 pt-6 space-y-6 md:space-y-10 min-h-screen bg-[#F5F5F5]">
      
      {/* 1. Global Status Bar (Online: Green #2ECC40 | Offline: Orange #FF851B) */}
      <div className={`p-4 md:p-8 rounded-[1.5rem] md:rounded-[3rem] border-4 flex flex-col sm:flex-row items-center justify-between gap-4 transition-all duration-500 shadow-2xl backdrop-blur-xl ${isOnline ? 'bg-[#2ECC40]/90 border-[#111111]/20' : 'bg-[#FF851B]/90 border-[#111111]/20'}`}>
        <div className="flex items-center gap-3 md:gap-5">
          {isOnline ? <Wifi className="text-[#111111] animate-pulse" size={36} /> : <WifiOff className="text-[#000000]" size={36} />}
          <div className="text-center sm:text-left">
            <p className="text-[10px] md:text-[12px] font-black uppercase text-[#111111] tracking-[0.2em] opacity-80">Peshawar Link Status</p>
            <p className={`text-xl md:text-3xl font-black ${isOnline ? 'text-[#111111]' : 'text-[#000000]'}`}>
              {isOnline ? 'LIVE CONNECTION' : 'OFFLINE VAULT'}
            </p>
          </div>
        </div>
        {pendingCount > 0 && isOnline && (
          <button onClick={runSync} disabled={syncing} className="w-full sm:w-auto bg-[#85144B] text-[#FFFFFF] px-8 py-4 rounded-full font-black text-sm md:text-base animate-bounce shadow-[0_10px_20px_rgba(133,20,75,0.4)] flex items-center justify-center gap-3 border-4 border-[#FFFFFF]/20 hover:scale-105 transition-transform">
            <RefreshCcw size={24} className={syncing ? 'animate-spin' : ''} />
            PUSH {pendingCount} PENDING
          </button>
        )}
      </div>

      {/* 2. Responsive Control Bar */}
      <div className="flex flex-wrap justify-between items-center bg-[#FFFFFF]/60 backdrop-blur-2xl p-4 md:p-6 rounded-[2rem] border-2 border-[#FFFFFF] gap-4 shadow-xl">
        <button onClick={() => exportToExcel()} className="text-[11px] md:text-sm font-black bg-[#FFFFFF] px-6 md:px-8 py-3 md:py-4 rounded-2xl border-4 border-[#111111] text-[#111111] hover:bg-[#39CCCC] hover:border-[#001F3F] hover:scale-105 transition-all flex items-center gap-3 shadow-lg">
          <FileDown size={20} /> EXCEL DUMP
        </button>
        <button onClick={() => isAdmin ? setIsAdmin(false) : setShowAdminPanel(!showAdminPanel)} className="text-[11px] md:text-sm font-black text-[#111111] uppercase tracking-widest px-4 py-2 border-b-4 border-transparent hover:border-[#85144B] hover:text-[#85144B] transition-all">
          {isAdmin ? 'LOCK ADMIN' : 'UNLOCK ADMIN'}
        </button>
      </div>

      {/* 3. Auth Gate */}
      {showAdminPanel && !isAdmin && (
        <div className="bg-[#FFFFFF]/90 backdrop-blur-2xl p-8 md:p-12 rounded-[3rem] border-8 border-dashed border-[#AAAAAA]/50 max-w-md mx-auto shadow-[0_20px_50px_rgba(0,0,0,0.2)] animate-in zoom-in-95 duration-500">
          <div className="flex justify-center mb-6 text-[#001F3F]"><Database size={56} /></div>
          <h2 className="text-center font-black text-[#111111] uppercase mb-6 tracking-widest text-sm md:text-base">Security Clearance</h2>
          <input type="password" placeholder="••••••••" className="w-full p-6 md:p-8 rounded-[2rem] border-4 border-[#AAAAAA] mb-8 text-center font-black text-2xl md:text-3xl outline-none focus:border-[#85144B] text-[#111111] shadow-inner bg-[#DDDDDD]/50" value={password} onChange={(e) => setPassword(e.target.value)} />
          <button onClick={() => password === 'swiss2026' ? (setIsAdmin(true), setShowAdminPanel(false), setPassword('')) : alert('Unauthorized')} className="w-full bg-[#001F3F] text-[#39CCCC] p-6 md:p-8 rounded-[2rem] font-black uppercase tracking-[0.3em] shadow-2xl active:scale-95 transition-all text-sm md:text-base hover:bg-[#111111] hover:shadow-[0_0_30px_rgba(57,204,204,0.4)]">ACCESS DASHBOARD</button>
        </div>
      )}

      {/* 4. ADMIN COMMAND CENTER */}
      {isAdmin && (
        <div className="space-y-12 animate-in slide-in-from-top-10 duration-700">
          
          {/* Quick Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-[#001F3F] p-6 rounded-[2rem] text-[#39CCCC]">
              <p className="text-[10px] font-black uppercase tracking-widest mb-1">Total Reports</p>
              <p className="text-3xl font-black text-white">{reports.length}</p>
            </div>
            <div className="bg-[#FFFFFF] p-6 rounded-[2rem] border-2 border-[#DDDDDD]">
              <p className="text-[10px] font-black uppercase tracking-widest mb-1 text-[#AAAAAA]">Regions</p>
              <p className="text-3xl font-black text-[#111111]">{new Set(reports.map(r => r.full_data['District'])).size}</p>
            </div>
            <div className="bg-[#85144B] p-6 rounded-[2rem] text-white">
              <p className="text-[10px] font-black uppercase tracking-widest mb-1">Pending Purge</p>
              <p className="text-3xl font-black">{selectedRows.size}</p>
            </div>
            <div className="bg-[#FFDC00] p-6 rounded-[2rem] text-[#111111]">
              <p className="text-[10px] font-black uppercase tracking-widest mb-1">Storage Est.</p>
              <p className="text-3xl font-black">{(reports.length * 2.5).toFixed(1)} <span className="text-sm">MB</span></p>
            </div>
          </div>

          <div className="bg-[#FFFFFF]/90 backdrop-blur-2xl p-6 md:p-10 rounded-[3rem] border-4 border-[#001F3F]/80 shadow-2xl space-y-8">
            <div className="flex flex-col md:flex-row justify-between items-center border-b-4 border-[#AAAAAA]/20 pb-8 gap-4">
              <h3 className="text-sm md:text-base font-black uppercase tracking-[0.3em] text-[#001F3F] flex items-center gap-4">
                <ListFilter size={28} /> Master Data Suite
              </h3>
              <div className="flex gap-4">
                <button onClick={() => exportToExcel(reports.filter(r => selectedRows.has(r.id)))} disabled={selectedRows.size === 0} className="bg-[#001F3F] text-[#39CCCC] px-6 md:px-8 py-3 md:py-4 rounded-full text-[10px] md:text-xs font-black disabled:opacity-30 border-2 border-[#39CCCC] hover:bg-[#111111] hover:scale-105 transition-all">EXPORT SELECTED</button>
                <button onClick={deleteSelected} disabled={selectedRows.size === 0} className="bg-[#85144B] text-[#FFFFFF] px-6 md:px-8 py-3 md:py-4 rounded-full text-[10px] md:text-xs font-black disabled:opacity-30 flex items-center gap-2 hover:bg-[#600e35] hover:scale-105 transition-all"><Trash2 size={16} /> PURGE</button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="relative">
                <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-[#AAAAAA]" size={24} />
                <input type="text" placeholder="Search by ID, Material, Surveyor..." className="w-full pl-16 pr-8 py-5 md:py-6 bg-[#DDDDDD] rounded-[2rem] font-black text-[#111111] outline-none border-4 border-transparent focus:border-[#001F3F] transition-all text-sm md:text-base placeholder-[#AAAAAA]" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
              </div>
              <div className="flex gap-4 items-center bg-[#DDDDDD] px-8 py-5 md:py-6 rounded-[2rem] border-4 border-transparent">
                <Filter size={24} className="text-[#AAAAAA]" />
                <select className="bg-transparent text-sm md:text-base font-black text-[#111111] outline-none flex-1 appearance-none" value={filterDistrict} onChange={(e) => setFilterDistrict(e.target.value)}>
                  <option value="All">All Research Regions</option>
                  <option value="Peshawar">Peshawar Division</option>
                  <option value="Swat">Swat Valley</option>
                  <option value="Chitral">Chitral District</option>
                </select>
                <ChevronRight className="rotate-90 text-[#AAAAAA]" />
              </div>
            </div>

            <div className="overflow-hidden rounded-[2rem] border-4 border-[#001F3F]">
              <div className="overflow-x-auto">
                <table className="w-full text-left min-w-[600px]">
                  <thead className="bg-[#001F3F] text-[#39CCCC] text-[11px] md:text-xs font-black uppercase tracking-[0.2em]">
                    <tr>
                      <th className="p-6 md:p-8 w-10">
                        <button onClick={() => selectedRows.size === filteredReports.length ? setSelectedRows(new Set()) : setSelectedRows(new Set(filteredReports.map(r => r.id)))}>
                          {selectedRows.size === filteredReports.length ? <CheckIcon className="text-[#39CCCC]" /> : <Square className="text-[#AAAAAA]" />}
                        </button>
                      </th>
                      <th className="p-6 md:p-8">Building ID</th>
                      <th className="p-6 md:p-8">Assigned Region</th>
                      <th className="p-6 md:p-8">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y-4 divide-[#DDDDDD]">
                    {paginatedReports.map(r => {
                      const photos = Object.values(r.full_data).find(v => Array.isArray(v) && v.length > 0 && typeof v[0] === 'object' && v[0].url) as ImageObject[];
                      return (
                        <tr key={r.id} className={`transition-colors cursor-pointer ${selectedRows.has(r.id) ? 'bg-[#DDDDDD]' : 'hover:bg-[#F5F5F5]'}`} onClick={() => {
                          const n = new Set(selectedRows); n.has(r.id) ? n.delete(r.id) : n.add(r.id); setSelectedRows(n);
                        }}>
                          <td className="p-6 md:p-8">{selectedRows.has(r.id) ? <CheckIcon className="text-[#001F3F]" size={24} /> : <Square className="text-[#AAAAAA]" size={24} />}</td>
                          <td className="p-6 md:p-8 font-black text-[#111111] text-base md:text-lg">{r.building_id}</td>
                          <td className="p-6 md:p-8 text-[#555555] font-black uppercase text-xs">{r.full_data['District'] || 'General'}</td>
                          <td className="p-6 md:p-8 flex gap-3">
                            {photos ? (
                              <button onClick={(e) => { e.stopPropagation(); setViewingImages(photos); }} className="bg-[#DDDDDD] p-3 rounded-xl hover:bg-[#39CCCC] text-[#001F3F] transition-colors"><Eye size={18} /></button>
                            ) : null}
                            <button onClick={(e) => { e.stopPropagation(); setEditingReport(r); }} className="bg-[#001F3F] p-3 rounded-xl text-[#39CCCC] hover:bg-[#111111] transition-colors"><Edit3 size={18} /></button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {/* Pagination Controls */}
              <div className="bg-[#001F3F] p-4 flex justify-between items-center text-[#39CCCC]">
                <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} className="flex items-center gap-2 font-black text-xs uppercase disabled:opacity-50"><ArrowLeft size={14} /> Prev</button>
                <span className="text-xs font-black">PAGE {currentPage}</span>
                <button disabled={currentPage * ITEMS_PER_PAGE >= filteredReports.length} onClick={() => setCurrentPage(p => p + 1)} className="flex items-center gap-2 font-black text-xs uppercase disabled:opacity-50">Next <ArrowRight size={14} /></button>
              </div>
            </div>
          </div>

          {/* PROTOCOL ARCHITECTURE (Schema Editor) */}
          <div className="bg-[#001F3F] p-8 md:p-12 rounded-[4rem] text-white space-y-10 shadow-2xl border-4 border-[#39CCCC]">
            <h3 className="text-sm md:text-base font-black uppercase tracking-[0.3em] text-[#39CCCC] flex items-center gap-4">
              <PlusCircle size={28} /> Advanced Protocol Management
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <p className="text-[10px] font-black uppercase text-[#39CCCC] ml-4">Parameter Name</p>
                <input type="text" placeholder="e.g., Seismic Joint Width" className="w-full p-6 bg-[#111111] rounded-3xl border-4 border-[#39CCCC]/30 text-[#FFFFFF] font-black outline-none focus:border-[#39CCCC] transition-all text-sm md:text-base" value={newFieldLabel} onChange={(e) => setNewFieldLabel(e.target.value)} />
              </div>
              <div className="space-y-4">
                <p className="text-[10px] font-black uppercase text-[#39CCCC] ml-4">Input Category</p>
                <select className="w-full p-6 bg-[#111111] rounded-3xl border-4 border-[#39CCCC]/30 text-[#FFFFFF] font-black outline-none appearance-none text-sm md:text-base" value={newFieldType} onChange={(e) => setNewFieldType(e.target.value as FieldType)}>
                  <option value="text">Observation Text</option>
                  <option value="select">Dropdown Choices</option>
                  <option value="checkbox">Binary (Verified/No)</option>
                  <option value="image">Scientific Image Capture</option>
                </select>
              </div>
            </div>
            <div className="space-y-4">
              <p className="text-[10px] font-black uppercase text-[#39CCCC] ml-4">Engineering Guidelines (Pop-up Tooltip)</p>
              <textarea placeholder="Describe the professional procedure for this field..." className="w-full p-6 bg-[#111111] rounded-3xl border-4 border-[#39CCCC]/30 text-[#FFFFFF] font-bold outline-none focus:border-[#39CCCC] min-h-[100px] text-sm md:text-base" value={newFieldTooltip} onChange={(e) => setNewFieldTooltip(e.target.value)} />
            </div>

            {newFieldType === 'select' && (
              <div className="bg-[#111111] p-8 rounded-[3rem] border-4 border-[#39CCCC]/20 space-y-4">
                <p className="text-[10px] font-black uppercase text-[#39CCCC] mb-2">Available Options</p>
                {newOptions.map((o, i) => (
                  <div key={i} className="flex gap-4">
                    <input type="text" className="flex-1 p-4 bg-[#001F3F] rounded-2xl text-[#FFFFFF] font-bold border-2 border-[#39CCCC]/50" value={o} onChange={(e) => { const u = [...newOptions]; u[i] = e.target.value; setNewOptions(u); }} />
                    <button onClick={() => setNewOptions(newOptions.filter((_, idx) => idx !== i))} className="text-[#85144B] p-3 hover:bg-[#85144B]/20 rounded-full transition-all"><Trash2 size={24} /></button>
                  </div>
                ))}
                <button onClick={() => setNewOptions([...newOptions, ''])} className="text-xs font-black text-[#39CCCC] hover:text-[#FFFFFF] transition-all">+ APPEND NEW CHOICE</button>
              </div>
            )}
            <button onClick={addField} className="w-full bg-[#39CCCC] text-[#001F3F] p-8 rounded-[3rem] font-black uppercase tracking-[0.3em] hover:bg-[#FFFFFF] transition-all shadow-2xl flex items-center justify-center gap-4 text-sm md:text-base">
              <LayoutGrid size={24} /> DEPLOY SYSTEM PARAMETER
            </button>
          </div>
        </div>
      )}

      {/* 5. GLASSMORPHIC FIELD RENDERER */}
      <div className="grid grid-cols-1 gap-8 md:gap-12">
        <div className="flex items-center gap-4 px-6 border-l-8 border-[#001F3F]">
          <h2 className="text-[12px] md:text-sm font-black text-[#111111] uppercase tracking-[0.3em]">Scientific Collection Protocol</h2>
        </div>
        
        {fields.map(f => (
          <div key={f.id} className="bg-[#FFFFFF]/70 backdrop-blur-2xl p-8 md:p-12 rounded-[3rem] border-4 border-[#FFFFFF]/50 shadow-[0_8px_30px_rgb(0,0,0,0.06)] hover:border-[#001F3F]/20 hover:shadow-[0_20px_40px_rgba(0,0,0,0.1)] hover:scale-[1.01] transition-all duration-500 relative group">
            <div className="flex justify-between items-start mb-6 md:mb-8">
              <label className="text-[12px] md:text-sm font-black uppercase text-[#111111] tracking-wider flex items-center gap-2">
                {f.label} <Tooltip text={f.tooltip} />
              </label>
              {isAdmin && (
                <button onClick={() => removeField(f.id)} className="opacity-0 group-hover:opacity-100 text-[#AAAAAA] hover:text-[#85144B] p-3 transition-all hover:scale-110">
                  <Trash2 size={24} />
                </button>
              )}
            </div>
            
            {f.type === 'text' && (
              <input type="text" className="w-full p-6 md:p-8 bg-[#F5F5F5]/80 rounded-[2rem] font-black text-lg md:text-2xl border-4 border-transparent focus:border-[#001F3F] focus:bg-[#FFFFFF] outline-none transition-all duration-300 text-[#111111] placeholder-[#AAAAAA] shadow-inner focus:shadow-xl focus:scale-[1.01]" 
                placeholder={`Input ${f.label} details...`} value={formData[f.label] || ''} 
                onChange={(e) => setFormData({...formData, [f.label]: e.target.value})} />
            )}
            
            {f.type === 'select' && (
              <div className="relative">
                <select className="w-full p-6 md:p-8 bg-[#F5F5F5]/80 rounded-[2rem] font-black text-lg md:text-2xl border-4 border-transparent appearance-none text-[#111111] shadow-inner focus:border-[#001F3F] focus:bg-[#FFFFFF] transition-all duration-300 outline-none focus:shadow-xl focus:scale-[1.01]" 
                  value={formData[f.label] || ''} onChange={(e) => setFormData({...formData, [f.label]: e.target.value})}>
                  <option value="">Select Condition</option>
                  {f.options?.map((o, i) => <option key={i} value={o}>{o}</option>)}
                </select>
                <ChevronRight className="absolute right-8 md:right-10 top-1/2 -translate-y-1/2 rotate-90 text-[#AAAAAA]" size={32} />
              </div>
            )}

            {f.type === 'image' && <ImageUpload label={f.label} value={formData[f.label] || []} onChange={(imgs) => setFormData({...formData, [f.label]: imgs})} />}

            {f.type === 'checkbox' && (
              <label className="flex items-center gap-6 md:gap-8 p-8 md:p-10 bg-[#F5F5F5]/80 rounded-[3rem] cursor-pointer border-4 border-transparent hover:border-[#2ECC40] hover:bg-[#FFFFFF] transition-all duration-300 shadow-inner hover:shadow-xl hover:scale-[1.02]">
                <input type="checkbox" className="w-8 h-8 md:w-10 md:h-10 accent-[#2ECC40] rounded-2xl shadow-md transform transition-transform duration-300 group-hover:scale-110" checked={!!formData[f.label]} onChange={(e) => setFormData({...formData, [f.label]: e.target.checked})} />
                <span className="text-sm md:text-lg font-black uppercase text-[#111111] tracking-[0.2em]">Verified Observation</span>
              </label>
            )}
          </div>
        ))}
      </div>

      {/* 6. GLOBAL SUBMISSION BUTTON */}
      {!isAdmin && (
        <button onClick={submitReport} className="w-full bg-[#85144B] text-[#FFFFFF] font-black py-8 md:py-10 rounded-[4rem] shadow-[0_20px_50px_rgba(133,20,75,0.5)] hover:bg-[#600e35] hover:scale-[1.03] active:scale-[0.98] transition-all duration-300 flex items-center justify-center gap-5 uppercase tracking-[0.3em] text-sm md:text-lg sticky bottom-8 z-10 border-[8px] md:border-[12px] border-[#FFFFFF]/80 backdrop-blur-md">
          <CheckSquare size={32} /> {isOnline ? 'ARCHIVE TO CLOUD' : 'LOCK IN LOCAL VAULT'}
        </button>
      )}

      {/* 7. IMAGE VIEWER MODAL */}
      {viewingImages && (
        <div className="fixed inset-0 z-[200] bg-[#001F3F]/95 backdrop-blur-3xl flex items-center justify-center p-6 md:p-10 animate-in fade-in duration-300">
          <button onClick={() => setViewingImages(null)} className="absolute top-6 right-6 md:top-10 md:right-10 text-[#FFFFFF] bg-[#FFFFFF]/10 p-4 md:p-5 rounded-full hover:bg-[#FFFFFF]/20 transition-all"><X size={32} /></button>
          <div className="max-w-6xl w-full grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-10 max-h-[85vh] overflow-y-auto p-4 md:p-10 custom-scrollbar">
            {viewingImages.map((img, i) => (
              <div key={i} className="space-y-4">
                <img src={img.url} className="w-full rounded-[2rem] shadow-2xl border-4 border-[#39CCCC]" alt="Scan" />
                <p className="text-center font-black text-[#39CCCC] uppercase tracking-widest text-xs md:text-sm bg-[#000000]/50 p-3 rounded-xl">{img.label}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 8. REPORT EDITOR MODAL */}
      {editingReport && (
        <div className="fixed inset-0 z-[200] bg-[#FFFFFF]/95 backdrop-blur-xl flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-[3rem] border-8 border-[#001F3F] shadow-2xl p-8 space-y-6">
            <div className="flex justify-between items-center border-b-4 border-[#AAAAAA]/20 pb-4">
              <h3 className="font-black text-2xl text-[#001F3F]">MODIFY REPORT</h3>
              <button onClick={() => setEditingReport(null)}><X size={32} /></button>
            </div>
            {fields.map(f => (
              <div key={f.id} className="space-y-2">
                <label className="text-[10px] font-black uppercase text-[#AAAAAA]">{f.label}</label>
                {f.type === 'text' && <input type="text" className="w-full p-4 bg-[#F5F5F5] rounded-xl font-bold border-2 border-transparent focus:border-[#001F3F]" value={editingReport.full_data[f.label] || ''} onChange={(e) => setEditingReport({ ...editingReport, full_data: { ...editingReport.full_data, [f.label]: e.target.value } })} />}
                {/* Simplified edit logic for brevity, full types supported in main renderer */}
              </div>
            ))}
            <button onClick={saveEditedReport} className="w-full bg-[#001F3F] text-[#39CCCC] py-6 rounded-[2rem] font-black uppercase tracking-widest text-lg hover:scale-[1.02] transition-transform">SAVE CHANGES</button>
          </div>
        </div>
      )}

    </div>
  );
}