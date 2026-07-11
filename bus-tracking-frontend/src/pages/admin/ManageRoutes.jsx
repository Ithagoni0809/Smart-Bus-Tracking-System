// Admin: Manage Routes page - full CRUD, including stop sequencing
import React, { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, Map, Search, X, Save, GripVertical } from 'lucide-react';
import { routeAPI, stopAPI } from '../../services/api';
import Spinner from '../../components/common/Spinner';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';

// A route needs an ORDERED list of stops (min 2), each with its own
// sequence number, distance-from-start, and expected-time-from-start —
// this mirrors what the backend's Route model requires (see routeStopSchema
// in models/Route.js). Without these the API rejects the request with a
// 400 validation error, so the modal collects them directly.
const emptyStopRow = () => ({ stop: '', distanceFromStart: '', expectedTimeFromStart: '' });

const RouteModal = ({ route, allStops, onClose, onSaved }) => {
  const [form, setForm] = useState(
    route
      ? {
          routeNumber: route.routeNumber,
          routeName: route.routeName,
          source: route.source,
          destination: route.destination,
          totalDistance: route.totalDistance,
          expectedDuration: route.expectedDuration,
          fare: route.fare,
          routeType: route.routeType || 'city',
        }
      : {
          routeNumber: '', routeName: '', source: '', destination: '',
          totalDistance: '', expectedDuration: '', fare: '', routeType: 'city',
        }
  );
  const [stopRows, setStopRows] = useState(
    route?.stops?.length
      ? route.stops
          .slice()
          .sort((a, b) => a.sequence - b.sequence)
          .map(s => ({
            stop: s.stop?._id || s.stop,
            distanceFromStart: s.distanceFromStart,
            expectedTimeFromStart: s.expectedTimeFromStart,
          }))
      : [emptyStopRow(), emptyStopRow()]
  );
  const [saving, setSaving] = useState(false);

  const updateStopRow = (idx, field, value) => {
    setStopRows(rows => rows.map((r, i) => (i === idx ? { ...r, [field]: value } : r)));
  };
  const addStopRow = () => setStopRows(rows => [...rows, emptyStopRow()]);
  const removeStopRow = (idx) => setStopRows(rows => rows.length <= 2 ? rows : rows.filter((_, i) => i !== idx));

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (stopRows.length < 2) {
      toast.error('A route needs at least 2 stops (source and destination)');
      return;
    }
    if (stopRows.some(r => !r.stop || r.distanceFromStart === '' || r.expectedTimeFromStart === '')) {
      toast.error('Fill in every stop row completely (or remove empty ones)');
      return;
    }

    const payload = {
      ...form,
      totalDistance: parseFloat(form.totalDistance),
      expectedDuration: parseInt(form.expectedDuration, 10),
      fare: parseFloat(form.fare),
      stops: stopRows.map((r, i) => ({
        stop: r.stop,
        sequence: i + 1,
        distanceFromStart: parseFloat(r.distanceFromStart),
        expectedTimeFromStart: parseInt(r.expectedTimeFromStart, 10),
      })),
    };

    setSaving(true);
    try {
      if (route?._id) {
        await routeAPI.update(route._id, payload);
        toast.success('Route updated');
      } else {
        await routeAPI.create(payload);
        toast.success('Route added');
      }
      onSaved();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save route');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-700">
          <h2 className="font-bold text-gray-900 dark:text-white">{route?._id ? 'Edit Route' : 'Add New Route'}</h2>
          <button onClick={onClose}><X size={18} className="text-gray-400" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {[['routeNumber', 'Route Number', '218K'], ['routeName', 'Route Name', 'Secunderabad - Koti']].map(([k, l, p]) => (
              <div key={k} className={k === 'routeName' ? 'col-span-2' : ''}>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{l}</label>
                <input className="input-field" placeholder={p} value={form[k]}
                  onChange={e => setForm({ ...form, [k]: e.target.value })} required />
              </div>
            ))}
            {[['source', 'Source', 'Secunderabad'], ['destination', 'Destination', 'Koti']].map(([k, l, p]) => (
              <div key={k}>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{l}</label>
                <input className="input-field" placeholder={p} value={form[k]}
                  onChange={e => setForm({ ...form, [k]: e.target.value })} required />
              </div>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Distance (km)</label>
              <input type="number" step="any" className="input-field" value={form.totalDistance}
                onChange={e => setForm({ ...form, totalDistance: e.target.value })} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Duration (min)</label>
              <input type="number" className="input-field" value={form.expectedDuration}
                onChange={e => setForm({ ...form, expectedDuration: e.target.value })} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Fare (₹)</label>
              <input type="number" step="any" className="input-field" value={form.fare}
                onChange={e => setForm({ ...form, fare: e.target.value })} required />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Route Type</label>
            <select className="input-field" value={form.routeType} onChange={e => setForm({ ...form, routeType: e.target.value })}>
              {['city', 'intercity', 'express', 'metro-feeder'].map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          {/* ── Ordered stops ─────────────────────────────────────────── */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Stops (in order — first is boarding, last is final stop)
              </label>
              <button type="button" onClick={addStopRow} className="text-xs text-brand-blue hover:underline flex items-center gap-1">
                <Plus size={12} /> Add stop
              </button>
            </div>
            {allStops.length === 0 && (
              <p className="text-xs text-amber-600 mb-2">
                No stops exist yet — add stops under Manage Stops first, then come back here.
              </p>
            )}
            <div className="space-y-2">
              {stopRows.map((row, idx) => (
                <div key={idx} className="flex items-center gap-2 bg-gray-50 dark:bg-gray-700/30 rounded-lg p-2">
                  <GripVertical size={14} className="text-gray-400 shrink-0" />
                  <span className="text-xs font-semibold text-gray-500 w-4 shrink-0">{idx + 1}</span>
                  <select
                    className="input-field text-xs py-1.5"
                    value={row.stop}
                    onChange={e => updateStopRow(idx, 'stop', e.target.value)}
                    required
                  >
                    <option value="">Select stop…</option>
                    {allStops.map(s => <option key={s._id} value={s._id}>{s.stopName}</option>)}
                  </select>
                  <input
                    type="number" step="any" placeholder="km" title="Distance from start (km)"
                    className="input-field text-xs py-1.5 w-16"
                    value={row.distanceFromStart}
                    onChange={e => updateStopRow(idx, 'distanceFromStart', e.target.value)}
                    required
                  />
                  <input
                    type="number" placeholder="min" title="Expected time from start (minutes)"
                    className="input-field text-xs py-1.5 w-16"
                    value={row.expectedTimeFromStart}
                    onChange={e => updateStopRow(idx, 'expectedTimeFromStart', e.target.value)}
                    required
                  />
                  <button type="button" onClick={() => removeStopRow(idx)} disabled={stopRows.length <= 2}
                    className="text-red-400 hover:text-red-600 disabled:opacity-30 disabled:cursor-not-allowed shrink-0">
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary flex-1">
              {saving ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> : <Save size={15} />}
              {saving ? 'Saving...' : 'Save Route'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const ManageRoutes = () => {
  const [routes, setRoutes] = useState([]);
  const [allStops, setAllStops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(null); // 'new' | route object | null

  const load = async () => {
    try {
      const [routeRes, stopRes] = await Promise.all([
        routeAPI.getAll(),
        stopAPI.getAll({ limit: 200 }),
      ]);
      setRoutes(routeRes.data.routes);
      setAllStops(stopRes.data.stops);
    } catch { toast.error('Failed to load routes'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this route?')) return;
    try { await routeAPI.delete(id); toast.success('Route deleted'); load(); }
    catch (e) { toast.error(e.response?.data?.message || 'Cannot delete - buses may be assigned'); }
  };

  const handleToggle = async (id, isActive) => {
    try {
      await routeAPI.update(id, { isActive: !isActive });
      load();
      toast.success(isActive ? 'Route deactivated' : 'Route activated');
    } catch { toast.error('Update failed'); }
  };

  const filtered = routes.filter(r =>
    r.routeNumber?.toLowerCase().includes(search.toLowerCase()) ||
    r.routeName?.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <div className="flex justify-center items-center min-h-[60vh]"><Spinner size="lg" /></div>;

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-4 animate-fade-in">
      {modal && (
        <RouteModal
          route={modal === 'new' ? null : modal}
          allStops={allStops}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); load(); }}
        />
      )}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Map size={22} className="text-brand-blue" />Manage Routes
        </h1>
        <button onClick={() => setModal('new')} className="btn-primary"><Plus size={16} />Add Route</button>
      </div>
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input className="input-field pl-9" placeholder="Search routes..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-xs text-gray-500 border-b border-gray-100 dark:border-gray-700">
            {['Route No', 'Name', 'Source → Destination', 'Distance', 'Fare', 'Status', 'Actions'].map(h => <th key={h} className="pb-3 font-semibold pr-4">{h}</th>)}
          </tr></thead>
          <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
            {filtered.map(route => (
              <tr key={route._id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                <td className="py-3 font-bold text-brand-navy dark:text-brand-blue pr-4">{route.routeNumber}</td>
                <td className="py-3 font-medium text-gray-800 dark:text-white pr-4 max-w-[150px] truncate">{route.routeName}</td>
                <td className="py-3 text-gray-600 dark:text-gray-400 pr-4 text-xs">{route.source} → {route.destination}</td>
                <td className="py-3 text-gray-600 dark:text-gray-400 pr-4">{route.totalDistance} km</td>
                <td className="py-3 text-gray-600 dark:text-gray-400 pr-4">₹{route.fare}</td>
                <td className="py-3 pr-4">
                  <button onClick={() => handleToggle(route._id, route.isActive)} className={`px-2 py-0.5 rounded-full text-xs font-semibold cursor-pointer ${route.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                    {route.isActive ? 'Active' : 'Inactive'}
                  </button>
                </td>
                <td className="py-3"><div className="flex gap-2">
                  <button onClick={() => setModal(route)} className="p-1.5 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg"><Pencil size={14} /></button>
                  <Link to={`/routes/${route._id}`} className="p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700/30 rounded-lg text-xs flex items-center">View</Link>
                  <button onClick={() => handleDelete(route._id)} className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"><Trash2 size={14} /></button>
                </div></td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <p className="text-center text-gray-500 py-8">No routes found.</p>}
      </div>
    </div>
  );
};
export default ManageRoutes;
