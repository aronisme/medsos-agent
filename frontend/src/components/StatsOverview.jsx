import React, { useEffect, useState } from 'react';
import api from '../api/client';
import {
  Calendar,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Share2,
  PenTool,
  Sparkles,
  RefreshCw,
  TrendingUp,
  Users,
  MousePointerClick,
  ShoppingBag,
  Activity,
  Facebook,
  Instagram,
  AtSign,
  ChevronRight,
  ShieldCheck,
  TrendingDown,
  Info,
  CalendarDays,
  FileText
} from 'lucide-react';

export default function StatsOverview({ setActiveTab }) {
  const [stats, setStats] = useState(null);
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('7d'); // 'today' | '7d' | '30d' | 'all'

  const fetchStats = async () => {
    setLoading(true);
    try {
      const [statsRes, overviewRes] = await Promise.all([
        api.get('/stats'),
        api.get(`/analytics/overview?range=${timeRange}`)
      ]);
      setStats(statsRes.data);
      setOverview(overviewRes.data);
    } catch (err) {
      console.error('Gagal mengambil statistik', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, [timeRange]);

  const summary = stats?.summary || {};
  const totalPosts = (summary.draft || 0) + (summary.scheduled || 0) + (summary.posted || 0) + (summary.failed || 0);

  // Stats cards configuration
  const kpiCards = [
    {
      title: 'Total Postingan',
      value: totalPosts,
      icon: FileText,
      color: 'from-blue-500/20 to-indigo-500/10 border-blue-500/30 text-blue-400',
      desc: 'Seluruh draft & terpublish'
    },
    {
      title: 'Terjadwal',
      value: summary.scheduled || 0,
      icon: Clock,
      color: 'from-amber-500/20 to-orange-500/10 border-amber-500/30 text-amber-400',
      desc: 'Menunggu waktu publish'
    },
    {
      title: 'Berhasil Terpublish',
      value: summary.posted || 0,
      icon: CheckCircle2,
      color: 'from-emerald-500/20 to-teal-500/10 border-emerald-500/30 text-emerald-400',
      desc: 'Telah terkirim ke medsos'
    },
    {
      title: 'Gagal Publish',
      value: summary.failed || 0,
      icon: AlertTriangle,
      color: 'from-rose-500/20 to-pink-500/10 border-rose-500/30 text-rose-400',
      desc: 'Butuh peninjauan ulang'
    },
    {
      title: 'Akun Sosmed Aktif',
      value: stats?.activeAccounts || 0,
      icon: Share2,
      color: 'from-purple-500/20 to-indigo-500/10 border-purple-500/30 text-purple-400',
      desc: 'Terhubung & siap tayang'
    },
    {
      title: 'Total Klik Link',
      value: overview?.summary?.total_clicks || 0,
      icon: MousePointerClick,
      color: 'from-cyan-500/20 to-blue-500/10 border-cyan-500/30 text-cyan-400',
      desc: 'Dari tautan promo Anda'
    },
    {
      title: 'Pengunjung Asli',
      value: overview?.summary?.human_clicks || 0,
      icon: Users,
      color: 'from-teal-500/20 to-emerald-500/10 border-teal-500/30 text-teal-400',
      desc: 'Bebas dari deteksi bot'
    }
  ];

  // Calculate scaling max value for trend chart
  const maxTrendClicks = overview?.trend?.length > 0
    ? Math.max(...overview.trend.map(t => t.clicks), 5)
    : 10;

  const getTimeRangeTitle = () => {
    switch (timeRange) {
      case 'today': return 'Tren Klik Hari Ini (Per Jam)';
      case '7d': return 'Tren Klik 7 Hari Terakhir';
      case '30d': return 'Tren Klik 30 Hari Terakhir';
      case 'all': return 'Tren Klik Sepanjang Waktu';
      default: return 'Tren Klik';
    }
  };

  const getLogMessage = (action, details) => {
    let parsedDetails = {};
    try {
      if (details) {
        parsedDetails = typeof details === 'string' ? JSON.parse(details) : details;
      }
    } catch (_) {}

    switch (action) {
      case 'create_post':
        return `Membuat postingan baru (ID: ${parsedDetails.postId?.slice(0, 7) || 'N/A'})`;
      case 'post_success':
        return `Berhasil publish ke platform ${parsedDetails.platform || 'sosial'}`;
      case 'post_success_dryrun':
        return `Simulasi publish berhasil (Dry Run) ke ${parsedDetails.platform || 'sosial'}`;
      case 'post_failed':
        return `Gagal publish ke platform ${parsedDetails.platform || 'sosial'}`;
      case 'auth_refresh':
        return 'Pembaruan token akun sosial berhasil';
      case 'sync_analytics':
        return 'Sinkronisasi analitik klik berhasil diselesaikan';
      default:
        return action;
    }
  };

  const getPlatformIcon = (plat) => {
    const p = String(plat || '').toLowerCase();
    if (p.includes('facebook')) return <Facebook className="w-3.5 h-3.5 text-blue-400" />;
    if (p.includes('instagram')) return <Instagram className="w-3.5 h-3.5 text-pink-400" />;
    return <AtSign className="w-3.5 h-3.5 text-slate-400" />;
  };

  return (
    <div className="space-y-6 text-left">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-indigo-900/60 via-purple-900/40 to-slate-900 border border-indigo-500/20 p-6 lg:p-8">
        <div className="relative z-10 max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-300 text-xs font-semibold border border-indigo-500/30 mb-3">
            <Sparkles className="w-3.5 h-3.5" />
            <span>FB, IG & Threads Automation Dashboard v2.0</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Ringkasan & Analitik Integrasi Medsos
          </h2>
          <p className="text-slate-300 text-sm mt-2 leading-relaxed max-w-2xl">
            Otomatisasi konten media sosial Facebook, Instagram, dan Threads. Pantau performa klik affiliate Shopee secara real-time dan analisis aktivitas sistem dari satu dasbor terpadu.
          </p>
          <div className="flex flex-wrap items-center gap-3 mt-6">
            <button
              onClick={() => setActiveTab('composer')}
              className="px-5 py-2.5 rounded-xl gradient-btn text-sm font-semibold flex items-center gap-2 shadow-lg hover:brightness-110 active:scale-95 transition-all"
            >
              <PenTool className="w-4 h-4" />
              <span>Buat Postingan Baru</span>
            </button>
            <button
              onClick={() => setActiveTab('accounts')}
              className="px-5 py-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-slate-200 border border-slate-700 text-sm font-semibold flex items-center gap-2 transition-all active:scale-95"
            >
              <Share2 className="w-4 h-4 text-purple-400" />
              <span>Hubungkan Akun</span>
            </button>
            <button
              onClick={() => setActiveTab('link_analytics')}
              className="px-5 py-2.5 rounded-xl bg-slate-900/60 hover:bg-slate-900 text-indigo-300 border border-indigo-500/30 text-sm font-semibold flex items-center gap-2 transition-all active:scale-95"
            >
              <TrendingUp className="w-4 h-4 text-indigo-400" />
              <span>Analitik Link Lengkap</span>
            </button>
          </div>
        </div>
      </div>

      {/* Control row with title & time range filter */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h3 className="text-base font-bold text-white flex items-center gap-2">
          <span>Ringkasan Performa Sistem</span>
        </h3>
        
        <div className="flex items-center gap-2 bg-slate-900 p-1.5 rounded-2xl border border-slate-800 self-start sm:self-auto">
          {[
            { id: 'today', label: 'Hari Ini' },
            { id: '7d', label: '7 Hari' },
            { id: '30d', label: '30 Hari' },
            { id: 'all', label: 'Semua' },
          ].map((range) => (
            <button
              key={range.id}
              onClick={() => setTimeRange(range.id)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                timeRange === range.id
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {range.label}
            </button>
          ))}
          <button
            onClick={fetchStats}
            className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors ml-1"
            title="Muat Ulang Data"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-4">
        {kpiCards.map((card, idx) => {
          const Icon = card.icon;
          return (
            <div
              key={idx}
              className={`p-4 rounded-2xl bg-gradient-to-br ${card.color} border bg-slate-900/40 backdrop-blur-md transition-all hover:scale-[1.02] flex flex-col justify-between`}
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{card.title}</span>
                  <div className="p-1.5 rounded-lg bg-slate-950/60">
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                </div>
                <div className="mt-3">
                  <span className="text-2xl font-extrabold text-white tracking-tight">
                    {loading ? '...' : card.value}
                  </span>
                </div>
              </div>
              <p className="text-[9px] text-slate-500 mt-2 truncate">{card.desc}</p>
            </div>
          );
        })}
      </div>

      {/* Dynamic Trend Chart & Distributions Row */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Click Trend Chart (8 columns) */}
        <div className="lg:col-span-8 p-5 sm:p-6 bg-slate-900/60 border border-slate-800/80 rounded-3xl space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <h4 className="text-xs uppercase font-extrabold text-indigo-400 tracking-widest flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5" />
                <span>{getTimeRangeTitle()}</span>
              </h4>
              <p className="text-[11px] text-slate-400">Total volume klik tautan affiliate periode saat ini</p>
            </div>
            <div className="flex items-center gap-3 text-[10px]">
              <div className="flex items-center gap-1.5 text-indigo-300 font-medium">
                <span className="w-2 h-2 rounded-full bg-indigo-500" />
                <span>Pengunjung</span>
              </div>
              <div className="flex items-center gap-1.5 text-slate-500 font-medium">
                <span className="w-2 h-2 rounded-full bg-slate-700" />
                <span>Bot</span>
              </div>
            </div>
          </div>

          {/* Bar Chart Graph rendering */}
          {loading ? (
            <div className="h-44 w-full flex items-center justify-center text-slate-500 text-xs">Memuat data tren...</div>
          ) : !overview?.trend || overview.trend.length === 0 ? (
            <div className="h-44 w-full flex items-center justify-center text-slate-500 text-xs">Belum ada klik terekam periode ini.</div>
          ) : (
            <div className="h-48 w-full pt-4 flex items-end gap-1.5 overflow-x-auto border-b border-slate-800 pb-2">
              {overview.trend.map((t, idx) => {
                const heightPercent = Math.max(Math.round((t.clicks / maxTrendClicks) * 100), 5);
                const isToday = idx === overview.trend.length - 1;
                return (
                  <div
                    key={t.date || idx}
                    className="flex-1 min-w-[12px] flex flex-col items-center gap-1 group relative"
                  >
                    {/* Tooltip on hover */}
                    <div className="absolute -top-14 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-950 border border-slate-700 text-[10px] text-white px-2.5 py-1 rounded-xl shadow-2xl pointer-events-none z-20 whitespace-nowrap">
                      <p className="font-bold">{t.date}</p>
                      <p className="text-indigo-300">{t.clicks} total ({t.human} pengunjung, {t.bot} bot)</p>
                    </div>

                    <div className="w-full h-36 flex items-end justify-center">
                      <div
                        style={{ height: `${heightPercent}%` }}
                        className={`w-full rounded-t-md transition-all duration-300 ${
                          isToday
                            ? 'bg-gradient-to-t from-indigo-600 to-cyan-500 shadow-md shadow-indigo-500/20'
                            : t.clicks > 0
                            ? 'bg-indigo-500/80 hover:bg-indigo-400'
                            : 'bg-slate-800/40'
                        }`}
                      />
                    </div>
                    <span className="text-[8px] text-slate-500 group-hover:text-slate-300 font-mono">
                      {timeRange === 'today' ? t.date : t.date.length > 5 ? t.date.slice(5) : t.date}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Distributions breakdown (4 columns) */}
        <div className="lg:col-span-4 p-5 sm:p-6 bg-slate-900/60 border border-slate-800/80 rounded-3xl space-y-4">
          <div className="space-y-0.5">
            <h4 className="text-xs uppercase font-extrabold text-purple-400 tracking-widest flex items-center gap-1.5">
              <Share2 className="w-3.5 h-3.5" />
              <span>Target Platform Postingan</span>
            </h4>
            <p className="text-[11px] text-slate-400">Total dispatch target dan kesuksesan</p>
          </div>

          <div className="space-y-3.5 pt-2">
            {loading ? (
              <div className="text-center text-slate-500 text-xs py-6">Memuat statistik...</div>
            ) : !stats?.byPlatform || stats.byPlatform.length === 0 ? (
              <div className="text-center text-slate-500 text-xs py-6">Belum ada target sosial terekam.</div>
            ) : (
              stats.byPlatform.map((platObj) => {
                const percent = platObj.total > 0 ? Math.round((platObj.success / platObj.total) * 100) : 0;
                return (
                  <div key={platObj.platform} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-300 flex items-center gap-1.5 capitalize">
                        {getPlatformIcon(platObj.platform)}
                        {platObj.platform}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {platObj.success}/{platObj.total} Sukses ({percent}%)
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-slate-950 overflow-hidden border border-slate-800/40">
                      <div
                        style={{ width: `${percent}%` }}
                        className={`h-full rounded-full transition-all duration-300 ${
                          percent >= 90 ? 'bg-emerald-500' : percent >= 50 ? 'bg-amber-500' : 'bg-rose-500'
                        }`}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Connected accounts info */}
          <div className="pt-2 border-t border-slate-800/80 flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-pulse" />
            <span className="text-[10px] text-slate-400 font-semibold">
              Koneksi API sosial aktif: {stats?.activeAccounts || 0} akun
            </span>
          </div>
        </div>
      </div>

      {/* Two Column details: Recent Posts (Left) & Timeline Logs (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent posts */}
        <div className="p-5 sm:p-6 bg-slate-900/60 border border-slate-800/80 rounded-3xl space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-xs uppercase font-extrabold text-indigo-400 tracking-widest flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" />
              <span>Postingan Terbaru</span>
            </h4>
            <button
              onClick={() => setActiveTab('posts')}
              className="text-[10px] font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-0.5"
            >
              <span>Semua</span>
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>

          <div className="space-y-3 max-h-[320px] overflow-y-auto pr-1 custom-scrollbar">
            {loading ? (
              <div className="text-center text-slate-500 text-xs py-8">Memuat daftar postingan...</div>
            ) : !stats?.recent || stats.recent.length === 0 ? (
              <div className="text-center text-slate-500 text-xs py-8">Belum ada postingan yang dibuat.</div>
            ) : (
              stats.recent.map((post) => {
                const statusColors = {
                  draft: 'bg-slate-800 text-slate-300 border-slate-700',
                  scheduled: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
                  posted: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
                  failed: 'bg-rose-500/10 text-rose-300 border-rose-500/30',
                };
                return (
                  <div
                    key={post.id}
                    className="p-3 bg-slate-950/60 border border-slate-800/80 rounded-2xl flex items-center justify-between gap-4 hover:border-slate-700 transition-all text-xs"
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border capitalize ${statusColors[post.status] || 'bg-slate-800'}`}>
                          {post.status}
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono">#{post.id.slice(0, 7)}</span>
                      </div>
                      <p className="font-semibold text-slate-200 truncate leading-relaxed">
                        {post.title || post.content}
                      </p>
                      <p className="text-[9px] text-slate-500">
                        {post.scheduled_at 
                          ? `Jadwal: ${new Date(post.scheduled_at).toLocaleString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB`
                          : `Dibuat: ${new Date(post.created_at).toLocaleDateString('id-ID')}`
                        }
                      </p>
                    </div>

                    {/* Platform Target icons list */}
                    <div className="flex -space-x-1 hover:space-x-0.5 transition-all shrink-0">
                      {post.targets?.slice(0, 3).map((t, idx) => (
                        <div
                          key={idx}
                          className="w-5 h-5 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center shadow-md"
                          title={`${t.platform}: ${t.status}`}
                        >
                          {getPlatformIcon(t.platform)}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Timeline Log Activities */}
        <div className="p-5 sm:p-6 bg-slate-900/60 border border-slate-800/80 rounded-3xl space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-xs uppercase font-extrabold text-cyan-400 tracking-widest flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5" />
              <span>Log Aktivitas Terbaru</span>
            </h4>
            <span className="text-[9px] font-bold text-slate-500 flex items-center gap-1">
              <ShieldCheck className="w-3 h-3 text-emerald-500" />
              <span>Sistem Diaudit</span>
            </span>
          </div>

          <div className="space-y-3.5 max-h-[320px] overflow-y-auto pr-1 custom-scrollbar text-xs">
            {loading ? (
              <div className="text-center text-slate-500 text-xs py-8">Memuat audit log...</div>
            ) : !stats?.recentLogs || stats.recentLogs.length === 0 ? (
              <div className="text-center text-slate-500 text-xs py-8">Belum ada aktivitas audit log.</div>
            ) : (
              stats.recentLogs.map((log) => (
                <div key={log.id} className="relative pl-5 border-l border-slate-800/80 py-0.5 last:border-none">
                  {/* Timeline bullet */}
                  <span className={`absolute left-[-4.5px] top-2.5 w-2 h-2 rounded-full border ${
                    log.action.includes('success') ? 'bg-emerald-500 border-emerald-300' :
                    log.action.includes('failed') ? 'bg-rose-500 border-rose-300' : 'bg-indigo-500 border-indigo-300'
                  }`} />
                  
                  <div className="space-y-0.5">
                    <p className="font-semibold text-slate-300">
                      {getLogMessage(log.action, log.details)}
                    </p>
                    <span className="text-[9px] text-slate-500 font-medium">
                      {new Date(log.created_at).toLocaleString('id-ID', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit'
                      })}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Top Product / Link Card */}
      {overview?.summary?.top_product && (
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-3xl p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-orange-500/10 text-orange-400 border border-orange-500/20 shadow-md shrink-0">
              <ShoppingBag className="w-5 h-5 animate-bounce" />
            </div>
            <div>
              <span className="text-[10px] uppercase font-extrabold text-orange-400 tracking-wider">Tautan Affiliate Terlaris Periode Ini</span>
              <h4 className="text-sm font-bold text-white leading-tight truncate max-w-md mt-0.5">
                {overview.summary.top_product.title}
              </h4>
              <p className="text-[10px] text-slate-500 mt-0.5 font-mono">ID Kode: /s/{overview.summary.top_product.code}</p>
            </div>
          </div>
          <div className="bg-slate-950 border border-slate-800 px-4 py-2.5 rounded-2xl shrink-0 text-right">
            <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Performa Klik</span>
            <span className="text-lg font-extrabold text-indigo-400">
              {overview.summary.top_product.clicks} Klik
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
