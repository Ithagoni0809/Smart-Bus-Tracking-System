// src/pages/admin/ManageUsers.jsx
import React, { useState, useEffect } from 'react';
import { Users, Search, ToggleLeft, ToggleRight, Mail, Phone, Shield } from 'lucide-react';
import { adminAPI } from '../../services/api';
import Spinner from '../../components/common/Spinner';
import toast from 'react-hot-toast';

const ManageUsers = () => {
  const [users, setUsers]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState('');
  const [page, setPage]       = useState(1);
  const [total, setTotal]     = useState(0);
  const limit = 20;

  const load = async () => {
    try {
      const res = await adminAPI.getAllUsers({ page, limit });
      setUsers(res.data.users);
      setTotal(res.data.total);
    } catch { toast.error('Failed to load users'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [page]);

  const handleToggle = async (id, currentStatus, name) => {
    try {
      await adminAPI.toggleUserStatus(id);
      toast.success(`${name} ${currentStatus ? 'deactivated' : 'activated'}`);
      load();
    } catch { toast.error('Update failed'); }
  };

  const filtered = users.filter(u =>
    u.name?.toLowerCase().includes(search.toLowerCase()) ||
    u.email?.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <div className="flex justify-center items-center min-h-[60vh]"><Spinner size="lg" /></div>;

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Users size={22} className="text-brand-blue" /> Manage Users
          <span className="text-sm font-normal text-gray-500">({total} total)</span>
        </h1>
      </div>

      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input className="input-field pl-9" placeholder="Search by name or email..."
          value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-gray-500 border-b border-gray-100 dark:border-gray-700">
              {['Name', 'Email', 'Phone', 'Email Verified', 'Joined', 'Status', 'Action'].map(h => (
                <th key={h} className="pb-3 font-semibold pr-4">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
            {filtered.map(user => (
              <tr key={user._id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                <td className="py-3 font-semibold text-gray-800 dark:text-white pr-4">{user.name}</td>
                <td className="py-3 text-gray-600 dark:text-gray-400 pr-4 text-xs">{user.email}</td>
                <td className="py-3 text-gray-600 dark:text-gray-400 pr-4">{user.phone}</td>
                <td className="py-3 pr-4">
                  {user.isEmailVerified
                    ? <span className="flex items-center gap-1 text-green-600 text-xs"><Shield size={11} /> Verified</span>
                    : <span className="text-xs text-yellow-600">Pending</span>}
                </td>
                <td className="py-3 text-gray-500 text-xs pr-4">
                  {new Date(user.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                </td>
                <td className="py-3 pr-4">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${user.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {user.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="py-3">
                  <button onClick={() => handleToggle(user._id, user.isActive, user.name)}
                    className={`p-1.5 rounded-lg transition-colors ${user.isActive ? 'text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20' : 'text-green-500 hover:bg-green-50 dark:hover:bg-green-900/20'}`}
                    title={user.isActive ? 'Deactivate' : 'Activate'}>
                    {user.isActive ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <p className="text-center text-gray-500 py-8">No users found.</p>}
      </div>

      {/* Pagination */}
      {total > limit && (
        <div className="flex items-center justify-center gap-2">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
            className="btn-secondary px-3 py-1.5 text-sm disabled:opacity-50">Prev</button>
          <span className="text-sm text-gray-600 dark:text-gray-400">
            Page {page} of {Math.ceil(total / limit)}
          </span>
          <button onClick={() => setPage(p => p + 1)} disabled={page >= Math.ceil(total / limit)}
            className="btn-secondary px-3 py-1.5 text-sm disabled:opacity-50">Next</button>
        </div>
      )}
    </div>
  );
};

export default ManageUsers;
