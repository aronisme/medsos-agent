import React, { useState, useEffect } from 'react';
import {
  Bot,
  Play,
  RotateCcw,
  Sparkles,
  Layers,
  Settings2,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Eye,
  MousePointerClick,
  TrendingUp,
  ShieldCheck,
  Zap,
  Activity,
  Terminal,
  Calendar,
  Cpu,
  Trash2
} from 'lucide-react';
import api from '../api/client';

export default function AgentDashboard({ setActiveTab }) {
  const [loading, setLoading] = useState(true);
  const [runningCycle, setRunningCycle] = useState(false);
  const [cycleLogs, setCycleLogs] = useState([]);
  const [config, setConfig] = useState(null);
  const [quarterStatus, setQuarterStatus] = useState(null);
  const [decisions, setDecisions] = useState([]);
  const [insights, setInsights] = useState([]);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const [cfgRes, qRes, decRes, insRes] = await Promise.all([
        api.get('/agent-orchestrator/config'),
        api.get('/agent-orchestrator/quarter/status'),
        api.get('/agent-orchestrator/decisions?limit=8'),
        api.get('/agent-orchestrator/insights'),
      ]);

      if (cfgRes.data.success) setConfig(cfgRes.data.config);
      if (qRes.data.success) setQuarterStatus(qRes.data);
      if (decRes.data.success) setDecisions(decRes.data.decisions || []);
      if (insRes.data.success) setInsights(insRes.data.insights || []);
    } catch (err) {
      console.error('Error fetching agent dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleAutopilot = async () => {
    try {
      const newStatus = !config?.autopilot_enabled;
      await api.post('/agent-orchestrator/config', { autopilot_enabled: newStatus });
      setConfig(prev => ({ ...prev, autopilot_enabled: newStatus }));
    } catch (err) {
      console.error('Error toggling autopilot:', err);
    }
  };

  const handleRunCycleNow = async () => {
    try {
      setRunningCycle(true);
      setCycleLogs(['[Agent Engine] Mengirim permintaan eksekusi siklus otonom...']);
      const res = await api.post('/agent-orchestrator/cycle/run', { forceRun: true });
      if (res.data.success) {
        setCycleLogs(res.data.log || ['Siklus otonom selesai diproses.']);
        fetchDashboardData();
      } else {
        setCycleLogs(res.data.log || [`Gagal: ${res.data.error || 'Terjadi kesalahan'}`]);
      }
    } catch (err) {
      console.error('Error running cycle:', err);
      setCycleLogs([`[Error] Gagal menjalankan siklus: ${err.message}`]);
    } finally {
      setRunningCycle(false);
    }
  };

  const agentModules = [
    {
      name: 'Product Intelligence',
      role: 'Shopee Profiler & Tagger',
      icon: '🛍️',
      status: 'Ready',
      desc: 'Menganalisis persona, pain points, USP, & niche produk',
    },
    {
      name: 'Media Evaluator',
      role: 'Curated Visual Filter',
      icon: '📸',
      status: 'Active',
      desc: 'Aturan ketat max 2 foto bersih / 1 video demo',
    },
    {
      name: 'Copywriter & Fingerprint',
      role: 'Multi-Angle Creator',
      icon: '✍️',
      status: 'Active',
      desc: 'PAS, Storytelling, Review + Anti-Duplikasi >85%',
    },
    {
      name: 'Template Bandit',
      role: 'Multi-Armed Bandit',
      icon: '🧪',
      status: 'Active',
      desc: '80% Eksploitasi Pemenang + 20% Eksplorasi Baru',
    },
    {
      name: 'Learning Layer',
      role: 'Closed-Loop Synthesizer',
      icon: '🧠',
      status: `${insights.length} Insights`,
      desc: 'Sintesis jam optimal & preferensi format per platform',
    },
    {
      name: 'Diagnostic Engine',
      role: '4-Root-Cause Analyzer',
      icon: '🛡️',
      status: 'Active',
      desc: 'Diagnosis Traffic, Content, Offer, & Product Failure',
    },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      
      {/* Top Banner: Master Control Center */}
      <div className="p-6 md:p-8 rounded-3xl bg-gradient-to-br from-indigo-950/80 via-slate-900 to-slate-950 border border-indigo-500/30 relative overflow-hidden shadow-2xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 flex items-center gap-1.5 shadow-sm">
                <Bot className="w-3.5 h-3.5 text-indigo-400" />
                <span>Autonomous Multi-Agent Engine V2.1</span>
              </span>
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5" />
                <span>GAS Heartbeat 1 Min Active</span>
              </span>
            </div>

            <h1 className="text-2xl md:text-3xl font-black text-slate-100 tracking-tight">
              Agent Control Center & Auto-Pilot Hub
            </h1>
            <p className="text-xs md:text-sm text-slate-300 max-w-2xl mt-1 leading-relaxed">
              Tugas Anda hanya menstok produk dari Shopee. Seluruh strategi konten, kurasi media, A/B testing template, dan evaluasi kuartal dijalankan otomatis oleh tim Sub-Agent AI.
            </p>
          </div>

          {/* Autopilot Switch & Quick Action */}
          <div className="flex flex-wrap items-center gap-4 bg-slate-950/80 p-4 rounded-2xl border border-slate-800 shrink-0">
            <div className="flex items-center gap-3">
              <div className="text-right">
                <span className="text-xs font-bold text-slate-200 block">Auto-Pilot</span>
                <span className={`text-[11px] font-semibold ${config?.autopilot_enabled ? 'text-emerald-400' : 'text-slate-500'}`}>
                  {config?.autopilot_enabled ? 'Aktif (Otomatis)' : 'Non-Aktif'}
                </span>
              </div>
              <button
                onClick={handleToggleAutopilot}
                className={`w-12 h-6 rounded-full transition-colors relative p-0.5 ${
                  config?.autopilot_enabled ? 'bg-indigo-600' : 'bg-slate-800'
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full bg-white transition-transform ${
                    config?.autopilot_enabled ? 'translate-x-6' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            <div className="w-px h-8 bg-slate-800 hidden sm:block" />

            <button
              onClick={handleRunCycleNow}
              disabled={runningCycle}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-indigo-600/30 transition-all disabled:opacity-50"
            >
              <Play className={`w-4 h-4 ${runningCycle ? 'animate-spin' : ''}`} />
              <span>{runningCycle ? 'Agent Bekerja...' : 'Jalankan Siklus Sekarang'}</span>
            </button>
          </div>
        </div>

        {/* Decorative Background Blob */}
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* Cycle Execution Terminal Log */}
      {cycleLogs.length > 0 && (
        <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 font-mono text-xs text-slate-300 space-y-1 max-h-48 overflow-y-auto custom-scrollbar shadow-inner">
          <div className="flex items-center justify-between text-indigo-400 font-bold mb-2 pb-1 border-b border-slate-800">
            <span className="flex items-center gap-1.5">
              <Terminal className="w-3.5 h-3.5" />
              <span>Agent Live Execution Stream</span>
            </span>
            <button
              onClick={() => setCycleLogs([])}
              className="text-[10px] text-slate-500 hover:text-slate-300 cursor-pointer"
            >
              Tutup
            </button>
          </div>
          {cycleLogs.map((log, i) => (
            <div key={i} className="leading-relaxed text-slate-400">
              <span className="text-indigo-500 mr-2">›</span>
              {log}
            </div>
          ))}
        </div>
      )}

      {/* Top Metrics Banner */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium">Status Kuartal</span>
            <Calendar className="w-3.5 h-3.5 text-indigo-400" />
          </div>
          <p className="text-lg font-bold text-white">
            {quarterStatus?.current_quarter || 'Q-Aktif'}
          </p>
          <p className="text-[10px] text-slate-500">
            {quarterStatus?.total_products || 0} Total Produk Terdaftar
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium">Total Tayangan (Views)</span>
            <Eye className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <p className="text-lg font-bold text-emerald-400">
            {(quarterStatus?.total_views || 0).toLocaleString('id-ID')}
          </p>
          <p className="text-[10px] text-slate-500">Dari seluruh postingan kuartal</p>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium">Klik Afiliasi Riil</span>
            <MousePointerClick className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <p className="text-lg font-bold text-amber-400">
            {(quarterStatus?.total_clicks || 0).toLocaleString('id-ID')}
          </p>
          <p className="text-[10px] text-slate-500">
            CTR Rata-rata: {quarterStatus?.avg_ctr || 0}%
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium">Status Autopilot</span>
            <Cpu className="w-3.5 h-3.5 text-purple-400" />
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`w-2 h-2 rounded-full ${
                config?.autopilot_enabled ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'
              }`}
            />
            <span className="text-sm font-bold text-white">
              {config?.autopilot_enabled ? 'Aktif Penuh' : 'Non-Aktif'}
            </span>
          </div>
          <button
            onClick={handleToggleAutopilot}
            className="text-[10px] text-indigo-400 hover:text-indigo-300 font-semibold cursor-pointer"
          >
            {config?.autopilot_enabled ? 'Matikan Autopilot' : 'Aktifkan Autopilot'}
          </button>
        </div>
      </div>

      {/* Autonomous System Architecture Modules */}
      <div className="p-6 rounded-3xl bg-slate-900/60 border border-slate-800/80 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-indigo-400" />
            <h3 className="text-sm font-bold text-slate-200">Arsitektur Agen Otonom</h3>
          </div>
          <span className="text-xs text-slate-500">Autonomous Core</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {agentModules.map((mod, idx) => (
            <div
              key={idx}
              className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800/80 flex items-start gap-3"
            >
              <div className="text-2xl p-2 rounded-xl bg-slate-950 border border-slate-800 shrink-0">
                {mod.icon}
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="text-xs font-bold text-slate-200 mb-0.5">{mod.name}</h4>
                <p className="text-[10px] text-slate-400 font-medium mb-1">{mod.role}</p>
                <p className="text-[10px] text-slate-500 line-clamp-2">{mod.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Real-time Decision Transparency Log */}
      <div className="p-6 rounded-3xl bg-slate-900/60 border border-slate-800/80 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-bold text-slate-200">
              Log Transparansi Keputusan AI Terkini
            </h3>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-500">Real-time Decision Stream</span>
            {decisions.length > 0 && (
              <button
                onClick={handleClearDecisions}
                className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-rose-400 transition-colors cursor-pointer"
                title="Bersihkan log keputusan"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Bersihkan</span>
              </button>
            )}
          </div>
        </div>

        {decisions.length === 0 ? (
          <div className="py-8 text-center text-slate-500 text-xs">
            Belum ada log keputusan baru. Keputusan akan dicatat saat agent memproses produk.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {decisions.map((dec) => (
              <div
                key={dec.id}
                className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800/80 text-xs space-y-1"
              >
                <div className="flex items-center justify-between gap-2 text-indigo-400 font-bold">
                  <span className="line-clamp-1">{dec.summary}</span>
                  <span className="text-[10px] text-slate-500 font-normal shrink-0">
                    {new Date(dec.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <p className="text-slate-400 leading-relaxed line-clamp-2">{dec.reasoning}</p>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
