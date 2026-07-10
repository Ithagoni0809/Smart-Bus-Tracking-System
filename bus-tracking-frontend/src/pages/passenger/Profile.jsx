// src/pages/passenger/Profile.jsx
import React, { useState } from 'react';
import { User, Moon, Sun, Mail, Phone, Shield, Save, Key, LogOut } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { authAPI } from '../../services/api';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

const Profile = () => {
  const { user, setUser, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '' });
  const [savingPw, setSavingPw] = useState(false);
  const [activeTab, setActiveTab] = useState('profile'); // 'profile' | 'security'

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setSavingPw(true);
    try {
      await authAPI.changePassword(pwForm);
      toast.success('Password changed successfully');
      setPwForm({ currentPassword: '', newPassword: '' });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to change password');
    } finally {
      setSavingPw(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    toast.success('Logged out');
    navigate('/login');
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-4 animate-fade-in">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Profile & Settings</h1>

      {/* Avatar + name */}
      <div className="card flex items-center gap-4">
        <div className="w-16 h-16 rounded-2xl bg-brand-blue/10 flex items-center justify-center">
          <User size={28} className="text-brand-blue" />
        </div>
        <div>
          <p className="text-xl font-bold text-gray-900 dark:text-white">{user?.name}</p>
          <p className="text-sm text-gray-500 capitalize">{user?.role} account</p>
          <div className={`inline-flex items-center gap-1 text-xs mt-1 px-2 py-0.5 rounded-full font-medium ${
            user?.isEmailVerified
              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
              : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
          }`}>
            <Shield size={10} /> {user?.isEmailVerified ? 'Verified' : 'Email not verified'}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl">
        {['profile', 'security'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2 text-sm font-medium rounded-lg capitalize transition-all ${
              activeTab === tab
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'profile' && (
        <div className="space-y-3">
          {/* Account info */}
          <div className="card space-y-3">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Account Information</h2>
            {[
              { icon: User,  label: 'Full Name', value: user?.name },
              { icon: Mail,  label: 'Email',     value: user?.email },
              { icon: Phone, label: 'Phone',     value: user?.phone },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                <Icon size={16} className="text-brand-blue shrink-0" />
                <div>
                  <p className="text-xs text-gray-500">{label}</p>
                  <p className="text-sm font-medium text-gray-800 dark:text-white">{value || '–'}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Preferences */}
          <div className="card space-y-3">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Preferences</h2>
            <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50">
              <div className="flex items-center gap-3">
                {isDark ? <Moon size={16} className="text-brand-blue" /> : <Sun size={16} className="text-brand-amber" />}
                <div>
                  <p className="text-sm font-medium text-gray-800 dark:text-white">Dark Mode</p>
                  <p className="text-xs text-gray-500">{isDark ? 'Currently dark' : 'Currently light'}</p>
                </div>
              </div>
              <button
                onClick={toggleTheme}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${isDark ? 'bg-brand-blue' : 'bg-gray-300'}`}
              >
                <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${isDark ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>
          </div>

          {/* Logout */}
          <button onClick={handleLogout} className="btn-danger w-full">
            <LogOut size={16} /> Sign Out
          </button>
        </div>
      )}

      {activeTab === 'security' && (
        <div className="card">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4 flex items-center gap-2">
            <Key size={14} className="text-brand-blue" /> Change Password
          </h2>
          <form onSubmit={handlePasswordChange} className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Current Password</label>
              <input type="password" className="input-field" placeholder="Your current password"
                value={pwForm.currentPassword}
                onChange={(e) => setPwForm({ ...pwForm, currentPassword: e.target.value })} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">New Password</label>
              <input type="password" className="input-field" placeholder="Min 8 chars, 1 uppercase, 1 number"
                value={pwForm.newPassword}
                onChange={(e) => setPwForm({ ...pwForm, newPassword: e.target.value })} required />
            </div>
            <button type="submit" disabled={savingPw} className="btn-primary w-full">
              {savingPw ? 'Saving...' : <><Save size={15} /> Update Password</>}
            </button>
          </form>
        </div>
      )}
    </div>
  );
};

export default Profile;
