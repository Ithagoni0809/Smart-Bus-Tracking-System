// src/pages/passenger/Favorites.jsx
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Star, Trash2, Bus, MapPin, ChevronRight } from 'lucide-react';
import { favoriteAPI } from '../../services/api';
import Spinner from '../../components/common/Spinner';
import EmptyState from '../../components/common/EmptyState';
import toast from 'react-hot-toast';

const Favorites = () => {
  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await favoriteAPI.getAll();
        setFavorites(res.data.favorites || []);
      } catch {
        toast.error('Failed to load saved routes');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleRemove = async (favId) => {
    try {
      await favoriteAPI.remove(favId);
      setFavorites((prev) => prev.filter((f) => f._id !== favId));
      toast.success('Removed from favourites');
    } catch {
      toast.error('Failed to remove favourite');
    }
  };

  if (loading) return <div className="flex justify-center items-center min-h-[60vh]"><Spinner size="lg" /></div>;

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Star size={22} className="text-pink-500" fill="currentColor" /> Saved Routes
        </h1>
        <Link to="/live-map" className="btn-primary text-sm">+ Add Route</Link>
      </div>

      {favorites.length === 0 ? (
        <EmptyState
          icon={Star}
          title="No saved routes yet"
          description="Search for a bus on the live map and save it for quick access."
          action={<Link to="/live-map" className="btn-primary">Open Live Map</Link>}
        />
      ) : (
        <div className="space-y-2">
          {favorites.map((fav) => {
            const item = fav.route || fav.bus;
            const isRoute = !!fav.route;
            return (
              <div key={fav._id} className="card flex items-center justify-between group">
                <Link
                  to={isRoute ? `/routes/${item?._id}` : `/buses/${item?._id}`}
                  className="flex items-center gap-3 flex-1 min-w-0"
                >
                  <div className="w-10 h-10 rounded-xl bg-pink-50 dark:bg-pink-900/20 flex items-center justify-center shrink-0">
                    {isRoute ? <MapPin size={18} className="text-pink-500" /> : <Bus size={18} className="text-pink-500" />}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-800 dark:text-white truncate">
                      {fav.nickname || (isRoute ? item?.routeName : item?.busNumber) || 'Saved item'}
                    </p>
                    <p className="text-xs text-gray-500 truncate">
                      {isRoute ? `${item?.source} → ${item?.destination}` : item?.vehicleNumber}
                    </p>
                  </div>
                </Link>
                <div className="flex items-center gap-2 shrink-0">
                  <ChevronRight size={16} className="text-gray-300 group-hover:text-brand-blue transition-colors" />
                  <button
                    onClick={() => handleRemove(fav._id)}
                    className="p-1.5 text-gray-400 hover:text-red-500 transition-colors"
                    title="Remove from favourites"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Favorites;
