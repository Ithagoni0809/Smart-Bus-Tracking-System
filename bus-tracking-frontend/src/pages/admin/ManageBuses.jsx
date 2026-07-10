// Admin: Manage Buses page - full CRUD
import React, { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, Bus, Search, X, Save } from 'lucide-react';
import { busAPI } from '../../services/api';
import Spinner from '../../components/common/Spinner';
import toast from 'react-hot-toast';

const BusModal = ({ bus, onClose, onSaved }) => {
  const [form, setForm] = useState(bus || { busNumber:'', vehicleNumber:'', capacity:52, busType:'ordinary' });
  const [saving, setSaving] = useState(false);
  const handleSubmit = async (e) => {
    e.preventDefault(); setSaving(true);
    try {
      if (bus?._id) { await busAPI.update(bus._id, form); toast.success('Bus updated'); }
      else { await busAPI.create(form); toast.success('Bus added'); }
      onSaved();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to save bus'); }
    finally { setSaving(false); }
  };
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-700">
          <h2 className="font-bold text-gray-900 dark:text-white">{bus?._id ? 'Edit Bus' : 'Add New Bus'}</h2>
          <button onClick={onClose}><X size={18} className="text-gray-400" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-3">
          {[['busNumber','Bus Number','AP39Z-1234'],['vehicleNumber','Vehicle Number','TS09EA1234']].map(([k,l,p]) => (
            <div key={k}><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{l}</label>
            <input className="input-field" placeholder={p} value={form[k]} onChange={e=>setForm({...form,[k]:e.target.value})} required /></div>
          ))}
          <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Capacity</label>
          <input type="number" className="input-field" value={form.capacity} onChange={e=>setForm({...form,capacity:parseInt(e.target.value)})} min="1" max="100" required /></div>
          <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Type</label>
          <select className="input-field" value={form.busType} onChange={e=>setForm({...form,busType:e.target.value})}>
            {['ordinary','express','deluxe','ac','metro-luxury'].map(t=><option key={t} value={t}>{t}</option>)}
          </select></div>
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary flex-1">
              {saving ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> : <Save size={15} />}
              {saving ? 'Saving...' : 'Save Bus'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const ManageBuses = () => {
  const [buses, setBuses] = useState([]); const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(''); const [modal, setModal] = useState(null);
  const load = async () => { try { const r = await busAPI.getAll({limit:100}); setBuses(r.data.buses); } catch { toast.error('Failed to load buses'); } finally { setLoading(false); } };
  useEffect(()=>{ load(); },[]);
  const handleDelete = async (id) => {
    if (!window.confirm('Delete this bus?')) return;
    try { await busAPI.delete(id); toast.success('Bus deleted'); load(); } catch(e){ toast.error(e.response?.data?.message||'Cannot delete'); }
  };
  const filtered = buses.filter(b => b.busNumber?.toLowerCase().includes(search.toLowerCase()) || b.vehicleNumber?.toLowerCase().includes(search.toLowerCase()));
  if (loading) return <div className="flex justify-center items-center min-h-[60vh]"><Spinner size="lg" /></div>;
  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-4 animate-fade-in">
      {modal && <BusModal bus={modal==='new'?null:modal} onClose={()=>setModal(null)} onSaved={()=>{setModal(null);load();}} />}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2"><Bus size={22} className="text-brand-blue"/>Manage Buses</h1>
        <button onClick={()=>setModal('new')} className="btn-primary"><Plus size={16}/>Add Bus</button>
      </div>
      <div className="relative"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/><input className="input-field pl-9" placeholder="Search by bus or vehicle number..." value={search} onChange={e=>setSearch(e.target.value)}/></div>
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-xs text-gray-500 border-b border-gray-100 dark:border-gray-700">
            {['Bus No','Vehicle No','Type','Capacity','Route','Status','Actions'].map(h=><th key={h} className="pb-3 font-semibold pr-4">{h}</th>)}
          </tr></thead>
          <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
            {filtered.map(bus=>(
              <tr key={bus._id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                <td className="py-3 font-semibold text-gray-800 dark:text-white pr-4">{bus.busNumber}</td>
                <td className="py-3 text-gray-600 dark:text-gray-400 pr-4">{bus.vehicleNumber}</td>
                <td className="py-3 capitalize text-gray-600 dark:text-gray-400 pr-4">{bus.busType}</td>
                <td className="py-3 text-gray-600 dark:text-gray-400 pr-4">{bus.capacity}</td>
                <td className="py-3 text-gray-600 dark:text-gray-400 pr-4">{bus.assignedRoute?.routeNumber||'–'}</td>
                <td className="py-3 pr-4"><span className={`px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${bus.isActive?'bg-green-100 text-green-700':'bg-gray-100 text-gray-600'}`}>{bus.status}</span></td>
                <td className="py-3"><div className="flex gap-2">
                  <button onClick={()=>setModal(bus)} className="p-1.5 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg"><Pencil size={14}/></button>
                  <button onClick={()=>handleDelete(bus._id)} className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"><Trash2 size={14}/></button>
                </div></td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length===0&&<p className="text-center text-gray-500 py-8">No buses found.</p>}
      </div>
    </div>
  );
};
export default ManageBuses;
