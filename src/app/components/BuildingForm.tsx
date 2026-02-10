'use client';

// ==========================================
// 1. IMPORTS & SYSTEM CONFIGURATION
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
  LayoutGrid, ListFilter, Edit3, ArrowLeft, ArrowRight, AlertTriangle, Layers, MapPin, ClipboardList, Loader2, PenTool
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

// --- Types & Interfaces ---
type FieldType = 'text' | 'number' | 'select' | 'checkbox' | 'image' | 'gps';

interface CustomField { 
  id: string; 
  label: string; 
  type: FieldType; 
  tooltip: string; 
  options?: string[]; 
  required?: boolean;
}

interface Section {
  id: string;
  title: string;
  fields: CustomField[];
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

// --- CONSTANTS: SWISS PROFORMA DEFAULTS ---
const DEFAULT_SECTIONS: Section[] = [
  {
    id: 'sec_ident', title: '1. Identification & Location',
    fields: [
      { id: 'f_id', label: 'Building ID', type: 'text', tooltip: 'Unique Code (e.g. PS-001)', required: true },
      { id: 'f_date', label: 'Survey Date', type: 'text', tooltip: 'DD/MM/YYYY', required: true },
      { id: 'f_dist', label: 'District / Tehsil', type: 'text', tooltip: 'Admin Boundary', required: true },
      { id: 'f_vill', label: 'Village / Locality', type: 'text', tooltip: 'Specific Location', required: true },
      { id: 'f_gps', label: 'GPS Coordinates', type: 'gps', tooltip: 'Satellite Lock Required', required: true },
      { id: 'f_surv', label: 'Surveyor Name', type: 'text', tooltip: 'Your Name', required: true },
    ]
  },
  {
    id: 'sec_attr', title: '2. General Attributes',
    fields: [
      { id: 'f_use', label: 'Current Use', type: 'select', tooltip: 'Primary function', options: ['Residential', 'Commercial', 'Religious', 'Mixed', 'Public', 'Storage'] },
      { id: 'f_age', label: 'Estimated Age', type: 'select', tooltip: 'Years since construction', options: ['<10 yrs', '10-30 yrs', '30-60 yrs', '60-100 yrs', '>100 yrs'] },
      { id: 'f_occ', label: 'Occupancy Status', type: 'select', tooltip: 'Current inhabitants', options: ['Occupied', 'Partial', 'Vacant', 'Seasonal'] },
    ]
  },
  {
    id: 'sec_const', title: '3. Construction Typology',
    fields: [
      { id: 'f_type', label: 'Construction Type', type: 'select', tooltip: 'Main structural system', options: ['Stone', 'Block', 'Adobe', 'Mixed', 'Other'] },
      { id: 'f_story', label: 'Number of Stories', type: 'number', tooltip: 'Count G+X', required: true },
      { id: 'f_shape', label: 'Plan Shape', type: 'select', tooltip: 'Footprint geometry', options: ['Rectangular', 'Square', 'L-shaped', 'Irregular'] },
    ]
  },
  {
    id: 'sec_wall', title: '4. Wall System',
    fields: [
      { id: 'f_thick', label: 'Wall Thickness (in)', type: 'number', tooltip: 'External wall', required: true },
      { id: 'f_mat', label: 'Wall Material', type: 'select', tooltip: 'Primary material', options: ['Random Rubble', 'Course Stone', 'Semi-Dressed', 'Solid Block', 'Hollow Block', 'Adobe'] },
      { id: 'f_mort', label: 'Mortar Type', type: 'select', tooltip: 'Binding agent', options: ['Mud', 'Lime', 'Cement', 'Mixed', 'None'] },
      { id: 'f_cond', label: 'Wall Condition', type: 'select', tooltip: 'Visual assessment', options: ['Good', 'Cracked', 'Bulging', 'Damp', 'Severe Distress'] },
    ]
  },
  {
    id: 'sec_doc', title: '5. Documentation',
    fields: [
      { id: 'f_elev', label: 'Elevation Photos', type: 'image', tooltip: 'Front and Side views' },
      { id: 'f_dmgs', label: 'Damage Details', type: 'image', tooltip: 'Close-ups of cracks/failures' },
      { id: 'f_sketch', label: 'Sketch Upload', type: 'image', tooltip: 'Photo of hand-drawn plan' },
    ]
  }
];

// ==========================================
// 2. SUB-COMPONENTS
// ==========================================

// --- High-Contrast Tooltip ---
const Tooltip = ({ text }: { text: string }) => {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <span className="relative ml-2 inline-flex items-center z-10">
      <button type="button" onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}
        className={`w-6 h-6 rounded-full flex items-center justify-center transition-all duration-300 shadow-sm ${isOpen ? 'bg-[#FFDC00] text-[#111111] ring-2 ring-[#111111]' : 'bg-[#AAAAAA] text-[#111111] hover:bg-[#FFDC00]'}`}>
        <Info size={14} strokeWidth={2.5} />
      </button>
      {isOpen && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 w-56 p-4 bg-[#FFDC00] text-[#111111] rounded-xl shadow-[0_10px_40px_rgba(0,0,0,0.5)] text-xs font-bold leading-relaxed border-2 border-[#111111] animate-in fade-in zoom-in-95">
          <p className="border-b-2 border-[#111111]/20 pb-1 mb-1 uppercase font-black text-[9px] tracking-widest">Protocol Guide</p>
          {text}
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-[#FFDC00]" />
        </div>
      )}
    </span>
  );
};

// --- R2 Image Upload ---
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
        className={`w-full py-5 md:py-6 border-2 border-dashed rounded-xl flex flex-col items-center justify-center gap-1 transition-all ${uploading ? 'bg-slate-50 border-blue-400' : 'bg-[#FFFFFF] border-[#AAAAAA] hover:bg-slate-50 hover:border-[#85144B]'}`}>
        <Camera size={24} className={uploading ? 'animate-pulse text-blue-600' : 'text-[#111111]'} />
        <span className="text-[10px] md:text-xs font-black uppercase tracking-widest text-[#111111]">
          {uploading ? 'Uploading...' : 'Add Photos'}
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
  const [isOnline, setIsOnline] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [locating, setLocating] = useState(false);
  
  const [isAdmin, setIsAdmin] = useState(false);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [password, setPassword] = useState('');

  // Section-Based Data Structure
  const [sections, setSections] = useState<Section[]>([]);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [reports, setReports] = useState<BuildingReport[]>([]);
  
  // Admin Features
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDistrict, setFilterDistrict] = useState('All');
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [editingReport, setEditingReport] = useState<BuildingReport | null>(null);
  const [viewingImages, setViewingImages] = useState<ImageObject[] | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 8;

  // Schema Editor
  const [newSectionTitle, setNewSectionTitle] = useState('');
  const [targetSectionId, setTargetSectionId] = useState('');
  const [newFieldLabel, setNewFieldLabel] = useState('');
  const [newFieldType, setNewFieldType] = useState<FieldType>('text');
  const [newFieldTooltip, setNewFieldTooltip] = useState('');
  const [newOptions, setNewOptions] = useState<string[]>(['']);

  useEffect(() => {
    loadSchema();
    loadReports();
    const update = () => setIsOnline(navigator.onLine);
    window.addEventListener('online', update); window.addEventListener('offline', update);
    checkPending();
    return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update); };
  }, []);

  const checkPending = async () => setPendingCount(await localDB.outbox.count());
  
  // --- SCHEMA LOADING WITH FALLBACK ---
  const loadSchema = async () => { 
    const { data } = await supabase.from('survey_schema').select('fields').limit(1).single(); 
    if(data && data.fields) {
        // Migration check: If old flat array, wrap it. Else use as is.
        if (Array.isArray(data.fields) && data.fields.length > 0 && !data.fields[0].fields) {
             setSections([{ id: 'migrated', title: 'Legacy Fields', fields: data.fields }]);
        } else {
             setSections(data.fields);
             if (data.fields.length > 0) setTargetSectionId(data.fields[0].id);
        }
    } else {
        // ** SMART DEFAULT **: If no schema exists, load the UET/EPFL defaults
        setSections(DEFAULT_SECTIONS);
        setTargetSectionId(DEFAULT_SECTIONS[0].id);
    }
  };
  
  const loadReports = async () => { 
    const { data } = await supabase.from('building_reports').select('*').order('created_at', {ascending: false}); 
    if(data) setReports(data); 
  };

  // --- SYNC ENGINE ---
  const runSync = async () => {
    if (!isOnline || syncing) return;
    setSyncing(true);
    try {
      const pending = await localDB.outbox.toArray();
      for (const report of pending) {
        const processedData = JSON.parse(JSON.stringify(report.full_data));
        
        // R2 Upload for offline images
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
                        if (uploadData.url) uploadedImages.push({ url: uploadData.url, label: img.label, isLocal: false });
                    } else { uploadedImages.push(img); }
                }
                processedData[key] = uploadedImages;
            }
        }
        const { error } = await supabase.from('building_reports').insert([{ building_id: report.building_id, full_data: processedData, created_at: new Date(report.timestamp).toISOString() }]);
        if (!error) await localDB.outbox.delete(report.id!);
      }
      await checkPending(); loadReports(); alert(`Synced ${pending.length} reports.`);
    } catch (e) { alert("Sync interrupted."); } finally { setSyncing(false); }
  };

  const submitReport = async () => {
    if (!formData['Building ID']) return alert("Critical: Building ID Required.");
    const entry = { building_id: formData['Building ID'], full_data: formData, timestamp: Date.now() };

    if (isOnline) {
      try {
          const { error } = await supabase.from('building_reports').insert([{ building_id: entry.building_id, full_data: entry.full_data }]);
          if (!error) { alert("Packet Uploaded!"); setFormData({}); loadReports(); } 
          else { throw new Error("DB Error"); }
      } catch (e) {
          await localDB.outbox.add(entry); await checkPending(); alert("Connection unstable. Saved Locally."); setFormData({});
      }
    } else {
      await localDB.outbox.add(entry); await checkPending(); alert("Offline Mode: Saved to Vault."); setFormData({});
    }
  };

  // --- GPS LOGIC (OFFLINE CAPABLE) ---
  const captureGPS = (fieldId: string) => {
      setLocating(true);
      if ("geolocation" in navigator) {
          navigator.geolocation.getCurrentPosition(
            (position) => {
              const { latitude, longitude, accuracy } = position.coords;
              const coords = `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
              setFormData(prev => ({ ...prev, [fieldId]: coords }));
              setLocating(false);
              alert(`Location Locked!\nAccuracy: ±${Math.round(accuracy)} meters`);
            }, 
            (err) => {
              setLocating(false);
              alert(`GPS Error: ${err.message}. Try moving outdoors.`);
            },
            {
                enableHighAccuracy: true, // Forces Hardware GPS
                timeout: 30000,           // 30s timeout for satellite lock
                maximumAge: 0
            }
          );
      } else {
          setLocating(false);
          alert("GPS hardware not found.");
      }
  }

  // --- ADMIN & SCHEMA ---
  const addSection = async () => {
    if (!newSectionTitle) return;
    const newSection: Section = { id: Date.now().toString(), title: newSectionTitle, fields: [] };
    const updated = [...sections, newSection];
    await updateSchema(updated);
    setNewSectionTitle(''); setTargetSectionId(newSection.id);
  };
  
  // NEW: Rename Section
  const renameSection = async (sectionId: string) => {
      const newTitle = prompt("Enter new section name:");
      if (!newTitle) return;
      const updated = sections.map(s => s.id === sectionId ? { ...s, title: newTitle } : s);
      await updateSchema(updated);
  };

  const addField = async () => {
    if (!newFieldLabel || !targetSectionId) return alert("Label/Section missing.");
    const newField: CustomField = {
      id: Date.now().toString(), label: newFieldLabel, type: newFieldType,
      tooltip: newFieldTooltip || 'Observation required.',
      options: newFieldType === 'select' ? newOptions.filter(o => o.trim() !== '') : undefined,
    };
    const updatedSections = sections.map(sec => sec.id === targetSectionId ? { ...sec, fields: [...sec.fields, newField] } : sec);
    await updateSchema(updatedSections);
    setNewFieldLabel(''); setNewOptions(['']);
  };

  const removeField = async (sectionId: string, fieldId: string) => {
    if(!window.confirm("Remove this field?")) return;
    const updatedSections = sections.map(sec => sec.id === sectionId ? { ...sec, fields: sec.fields.filter(f => f.id !== fieldId) } : sec);
    await updateSchema(updatedSections);
  };

  const removeSection = async (sectionId: string) => {
      if(!window.confirm("Delete section and fields?")) return;
      const updated = sections.filter(s => s.id !== sectionId);
      await updateSchema(updated);
      if(updated.length > 0) setTargetSectionId(updated[0].id);
  }

  const updateSchema = async (newSections: Section[]) => {
      setSections(newSections);
      // Upsert logic for schema
      const { data } = await supabase.from('survey_schema').select('id').single();
      if (data) {
          await supabase.from('survey_schema').update({ fields: newSections }).eq('id', data.id);
      } else {
          await supabase.from('survey_schema').insert([{ fields: newSections }]);
      }
  }

  const deleteSelected = async () => {
    if (!window.confirm(`Purge ${selectedRows.size} records?`)) return;
    const filesToPurge: string[] = [];
    reports.filter(r => selectedRows.has(r.id)).forEach(report => {
      Object.values(report.full_data).forEach(val => {
        if (Array.isArray(val)) val.forEach((i: any) => { if(i.url && i.url.includes('r2')) filesToPurge.push(i.url.split('/').pop()!); });
      });
    });
    if (filesToPurge.length > 0) await fetch('/api/delete-file', { method: 'POST', body: JSON.stringify({ keys: filesToPurge }) });
    await supabase.from('building_reports').delete().in('id', Array.from(selectedRows));
    setSelectedRows(new Set()); loadReports();
    alert("System Cleaned.");
  };

  // --- EDIT REPORT LOGIC (Super Admin) ---
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
  
  const handleEditChange = (fieldLabel: string, value: any) => {
      if (!editingReport) return;
      setEditingReport({
          ...editingReport,
          full_data: { ...editingReport.full_data, [fieldLabel]: value }
      });
  };

  // --- EXCEL EXPORT (FLATTENED) ---
  const exportToExcel = async (subset?: BuildingReport[]) => {
    const dataToExport = subset || reports;
    if (dataToExport.length === 0) return alert("No data.");

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Data');
    
    // Headers
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

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    saveAs(blob, `UET_EPFL_Report_${Date.now()}.xlsx`);
  };

  const filteredReports = reports.filter(r => {
    const searchLower = searchQuery.toLowerCase();
    const matchesID = r.building_id.toLowerCase().includes(searchLower);
    const matchesData = Object.values(r.full_data).some(v => String(v).toLowerCase().includes(searchLower));
    return matchesID || matchesData;
  });

  const paginatedReports = filteredReports.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  return (
    <div className="max-w-screen-lg mx-auto px-4 pb-32 pt-6 space-y-8 min-h-screen bg-[#F5F5F5]">
      
      {/* Header Rebranding */}
      <div className="text-center space-y-1">
         <h1 className="text-2xl md:text-3xl font-black text-[#001F3F] tracking-tighter">UET x EPFL</h1>
         <p className="text-xs font-bold text-[#85144B] uppercase tracking-[0.2em]">Building Inventory Proforma</p>
      </div>

      {/* 1. Status Bar */}
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

      {/* 2. Admin Toggle */}
      <div className="flex justify-between items-center bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
        {!isAdmin && <button onClick={() => exportToExcel()} className="text-[10px] font-black bg-white px-3 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-[#001F3F] hover:text-[#39CCCC] transition-colors flex items-center gap-2">
          <FileDown size={14} /> EXCEL
        </button>}
        <button onClick={() => isAdmin ? setIsAdmin(false) : setShowAdminPanel(!showAdminPanel)} className="text-[10px] font-black text-slate-400 hover:text-blue-600 uppercase tracking-wider">
          {isAdmin ? 'Exit Admin' : 'Admin'}
        </button>
      </div>

      {/* 3. Auth */}
      {showAdminPanel && !isAdmin && (
        <div className="bg-slate-100 p-6 rounded-2xl border-2 border-dashed border-slate-300 max-w-sm mx-auto text-center">
          <input type="password" placeholder="Passcode" className="w-full p-3 rounded-xl border text-center font-bold text-lg mb-3 text-black" value={password} onChange={(e) => setPassword(e.target.value)} />
          <button onClick={() => password === 'swiss2026' ? (setIsAdmin(true), setShowAdminPanel(false), setPassword('')) : alert('Denied')} className="w-full bg-[#001F3F] text-[#39CCCC] p-3 rounded-xl font-black text-xs uppercase">Login</button>
        </div>
      )}

      {/* 4. ADMIN DASHBOARD */}
      {isAdmin && (
        <div className="space-y-6 animate-in slide-in-from-top-4">
          
          {/* Data List */}
          <div className="bg-white p-6 rounded-3xl border-2 border-[#001F3F] shadow-xl space-y-4">
             <div className="flex justify-between items-center border-b pb-3">
                 <h3 className="font-black text-[#001F3F] text-xs">DATA RECORDS</h3>
                 <div className="flex gap-2">
                     <button onClick={deleteSelected} className="bg-red-600 text-white text-[10px] font-bold px-3 py-1 rounded">PURGE ({selectedRows.size})</button>
                 </div>
             </div>
             <input type="text" placeholder="Search..." className="w-full p-2 bg-slate-50 border rounded-lg text-xs" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
             
             <div className="max-h-60 overflow-y-auto">
                 {paginatedReports.map(r => (
                     <div key={r.id} className="flex justify-between items-center p-3 border-b text-xs">
                         <span className="font-bold">{r.building_id}</span>
                         <div className="flex gap-2">
                             <button onClick={() => setViewingImages(Object.values(r.full_data).flatMap(v => (Array.isArray(v) && v[0]?.url) ? v : []))} className="text-[#001F3F]"><Eye size={14}/></button>
                             <button onClick={() => setEditingReport(r)} className="text-[#001F3F]"><Edit3 size={14}/></button>
                             <input type="checkbox" checked={selectedRows.has(r.id)} onChange={() => { const n = new Set(selectedRows); n.has(r.id) ? n.delete(r.id) : n.add(r.id); setSelectedRows(n); }} />
                         </div>
                     </div>
                 ))}
             </div>
          </div>

          {/* PROTOCOL EDITOR (Sectioned) */}
          <div className="bg-[#001F3F] p-6 rounded-3xl text-white space-y-6 shadow-lg">
            <h3 className="text-xs font-black uppercase text-[#39CCCC] border-b border-white/20 pb-2">1. Create Section</h3>
            <div className="flex gap-2">
                <input type="text" placeholder="Section Name (e.g. Wall System)" className="flex-1 p-3 bg-white/10 rounded-xl text-xs font-bold border border-white/10 text-white" value={newSectionTitle} onChange={(e) => setNewSectionTitle(e.target.value)} />
                <button onClick={addSection} className="bg-[#39CCCC] text-[#001F3F] px-4 rounded-xl font-black text-xs">ADD</button>
            </div>

            <h3 className="text-xs font-black uppercase text-[#39CCCC] border-b border-white/20 pb-2">2. Add Field to Section</h3>
            <div className="space-y-3">
                <select className="w-full p-3 bg-white rounded-xl text-xs font-bold border border-white/10 text-black" value={targetSectionId} onChange={(e) => setTargetSectionId(e.target.value)}>
                    <option value="">Select Target Section...</option>
                    {sections.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
                </select>

                <div className="grid grid-cols-2 gap-3">
                    <input type="text" placeholder="Field Label" className="p-3 bg-white/10 rounded-xl text-xs font-bold border border-white/10 text-white" value={newFieldLabel} onChange={(e) => setNewFieldLabel(e.target.value)} />
                    <select className="p-3 bg-white rounded-xl text-xs font-bold border border-white/10 text-black" value={newFieldType} onChange={(e) => setNewFieldType(e.target.value as FieldType)}>
                        <option value="text">Text</option><option value="number">Number</option><option value="select">Dropdown</option><option value="checkbox">Check</option><option value="image">Photo</option><option value="gps">GPS</option>
                    </select>
                </div>
                {newFieldType === 'select' && (
                  <div className="flex gap-2">
                      <input type="text" placeholder="Options (comma separated)" className="flex-1 p-3 bg-white/10 rounded-xl text-xs" value={newOptions.join(',')} onChange={(e) => setNewOptions(e.target.value.split(','))} />
                  </div>
                )}
                <button onClick={addField} disabled={!targetSectionId} className="w-full bg-[#39CCCC] text-[#001F3F] p-3 rounded-xl font-black text-xs uppercase tracking-widest mt-2 disabled:opacity-50">DEPLOY FIELD</button>
            </div>
          </div>
        </div>
      )}

      {/* 5. USER FORM RENDERER (SECTIONED) */}
      <div className="space-y-8">
        {sections.map(section => (
            <div key={section.id} className="space-y-4">
                <div className="flex items-center gap-3 border-b-4 border-[#001F3F] pb-2">
                    <Layers className="text-[#001F3F]" size={20} />
                    <h2 className="text-sm font-black text-[#001F3F] uppercase tracking-widest">{section.title}</h2>
                    {isAdmin && (
                        <div className="ml-auto flex gap-2">
                            <button onClick={() => renameSection(section.id)} className="text-blue-500 hover:text-blue-700"><PenTool size={16}/></button>
                            <button onClick={() => removeSection(section.id)} className="text-red-400 hover:text-red-600"><Trash2 size={16}/></button>
                        </div>
                    )}
                </div>

                <div className="grid grid-cols-1 gap-4">
                    {section.fields.map(f => (
                        <div key={f.id} className="bg-white p-4 sm:p-6 rounded-2xl border-2 border-slate-100 shadow-sm relative hover:border-blue-200 transition-colors">
                            <div className="flex justify-between items-center mb-2">
                                <label className="text-[10px] sm:text-xs font-black uppercase text-[#111111] flex items-center gap-1">
                                    {f.label} <Tooltip text={f.tooltip} />
                                    {f.required && <span className="text-red-500">*</span>}
                                </label>
                                {isAdmin && <button onClick={() => removeField(section.id, f.id)} className="text-slate-300 hover:text-red-500"><Trash2 size={14} /></button>}
                            </div>

                            {/* DYNAMIC INPUT RENDERING */}
                            {f.type === 'text' && (
                                <input type="text" className="w-full p-3 bg-[#FFFFFF] rounded-xl font-bold text-sm border-2 border-[#AAAAAA] focus:border-[#85144B] outline-none text-[#111111]" 
                                    placeholder="..." value={formData[f.label] || ''} 
                                    onChange={(e) => setFormData({...formData, [f.label]: e.target.value})} />
                            )}

                            {f.type === 'number' && (
                                <input type="number" className="w-full p-3 bg-[#FFFFFF] rounded-xl font-bold text-sm border-2 border-[#AAAAAA] focus:border-[#85144B] outline-none text-[#111111]" 
                                    placeholder="0" value={formData[f.label] || ''} 
                                    onChange={(e) => setFormData({...formData, [f.label]: e.target.value})} />
                            )}
                            
                            {f.type === 'select' && (
                                <div className="relative">
                                    <select className="w-full p-3 bg-[#FFFFFF] rounded-xl font-bold text-sm border-2 border-[#AAAAAA] focus:border-[#85144B] appearance-none text-[#111111] outline-none" 
                                    value={formData[f.label] || ''} onChange={(e) => setFormData({...formData, [f.label]: e.target.value})}>
                                    <option value="">Select...</option>
                                    {f.options?.map((o, i) => <option key={i} value={o}>{o}</option>)}
                                    </select>
                                    <ChevronRight className="absolute right-3 top-1/2 -translate-y-1/2 rotate-90 text-[#AAAAAA]" size={20} />
                                </div>
                            )}

                            {f.type === 'image' && <ImageUpload label={f.label} value={formData[f.label] || []} onChange={(imgs) => setFormData({...formData, [f.label]: imgs})} />}

                            {f.type === 'gps' && (
                                <div className="flex gap-2">
                                    <input type="text" readOnly className="flex-1 p-3 bg-slate-100 rounded-xl font-mono text-xs border-2" value={formData[f.label] || 'Waiting for signal...'} />
                                    <button onClick={() => captureGPS(f.label)} className="bg-[#85144B] text-white p-3 rounded-xl hover:bg-[#600e35] flex items-center justify-center gap-2">
                                        {locating ? <Loader2 className="animate-spin" size={18} /> : <MapPin size={18} />}
                                    </button>
                                </div>
                            )}

                            {f.type === 'checkbox' && (
                                <label className="flex items-center gap-4 p-3 bg-slate-50 rounded-xl border-2 border-transparent hover:border-[#2ECC40] transition-all cursor-pointer">
                                    <input type="checkbox" className="w-6 h-6 accent-[#2ECC40] rounded" checked={!!formData[f.label]} onChange={(e) => setFormData({...formData, [f.label]: e.target.checked})} />
                                    <span className="text-xs font-bold uppercase text-[#111111]">Verified</span>
                                </label>
                            )}
                        </div>
                    ))}
                    {section.fields.length === 0 && <p className="text-xs text-slate-400 italic text-center py-4">No fields in this section yet.</p>}
                </div>
            </div>
        ))}
      </div>

      {!isAdmin && (
        <button onClick={submitReport} className="w-full bg-[#85144B] text-[#FFFFFF] font-black py-5 rounded-[2rem] shadow-xl hover:scale-[1.01] active:scale-[0.98] transition-all flex items-center justify-center gap-3 uppercase tracking-widest text-xs sticky bottom-4 z-10 border-4 border-white ring-2 ring-slate-100">
          <CheckSquare size={18} /> {isOnline ? 'SUBMIT PROFORMA' : 'SAVE LOCALLY'}
        </button>
      )}

      {/* Image Viewer */}
      {viewingImages && (
        <div className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4">
            <button onClick={() => setViewingImages(null)} className="absolute top-4 right-4 text-white"><X size={32}/></button>
            <div className="grid grid-cols-2 gap-4 max-h-[80vh] overflow-y-auto">
                {viewingImages.map((img, i) => <img key={i} src={img.url} className="w-full rounded border-2 border-[#39CCCC]" />)}
            </div>
        </div>
      )}

      {/* 7. SUPER ADMIN EDIT MODAL */}
      {editingReport && (
        <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b pb-2">
              <h3 className="font-black text-lg text-[#001F3F]">FULL DATA EDITOR</h3>
              <button onClick={() => setEditingReport(null)}><X /></button>
            </div>
            
            {/* Iterate Sections -> Fields */}
            {sections.map(sec => (
              <div key={sec.id} className="space-y-3 border-b pb-4">
                <h4 className="text-xs font-black text-[#85144B] uppercase tracking-widest">{sec.title}</h4>
                {sec.fields.map(f => (
                  <div key={f.id} className="space-y-1">
                    <label className="text-[10px] font-bold uppercase text-black">{f.label}</label>
                    
                    {f.type === 'text' && <input type="text" className="w-full p-3 bg-slate-50 rounded-xl font-bold border" value={editingReport.full_data[f.label] || ''} onChange={(e) => handleEditChange(f.label, e.target.value)} />}
                    
                    {f.type === 'number' && <input type="number" className="w-full p-3 bg-slate-50 rounded-xl font-bold border" value={editingReport.full_data[f.label] || ''} onChange={(e) => handleEditChange(f.label, e.target.value)} />}
                    
                    {f.type === 'select' && (
                       <select className="w-full p-3 bg-slate-50 rounded-xl font-bold border" value={editingReport.full_data[f.label] || ''} onChange={(e) => handleEditChange(f.label, e.target.value)}>
                          <option value="">Select...</option>
                          {f.options?.map(o => <option key={o} value={o}>{o}</option>)}
                       </select>
                    )}

                    {f.type === 'checkbox' && (
                       <div className="flex items-center gap-2">
                         <input type="checkbox" className="w-5 h-5 accent-[#85144B]" checked={!!editingReport.full_data[f.label]} onChange={(e) => handleEditChange(f.label, e.target.checked)} />
                         <span className="text-xs font-bold">Verified</span>
                       </div>
                    )}

                    {f.type === 'image' && (
                       <ImageUpload label={f.label} value={editingReport.full_data[f.label] || []} onChange={(imgs) => handleEditChange(f.label, imgs)} />
                    )}

                    {f.type === 'gps' && <input type="text" className="w-full p-3 bg-slate-100 font-mono text-xs border" value={editingReport.full_data[f.label] || ''} readOnly />}
                  </div>
                ))}
              </div>
            ))}

            <button onClick={saveEditedReport} className="w-full bg-[#001F3F] text-[#39CCCC] py-4 rounded-xl font-black uppercase text-sm sticky bottom-0 shadow-xl">SAVE ALL CHANGES</button>
          </div>
        </div>
      )}

    </div>
  );
}