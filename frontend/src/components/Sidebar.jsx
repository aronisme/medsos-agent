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
  Bot,
  Kanban,
  FlaskConical,
} from 'lucide-react';

export default function Sidebar({ activeTab, setActiveTab }) {
  const sections = [
    {
      title: 'Otomasi AI (Auto-Pilot)',
      items: [
        { id: 'agent_dashboard', label: 'Agent Command Center', icon: Bot, highlight: true },
        { id: 'product_lifecycle', label: 'Siklus Hidup Produk', icon: Kanban, highlight: true },
        { id: 'experiment_lab', label: 'Lab Eksperimen & A/B', icon: FlaskConical, highlight: true },
      ]
    },
    {
      title: 'Konten & Media Sosial',
      items: [
        { id: 'dashboard', label: 'Dashboard Ringkasan', icon: LayoutDashboard },
        { id: 'post_analytics', label: 'Analitik Postingan', icon: LineChart },
        { id: 'composer', label: 'Buat Postingan', icon: PenTool },
        { id: 'posts', label: 'Kelola & Jadwal', icon: Calendar },
        { id: 'templates', label: 'Template Caption', icon: FileText },
      ]
    },
    {
      title: 'Katalog & Afiliasi',
      items: [
        { id: 'affiliate_products', label: 'Produk Affiliate', icon: FolderArchive },
        { id: 'shopee_affiliate', label: 'Shopee Generator', icon: LinkIcon },
        { id: 'link_analytics', label: 'Analitik Link', icon: BarChart3 },
      ]
    },
    {
      title: 'Pengaturan',
      items: [
        { id: 'accounts', label: 'Akun Sosmed', icon: Share2 },
        { id: 'api_docs', label: 'API Agent Docs', icon: Terminal },
      ]
    }
  ];

  return (
    <aside className="w-full md:w-64 bg-slate-900/70 border-r border-slate-800/80 p-3.5 shrink-0 flex flex-col justify-between overflow-y-auto custom-scrollbar">
      <div className="space-y-5">
        {sections.map((section, idx) => (
          <div key={idx} className="space-y-1">
            <p className="px-3 text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-1.5">
              {section.title}
            </p>
            {section.items.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                    isActive
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30 font-bold'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : item.highlight ? 'text-indigo-400' : 'text-slate-400'}`} />
                    <span className="truncate">{item.label}</span>
                  </div>
                  {item.highlight && !isActive && (
                    <Sparkles className="w-3 h-3 text-indigo-400 animate-pulse shrink-0 ml-1" />
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      <div className="mt-6 p-3.5 rounded-2xl bg-gradient-to-br from-indigo-950/60 via-purple-950/30 to-slate-950 border border-indigo-500/20">
        <div className="flex items-center gap-2 text-indigo-300 font-bold text-xs mb-1">
          <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
          <span>Auto-Pilot AI Ready</span>
        </div>
        <p className="text-[11px] text-slate-400 leading-relaxed">
          Semua strategi postingan & evaluasi kuartal berjalan otomatis.
        </p>
      </div>
    </aside>
  );
}
