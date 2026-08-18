import React, { useState, useEffect } from 'react';
import api from '../api/client';
import {
  BarChart3,
  TrendingUp,
  MousePointerClick,
  Users,
  Bot,
  ExternalLink,
  Copy,
  Check,
  Search,
  ArrowUpDown,
  RefreshCw,
  Plus,
  Trash2,
  Calendar,
  Smartphone,
  Globe,
  Share2,
  ShoppingBag,
  Sparkles,
  Layers,
  X,
  Loader2,
  AlertCircle,
  Activity,
  ShieldCheck,
  ChevronRight,
  PieChart
} from 'lucide-react';

export default function LinkAnalytics() {
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState(null);
  const [links, setLinks] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('clicks');
  const [selectedLinkDetail, setSelectedLinkDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [singleLinkData, setSingleLinkData] = useState(null);

  // Custom link modal
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [customSlug, setCustomSlug] = useState('');
  const [customTargetUrl, setCustomTargetUrl] = useState('');
  const [customTitle, setCustomTitle] = useState('');
  const [creatingCustom, setCreatingCustom] = useState(false);

  // Toast / Copy state
  const [copiedCode, setCopiedCode] = useState('');
  const [toastMessage, setToastMessage] = useState('');

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3000);
  };

  const copyToClipboard = (key, text) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedCode(key);
    showToast('Tautan berhasil disalin ke clipboard!');
    setTimeout(() => setCopiedCode(''), 2000);
  };

  const fetchAnalyticsData = async () => {
    setLoading(true);
    try {
      const [overviewRes, linksRes] = await Promise.all([
        api.get('/analytics/overview'),
        api.get(`/analytics/links?sortBy=${sortBy}&q=${encodeURIComponent(searchQuery)}`)
      ]);
      setOverview(overviewRes.data);
      setLinks(linksRes.data.links || []);
    } catch (err) {
      console.error('Error fetching analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalyticsData();
  }, [sortBy]);

  // Debounced search
  useEffect(() => {
    const handler = setTimeout(() => {
      api.get(`/analytics/links?sortBy=${sortBy}&q=${encodeURIComponent(searchQuery)}`)
        .then(res => setLinks(res.data.links || []))
        .catch(() => {});
    }, 300);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  const handleOpenDetail = async (link) => {
    setSelectedLinkDetail(link);
    setLoadingDetail(true);
    try {
      const res = await api.get(`/analytics/links/${link.code}`);
      setSingleLinkData(res.data);
    } catch (err) {
      console.error('Error fetching single link detail:', err);
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleCreateCustomLink = async (e) => {
    e.preventDefault();
    if (!customSlug.trim() || !customTargetUrl.trim()) {
      alert('Custom slug dan URL target wajib diisi.');
      return;
    }
    setCreatingCustom(true);
    try {
      await api.post('/analytics/links/custom', {
        custom_slug: customSlug.trim(),
        product_url: customTargetUrl.trim(),
        title: customTitle.trim() || 'Custom Promo Link'
      });
      setShowCustomModal(false);
      setCustomSlug('');
      setCustomTargetUrl('');
      setCustomTitle('');
      fetchAnalyticsData();
      showToast('Custom shortlink berhasil dibuat!');
    } catch (err) {
      alert(err.response?.data?.error || 'Gagal membuat custom shortlink.');
    } finally {
      setCreatingCustom(false);
    }
  };

  const handleDeleteLink = async (code) => {
    if (!confirm(`Hapus shortlink /s/${code}? Data statistik link ini akan dihapus.`)) return;
    try {
      await api.delete(`/analytics/links/${code}`);
      setLinks(prev => prev.filter(l => l.code !== code));
      if (selectedLinkDetail?.code === code) setSelectedLinkDetail(null);
      showToast('Shortlink berhasil dihapus.');
    } catch (err) {
      alert('Gagal menghapus shortlink.');
    }
  };

  // Helper colors for platforms
  const getPlatformBadge = (plat) => {
    switch (plat) {
      case 'Instagram':
        return 'bg-gradient-to-r from-pink-500/20 to-purple-500/20 text-pink-300 border-pink-500/30';
      case 'Facebook':
        return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
      case 'Threads':
        return 'bg-slate-700/50 text-slate-200 border-slate-600';
      case 'WhatsApp':
        return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
      case 'TikTok':
        return 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30';
      case 'Twitter / X':
        return 'bg-sky-500/20 text-sky-300 border-sky-500/30';
      default:
        return 'bg-slate-800 text-slate-300 border-slate-700';
    }
  };

  // Max value calculation for chart scaling
  const maxTrendClicks = overview?.trend?.length > 0 
    ? Math.max(...overview.trend.map(t => t.clicks), 5)
    : 10;

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-indigo-600 text-white text-xs font-bold px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-2 animate-bounce">
          <Check className="w-4 h-4 text-emerald-300" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-900/60 border border-slate-800/80 p-5 sm:p-6 rounded-3xl backdrop-blur-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-2xl bg-indigo-500/20 border border-indigo-500/30 text-indigo-400">
              <BarChart3 className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2">
                Analitik Link Affiliate
                <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Live Tracking
                </span>
              </h1>
              <p className="text-xs text-slate-400">
                Pantau performa klik, asal media sosial, dan konversi produk Shopee secara real-time.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 self-stretch sm:self-auto">
          <button
            onClick={() => setShowCustomModal(true)}
            className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-sm"
          >
            <Plus className="w-4 h-4 text-indigo-400" />
            <span>Custom Slug</span>
          </button>

          <button
            onClick={fetchAnalyticsData}
            disabled={loading}
            className="px-4 py-2.5 rounded-xl gradient-btn text-white text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20 transition-all active:scale-95"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Segarkan</span>
          </button>
        </div>
      </div>

      {/* 4 Hero KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Clicks */}
        <div className="p-5 bg-slate-900/60 border border-slate-800/80 rounded-2xl relative overflow-hidden group hover:border-slate-700 transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Klik Link</span>
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <MousePointerClick className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold text-white">
              {overview?.summary?.total_clicks?.toLocaleString('id-ID') || 0}
            </span>
            <span className="text-xs font-bold text-indigo-400">
              +{overview?.summary?.clicks_today || 0} hari ini
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Akumulasi seluruh shortlink</p>
        </div>

        {/* Real Human Visitors */}
        <div className="p-5 bg-slate-900/60 border border-slate-800/80 rounded-2xl relative overflow-hidden group hover:border-slate-700 transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Pengunjung Asli</span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold text-emerald-400">
              {overview?.summary?.human_clicks?.toLocaleString('id-ID') || 0}
            </span>
            <span className="text-[11px] text-slate-400">
              ({overview?.summary?.total_clicks > 0 ? Math.round((overview.summary.human_clicks / overview.summary.total_clicks) * 100) : 100}%)
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Bebas dari bot & preview crawler</p>
        </div>

        {/* Top Platform */}
        <div className="p-5 bg-slate-900/60 border border-slate-800/80 rounded-2xl relative overflow-hidden group hover:border-slate-700 transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Top Sumber Trafik</span>
            <div className="p-2 rounded-xl bg-pink-500/10 text-pink-400 border border-pink-500/20">
              <Share2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-extrabold text-pink-400 truncate">
            {overview?.summary?.top_platform || 'Belum Ada'}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Media sosial penghasil klik tertinggi</p>
        </div>

        {/* Top Product */}
        <div className="p-5 bg-slate-900/60 border border-slate-800/80 rounded-2xl relative overflow-hidden group hover:border-slate-700 transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Produk #1 Terpopuler</span>
            <div className="p-2 rounded-xl bg-orange-500/10 text-orange-400 border border-orange-500/20">
              <ShoppingBag className="w-4 h-4" />
            </div>
          </div>
          <div className="text-sm font-bold text-white truncate" title={overview?.summary?.top_product?.title}>
            {overview?.summary?.top_product?.title || 'Belum Ada Klik'}
          </div>
          <p className="text-[11px] text-orange-400/90 font-semibold mt-1">
            {overview?.summary?.top_product?.clicks ? `${overview.summary.top_product.clicks} total klik` : 'Siap dipantau'}
          </p>
        </div>
      </div>

      {/* Main Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* 30-Day Trend Chart (8 Cols) */}
        <div className="lg:col-span-8 p-5 sm:p-6 bg-slate-900/60 border border-slate-800/80 rounded-3xl space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-indigo-400" />
                <span>Tren Klik 30 Hari Terakhir</span>
              </h3>
              <p className="text-xs text-slate-400">Aktivitas klik harian dari seluruh tautan affiliate</p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <div className="flex items-center gap-1.5 text-indigo-400 font-medium">
                <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
                <span>Pengunjung</span>
              </div>
              <div className="flex items-center gap-1.5 text-slate-500 font-medium">
                <span className="w-2.5 h-2.5 rounded-full bg-slate-700" />
                <span>Bot</span>
              </div>
            </div>
          </div>

          {/* Bar Chart Visualization */}
          <div className="h-56 w-full pt-4 flex items-end gap-1 sm:gap-1.5 overflow-x-auto border-b border-slate-800 pb-2">
            {overview?.trend?.map((t, idx) => {
              const heightPercent = Math.max(Math.round((t.clicks / maxTrendClicks) * 100), 4);
              const isToday = idx === overview.trend.length - 1;
              return (
                <div
                  key={t.date}
                  className="flex-1 min-w-[12px] flex flex-col items-center gap-1.5 group relative"
                >
                  {/* Tooltip */}
                  <div className="absolute -top-12 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-950 border border-slate-700 text-[10px] text-white px-2 py-1 rounded-lg shadow-xl pointer-events-none z-20 whitespace-nowrap">
                    <p className="font-bold">{t.date}</p>
                    <p className="text-indigo-300">{t.clicks} total ({t.human} manusia)</p>
                  </div>

                  <div className="w-full h-44 flex items-end justify-center">
                    <div
                      style={{ height: `${heightPercent}%` }}
                      className={`w-full rounded-t-md transition-all duration-300 ${
                        isToday
                          ? 'bg-gradient-to-t from-indigo-600 to-pink-500 shadow-lg shadow-indigo-500/30'
                          : t.clicks > 0
                          ? 'bg-indigo-500/80 hover:bg-indigo-400'
                          : 'bg-slate-800/40'
                      }`}
                    />
                  </div>
                  <span className="text-[9px] text-slate-500 group-hover:text-slate-300">
                    {t.date.slice(8)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Platform Breakdown Donut / List (4 Cols) */}
        <div className="lg:col-span-4 p-5 sm:p-6 bg-slate-900/60 border border-slate-800/80 rounded-3xl space-y-4">
          <div className="space-y-0.5">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <PieChart className="w-4 h-4 text-pink-400" />
              <span>Distribusi Platform</span>
            </h3>
            <p className="text-xs text-slate-400">Pangsa trafik dari tiap media sosial</p>
          </div>

          <div className="space-y-2.5 pt-2">
            {overview?.platform_breakdown && Object.entries(overview.platform_breakdown).map(([plat, count]) => {
              const total = overview?.summary?.total_clicks || 1;
              const percent = Math.round((count / total) * 100) || 0;
              return (
                <div key={plat} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-300">{plat}</span>
                    <span className="font-bold text-slate-400">{count} klik ({percent}%)</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-950 overflow-hidden">
                    <div
                      style={{ width: `${percent}%` }}
                      className={`h-full rounded-full transition-all duration-500 ${
                        plat === 'Instagram' ? 'bg-gradient-to-r from-pink-500 to-purple-500' :
                        plat === 'Facebook' ? 'bg-blue-500' :
                        plat === 'Threads' ? 'bg-slate-400' :
                        plat === 'WhatsApp' ? 'bg-emerald-500' :
                        plat === 'TikTok' ? 'bg-cyan-400' : 'bg-indigo-500'
                      }`}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
            <span>Perangkat:</span>
            <span className="text-slate-200 font-semibold">
              📱 Mobile {overview?.device_breakdown?.Mobile || 0} • 💻 Desktop {overview?.device_breakdown?.Desktop || 0}
            </span>
          </div>
        </div>
      </div>

      {/* Leaderboard Table of All Monitored Links */}
      <div className="bg-slate-900/60 border border-slate-800/80 rounded-3xl overflow-hidden space-y-4 p-5 sm:p-6">
        {/* Table Header Filter */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="space-y-0.5">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-400" />
              <span>Daftar Tautan Affiliate & Pantauan Klik ({links.length})</span>
            </h3>
            <p className="text-xs text-slate-400">Semua link pendek aktif dengan pelacakan performa</p>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            {/* Search Input */}
            <div className="relative flex-1 sm:w-56">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Cari produk / slug..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 outline-none focus:border-indigo-500"
              />
            </div>

            {/* Sort */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-xl px-3 py-2 outline-none cursor-pointer"
            >
              <option value="clicks">Klik Terbanyak</option>
              <option value="newest">Terbaru</option>
              <option value="oldest">Terlama</option>
            </select>
          </div>
        </div>

        {/* Table Content */}
        {loading ? (
          <div className="py-16 text-center flex flex-col items-center justify-center gap-2">
            <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
            <span className="text-xs text-slate-400">Memuat data analitik...</span>
          </div>
        ) : links.length === 0 ? (
          <div className="py-16 text-center space-y-3 bg-slate-950/40 rounded-2xl border border-slate-800/80">
            <BarChart3 className="w-10 h-10 mx-auto text-slate-600" />
            <p className="text-sm font-bold text-white">Belum Ada Tautan yang Dibuat</p>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Tautan otomatis dibuat saat Anda mengirim produk ke <b>Buat Postingan</b> atau menekan tombol <b>Custom Slug</b> di atas.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-slate-400 font-bold uppercase tracking-wider border-b border-slate-800/80 text-[10px] bg-slate-950/40">
                <tr>
                  <th className="py-3 px-4">Produk & Judul</th>
                  <th className="py-3 px-4">Shortlink</th>
                  <th className="py-3 px-4 text-center">Total Klik</th>
                  <th className="py-3 px-4 text-center">Pengunjung Asli</th>
                  <th className="py-3 px-4">Terakhir Diklik</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {links.map((link) => (
                  <tr key={link.code} className="hover:bg-slate-800/30 transition-colors group">
                    {/* Product & Title */}
                    <td className="py-3 px-4 max-w-xs">
                      <div className="flex items-center gap-3">
                        {link.image_url ? (
                          <img
                            src={link.image_url}
                            alt={link.title}
                            className="w-9 h-9 rounded-lg object-cover bg-slate-950 border border-slate-800 shrink-0"
                          />
                        ) : (
                          <div className="w-9 h-9 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-500 shrink-0">
                            <ShoppingBag className="w-4 h-4" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="font-bold text-slate-100 truncate" title={link.title}>
                            {link.title}
                          </p>
                          {link.price > 0 && (
                            <p className="text-[11px] text-orange-400 font-semibold">
                              Rp {link.price?.toLocaleString('id-ID')}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Shortlink */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-indigo-400 bg-indigo-500/10 px-2 py-1 rounded-lg border border-indigo-500/20 font-semibold">
                          /s/{link.code}
                        </span>
                        <button
                          onClick={() => copyToClipboard(link.code, link.short_url)}
                          className="p-1 text-slate-400 hover:text-slate-200 rounded"
                          title="Salin Shortlink"
                        >
                          {copiedCode === link.code ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </td>

                    {/* Total Clicks */}
                    <td className="py-3 px-4 text-center">
                      <span className="text-sm font-extrabold text-white">
                        {link.total_clicks?.toLocaleString('id-ID') || 0}
                      </span>
                    </td>

                    {/* Human Clicks */}
                    <td className="py-3 px-4 text-center">
                      <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                        {link.human_clicks?.toLocaleString('id-ID') || 0}
                      </span>
                    </td>

                    {/* Last Clicked */}
                    <td className="py-3 px-4 text-slate-400 text-[11px]">
                      {link.last_clicked_at ? new Date(link.last_clicked_at).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' }) : 'Belum ada'}
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleOpenDetail(link)}
                          className="p-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-300 border border-indigo-500/30 flex items-center gap-1 text-[11px] font-semibold"
                          title="Lihat Rincian Analitik"
                        >
                          <BarChart3 className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Detail</span>
                        </button>

                        <a
                          href={link.short_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
                          title="Uji Buka Link"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>

                        <button
                          onClick={() => handleDeleteLink(link.code)}
                          className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20"
                          title="Hapus Link"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ===================================================================== */}
      {/* MODAL: Single Link Deep Dive Analytics                                 */}
      {/* ===================================================================== */}
      {selectedLinkDetail && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-indigo-500/20 border border-indigo-500/30 text-indigo-400">
                  <BarChart3 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white truncate max-w-sm sm:max-w-md">
                    Analitik /s/{selectedLinkDetail.code}
                  </h3>
                  <p className="text-xs text-slate-400 truncate max-w-sm sm:max-w-md">
                    {selectedLinkDetail.title}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedLinkDetail(null)}
                className="p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 sm:p-6 overflow-y-auto space-y-6 flex-1">
              {loadingDetail ? (
                <div className="py-16 text-center flex flex-col items-center justify-center gap-2">
                  <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
                  <span className="text-xs text-slate-400">Memuat data analitik link...</span>
                </div>
              ) : (
                <>
                  {/* Summary row */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-2xl text-center">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Total Klik</span>
                      <p className="text-xl font-extrabold text-white mt-0.5">
                        {singleLinkData?.link?.total_clicks || 0}
                      </p>
                    </div>
                    <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-2xl text-center">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Pengunjung Asli</span>
                      <p className="text-xl font-extrabold text-emerald-400 mt-0.5">
                        {singleLinkData?.link?.human_clicks || 0}
                      </p>
                    </div>
                    <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-2xl text-center">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Bot Crawler</span>
                      <p className="text-xl font-extrabold text-slate-400 mt-0.5">
                        {singleLinkData?.link?.bot_clicks || 0}
                      </p>
                    </div>
                  </div>

                  {/* 14-Day Trend Chart */}
                  <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl space-y-3">
                    <h4 className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                      <TrendingUp className="w-3.5 h-3.5 text-indigo-400" />
                      <span>Tren Klik 14 Hari Terakhir</span>
                    </h4>
                    <div className="h-36 w-full flex items-end gap-1.5 pt-2">
                      {singleLinkData?.trend?.map((t) => {
                        const maxVal = Math.max(...singleLinkData.trend.map(x => x.clicks), 5);
                        const pct = Math.max(Math.round((t.clicks / maxVal) * 100), 5);
                        return (
                          <div key={t.date} className="flex-1 flex flex-col items-center gap-1 group relative">
                            <div
                              style={{ height: `${pct}%` }}
                              className="w-full rounded-t bg-indigo-500 group-hover:bg-indigo-400 transition-all"
                            />
                            <span className="text-[8px] text-slate-500">{t.date.slice(8)}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Recent 30 Clicks Log Stream */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                      <Activity className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Log Klik Terbaru (Real-Time Feed)</span>
                    </h4>

                    {singleLinkData?.recent_clicks?.length === 0 ? (
                      <p className="text-xs text-slate-500 italic py-4 text-center">Belum ada aktivitas klik.</p>
                    ) : (
                      <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                        {singleLinkData?.recent_clicks?.map((c, i) => (
                          <div
                            key={i}
                            className="p-2.5 bg-slate-950 border border-slate-800/80 rounded-xl flex items-center justify-between text-xs"
                          >
                            <div className="flex items-center gap-2">
                              <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${getPlatformBadge(c.platform)}`}>
                                {c.platform}
                              </span>
                              <span className="text-slate-300 font-medium">{c.device} ({c.os})</span>
                              {c.is_bot && (
                                <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                                  Bot Preview
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-slate-500 font-mono">
                              {new Date(c.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL: Create Custom Slug Shortlink                                    */}
      {/* ===================================================================== */}
      {showCustomModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-400" />
                <span>Buat Custom Shortlink</span>
              </h3>
              <button
                onClick={() => setShowCustomModal(false)}
                className="p-1 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateCustomLink} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-300 mb-1">Custom Slug (Tautan Pendek)</label>
                <div className="flex items-center bg-slate-950 border border-slate-800 rounded-xl px-3 py-2">
                  <span className="text-slate-500 font-mono">/s/</span>
                  <input
                    type="text"
                    required
                    placeholder="promo-hijab-bella"
                    value={customSlug}
                    onChange={(e) => setCustomSlug(e.target.value)}
                    className="flex-1 bg-transparent text-white font-mono outline-none pl-1"
                  />
                </div>
                <p className="text-[10px] text-slate-500 mt-1">Hanya huruf, angka, strip (-), dan garis bawah (_).</p>
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1">URL Target Produk / Affiliate</label>
                <input
                  type="url"
                  required
                  placeholder="https://shopee.co.id/..."
                  value={customTargetUrl}
                  onChange={(e) => setCustomTargetUrl(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1">Judul / Catatan Promo (Opsional)</label>
                <input
                  type="text"
                  placeholder="Contoh: Promo Flash Sale Hijab Bella"
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white outline-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCustomModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-bold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={creatingCustom}
                  className="px-5 py-2 rounded-xl gradient-btn text-white font-bold flex items-center gap-1.5 shadow-lg shadow-indigo-600/20"
                >
                  {creatingCustom && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Buat Link</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
