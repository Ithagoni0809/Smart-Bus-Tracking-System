// Admin: Manage Routes page
import React, { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, Map, Search, X, Save } from 'lucide-react';
import { routeAPI } from '../../services/api';
import Spinner from '../../components/common/Spinner';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';

const ManageRoutes = () => {
  const [routes, setRoutes] = useState([]); const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const load = async () => { try { const r = await routeAPI.getAll(); setRoutes(r.data.routes); } catch { toast.error('Failed'); } finally { setLoading(false); } };
  useEffect(()=>{ load(); },[]);
  const handleDelete = async (id) => {
    if (!window.confirm('Delete this route?')) return;
    try { await routeAPI.delete(id); toast.success('Route deleted'); load(); } catch(e){ toast.error(e.response?.data?.message||'Cannot delete - buses may be assigned'); }
  };
  const handleToggle = async (id, isActive) => {
    try { await routeAPI.update(id, { isActive: !isActive }); load(); toast.success(isActive ? 'Route deactivated' : 'Route activated'); } catch { toast.error('Update failed'); }
  };
  const filtered = routes.filter(r => r.routeNumber?.toLowerCase().includes(search.toLowerCase()) || r.routeName?.toLowerCase().includes(search.toLowerCase()));
  if (loading) return <div className="flex justify-center items-center min-h-[60vh]"><Spinner size="lg"/></div>;
  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2"><Map size={22} className="text-brand-blue"/>Manage Routes</h1>
        <Link to="/admin/routes/new" className="btn-primary"><Plus size={16}/>Add Route</Link>
      </div>
      <div className="relative"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
        <input className="input-field pl-9" placeholder="Search routes..." value={search} onChange={e=>setSearch(e.target.value)}/></div>
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-xs text-gray-500 border-b border-gray-100 dark:border-gray-700">
            {['Route No','Name','Source → Destination','Distance','Fare','Status','Actions'].map(h=><th key={h} className="pb-3 font-semibold pr-4">{h}</th>)}
          </tr></thead>
          <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
            {filtered.map(route=>(
              <tr key={route._id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                <td className="py-3 font-bold text-brand-navy dark:text-brand-blue pr-4">{route.routeNumber}</td>
                <td className="py-3 font-medium text-gray-800 dark:text-white pr-4 max-w-[150px] truncate">{route.routeName}</td>
                <td className="py-3 text-gray-600 dark:text-gray-400 pr-4 text-xs">{route.source} → {route.destination}</td>
                <td className="py-3 text-gray-600 dark:text-gray-400 pr-4">{route.totalDistance} km</td>
                <td className="py-3 text-gray-600 dark:text-gray-400 pr-4">₹{route.fare}</td>
                <td className="py-3 pr-4">
                  <button onClick={()=>handleToggle(route._id, route.isActive)} className={`px-2 py-0.5 rounded-full text-xs font-semibold cursor-pointer ${route.isActive?'bg-green-100 text-green-700':'bg-gray-100 text-gray-600'}`}>
                    {route.isActive?'Active':'Inactive'}
                  </button>
                </td>
                <td className="py-3"><div className="flex gap-2">
                  <Link to={`/routes/${route._id}`} className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg"><Pencil size={14}/></Link>
                  <button onClick={()=>handleDelete(route._id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg"><Trash2 size={14}/></button>
                </div></td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length===0&&<p className="text-center text-gray-500 py-8">No routes found.</p>}
      </div>
    </div>
  );
};
export default ManageRoutes;
