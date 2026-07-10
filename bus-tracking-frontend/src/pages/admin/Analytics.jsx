// src/pages/admin/Analytics.jsx
// Fleet analytics dashboard with trip stats, performance metrics,
// and a trips-per-day chart using a pure CSS/SVG approach
// (no external chart library needed - keeps bundle small).

import React, { useState, useEffect } from 'react';
import { TrendingUp, Bus, Users, Clock, CheckCircle, AlertTriangle, BarChart2, Download } from 'lucide-react';
import { adminAPI } from '../../services/api';
import Spinner from '../../components/common/Spinner';
import toast from 'react-hot-toast';

// Simple bar chart using SVG
const BarChart = ({ data }) => {
  if (!data || data.length === 0) return <p className="text-center text-gray-400 py-8 text-sm">No data yet</p>;
  const max = Math.max(...data.map(d => d.count), 1);
  const barW = Math.floor(500 / data.length) - 4;

  return (
    <div className="overflow-x-auto">
      <svg width="100%" viewBox={`0 0 ${Math.max(500, data.length * 60)} 180`} className="w-full">
        {data.map((d, i) => {
          const h = Math.round((d.count / max) * 120);
          const x = i * (barW + 4) + 2;
          return (
            <g key={d._id}>
              <rect x={x} y={140 - h} width={barW} height={h}
                rx="4" fill="#2E86AB" className="hover:fill-brand-navy transition-colors" />
              <text x={x + barW / 2} y={155} textAnchor="middle"
                fontSize="9" fill="#9CA3AF">
                {d._id?.slice(5)} {/* MM-DD */}
              </text>
              <text x={x + barW / 2} y={140 - h - 4} textAnchor="middle"
                fontSize="10" fill="#374151" fontWeight="600">{d.count}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};

const StatCard = ({ icon: Icon, label, value, sub, color, bgColor }) => (
  <div className="card">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{label}</p>
        <p className="text-3xl font-extrabold text-gray-900 dark:text-white mt-1">{value ?? '–'}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
      <div className={`w-12 h-12 rounded-xl ${bgColor} flex items-center justify-center`}>
        <Icon size={22} className={color} />
      </div>
    </div>
  </div>
);

const Analytics = () => {
  const [data, setData]     = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await adminAPI.getAnalytics();
        setData(res.data.analytics);
      } catch { toast.error('Failed to load analytics'); }
      finally { setLoading(false); }
    };
    load();
  }, []);

  const handleExport = () => {
    if (!data) return;
    const csv = [
      'Metric,Value',
      `Total Buses,${data.fleet.totalBuses}`,
      `Active Buses,${data.fleet.activeBuses}`,
      `Total Routes,${data.fleet.totalRoutes}`,
      `Total Drivers,${data.fleet.totalDrivers}`,
      `Total Users,${data.users.totalUsers}`,
      `Trips Today,${data.trips.tripsToday}`,
      `Trips This Week,${data.trips.tripsThisWeek}`,
      `Avg Delay (min),${data.performance.avgDelayMinutes}`,
      `On-Time Rate (%),${data.performance.onTimeRate}`,
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = `bus-analytics-${new Date().toISOString().slice(0,10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
    toast.success('Report downloaded');
  };

  if (loading) return <div className="flex justify-center items-center min-h-[60vh]"><Spinner size="lg" /></div>;
  if (!data)   return <div className="text-center py-20 text-gray-500">Failed to load analytics.</div>;

  const { fleet, users, trips, performance, chart } = data;

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <BarChart2 size={22} className="text-brand-blue" /> Analytics & Reports
        </h1>
        <button onClick={handleExport} className="btn-secondary text-sm gap-2">
          <Download size={15} /> Export CSV
        </button>
      </div>

      {/* Fleet Stats */}
      <div>
        <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">Fleet Overview</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon={Bus}       label="Total Buses"   value={fleet.totalBuses}   sub="in system"          bgColor="bg-brand-blue/10"   color="text-brand-blue" />
          <StatCard icon={Bus}       label="Active Now"    value={fleet.activeBuses}  sub="on live trips"      bgColor="bg-green-100 dark:bg-green-900/20"   color="text-green-600" />
          <StatCard icon={TrendingUp}label="Routes"        value={fleet.totalRoutes}  sub="active routes"      bgColor="bg-amber-100 dark:bg-amber-900/20"   color="text-amber-600" />
          <StatCard icon={Users}     label="Drivers"       value={fleet.totalDrivers} sub="registered"         bgColor="bg-purple-100 dark:bg-purple-900/20" color="text-purple-600" />
        </div>
      </div>

      {/* Trip Stats */}
      <div>
        <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">Trip Statistics (Last 7 Days)</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon={Clock}        label="Trips Today"     value={trips.tripsToday}     bgColor="bg-blue-100 dark:bg-blue-900/20"   color="text-blue-600" />
          <StatCard icon={TrendingUp}   label="Trips This Week" value={trips.tripsThisWeek}  bgColor="bg-indigo-100 dark:bg-indigo-900/20" color="text-indigo-600" />
          <StatCard icon={CheckCircle}  label="Completed"       value={trips.completedTrips} bgColor="bg-green-100 dark:bg-green-900/20"  color="text-green-600" />
          <StatCard icon={AlertTriangle}label="Breakdowns"      value={trips.breakdownTrips} bgColor="bg-red-100 dark:bg-red-900/20"      color="text-red-600" />
        </div>
      </div>

      {/* Performance Metrics */}
      <div>
        <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">Performance</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="card text-center">
            <p className="text-xs text-gray-500 mb-2">Average Delay</p>
            <p className="text-4xl font-extrabold text-gray-900 dark:text-white">{performance.avgDelayMinutes}</p>
            <p className="text-sm text-gray-500">minutes per trip</p>
          </div>
          <div className="card text-center">
            <p className="text-xs text-gray-500 mb-2">On-Time Rate</p>
            <p className={`text-4xl font-extrabold ${parseFloat(performance.onTimeRate) >= 80 ? 'text-green-600' : 'text-red-600'}`}>
              {performance.onTimeRate}%
            </p>
            <p className="text-sm text-gray-500">of trips on schedule</p>
          </div>
          <div className="card text-center">
            <p className="text-xs text-gray-500 mb-2">Registered Passengers</p>
            <p className="text-4xl font-extrabold text-gray-900 dark:text-white">{users.totalUsers}</p>
            <p className="text-sm text-gray-500">active accounts</p>
          </div>
        </div>
      </div>

      {/* Trips Per Day Chart */}
      <div className="card">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4 flex items-center gap-2">
          <BarChart2 size={14} className="text-brand-blue" /> Trips Per Day (Last 7 Days)
        </h2>
        <BarChart data={chart.tripsPerDay} />
      </div>

      {/* Tips */}
      <div className="card bg-brand-light dark:bg-gray-800/50 border border-brand-blue/10">
        <h3 className="text-sm font-semibold text-brand-navy dark:text-brand-blue mb-2">Analytics Notes</h3>
        <ul className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
          <li>• All trip statistics are calculated for the <strong>last 7 days</strong></li>
          <li>• On-Time Rate = (Completed Trips − Breakdown Trips) ÷ Completed Trips × 100</li>
          <li>• Average delay only counts trips that ran late, not on-time trips</li>
          <li>• Export CSV to download all metrics for your project report</li>
        </ul>
      </div>
    </div>
  );
};

export default Analytics;
