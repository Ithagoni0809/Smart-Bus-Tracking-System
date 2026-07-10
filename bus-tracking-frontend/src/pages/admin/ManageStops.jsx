// Admin: Manage Stops page
import React, { useState, useEffect } from 'react';
import { Plus, MapPin, Search, X, Save, Trash2 } from 'lucide-react';
import { stopAPI } from '../../services/api';
import Spinner from '../../components/common/Spinner';
import toast from 'react-hot-toast';

const StopModal = ({ stop, onClose, onSaved }) => {
  const [form, setForm] = useState(stop ? {
    stopName: stop.stopName, stopCode: stop.stopCode, city: stop.city,
    latitude: stop.location?.coordinates[1], longitude: stop.location?.coordinates[0],
    address: stop.address || '', landmark: stop.landmark || ''
  } : { stopName:'', stopCode:'', city:'Hyderabad', latitude:'', longitude:'', address:'', landmark:'' });
  const [saving, setSaving] = useState(false);
  const handleSubmit = async (e) => {
    e.preventDefault(); setSaving(true);
    try {
      if (stop?._id) { await stopAPI.update(stop._id, form); toast.success('Stop updated'); }
      else { await stopAPI.create(form); toast.success('Stop added'); }
      onSaved();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to save stop'); }
    finally { setSaving(false); }
  };
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-700">
          <h2 className="font-bold text-gray-900 dark:text-white">{stop?._id ? 'Edit Stop' : 'Add New Stop'}</h2>
          <button onClick={onClose}><X size={18} className="text-gray-400"/></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-3">
          {[['stopName','Stop Name','Ameerpet X Roads'],['stopCode','Stop Code','HYD-001'],['city','City','Hyderabad'],['address','Address (optional)','Near Apollo Hospital'],['landmark','Landmark (optional)','Apollo Hospital']].map(([k,l,p])=>(
            <div key={k}><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{l}</label>
            <input className="input-field" placeholder={p} value={form[k]} onChange={e=>setForm({...form,[k]:e.target.value})} required={!['address','landmark'].includes(k)} /></div>
          ))}
          <div className="grid grid-cols-2 gap-2">
            <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Latitude</label>
            <input type="number" step="any" className="input-field" placeholder="17.4374" value={form.latitude} onChange={e=>setForm({...form,latitude:e.target.value})} required /></div>
            <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Longitude</label>
            <input type="number" step="any" className="input-field" placeholder="78.4487" value={form.longitude} onChange={e=>setForm({...form,longitude:e.target.value})} required /></div>
          </div>
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary flex-1">{saving ? 'Saving...' : 'Save Stop'}</button>
          </div>
        </form>
      </div>
    </div>
  );
};

const ManageStops = () => {
  const [stops, setStops] = useState([]); const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(''); const [modal, setModal] = useState(null);
  const load = async () => { try { const r = await stopAPI.getAll({ limit:200 }); setStops(r.data.stops); } catch { toast.error('Failed to load stops'); } finally { setLoading(false); } };
  useEffect(()=>{ load(); },[]);
  const handleDelete = async (id) => {
    if (!window.confirm('Delete this stop?')) return;
    try { await stopAPI.delete(id); toast.success('Stop deleted'); load(); } catch { toast.error('Cannot delete - stop may be in use'); }
  };
  const filtered = stops.filter(s => s.stopName?.toLowerCase().includes(search.toLowerCase()) || s.stopCode?.toLowerCase().includes(search.toLowerCase()));
  if (loading) return <div className="flex justify-center items-center min-h-[60vh]"><Spinner size="lg"/></div>;
  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-4 animate-fade-in">
      {modal && <StopModal stop={modal==='new'?null:modal} onClose={()=>setModal(null)} onSaved={()=>{setModal(null);load();}} />}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2"><MapPin size={22} className="text-brand-blue"/>Manage Stops <span className="text-sm font-normal text-gray-500">({stops.length} total)</span></h1>
        <button onClick={()=>setModal('new')} className="btn-primary"><Plus size={16}/>Add Stop</button>
      </div>
      <div className="relative"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
        <input className="input-field pl-9" placeholder="Search stops..." value={search} onChange={e=>setSearch(e.target.value)}/></div>
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-xs text-gray-500 border-b border-gray-100 dark:border-gray-700">
            {['Code','Name','City','Coordinates','Landmark','Actions'].map(h=><th key={h} className="pb-3 font-semibold pr-4">{h}</th>)}
          </tr></thead>
          <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
            {filtered.map(stop=>(
              <tr key={stop._id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                <td className="py-3 font-mono text-xs font-bold text-brand-blue pr-4">{stop.stopCode}</td>
                <td className="py-3 font-medium text-gray-800 dark:text-white pr-4">{stop.stopName}</td>
                <td className="py-3 text-gray-600 dark:text-gray-400 pr-4">{stop.city}</td>
                <td className="py-3 text-gray-500 text-xs font-mono pr-4">
                  {stop.location?.coordinates[1]?.toFixed(4)}, {stop.location?.coordinates[0]?.toFixed(4)}
                </td>
                <td className="py-3 text-gray-500 text-xs pr-4">{stop.landmark||'–'}</td>
                <td className="py-3"><div className="flex gap-2">
                  <button onClick={()=>setModal(stop)} className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg"><MapPin size={14}/></button>
                  <button onClick={()=>handleDelete(stop._id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg"><Trash2 size={14}/></button>
                </div></td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length===0&&<p className="text-center text-gray-500 py-8">No stops found.</p>}
      </div>
    </div>
  );
};
export default ManageStops;
