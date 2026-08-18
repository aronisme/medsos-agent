import React from 'react';
import {
  LayoutDashboard,
  PenTool,
  Calendar,
  Share2,
  FileText,
  Sparkles,
  Terminal,
  FolderArchive,
  Link as LinkIcon,
  BarChart3,
  LineChart,
} from 'lucide-react';

export default function Sidebar({ activeTab, setActiveTab }) {
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'post_analytics', label: 'Analitik Postingan', icon: LineChart, highlight: true },
    { id: 'composer', label: 'Buat Postingan', icon: PenTool, highlight: true },
    { id: 'affiliate_products', label: 'Produk Affiliate', icon: FolderArchive, highlight: true },
    { id: 'link_analytics', label: 'Analitik Link', icon: BarChart3 },
    { id: 'posts', label: 'Kelola & Jadwal', icon: Calendar },
    { id: 'accounts', label: 'Akun Sosmed', icon: Share2 },
    { id: 'templates', label: 'Template Caption', icon: FileText },
    { id: 'shopee_affiliate', label: 'Shopee Affiliate', icon: LinkIcon },
    { id: 'api_docs', label: 'API Agent', icon: Terminal },
  ];

  return (
    <aside className="w-full md:w-64 bg-slate-900/60 border-r border-slate-800/80 p-4 shrink-0">
      <div className="space-y-1">
        <p className="px-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
          Menu Utama
        </p>
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/25'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : item.highlight ? 'text-indigo-400' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </div>
              {item.highlight && !isActive && (
                <Sparkles className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-8 p-4 rounded-2xl bg-gradient-to-br from-indigo-900/40 via-purple-900/20 to-slate-900 border border-indigo-500/20">
        <div className="flex items-center gap-2 text-indigo-300 font-semibold text-xs mb-1">
          <Sparkles className="w-4 h-4 text-indigo-400" />
          <span>Mistral AI Ready</span>
        </div>
        <p className="text-xs text-slate-400 leading-relaxed">
          Gunakan fitur AI di Post Composer untuk membuat caption menarik secara otomatis.
        </p>
      </div>
    </aside>
  );
}
