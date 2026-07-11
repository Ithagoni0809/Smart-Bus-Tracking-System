// src/pages/admin/AdminDashboard.jsx
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Bus, Map, Users, AlertTriangle, TrendingUp, Settings, Plus, Activity } from 'lucide-react';
import { busAPI, routeAPI } from '../../services/api';
import { useSocket } from '../../context/SocketContext';
import Spinner from '../../components/common/Spinner';
import toast from 'react-hot-toast';

const StatCard = ({ icon: Icon, label, value, sub, color }) => (
  <div className="card">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{label}</p>
        <p className="text-3xl font-extrabold text-gray-900 dark:text-white mt-1">{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
      <div className={`w-12 h-12 rounded-xl ${color} flex items-center justify-center`}>
        <Icon size={22} className="text-white" />
      </div>
    </div>
  </div>
);

const AdminDashboard = () => {
  const { socket, isConnected } = useSocket();
  const [liveBuses, setLiveBuses] = useState([]);
  const [allBuses, setAllBuses] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [busRes, liveRes, routeRes] = await Promise.all([
          busAPI.getAll({ limit: 100 }),
          busAPI.getLive(),
          routeAPI.getAll(),
        ]);
        setAllBuses(busRes.data.buses);
        setLiveBuses(liveRes.data.buses);
        setRoutes(routeRes.data.routes);
      } catch {
        toast.error('Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    };
    load();
    // Join admin socket room for real-time alerts
    socket?.emit('join-admin');
  }, [socket]);

  // Real-time fleet updates
  useEffect(() => {
    if (!socket) return;
    const onTripStarted = (d) => { toast.success(`🚌 Bus ${d.busNumber} started a trip`); };
    const onTripEnded   = (d) => { setLiveBuses((p) => p.filter((b) => b._id !== d.busId)); };
    const onEmergency   = (d) => {
      toast.error(`🚨 EMERGENCY: Bus ${d.busNumber} — ${d.message}`, { duration: 10000 });
      setAlerts((prev) => [{ ...d, type: 'emergency', ts: new Date() }, ...prev.slice(0, 9)]);
    };
    const onBreakdown   = (d) => {
      toast.error(`🔧 BREAKDOWN: Bus ${d.busId}`, { duration: 8000 });
      setAlerts((prev) => [{ ...d, type: 'breakdown', ts: new Date() }, ...prev.slice(0, 9)]);
    };
    socket.on('trip-started',    onTripStarted);
    socket.on('trip-ended',      onTripEnded);
    socket.on('emergency-alert', onEmergency);
    socket.on('breakdown-report',onBreakdown);
    return () => {
      socket.off('trip-started',    onTripStarted);
      socket.off('trip-ended',      onTripEnded);
      socket.off('emergency-alert', onEmergency);
      socket.off('breakdown-report',onBreakdown);
    };
  }, [socket]);

  if (loading) return <div className="flex justify-center items-center min-h-[60vh]"><Spinner size="lg" /></div>;

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Admin Dashboard</h1>
          <div className={`flex items-center gap-2 text-xs mt-1 ${isConnected ? 'text-green-600' : 'text-red-500'}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
            {isConnected ? 'Live fleet connected' : 'Reconnecting...'}
          </div>
        </div>
        <div className="flex gap-2">
          <Link to="/admin/buses" className="btn-primary text-sm"><Plus size={15} /> Add Bus</Link>
          <Link to="/admin/routes" className="btn-secondary text-sm"><Plus size={15} /> Add Route</Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Bus}        label="Total Buses"    value={allBuses.length}  sub="in fleet"            color="bg-brand-blue" />
        <StatCard icon={Activity}   label="Live Now"       value={liveBuses.length} sub="currently on trip"   color="bg-green-500" />
        <StatCard icon={Map}        label="Active Routes"  value={routes.length}    sub="in system"           color="bg-brand-amber" />
        <StatCard icon={AlertTriangle} label="Alerts Today" value={alerts.length}  sub="emergencies/breakdowns" color="bg-red-500" />
      </div>

      {/* Live Fleet Table */}
      <div className="card">
        <h2 className="text-base font-semibold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          Live Fleet ({liveBuses.length} buses)
        </h2>
        {liveBuses.length === 0 ? (
          <p className="text-center text-gray-500 py-6 text-sm">No buses are currently active.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700">
                  <th className="pb-2 font-semibold">Bus</th>
                  <th className="pb-2 font-semibold">Route</th>
                  <th className="pb-2 font-semibold">Speed</th>
                  <th className="pb-2 font-semibold">Occupancy</th>
                  <th className="pb-2 font-semibold">Status</th>
                  <th className="pb-2 font-semibold">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
                {liveBuses.map((bus) => (
                  <tr key={bus._id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                    <td className="py-2.5 font-semibold text-gray-800 dark:text-white">{bus.busNumber}</td>
                    <td className="py-2.5 text-gray-600 dark:text-gray-400">{bus.assignedRoute?.routeNumber || '–'}</td>
                    <td className="py-2.5 text-gray-600 dark:text-gray-400">{bus.currentSpeed ?? 0} km/h</td>
                    <td className="py-2.5 text-gray-600 dark:text-gray-400">
                      {bus.currentOccupancy}/{bus.capacity}
                    </td>
                    <td className="py-2.5">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${
                        bus.status === 'active'    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                        bus.status === 'delayed'   ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' :
                        bus.status === 'breakdown' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                        'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                      }`}>{bus.status}</span>
                    </td>
                    <td className="py-2.5">
                      <Link to={`/buses/${bus._id}`} className="text-xs text-brand-blue hover:underline">Details</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Recent Alerts */}
      {alerts.length > 0 && (
        <div className="card">
          <h2 className="text-base font-semibold text-gray-800 dark:text-white mb-3 flex items-center gap-2">
            <AlertTriangle size={16} className="text-red-500" /> Recent Alerts
          </h2>
          <div className="space-y-2">
            {alerts.map((a, i) => (
              <div key={i} className={`flex items-start gap-3 p-3 rounded-lg ${
                a.type === 'emergency' ? 'bg-red-50 dark:bg-red-900/10' : 'bg-orange-50 dark:bg-orange-900/10'
              }`}>
                <AlertTriangle size={14} className={a.type === 'emergency' ? 'text-red-500' : 'text-orange-500'} />
                <div>
                  <p className="text-xs font-semibold text-gray-800 dark:text-white capitalize">{a.type}: {a.busNumber || a.busId}</p>
                  <p className="text-xs text-gray-500">{a.message || a.description}</p>
                  <p className="text-xs text-gray-400">{new Date(a.ts).toLocaleTimeString()}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick Links */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Manage Buses',   to: '/admin/buses',   icon: Bus,      color: 'bg-brand-blue/10 text-brand-blue' },
          { label: 'Manage Routes',  to: '/admin/routes',  icon: Map,      color: 'bg-green-100 text-green-700'  },
          { label: 'Manage Drivers', to: '/admin/drivers', icon: Users,    color: 'bg-amber-100 text-amber-700'  },
          { label: 'Analytics',      to: '/admin/analytics',icon: TrendingUp,color:'bg-purple-100 text-purple-700'},
        ].map(({ label, to, icon: Icon, color }) => (
          <Link key={to} to={to} className={`flex flex-col items-center gap-2 p-4 rounded-xl ${color} hover:opacity-80 transition-opacity text-center`}>
            <Icon size={22} />
            <span className="text-xs font-semibold">{label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
};

export default AdminDashboard;
