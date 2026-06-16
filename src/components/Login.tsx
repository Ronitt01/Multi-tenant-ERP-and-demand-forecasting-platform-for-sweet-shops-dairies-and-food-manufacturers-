import React, { useState, useEffect } from 'react';
import { UserSession } from '../types';
import { Store, User, ShieldCheck, Key, UserCheck, CheckCircle2, ChevronRight, FileSpreadsheet } from 'lucide-react';

interface LoginProps {
  onLoginSuccess: (session: UserSession) => void;
}

export default function Login({ onLoginSuccess }: LoginProps) {
  const [shopId, setShopId] = useState('admin@shamsweets.com');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'Owner' | 'Manager' | 'Cashier' | 'Production Staff' | 'Delivery Staff'>('Owner');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Suggested Sham credentials for smooth UX
  const [shamPassword, setShamPassword] = useState('ShamSweetsSecure2026!');

  // Register state
  const [showRegister, setShowRegister] = useState(false);
  const [regName, setRegName] = useState('');
  const [regOwnerName, setRegOwnerName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPasswordInput, setRegPasswordInput] = useState('');
  const [regGst, setRegGst] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regAddress, setRegAddress] = useState('');
  const [regSuccess, setRegSuccess] = useState<{ shopId: string; password: string; name: string; ownerEmail?: string } | null>(null);

  useEffect(() => {
    // Fetch live generated passcode for Sham Sweets
    fetch('/api/auth/sham-password')
      .then(r => r.json())
      .then(data => {
        if (data.password) {
          setShamPassword(data.password);
        }
      })
      .catch(err => console.error('Error fetching default passcode:', err));
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shopId, password, role })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Login verification failed.');
      }

      onLoginSuccess(data);
    } catch (err: any) {
      setError(err.message || 'Server connection issue.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shopName: regName,
          ownerName: regOwnerName,
          ownerEmail: regEmail,
          password: regPasswordInput,
          gstNumber: regGst,
          phoneNumber: regPhone,
          address: regAddress
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Registration failed.');
      }

      setRegSuccess(data);
      // Auto-fill login fields
      setShopId(data.ownerEmail || data.shopId);
      setPassword(data.password);
      setRegName('');
      setRegOwnerName('');
      setRegEmail('');
      setRegPasswordInput('');
      setRegGst('');
      setRegPhone('');
      setRegAddress('');
    } catch (err: any) {
      setError(err.message || 'Failed to register shop.');
    } finally {
      setLoading(false);
    }
  };

  const handleUseShamSweets = () => {
    setShopId('admin@shamsweets.com');
    setPassword(shamPassword);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-md w-full mx-auto">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center p-3 bg-amber-600 rounded-2xl shadow-lg mb-4 text-white">
            <Store className="h-8 w-8" id="logo-icon-login" />
          </div>
          <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">
            Sweet Shop ERP
          </h2>
          <p className="mt-3 text-sm text-slate-600 font-medium leading-relaxed max-w-sm mx-auto">
            Fostering fluent operations, automated bulk ledgers, and intelligent kitchen workflows to help sweet shop businesses run with effortless efficiency.
          </p>
        </div>

        {/* Demo Quick Access Card */}
        {shamPassword && !showRegister && (
          <div className="bg-gradient-to-r from-slate-900 to-slate-800 border border-slate-700 rounded-xl p-4 mb-6 shadow-md text-white">
            <div className="flex items-start">
              <Key className="h-5 w-5 text-amber-400 mt-0.5 mr-3 shrink-0" />
              <div className="w-full">
                <h4 className="text-sm font-semibold text-amber-450 font-display">
                  SaaS Demo Space: Sham Sweets
                </h4>
                <p className="text-[11px] text-slate-300 mt-0.5">
                  Pre-configured accounts database with complete outstanding balance history:
                </p>
                <div className="mt-2.5 space-y-1 text-xs text-slate-300 font-mono bg-slate-950/80 p-2.5 rounded-lg border border-slate-800">
                  <div>
                    <span className="text-slate-500">Owner Email:</span>{" "}
                    <span className="text-emerald-400 font-bold">admin@shamsweets.com</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <div>
                      <span className="text-slate-500">Passcode:</span>{" "}
                      <span className="text-amber-400 font-medium">{shamPassword}</span>
                    </div>
                  </div>
                </div>
                <div className="mt-2 text-right">
                  <button
                    onClick={handleUseShamSweets}
                    type="button"
                    className="text-[11px] font-bold text-amber-300 hover:text-amber-250 transition inline-flex items-center"
                  >
                    Auto-Fill Demo Credentials <ChevronRight className="h-3.5 w-3.5 ml-0.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Access Code success alert */}
        {regSuccess && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 mb-6 shadow-sm animate-fade-in">
            <div className="flex items-start">
              <CheckCircle2 className="h-6 w-6 text-emerald-600 mr-3 mt-0.5" />
              <div>
                <h4 className="text-sm font-bold text-emerald-900">
                  Shop Registered Successfully!
                </h4>
                <p className="text-xs text-emerald-800 mt-1">
                  Your new sweet shop database has been created with custom default parameters.
                </p>
                <div className="mt-3 p-3 bg-white rounded-lg border border-emerald-100 text-xs font-mono space-y-1">
                  <div><span className="font-semibold text-slate-700">Shop ID:</span> <span className="text-emerald-900 font-bold">{regSuccess.shopId}</span></div>
                  <div><span className="font-semibold text-slate-700">Passcode:</span> <span className="text-emerald-900 font-bold">{regSuccess.password}</span></div>
                  <div><span className="font-semibold text-slate-700">Name:</span> <span className="text-slate-900">{regSuccess.name}</span></div>
                </div>
                <button
                  onClick={() => {
                    setRegSuccess(null);
                    setShowRegister(false);
                  }}
                  type="button"
                  className="mt-3 text-xs font-bold text-emerald-700 hover:text-emerald-900 flex items-center"
                >
                  Proceed to Login now <ChevronRight className="h-3.5 w-3.5 ml-0.5" />
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="bg-white py-8 px-6 shadow-xl rounded-2xl border border-slate-100">
          {/* Header switch buttons */}
          <div className="flex border-b border-slate-200 mb-6">
            <button
              onClick={() => { setShowRegister(false); setError(''); }}
              className={`flex-1 pb-3 text-center text-sm font-semibold border-b-2 transition ${
                !showRegister ? 'border-amber-600 text-amber-600' : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => { setShowRegister(true); setError(''); }}
              className={`flex-1 pb-3 text-center text-sm font-semibold border-b-2 transition ${
                showRegister ? 'border-amber-600 text-amber-600' : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
            >
              Register Shop
            </button>
          </div>

          {error && (
            <div className="bg-rose-50 border-l-4 border-rose-600 p-3 mb-4 rounded-r-lg">
              <p className="text-xs text-rose-800 font-medium">{error}</p>
            </div>
          )}

          {!showRegister ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Sweet Shop ID
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Store className="h-4 w-4" />
                  </div>
                  <input
                    type="text"
                    required
                    value={shopId}
                    onChange={(e) => setShopId(e.target.value)}
                    className="block w-full pl-10 pr-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                    placeholder="e.g. sham-sweets"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Shop Passcode
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Key className="h-4 w-4" />
                  </div>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="block w-full pl-10 pr-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Your ERP Role
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <User className="h-4 w-4" />
                  </div>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as any)}
                    className="block w-full pl-10 pr-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 font-medium bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                  >
                    <option value="Owner">Owner (Full Analytics & AI)</option>
                    <option value="Manager">Manager (Production & Supplies)</option>
                    <option value="Cashier">Cashier (POS & Sales Registers)</option>
                    <option value="Production Staff">Production Staff (Kitchen Plans)</option>
                    <option value="Delivery Staff">Delivery Staff (Dispatches & Receipts)</option>
                  </select>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-6 py-2.5 px-4 rounded-xl text-sm font-bold text-white bg-amber-600 hover:bg-amber-700 transition duration-150 flex items-center justify-center shadow-md disabled:bg-slate-300"
              >
                {loading ? 'Authenticating...' : 'Access ERP Portal'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1 text-left">
                  Shop Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Gupta Sweets or Bikaner Sweets"
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  className="block w-full px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1 text-left">
                    Owner Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Ramesh Gupta"
                    value={regOwnerName}
                    onChange={(e) => setRegOwnerName(e.target.value)}
                    className="block w-full px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1 text-left">
                    Mobile Number <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="tel"
                    required
                    placeholder="e.g. +91 94000 12345"
                    value={regPhone}
                    onChange={(e) => setRegPhone(e.target.value)}
                    className="block w-full px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1 text-left">
                  Owner Email <span className="text-rose-500">*</span>
                </label>
                <input
                  type="email"
                  required
                  placeholder="e.g. owner@bikanersweets.com"
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  className="block w-full px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1 text-left">
                  SaaS Portal Password <span className="text-rose-500">*</span>
                </label>
                <input
                  type="password"
                  required
                  placeholder="Create secure portal password"
                  value={regPasswordInput}
                  onChange={(e) => setRegPasswordInput(e.target.value)}
                  className="block w-full px-3 py-1.5 border border-slate-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1 text-left">
                  Business Address <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ground Floor, Sector 15, Gurugram"
                  value={regAddress}
                  onChange={(e) => setRegAddress(e.target.value)}
                  className="block w-full px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1 text-left">
                  GSTIN (GST Number - Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. 07AAAAA1234A1Z7"
                  value={regGst}
                  onChange={(e) => setRegGst(e.target.value)}
                  className="block w-full px-3 py-1.5 border border-slate-200 rounded-lg text-sm font-mono uppercase focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-4 py-2.5 px-4 rounded-xl text-sm font-bold text-white bg-slate-900 hover:bg-slate-850 cursor-pointer transition duration-150 flex items-center justify-center shadow-md disabled:bg-slate-300"
              >
                {loading ? 'Bootstrapping Starter Tables...' : 'Create Multi-Tenant Shop Accounts'}
              </button>
            </form>
          )}
        </div>

        <p className="mt-4 text-center text-xs text-slate-400">
          This ERP executes thread-safe ACID data transactions via local sandbox data streams in the Cloud Run containers.
        </p>
      </div>
    </div>
  );
}
