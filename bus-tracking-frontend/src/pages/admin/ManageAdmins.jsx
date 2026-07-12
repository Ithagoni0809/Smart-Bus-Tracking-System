// Superadmin-only: Manage Admin accounts
// Regular admins never see this page — App.jsx routes it behind
// roles={['superadmin']}, and the backend independently enforces the
// same restriction on every /api/admin/admins/* endpoint, so this page
// isn't the only thing standing between a plain admin and these actions.
import React, { useState, useEffect } from 'react';
import { Plus, Crown, Search, X, Save, ShieldCheck, Shield, Ban, CheckCircle } from 'lucide-react';
import { adminAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import Spinner from '../../components/common/Spinner';
import toast from 'react-hot-toast';

const AdminModal = ({ onClose, onSaved }) => {
  const [form, setForm] = useState({
    name: '', email: '', phone: '', password: 'Admin@1234',
    role: 'admin', department: 'Operations',
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await adminAPI.createAdmin(form);
      toast.success('Admin account created');
      onSaved();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create admin');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-700">
          <h2 className="font-bold text-gray-900 dark:text-white">Create Admin Account</h2>
          <button onClick={onClose}><X size={18} className="text-gray-400" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-3">
          {[['name', 'Full Name', 'Priya Reddy'], ['email', 'Email', 'admin2@bustrack.com'], ['phone', 'Phone', '9876543210']].map(([k, l, p]) => (
            <div key={k}>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{l}</label>
              <input className="input-field" placeholder={p} value={form[k]}
                onChange={e => setForm({ ...form, [k]: e.target.value })} required />
            </div>
          ))}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Department</label>
            <input className="input-field" value={form.department}
              onChange={e => setForm({ ...form, department: e.target.value })} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Role</label>
            <select className="input-field" value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>
              <option value="admin">Admin</option>
              <option value="superadmin">Superadmin</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Temporary Password</label>
            <input className="input-field" value={form.password}
              onChange={e => setForm({ ...form, password: e.target.value })} required />
          </div>
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary flex-1">
              {saving ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> : <Save size={15} />}
              {saving ? 'Creating...' : 'Create Admin'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const ManageAdmins = () => {
  const { user: currentUser } = useAuth();
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);

  const load = async () => {
    try {
      const r = await adminAPI.getAllAdmins();
      setAdmins(r.data.admins);
    } catch { toast.error('Failed to load admins'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const handleToggle = async (id, isActive, name) => {
    const verb = isActive ? 'deactivate' : 'activate';
    if (!window.confirm(`${verb === 'deactivate' ? 'Deactivate' : 'Activate'} ${name}?`)) return;
    try {
      await adminAPI.toggleAdminStatus(id);
      toast.success(`${name} ${isActive ? 'deactivated' : 'activated'}`);
      load();
    } catch (e) { toast.error(e.response?.data?.message || 'Update failed'); }
  };

  const handleRoleChange = async (id, currentRole, name) => {
    const newRole = currentRole === 'superadmin' ? 'admin' : 'superadmin';
    if (!window.confirm(`Change ${name}'s role to ${newRole}?`)) return;
    try {
      await adminAPI.updateAdminRole(id, newRole);
      toast.success(`${name} is now ${newRole}`);
      load();
    } catch (e) { toast.error(e.response?.data?.message || 'Role change failed'); }
  };

  const filtered = admins.filter(a =>
    a.name?.toLowerCase().includes(search.toLowerCase()) ||
    a.email?.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <div className="flex justify-center items-center min-h-[60vh]"><Spinner size="lg" /></div>;

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-4 animate-fade-in">
      {showModal && <AdminModal onClose={() => setShowModal(false)} onSaved={() => { setShowModal(false); load(); }} />}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Crown size={22} className="text-amber-500" /> Manage Admins
          <span className="text-sm font-normal text-gray-500">({admins.length} total)</span>
        </h1>
        <button onClick={() => setShowModal(true)} className="btn-primary"><Plus size={16} />Add Admin</button>
      </div>

      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input className="input-field pl-9" placeholder="Search by name or email..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-gray-500 border-b border-gray-100 dark:border-gray-700">
              {['Name', 'Email', 'Department', 'Role', 'Status', 'Actions'].map(h => (
                <th key={h} className="pb-3 font-semibold pr-4">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
            {filtered.map(admin => {
              const isSelf = admin._id === currentUser?._id;
              return (
                <tr key={admin._id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                  <td className="py-3 font-semibold text-gray-800 dark:text-white pr-4">
                    {admin.name} {isSelf && <span className="text-xs text-gray-400 font-normal">(you)</span>}
                  </td>
                  <td className="py-3 text-gray-600 dark:text-gray-400 pr-4 text-xs">{admin.email}</td>
                  <td className="py-3 text-gray-600 dark:text-gray-400 pr-4">{admin.department}</td>
                  <td className="py-3 pr-4">
                    <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold w-fit ${
                      admin.role === 'superadmin'
                        ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                        : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                    }`}>
                      {admin.role === 'superadmin' ? <ShieldCheck size={12} /> : <Shield size={12} />}
                      {admin.role}
                    </span>
                  </td>
                  <td className="py-3 pr-4">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${admin.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {admin.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="py-3">
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleRoleChange(admin._id, admin.role, admin.name)}
                        disabled={isSelf && admin.role === 'superadmin'}
                        title={admin.role === 'superadmin' ? 'Demote to admin' : 'Promote to superadmin'}
                        className="p-1.5 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        {admin.role === 'superadmin' ? <Shield size={14} /> : <ShieldCheck size={14} />}
                      </button>
                      <button
                        onClick={() => handleToggle(admin._id, admin.isActive, admin.name)}
                        disabled={isSelf}
                        title={admin.isActive ? 'Deactivate' : 'Activate'}
                        className={`p-1.5 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed ${admin.isActive ? 'text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20' : 'text-green-500 hover:bg-green-50 dark:hover:bg-green-900/20'}`}
                      >
                        {admin.isActive ? <Ban size={14} /> : <CheckCircle size={14} />}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && <p className="text-center text-gray-500 py-8">No admins found.</p>}
      </div>
    </div>
  );
};

export default ManageAdmins;
