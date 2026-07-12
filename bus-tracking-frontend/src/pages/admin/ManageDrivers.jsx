// Admin: Manage Drivers page
import React, { useState, useEffect } from 'react';
import { Plus, User, Search, X, Save, Ban, CheckCircle } from 'lucide-react';
import { adminAPI } from '../../services/api';
import Spinner from '../../components/common/Spinner';
import toast from 'react-hot-toast';

const DriverModal = ({ onClose, onSaved }) => {
  const [form, setForm] = useState({ name:'', email:'', phone:'', password:'Driver@1234', employeeId:'', licenseNumber:'', licenseExpiry:'' });
  const [saving, setSaving] = useState(false);
  const handleSubmit = async (e) => {
    e.preventDefault(); setSaving(true);
    try { await adminAPI.createDriver(form); toast.success('Driver account created'); onSaved(); }
    catch (err) { toast.error(err.response?.data?.message || 'Failed to create driver'); }
    finally { setSaving(false); }
  };
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-700">
          <h2 className="font-bold text-gray-900 dark:text-white">Create Driver Account</h2>
          <button onClick={onClose}><X size={18} className="text-gray-400"/></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-3">
          {[['name','Full Name','Raju Kumar'],['email','Email','driver@example.com'],['phone','Phone','9876543210'],['employeeId','Employee ID','EMP001'],['licenseNumber','License Number','TS0120230001234']].map(([k,l,p])=>(
            <div key={k}><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{l}</label>
            <input className="input-field" placeholder={p} value={form[k]} onChange={e=>setForm({...form,[k]:e.target.value})} required /></div>
          ))}
          <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">License Expiry</label>
          <input type="date" className="input-field" value={form.licenseExpiry} onChange={e=>setForm({...form,licenseExpiry:e.target.value})} required /></div>
          <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Temporary Password</label>
          <input className="input-field" value={form.password} onChange={e=>setForm({...form,password:e.target.value})} required /></div>
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary flex-1">
              {saving ? 'Creating...' : 'Create Driver'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const ManageDrivers = () => {
  const [drivers, setDrivers] = useState([]); const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(''); const [showModal, setShowModal] = useState(false);
  const load = async () => { try { const r = await adminAPI.getAllDrivers(); setDrivers(r.data.drivers); } catch { toast.error('Failed to load drivers'); } finally { setLoading(false); } };
  useEffect(()=>{ load(); },[]);
  const handleToggle = async (id, currentStatus, name) => {
    const verb = currentStatus ? 'Deactivate' : 'Activate';
    if (!window.confirm(`${verb} ${name}?`)) return;
    try { await adminAPI.toggleDriverStatus(id); toast.success(`Driver ${currentStatus ? 'deactivated' : 'activated'}`); load(); } catch(e){ toast.error(e.response?.data?.message||'Failed'); }
  };
  const filtered = drivers.filter(d => d.name?.toLowerCase().includes(search.toLowerCase()) || d.employeeId?.toLowerCase().includes(search.toLowerCase()));
  if (loading) return <div className="flex justify-center items-center min-h-[60vh]"><Spinner size="lg"/></div>;
  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-4 animate-fade-in">
      {showModal && <DriverModal onClose={()=>setShowModal(false)} onSaved={()=>{setShowModal(false);load();}} />}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2"><User size={22} className="text-brand-blue"/>Manage Drivers</h1>
        <button onClick={()=>setShowModal(true)} className="btn-primary"><Plus size={16}/>Add Driver</button>
      </div>
      <div className="relative"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
        <input className="input-field pl-9" placeholder="Search by name or employee ID..." value={search} onChange={e=>setSearch(e.target.value)}/></div>
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-xs text-gray-500 border-b border-gray-100 dark:border-gray-700">
            {['Name','Employee ID','Phone','Bus','Route','Status','Action'].map(h=><th key={h} className="pb-3 font-semibold pr-4">{h}</th>)}
          </tr></thead>
          <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
            {filtered.map(d=>(
              <tr key={d._id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                <td className="py-3 font-semibold text-gray-800 dark:text-white pr-4">{d.name}</td>
                <td className="py-3 text-gray-600 dark:text-gray-400 pr-4 font-mono text-xs">{d.employeeId}</td>
                <td className="py-3 text-gray-600 dark:text-gray-400 pr-4">{d.phone}</td>
                <td className="py-3 text-gray-600 dark:text-gray-400 pr-4">{d.assignedBus?.busNumber||'–'}</td>
                <td className="py-3 text-gray-600 dark:text-gray-400 pr-4">{d.assignedRoute?.routeNumber||'–'}</td>
                <td className="py-3 pr-4">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${d.isOnTrip?'bg-green-100 text-green-700':d.isActive?'bg-blue-100 text-blue-700':'bg-gray-100 text-gray-600'}`}>
                    {d.isOnTrip?'On Trip':d.isActive?'Active':'Inactive'}
                  </span>
                </td>
                <td className="py-3">
                  <button
                    onClick={()=>handleToggle(d._id, d.isActive, d.name)}
                    disabled={d.isOnTrip}
                    title={d.isActive ? 'Deactivate' : 'Activate'}
                    className={`p-1.5 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed ${d.isActive ? 'text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20' : 'text-green-500 hover:bg-green-50 dark:hover:bg-green-900/20'}`}
                  >
                    {d.isActive ? <Ban size={14}/> : <CheckCircle size={14}/>}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length===0&&<p className="text-center text-gray-500 py-8">No drivers found.</p>}
      </div>
    </div>
  );
};
export default ManageDrivers;
