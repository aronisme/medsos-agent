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
  Trash2,
  AtSign
} from 'lucide-react';
import api from '../api/client';

export default function AgentDashboard({ setActiveTab }) {
  const [loading, setLoading] = useState(true);
  const [runningCycle, setRunningCycle] = useState(false);
  const [cycleLogs, setCycleLogs] = useState([]);
  const [config, setConfig] = useState(null);
  const [quarterStatus, setQuarterStatus] = useState(null);
  const [insights, setInsights] = useState([]);
  const [decisions, setDecisions] = useState([]);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const res = await api.get('/agent-orchestrator/dashboard');
      if (res.data.success && res.data.data) {
        const data = res.data.data;
        setConfig(data.config);
        setQuarterStatus(data.quarter_status);
        setInsights(data.recent_insights || []);
        setDecisions(data.recent_decisions || []);
        return;
      }
    } catch (err) {
      console.warn('[AgentDashboard] Aggregated endpoint fallback:', err.message);
    }

    try {
      const [cfgRes, qRes, decRes, insRes] = await Promise.allSettled([
        api.get('/agent-orchestrator/config'),
        api.get('/agent-orchestrator/quarter/status'),
        api.get('/agent-orchestrator/decisions?limit=8'),
        api.get('/agent-orchestrator/insights'),
      ]);

      if (cfgRes.status === 'fulfilled' && cfgRes.value.data.success) {
        setConfig(cfgRes.value.data.config);
      }
      if (qRes.status === 'fulfilled' && qRes.value.data.success) {
        setQuarterStatus(qRes.value.data);
      }
      if (decRes.status === 'fulfilled' && decRes.value.data.success) {
        setDecisions(decRes.value.data.decisions || []);
      }
      if (insRes.status === 'fulfilled' && insRes.value.data.success) {
        setInsights(insRes.value.data.insights || []);
      }
    } catch (fallbackErr) {
      console.error('[AgentDashboard] Error fetching fallback data:', fallbackErr);
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

  const handleUpdateThreadsMediaMode = async (mode) => {
    try {
      await api.post('/agent-orchestrator/config', { threads_media_mode: mode });
      setConfig(prev => ({ ...prev, threads_media_mode: mode }));
    } catch (err) {
      console.error('Error updating threads_media_mode config:', err);
    }
  };

  const handleClearDecisions = async () => {
    try {
      await api.delete('/agent-orchestrator/decisions');
      setDecisions([]);
    } catch (err) {
      console.error('Error clearing decisions:', err);
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

      {/* Threads Autopilot Strategy Controls */}
      <div className="p-5 rounded-3xl bg-slate-900/60 border border-slate-800/80 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-black border border-slate-700 flex items-center justify-center text-white">
              <AtSign className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-200">Strategi Media Threads (AI Autopilot)</h3>
              <p className="text-[11px] text-slate-400">Tentukan cara Agen AI menerbitkan konten ke akun Meta Threads</p>
            </div>
          </div>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-400 border border-sky-500/30 font-bold self-start sm:self-auto">
            Mode Aktif: {(config?.threads_media_mode || 'auto').toUpperCase()}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
          {[
            {
              id: 'no_media',
              title: '🔗 Link Card Preview (Tanpa Media)',
              badge: 'DIREKOMENDASIKAN',
              desc: 'Teks murni dengan URL afiliasi di caption. Meta Threads otomatis merender kartu thumbnail, judul, harga, dan rating Shopee interaktif.',
            },
            {
              id: 'auto',
              title: '🤖 Auto Mix (Adaptif)',
              badge: 'HYBRID',
              desc: 'Gunakan foto/video jika produk memiliki media berkualitas tinggi; jika stok media habis, otomatis fallback ke Link Card Preview.',
            },
            {
              id: 'with_media',
              title: '🖼️ Visual Media Saja',
              badge: 'CLASSIC',
              desc: 'Wajib menyertakan foto atau video produk pada setiap postingan Threads. First reply digunakan untuk link afiliasi.',
            }
          ].map(opt => {
            const isSelected = (config?.threads_media_mode || 'auto') === opt.id;
            return (
              <div
                key={opt.id}
                onClick={() => handleUpdateThreadsMediaMode(opt.id)}
                className={`cursor-pointer p-3.5 rounded-2xl border flex flex-col justify-between transition-all ${
                  isSelected
                    ? 'bg-sky-500/15 border-sky-500/50 shadow-lg shadow-sky-500/5 ring-1 ring-sky-500/40'
                    : 'bg-slate-950/60 border-slate-800/80 hover:border-slate-700 text-slate-300'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="text-xs font-bold text-white">{opt.title}</span>
                    <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded border ${
                      isSelected
                        ? 'bg-sky-500/30 text-sky-200 border-sky-400/40'
                        : 'bg-slate-800 text-slate-400 border-slate-700'
                    }`}>
                      {opt.badge}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">{opt.desc}</p>
                </div>
                <div className="mt-3 pt-2 border-t border-slate-800/60 flex items-center justify-between text-[10px]">
                  <span className={isSelected ? 'text-sky-400 font-bold' : 'text-slate-500'}>
                    {isSelected ? '✓ Terpilih Sebagai Default' : 'Klik untuk Aktifkan'}
                  </span>
                </div>
              </div>
            );
          })}
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
                    {dec.created_at ? new Date(dec.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : ''}
                  </span>
                </div>
                <p className="text-slate-400 leading-relaxed line-clamp-2">{dec.reasoning}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Knowledge Insights from Closed-Loop Learning Layer */}
      {insights.length > 0 && (
        <div className="p-6 rounded-3xl bg-slate-900/60 border border-slate-800/80 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <h3 className="text-sm font-bold text-slate-200">
                Wawasan Pembelajaran AI (Knowledge Layer)
              </h3>
            </div>
            <span className="text-xs text-slate-500">{insights.length} Wawasan Aktif</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {insights.map((ins, idx) => (
              <div key={idx} className="p-3 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-1">
                <div className="flex items-center justify-between text-xs font-bold text-slate-200">
                  <span className="truncate">{ins.insight_type || 'Wawasan Pola'}</span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    {(ins.confidence_score ? `${Math.round(ins.confidence_score * 100)}%` : 'AI Learned')}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">{ins.summary || ins.finding}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick Navigation Hub */}
      {setActiveTab && (
        <div className="p-5 rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-center sm:text-left">
            <h4 className="text-xs font-bold text-slate-200">Navigasi Modul Agen Otonom</h4>
            <p className="text-[11px] text-slate-400">Akses cepat papan status produk kuartal, laboratorium eksperimen, dan katalog</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 justify-center">
            <button
              onClick={() => setActiveTab('product_lifecycle')}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors"
            >
              📊 Lifecycle Board
            </button>
            <button
              onClick={() => setActiveTab('affiliate_products')}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors"
            >
              🛍️ Katalog Produk
            </button>
            <button
              onClick={() => setActiveTab('threads_marketing')}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors"
            >
              🧵 Threads Hub
            </button>
            <button
              onClick={() => setActiveTab('post_analytics')}
              className="px-3 py-1.5 rounded-xl bg-indigo-600/80 hover:bg-indigo-600 text-white text-xs font-semibold border border-indigo-500 transition-colors"
            >
              📈 Analitik Terpadu
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
