// src/pages/passenger/SearchBus.jsx
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, Bus, MapPin, ChevronRight, Filter } from 'lucide-react';
import { busAPI } from '../../services/api';
import OccupancyBadge from '../../components/common/OccupancyBadge';
import Spinner from '../../components/common/Spinner';
import EmptyState from '../../components/common/EmptyState';
import toast from 'react-hot-toast';

const SearchBus = () => {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const handleSearch = async (e) => {
    e.preventDefault();
    setLoading(true);
    setSearched(true);
    try {
      const res = await busAPI.search({ q: query || undefined, status: status || undefined });
      setResults(res.data.buses);
    } catch {
      toast.error('Search failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-4 animate-fade-in">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
        <Search size={22} className="text-brand-blue" /> Search Buses
      </h1>

      {/* Search form */}
      <form onSubmit={handleSearch} className="card space-y-3">
        <input
          className="input-field"
          placeholder="Bus number or vehicle number (e.g. AP39Z or TS09EA)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="flex gap-2">
          <select className="input-field" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All Status</option>
            <option value="active">🟢 Active</option>
            <option value="idle">⚪ Idle</option>
            <option value="delayed">🟡 Delayed</option>
            <option value="breakdown">🔴 Breakdown</option>
          </select>
          <button type="submit" disabled={loading} className="btn-primary shrink-0 px-6">
            {loading ? <Spinner size="sm" /> : <Search size={16} />}
            Search
          </button>
        </div>
      </form>

      {/* Results */}
      {loading && <div className="flex justify-center py-8"><Spinner size="lg" /></div>}

      {!loading && searched && results.length === 0 && (
        <EmptyState icon={Bus} title="No buses found" description="Try a different bus number or remove filters." />
      )}

      {!loading && results.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm text-gray-500">{results.length} bus{results.length !== 1 ? 'es' : ''} found</p>
          {results.map((bus) => (
            <Link
              key={bus._id}
              to={`/buses/${bus._id}`}
              className="card flex items-center justify-between hover:shadow-md transition-shadow group"
            >
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  bus.isActive ? 'bg-green-100 dark:bg-green-900/30' : 'bg-gray-100 dark:bg-gray-700'
                }`}>
                  <Bus size={18} className={bus.isActive ? 'text-green-600' : 'text-gray-400'} />
                </div>
                <div>
                  <p className="font-semibold text-gray-800 dark:text-white">{bus.busNumber}</p>
                  <p className="text-xs text-gray-500">{bus.vehicleNumber} · {bus.busType}</p>
                  {bus.assignedRoute && (
                    <p className="text-xs text-brand-blue flex items-center gap-1 mt-0.5">
                      <MapPin size={10} /> {bus.assignedRoute.routeNumber} — {bus.assignedRoute.source} → {bus.assignedRoute.destination}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <OccupancyBadge occupancy={bus.currentOccupancy} capacity={bus.capacity} />
                <ChevronRight size={16} className="text-gray-400 group-hover:text-brand-blue transition-colors" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

export default SearchBus;
