'use client';

import { supabase } from '@/lib/supabase';
import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { 
  Info, Database, Settings, PlusCircle, Trash2, 
  X, CheckSquare, Type, List, Camera, ChevronRight, FileDown, 
  Filter, Square, CheckSquare as CheckIcon, Search, Eye
} from 'lucide-react';

// --- Types ---
type FieldType = 'text' | 'select' | 'checkbox' | 'image';

interface CustomField {
  id: string;
  label: string;
  type: FieldType;
  tooltip: string;
  options?: string[];
}

interface BuildingReport {
  id: string;
  building_id: string;
  created_at: string;
  full_data: Record<string, any>;
}

// --- Smart Tooltip ---
const Tooltip = ({ text }: { text: string }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [positionClass, setPositionClass] = useState('left-1/2 -translate-x-1/2');
  const iconRef = useRef<HTMLButtonElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (tooltipRef.current && !tooltipRef.current.contains(event.target as Node) &&
          iconRef.current && !iconRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  useLayoutEffect(() => {
    if (isOpen && iconRef.current && tooltipRef.current) {
      const iconRect = iconRef.current.getBoundingClientRect();
      const tooltipRect = tooltipRef.current.getBoundingClientRect();
      const screenWidth = window.innerWidth;
      const padding = 20; 
      if (iconRect.left - tooltipRect.width / 2 < padding) setPositionClass('left-0');
      else if (iconRect.right + tooltipRect.width / 2 > screenWidth - padding) setPositionClass('right-0');
      else setPositionClass('left-1/2 -translate-x-1/2');
    }
  }, [isOpen]);

  return (
    <span className="relative ml-2 inline-flex items-center">
      <button ref={iconRef} type="button" onClick={(e) => { e.preventDefault(); setIsOpen(!isOpen); }}
        className={`flex items-center justify-center w-6 h-6 rounded-full transition-all z-20 ${isOpen ? 'bg-blue-600 text-white shadow-lg scale-110' : 'bg-slate-200 text-slate-500 hover:bg-blue-100 hover:text-blue-600'}`}>
        {isOpen ? <X size={12} strokeWidth={3} /> : <Info size={14} strokeWidth={3} />}
      </button>
      {isOpen && (
        <div ref={tooltipRef} className={`absolute bottom-full mb-3 z-50 w-64 p-4 bg-slate-900 text-white rounded-2xl shadow-2xl ring-1 ring-white/10 animate-in fade-in slide-in-from-bottom-2 duration-200 ${positionClass}`}>
          <div className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-2 border-b border-blue-800/30 pb-2">Guidance</div>
          <p className="text-sm font-medium leading-relaxed">{text}</p>
          <div className={`absolute top-full h-0 w-0 border-8 border-transparent border-t-slate-900 ${positionClass === 'left-0' ? 'left-3' : positionClass === 'right-0' ? 'right-3' : 'left-1/2 -translate-x-1/2'}`} />
        </div>
      )}
    </span>
  );
};

// --- Multi-Image Upload Component ---
const ImageUpload = ({ label, value, onChange }: { label: string, value: string[], onChange: (imgs: string[]) => void }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    files.forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => { onChange([...value, reader.result as string]); };
      reader.readAsDataURL(file);
    });
  };
  return (
    <div className="w-full space-y-4">
      {value.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {value.map((img, index) => (
            <div key={index} className="relative aspect-square rounded-xl overflow-hidden shadow-sm group border border-slate-200">
              <img src={img} alt="Capture" className="w-full h-full object-cover" />
              <button onClick={() => onChange(value.filter((_, i) => i !== index))} className="absolute top-1 right-1 p-1.5 bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
      <button type="button" onClick={() => fileInputRef.current?.click()} className="w-full py-8 border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center gap-2 hover:bg-blue-50 transition-all text-slate-400">
        <Camera size={28} />
        <span className="text-xs font-black uppercase tracking-widest px-4 text-center">Add Photos for {label}</span>
        <input type="file" multiple accept="image/*" capture="environment" className="hidden" ref={fileInputRef} onChange={handleImageChange} />
      </button>
    </div>
  );
};

// --- Main Building Form Component ---
export default function BuildingForm() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [password, setPassword] = useState('');
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [fields, setFields] = useState<CustomField[]>([]);
  const [formData, setFormData] = useState<Record<string, any>>({});

  // Data Management State
  const [reports, setReports] = useState<BuildingReport[]>([]);
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [filterDistrict, setFilterDistrict] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewingImages, setViewingImages] = useState<string[] | null>(null);

  // Admin Field State
  const [newFieldLabel, setNewFieldLabel] = useState('');
  const [newFieldType, setNewFieldType] = useState<FieldType>('text');
  const [newFieldTooltip, setNewFieldTooltip] = useState('');
  const [newOptions, setNewOptions] = useState<string[]>(['']);

  useEffect(() => { loadSchema(); loadReports(); }, []);

  const loadSchema = async () => {
    const { data } = await supabase.from('survey_schema').select('fields').limit(1).single();
    if (data) setFields(data.fields);
  };

  const loadReports = async () => {
    const { data } = await supabase.from('building_reports').select('*').order('created_at', { ascending: false });
    if (data) setReports(data);
  };

  const exportToExcel = async (subset?: BuildingReport[]) => {
    const dataToExport = subset || reports;
    if (dataToExport.length === 0) return alert("No data to export.");
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Seismic Survey Data');
    const allKeys = new Set<string>();
    dataToExport.forEach(report => { Object.keys(report.full_data).forEach(key => allKeys.add(key)); });
    const dynamicHeaders = Array.from(allKeys);
    worksheet.columns = [
      { header: 'DATE', key: 'date', width: 15 },
      { header: 'BUILDING ID', key: 'building_id', width: 20 },
      ...dynamicHeaders.map(key => ({ header: key.toUpperCase(), key: key, width: 25 }))
    ];
    dataToExport.forEach(report => {
      const rowData: any = { date: new Date(report.created_at).toLocaleDateString(), building_id: report.building_id };
      dynamicHeaders.forEach(header => {
        const val = report.full_data[header];
        rowData[header] = (Array.isArray(val) && val.length > 0 && typeof val[0] === 'string' && val[0].startsWith('data:image')) 
          ? `${val.length} Image(s) Attached` : val;
      });
      worksheet.addRow(rowData);
    });
    worksheet.eachRow((row, rowNumber) => {
      row.eachCell((cell) => {
        cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
        cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        if (rowNumber === 1) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E40AF' } };
          cell.font = { color: { argb: 'FFFFFFFF' }, bold: true };
        }
      });
      row.height = 25;
    });
    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), `Seismic_Report_${Date.now()}.xlsx`);
  };

  const toggleRow = (id: string) => {
    const newSelected = new Set(selectedRows);
    if (newSelected.has(id)) newSelected.delete(id);
    else newSelected.add(id);
    setSelectedRows(newSelected);
  };

  const deleteSelected = async () => {
    if (!window.confirm(`Delete ${selectedRows.size} building reports forever?`)) return;
    const { error } = await supabase.from('building_reports').delete().in('id', Array.from(selectedRows));
    if (!error) { alert("Deleted successfully."); setSelectedRows(new Set()); loadReports(); }
  };

  const submitReport = async () => {
    if (!formData['Building ID']) return alert("Building ID is required.");
    if (window.confirm(`Submit report for ${formData['Building ID']}?`)) {
      const { error } = await supabase.from('building_reports').insert([{ building_id: formData['Building ID'], full_data: formData }]);
      if (!error) { alert("Submitted!"); setFormData({}); loadReports(); }
    }
  };

  const addField = async () => {
    if (!newFieldLabel) return;
    const newField: CustomField = {
      id: Date.now().toString(), label: newFieldLabel, type: newFieldType,
      tooltip: newFieldTooltip || 'No guidance.',
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

  // --- UNIVERSAL SEARCH & FILTER LOGIC ---
  const filteredReports = reports.filter(r => {
    const matchesDistrict = filterDistrict === 'All' || r.full_data['District'] === filterDistrict;
    const searchLower = searchQuery.toLowerCase();
    const matchesID = r.building_id.toLowerCase().includes(searchLower);
    const matchesData = Object.values(r.full_data).some(val => {
      if (Array.isArray(val)) return false; 
      return String(val).toLowerCase().includes(searchLower);
    });
    return matchesDistrict && (matchesID || matchesData);
  });

  return (
    <div className="space-y-10 pb-20">
      {/* Photo Viewer Modal */}
      {viewingImages && (
        <div className="fixed inset-0 z-[100] bg-slate-900/95 backdrop-blur-md flex items-center justify-center p-6 animate-in fade-in">
          <button onClick={() => setViewingImages(null)} className="absolute top-6 right-6 text-white bg-white/10 p-3 rounded-full hover:bg-white/20 transition-all"><X /></button>
          <div className="max-w-4xl w-full grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[80vh] overflow-y-auto p-4 custom-scrollbar">
            {viewingImages.map((img, i) => (
              <img key={i} src={img} className="w-full rounded-2xl shadow-2xl border-4 border-white/10" alt="Building Capture" />
            ))}
          </div>
        </div>
      )}

      {/* Header Bar */}
      <div className="flex justify-between items-center bg-slate-50 p-4 rounded-2xl border border-slate-200 shadow-sm">
        {!isAdmin && <button onClick={() => exportToExcel()} className="text-[10px] font-black bg-white border border-slate-300 px-4 py-2 rounded-xl flex items-center gap-2 text-slate-600 hover:border-blue-400">
          <FileDown size={14} /> BACKUP DATABASE
        </button>}
        <button onClick={() => isAdmin ? setIsAdmin(false) : setShowAdminPanel(!showAdminPanel)} className="text-xs font-bold text-slate-400 flex items-center gap-1">
          <Settings size={14} /> {isAdmin ? 'EXIT ADMIN' : 'ADMIN ACCESS'}
        </button>
      </div>

      {showAdminPanel && !isAdmin && (
        <div className="bg-white p-6 rounded-3xl border-2 border-dashed border-slate-300 max-w-sm mx-auto shadow-2xl">
          <input type="password" placeholder="swiss2026" className="w-full p-4 rounded-2xl border mb-4 text-center font-bold text-lg" value={password} onChange={(e) => setPassword(e.target.value)} />
          <button onClick={() => { if(password === 'swiss2026') {setIsAdmin(true); setShowAdminPanel(false); setPassword('');} else alert('Wrong Password'); }} className="w-full bg-blue-600 text-white p-4 rounded-2xl font-black uppercase tracking-widest">Verify Access</button>
        </div>
      )}

      {/* Admin Power Dashboard */}
      {isAdmin && (
        <div className="space-y-8 animate-in slide-in-from-top-4">
          <div className="bg-white p-8 rounded-[2.5rem] border-2 border-blue-100 shadow-2xl space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <h3 className="text-sm font-black text-blue-900 uppercase flex items-center gap-2"><Database size={18} /> Building Repository</h3>
              <div className="flex gap-2">
                <button onClick={() => exportToExcel(reports.filter(r => selectedRows.has(r.id)))} disabled={selectedRows.size === 0} className="bg-blue-600 text-white text-[10px] font-bold px-5 py-2.5 rounded-full disabled:opacity-30 shadow-md">EXPORT SELECTED ({selectedRows.size})</button>
                <button onClick={deleteSelected} disabled={selectedRows.size === 0} className="bg-red-50 text-red-600 text-[10px] font-bold px-4 py-2.5 rounded-full hover:bg-red-100"><Trash2 size={16} /></button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input type="text" placeholder="Search ID or Field..." className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
              </div>
              <div className="flex gap-3 items-center bg-slate-50 px-4 py-3.5 rounded-2xl border border-slate-200">
                <Filter size={16} className="text-slate-400" />
                <select className="bg-transparent text-sm font-bold text-slate-900 outline-none flex-1" value={filterDistrict} onChange={(e) => setFilterDistrict(e.target.value)}>
                  <option value="All">All Regions</option>
                  <option value="Peshawar">Peshawar</option>
                  <option value="Swat">Swat</option>
                  <option value="Chitral">Chitral</option>
                </select>
              </div>
            </div>

            <div className="overflow-x-auto rounded-3xl border border-slate-100">
              <table className="w-full text-left">
                <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b">
                  <tr>
                    <th className="p-5 w-10"></th>
                    <th className="p-5">Building ID</th>
                    <th className="p-5">Details</th>
                    <th className="p-5">Photos</th>
                  </tr>
                </thead>
                <tbody className="text-sm">
                  {filteredReports.map((report) => {
                    const images = Object.values(report.full_data).find(v => Array.isArray(v) && v.length > 0 && typeof v[0] === 'string' && v[0].startsWith('data:image')) as string[];
                    return (
                      <tr key={report.id} className={`border-b border-slate-50 transition-colors ${selectedRows.has(report.id) ? 'bg-blue-50/50' : 'hover:bg-slate-50/50'}`}>
                        <td className="p-5"><button onClick={() => toggleRow(report.id)}>{selectedRows.has(report.id) ? <CheckIcon className="text-blue-600" size={20} /> : <Square className="text-slate-200" size={20} />}</button></td>
                        <td className="p-5 font-black text-slate-900">{report.building_id}</td>
                        <td className="p-5 font-bold text-slate-500 text-[10px] uppercase">{report.full_data['District'] || 'General'}</td>
                        <td className="p-5">
                          {images ? (
                            <button onClick={() => setViewingImages(images)} className="flex items-center gap-1.5 text-blue-600 font-bold hover:underline">
                              <Eye size={16} /> View {images.length}
                            </button>
                          ) : <span className="text-slate-300">No Photos</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white p-8 rounded-[2.5rem] border-2 border-slate-100 space-y-4">
            <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><PlusCircle size={18} /> Append Survey Schema</h3>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <input type="text" placeholder="Label" className="p-4 bg-slate-50 rounded-2xl border text-sm" value={newFieldLabel} onChange={(e) => setNewFieldLabel(e.target.value)} />
              <select className="p-4 bg-slate-50 rounded-2xl border text-sm" value={newFieldType} onChange={(e) => setNewFieldType(e.target.value as FieldType)}>
                <option value="text">Text Field</option><option value="select">Selection Box</option><option value="checkbox">Toggle</option><option value="image">Camera</option>
              </select>
              <input type="text" placeholder="Tooltip" className="p-4 bg-slate-50 rounded-2xl border text-sm" value={newFieldTooltip} onChange={(e) => setNewFieldTooltip(e.target.value)} />
            </div>
            {newFieldType === 'select' && (
              <div className="bg-slate-50 p-4 rounded-2xl space-y-2 border">
                {newOptions.map((o, i) => (
                  <div key={i} className="flex gap-2">
                    <input type="text" className="flex-1 p-2 rounded-lg text-sm" value={o} onChange={(e) => {
                      const u = [...newOptions]; u[i] = e.target.value; setNewOptions(u);
                    }} />
                    <button onClick={() => setNewOptions(newOptions.filter((_, idx) => idx !== i))} className="text-red-400"><Trash2 size={16} /></button>
                  </div>
                ))}
                <button onClick={() => setNewOptions([...newOptions, ''])} className="text-xs font-bold text-blue-600">+ Add Choice</button>
              </div>
            )}
            <button onClick={addField} className="w-full bg-slate-900 text-white font-black py-4 rounded-2xl shadow-xl hover:bg-black transition-all">DEPLOY PROTOCOL UPDATES</button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 relative z-0">
        <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-4">Field Collection Form</h2>
        {fields.map((field) => (
          <div key={field.id} className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm relative">
            <div className="flex justify-between items-start mb-4">
              <label className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center">
                {field.label} <Tooltip text={field.tooltip} />
              </label>
              {isAdmin && <button onClick={() => removeField(field.id)} className="text-slate-300 hover:text-red-500 p-2"><Trash2 size={16} /></button>}
            </div>
            {field.type === 'text' && (
              <input type="text" className="w-full p-4 bg-slate-50 border-2 border-slate-50 rounded-2xl text-slate-900 font-bold outline-none focus:border-blue-500 focus:bg-white transition-all" placeholder={`Enter ${field.label}...`} value={formData[field.label] || ''} onChange={(e) => setFormData({...formData, [field.label]: e.target.value})} />
            )}
            {field.type === 'select' && (
              <div className="relative">
                <select className="w-full p-4 bg-slate-50 border-2 border-slate-50 rounded-2xl text-slate-900 font-bold outline-none appearance-none" value={formData[field.label] || ''} onChange={(e) => setFormData({...formData, [field.label]: e.target.value})}>
                  <option value="">Select Condition</option>
                  {field.options?.map((opt, i) => <option key={i} value={opt}>{opt}</option>)}
                </select>
                <ChevronRight className="absolute right-4 top-1/2 -translate-y-1/2 rotate-90 text-slate-400" />
              </div>
            )}
            {field.type === 'image' && <ImageUpload label={field.label} value={formData[field.label] || []} onChange={(imgs) => setFormData({...formData, [field.label]: imgs})} />}
            {field.type === 'checkbox' && (
              <label className="flex items-center gap-4 p-5 bg-slate-50 border-2 border-slate-50 rounded-2xl cursor-pointer hover:bg-blue-50 transition-colors">
                <input type="checkbox" className="w-6 h-6 accent-blue-600 rounded-lg" checked={!!formData[field.label]} onChange={(e) => setFormData({...formData, [field.label]: e.target.checked})} />
                <span className="text-slate-900 font-black text-xs uppercase tracking-widest">Verify Technical Observation</span>
              </label>
            )}
          </div>
        ))}
      </div>

      {!isAdmin && (
        <button onClick={submitReport} className="w-full bg-blue-600 text-white font-black py-6 rounded-[2.5rem] shadow-2xl hover:bg-blue-700 active:scale-[0.98] transition-all flex items-center justify-center gap-3 uppercase tracking-widest text-sm sticky bottom-6">
          <CheckSquare size={20} /> Submit Research Packet
        </button>
      )}
    </div>
  );
}