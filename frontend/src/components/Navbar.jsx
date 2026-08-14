import React from 'react';
import { useAuth } from '../context/AuthContext';
import { Bot, LogOut, ShieldAlert, Sparkles, User as UserIcon } from 'lucide-react';

export default function Navbar({ health }) {
  const { user, logout } = useAuth();

  return (
    <header className="sticky top-0 z-30 bg-slate-900/80 backdrop-blur-md border-b border-slate-800/80 px-4 lg:px-8 py-3 transition-all">
      <div className="flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 p-0.5 shadow-lg shadow-indigo-500/20">
            <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
              <Bot className="w-5 h-5 text-indigo-400" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-lg text-white tracking-tight">Medsos Agent</h1>
              <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                v1.0
              </span>
            </div>
            <p className="text-xs text-slate-400">FB & IG Auto Poster + AI Assistant</p>
          </div>
        </div>

        {/* Right side items */}
        <div className="flex items-center gap-4">
          {/* Dry Run Badge */}
          {health?.dryRun !== undefined && (
            <div
              className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border transition-all ${
                health.dryRun
                  ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                  : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
              }`}
              title={
                health.dryRun
                  ? 'Mode Simulasi: Postingan tidak dikirim ke API publik sungguhan.'
                  : 'Mode Live: Postingan dikirim ke FB/IG Graph API.'
              }
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>{health.dryRun ? 'DRY-RUN MODE' : 'LIVE API'}</span>
            </div>
          )}

          {/* User Profile & Logout */}
          {user && (
            <div className="flex items-center gap-3 pl-3 border-l border-slate-800">
              <div className="hidden sm:flex flex-col items-end">
                <span className="text-sm font-semibold text-slate-200">{user.name}</span>
                <span className="text-xs text-slate-400">{user.email}</span>
              </div>
              <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 font-bold text-xs">
                {user.name ? user.name.charAt(0).toUpperCase() : <UserIcon className="w-4 h-4" />}
              </div>
              <button
                onClick={logout}
                className="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-800/80 rounded-lg transition-colors"
                title="Keluar"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
