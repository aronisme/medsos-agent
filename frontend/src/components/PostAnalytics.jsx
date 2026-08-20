import React, { useState, useEffect, useMemo } from 'react';
import api from '../api/client';
import {
  RefreshCw,
  Search,
  ExternalLink,
  Eye,
  Heart,
  MessageCircle,
  Share2,
  Bookmark,
  TrendingUp,
  Clock,
  Download,
  CheckCircle2,
  AlertTriangle,
  FileCode,
  FileSpreadsheet,
  Link as LinkIcon,
  Video,
  Image as ImageIcon,
  Sparkles,
  Layers,
  Activity,
  History,
  X,
  Copy,
  Check,
  ChevronDown
} from 'lucide-react';

export default function PostAnalytics() {
  const [posts, setPosts] = useState([]);
  const [summary, setSummary] = useState(null);
  const [platformStatus, setPlatformStatus] = useState(null);
  const [lastSyncedAt, setLastSyncedAt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState(null);

  // Filters
  const [activePlatform, setActivePlatform] = useState('all');
  const [activeAccount, setActiveAccount] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('newest');
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'table'

  // Modal Detail / History state
  const [selectedPost, setSelectedPost] = useState(null);
  const [postHistory, setPostHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [activeDetailTab, setActiveDetailTab] = useState('velocity'); // 'velocity' | 'raw' | 'normalized'
  const [copiedJson, setCopiedJson] = useState(false);

  // Export dropdown state
  const [showExportMenu, setShowExportMenu] = useState(false);

  // Compute available accounts for filter dropdown
  const availableAccounts = useMemo(() => {
    const list = [];
    if (!platformStatus) return list;
    
    ['facebook', 'instagram', 'threads'].forEach(p => {
      if (activePlatform === 'all' || activePlatform === p) {
        const platInfo = platformStatus[p];
        if (platInfo?.accounts && platInfo.accounts.length > 0) {
          platInfo.accounts.forEach(acc => {
            list.push({
              id: acc.id || acc.name,
              name: acc.name,
              platform: p,
            });
          });
        }
      }
    });
    return list;
  }, [platformStatus, activePlatform]);

  // Fetch initial data
  const fetchData = async () => {
    setLoading(true);
    try {
      const [postsRes, summaryRes, statusRes] = await Promise.all([
        api.get('/analytics/posts', {
          params: {
            platform: activePlatform,
            account_id: activeAccount !== 'all' ? activeAccount : undefined,
            sortBy,
            q: searchQuery
          }
        }),
        api.get('/analytics/posts/summary'),
        api.get('/analytics/posts/status')
      ]);

      if (postsRes.data?.success) {
        setPosts(postsRes.data.posts || []);
        setLastSyncedAt(postsRes.data.last_synced_at);
      }
      if (summaryRes.data?.success) {
        setSummary(summaryRes.data);
      }
      if (statusRes.data?.success) {
        setPlatformStatus(statusRes.data.platforms);
      }
    } catch (err) {
      console.error('Gagal mengambil data analitik postingan:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [activePlatform, activeAccount, sortBy]);

  // Handle Search Debounce / Trigger
  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchData();
  };

  // Sync from Meta
  const handleSyncMeta = async () => {
    setSyncing(true);
    setSyncMessage(null);
    try {
      const res = await api.post('/analytics/posts/sync');
      if (res.data?.success) {
        const count = res.data.total_posts_synced || 0;
        setSyncMessage({
          type: 'success',
          text: `Berhasil menyinkronkan ${count} postingan dari Meta API.`
        });
        await fetchData();
      } else {
        setSyncMessage({
          type: 'error',
          text: res.data?.message || 'Sinkronisasi gagal.'
        });
      }
    } catch (err) {
      setSyncMessage({
        type: 'error',
        text: err.response?.data?.error || err.message || 'Gagal menghubungi server Meta.'
      });
    } finally {
      setSyncing(false);
      setTimeout(() => setSyncMessage(null), 6000);
    }
  };

  // Open Post Detail & Snapshot History
  const handleOpenDetail = async (post) => {
    setSelectedPost(post);
    setActiveDetailTab('velocity');
    setHistoryLoading(true);
    try {
      const res = await api.get(`/analytics/posts/${post.id}/history`);
      if (res.data?.success) {
        setPostHistory(res.data.history || []);
      }
    } catch (err) {
      console.error('Gagal mengambil snapshot history:', err);
      setPostHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  // Export handlers
  const handleExportNormalizedJson = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(posts, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `medsos_analytics_normalized_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    setShowExportMenu(false);
  };

  const handleExportRawJson = () => {
    const rawData = posts.map(p => ({
      id: p.id,
      platform: p.identity?.platform,
      post_id: p.identity?.post_id,
      raw: p.raw
    }));
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(rawData, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `medsos_analytics_raw_meta_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    setShowExportMenu(false);
  };

  const handleExportCsv = () => {
    const headers = [
      'Platform',
      'Account Name',
      'Post ID',
      'Published Date',
      'Media Type',
      'Views',
      'Reach',
      'Likes/Reactions',
      'Comments/Replies',
      'Shares/Reposts',
      'Saves',
      'Affiliate Clicks',
      'Permalink',
      'Caption'
    ];

    const rows = posts.map(p => {
      const m = p.metrics || {};
      const aff = p.affiliate || {};
      return [
        `"${p.identity?.platform || ''}"`,
        `"${p.identity?.account_name || ''}"`,
        `"${p.identity?.post_id || ''}"`,
        `"${p.content?.published_at || ''}"`,
        `"${p.content?.media_type || ''}"`,
        m.views != null ? m.views : '',
        m.reach != null ? m.reach : '',
        m.likes || 0,
        (m.comments || 0) + (m.replies || 0),
        (m.shares || 0) + (m.reposts || 0) + (m.quotes || 0),
        m.saves != null ? m.saves : '',
        aff.human_clicks || aff.total_clicks || 0,
        `"${p.identity?.permalink || ''}"`,
        `"${(p.content?.caption || '').replace(/"/g, '""').slice(0, 150)}"`
      ].join(',');
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + encodeURIComponent([headers.join(','), ...rows].join('\n'));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', csvContent);
    downloadAnchor.setAttribute('download', `medsos_analytics_${Date.now()}.csv`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    setShowExportMenu(false);
  };

  // Helper date formatter
  const formatDate = (isoString) => {
    if (!isoString) return '-';
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return isoString;
    }
  };

  const formatRelativeTime = (isoString) => {
    if (!isoString) return 'Belum pernah disinkronkan';
    try {
      const diffMs = Date.now() - new Date(isoString).getTime();
      const diffMin = Math.floor(diffMs / (1000 * 60));
      if (diffMin < 1) return 'Baru saja';
      if (diffMin < 60) return `${diffMin} menit yang lalu`;
      const diffHours = Math.floor(diffMin / 60);
      if (diffHours < 24) return `${diffHours} jam yang lalu`;
      return formatDate(isoString);
    } catch {
      return isoString;
    }
  };

  const getPlatformBadge = (platform) => {
    switch (platform) {
      case 'facebook':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
            Facebook
          </span>
        );
      case 'instagram':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gradient-to-r from-pink-500/15 via-purple-500/15 to-orange-500/15 text-pink-300 border border-pink-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-pink-400 animate-pulse" />
            Instagram
          </span>
        );
      case 'threads':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-800 text-slate-200 border border-slate-700">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            Threads
          </span>
        );
      default:
        return null;
    }
  };

  const globalSummary = summary?.global || {};

  return (
    <div className="space-y-6">
      {/* 1. Connection Status Bar & Platform Health */}
      <div className="rounded-2xl bg-slate-900/60 border border-slate-800 p-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-indigo-400" />
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              Status Koneksi Meta API
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-xs">
            {/* Facebook Status */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-850 border border-slate-800">
              <span className={`w-2 h-2 rounded-full ${platformStatus?.facebook?.connected ? 'bg-emerald-400 shadow-sm shadow-emerald-400/50' : 'bg-rose-500'}`} />
              <span className="text-slate-400 font-medium">Facebook:</span>
              <span className="text-slate-200 font-semibold">
                {platformStatus?.facebook?.connected
                  ? `${platformStatus.facebook.count > 1 ? `(${platformStatus.facebook.count} Akun) ` : ''}${platformStatus.facebook.account_name}`
                  : 'Disconnected'}
              </span>
            </div>

            {/* Instagram Status */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-850 border border-slate-800">
              <span className={`w-2 h-2 rounded-full ${platformStatus?.instagram?.connected ? 'bg-emerald-400 shadow-sm shadow-emerald-400/50' : 'bg-rose-500'}`} />
              <span className="text-slate-400 font-medium">Instagram:</span>
              <span className="text-slate-200 font-semibold">
                {platformStatus?.instagram?.connected
                  ? `${platformStatus.instagram.count > 1 ? `(${platformStatus.instagram.count} Akun) ` : ''}${platformStatus.instagram.account_name}`
                  : 'Disconnected'}
              </span>
            </div>

            {/* Threads Status */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-850 border border-slate-800">
              <span className={`w-2 h-2 rounded-full ${platformStatus?.threads?.connected ? 'bg-emerald-400 shadow-sm shadow-emerald-400/50' : 'bg-rose-500'}`} />
              <span className="text-slate-400 font-medium">Threads:</span>
              <span className="text-slate-200 font-semibold">
                {platformStatus?.threads?.connected
                  ? `${platformStatus.threads.count > 1 ? `(${platformStatus.threads.count} Akun) ` : ''}${platformStatus.threads.account_name}`
                  : 'Disconnected'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Top Header & Action Controls */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Analitik Postingan Multi-Platform
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              Raw Metrics Engine
            </span>
          </div>
          <p className="text-slate-400 text-sm mt-1">
            Data analitik mentah langsung dari Facebook, Instagram, Threads & klik link afiliasi.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
          {/* Sync Button */}
          <button
            onClick={handleSyncMeta}
            disabled={syncing}
            className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/25 transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
            <span>{syncing ? 'Menyinkronkan dari Meta...' : 'Sync from Meta'}</span>
          </button>

          {/* Export Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              className="px-3.5 py-2.5 rounded-xl bg-slate-800/90 hover:bg-slate-800 text-slate-200 border border-slate-700 text-xs sm:text-sm font-semibold flex items-center gap-2 transition-all"
            >
              <Download className="w-4 h-4 text-indigo-400" />
              <span>Export</span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {showExportMenu && (
              <div className="absolute right-0 mt-2 w-56 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl p-1.5 z-30 animate-in fade-in slide-in-from-top-2">
                <button
                  onClick={handleExportNormalizedJson}
                  className="w-full text-left px-3 py-2 rounded-lg text-xs font-medium text-slate-200 hover:bg-slate-800 flex items-center gap-2.5"
                >
                  <FileCode className="w-4 h-4 text-indigo-400" />
                  <div>
                    <p className="font-semibold">Normalized JSON</p>
                    <p className="text-[10px] text-slate-400">Format standar terpadu</p>
                  </div>
                </button>
                <button
                  onClick={handleExportRawJson}
                  className="w-full text-left px-3 py-2 rounded-lg text-xs font-medium text-slate-200 hover:bg-slate-800 flex items-center gap-2.5"
                >
                  <Sparkles className="w-4 h-4 text-purple-400" />
                  <div>
                    <p className="font-semibold">Raw Meta API JSON</p>
                    <p className="text-[10px] text-slate-400">Payload asli tanpa modifikasi</p>
                  </div>
                </button>
                <button
                  onClick={handleExportCsv}
                  className="w-full text-left px-3 py-2 rounded-lg text-xs font-medium text-slate-200 hover:bg-slate-800 flex items-center gap-2.5 border-t border-slate-800/80 mt-1 pt-2"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                  <div>
                    <p className="font-semibold">Export CSV</p>
                    <p className="text-[10px] text-slate-400">Untuk Excel / Spreadsheet</p>
                  </div>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Sync Notification Banner */}
      {syncMessage && (
        <div className={`p-3.5 rounded-xl border flex items-center gap-3 text-xs font-medium ${syncMessage.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' : 'bg-rose-500/10 border-rose-500/30 text-rose-300'}`}>
          {syncMessage.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
          <span>{syncMessage.text}</span>
        </div>
      )}

      {/* 3. Summary KPI Cards (Raw Numbers) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        {/* Card 1: Total Views */}
        <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-500/10 via-slate-900 to-slate-900 border border-indigo-500/20">
          <div className="flex items-center justify-between text-indigo-400 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Total Views</span>
            <Eye className="w-4 h-4" />
          </div>
          <p className="text-xl sm:text-2xl font-extrabold text-white">
            {globalSummary.total_views != null ? globalSummary.total_views.toLocaleString('id-ID') : 0}
          </p>
          <p className="text-[10px] text-slate-400 mt-1">Tayangan IG & Threads</p>
        </div>

        {/* Card 2: Likes / Reactions */}
        <div className="p-4 rounded-2xl bg-gradient-to-br from-rose-500/10 via-slate-900 to-slate-900 border border-rose-500/20">
          <div className="flex items-center justify-between text-rose-400 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Likes / Reaksi</span>
            <Heart className="w-4 h-4" />
          </div>
          <p className="text-xl sm:text-2xl font-extrabold text-white">
            {(globalSummary.total_likes || 0).toLocaleString('id-ID')}
          </p>
          <p className="text-[10px] text-slate-400 mt-1">FB, IG & Threads</p>
        </div>

        {/* Card 3: Comments / Replies */}
        <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-500/10 via-slate-900 to-slate-900 border border-blue-500/20">
          <div className="flex items-center justify-between text-blue-400 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Komentar</span>
            <MessageCircle className="w-4 h-4" />
          </div>
          <p className="text-xl sm:text-2xl font-extrabold text-white">
            {(globalSummary.total_comments || 0).toLocaleString('id-ID')}
          </p>
          <p className="text-[10px] text-slate-400 mt-1">Total interaksi komentar</p>
        </div>

        {/* Card 4: Shares & Reposts */}
        <div className="p-4 rounded-2xl bg-gradient-to-br from-purple-500/10 via-slate-900 to-slate-900 border border-purple-500/20">
          <div className="flex items-center justify-between text-purple-400 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Shares / Repost</span>
            <Share2 className="w-4 h-4" />
          </div>
          <p className="text-xl sm:text-2xl font-extrabold text-white">
            {(globalSummary.total_shares || 0).toLocaleString('id-ID')}
          </p>
          <p className="text-[10px] text-slate-400 mt-1">FB shares & Threads repost</p>
        </div>

        {/* Card 5: Saves */}
        <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-500/10 via-slate-900 to-slate-900 border border-amber-500/20">
          <div className="flex items-center justify-between text-amber-400 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Disimpan</span>
            <Bookmark className="w-4 h-4" />
          </div>
          <p className="text-xl sm:text-2xl font-extrabold text-white">
            {(globalSummary.total_saves || 0).toLocaleString('id-ID')}
          </p>
          <p className="text-[10px] text-slate-400 mt-1">Instagram saves bookmark</p>
        </div>

        {/* Card 6: Affiliate Clicks */}
        <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-500/10 via-slate-900 to-slate-900 border border-emerald-500/20">
          <div className="flex items-center justify-between text-emerald-400 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Klik Afiliasi</span>
            <LinkIcon className="w-4 h-4" />
          </div>
          <p className="text-xl sm:text-2xl font-extrabold text-white">
            {(globalSummary.total_affiliate_clicks || 0).toLocaleString('id-ID')}
          </p>
          <p className="text-[10px] text-slate-400 mt-1">Klik link shortener internal</p>
        </div>
      </div>

      {/* 4. Filter Toolbar & Search */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-slate-900/70 border border-slate-800 p-3 rounded-2xl">
        {/* Platform Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
          {[
            { id: 'all', label: 'Semua Platform' },
            { id: 'facebook', label: 'Facebook' },
            { id: 'instagram', label: 'Instagram' },
            { id: 'threads', label: 'Threads' }
          ].map((tab) => {
            const isActive = activePlatform === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActivePlatform(tab.id)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Search, Account Filter & Sort */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Account Filter */}
          {availableAccounts.length > 1 && (
            <div className="flex items-center gap-1.5">
              <select
                value={activeAccount}
                onChange={(e) => setActiveAccount(e.target.value)}
                className="px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-semibold text-indigo-300 focus:outline-none focus:border-indigo-500 max-w-[180px] truncate"
              >
                <option value="all">Semua Akun ({availableAccounts.length})</option>
                {availableAccounts.map((acc, idx) => (
                  <option key={idx} value={acc.name || acc.id}>
                    {acc.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <form onSubmit={handleSearchSubmit} className="relative flex-1 sm:w-64">
            <input
              type="text"
              placeholder="Cari caption / ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
            />
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
          </form>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-medium text-slate-300 focus:outline-none focus:border-indigo-500"
          >
            <option value="newest">Terbaru</option>
            <option value="views">Views Terbanyak</option>
            <option value="likes">Likes Terbanyak</option>
            <option value="comments">Komentar Terbanyak</option>
            <option value="clicks">Klik Afiliasi Terbanyak</option>
            <option value="oldest">Terlama</option>
          </select>
        </div>
      </div>

      {/* Sync Info Meta */}
      <div className="flex items-center justify-between text-xs text-slate-500 px-1">
        <span>Menampilkan <strong>{posts.length}</strong> postingan</span>
        <span>Terakhir disinkronkan: <strong>{formatRelativeTime(lastSyncedAt)}</strong></span>
      </div>

      {/* 5. Post Grid / Cards */}
      {loading ? (
        <div className="p-16 flex flex-col items-center justify-center gap-3 bg-slate-900/30 rounded-3xl border border-slate-800">
          <div className="w-8 h-8 border-3 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
          <span className="text-xs text-slate-400 font-medium">Memuat data analitik postingan...</span>
        </div>
      ) : posts.length === 0 ? (
        <div className="p-16 text-center bg-slate-900/30 rounded-3xl border border-slate-800">
          <Layers className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-bold text-white">Belum Ada Data Postingan</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto mt-1 mb-4">
            Klik tombol <strong>Sync from Meta</strong> di atas untuk mengambil postingan terbaru dan metrik analitik dari Facebook, Instagram, dan Threads.
          </p>
          <button
            onClick={handleSyncMeta}
            disabled={syncing}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold"
          >
            Mulai Sinkronisasi Sekarang
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {posts.map((post) => {
            const m = post.metrics || {};
            const aff = post.affiliate || {};
            const content = post.content || {};
            const identity = post.identity || {};
            const isVideo = content.media_type === 'VIDEO' || content.media_type === 'REELS';

            return (
              <div
                key={post.id}
                className="rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition-all flex flex-col overflow-hidden group shadow-lg shadow-black/20"
              >
                {/* Card Header: Platform & Date */}
                <div className="p-3.5 pb-2.5 flex items-center justify-between border-b border-slate-800/80 bg-slate-950/40">
                  <div className="flex items-center gap-2">
                    {getPlatformBadge(identity.platform)}
                    <span className="text-xs font-semibold text-slate-300 truncate max-w-[130px]">
                      {identity.account_name || identity.username}
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-500">
                    {formatDate(content.published_at)}
                  </span>
                </div>

                {/* Media Preview & Caption */}
                <div className="p-3.5 flex-1 flex flex-col gap-3">
                  {content.thumbnail_url ? (
                    <div className="relative rounded-xl overflow-hidden bg-slate-950 aspect-video max-h-40 border border-slate-800/60">
                      <img
                        src={content.thumbnail_url}
                        alt="Media Preview"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        onError={(e) => { e.target.style.display = 'none'; }}
                      />
                      <div className="absolute top-2 right-2 px-2 py-0.5 rounded-md bg-black/70 backdrop-blur-md text-[10px] font-semibold text-white flex items-center gap-1 border border-white/10">
                        {isVideo ? <Video className="w-3 h-3 text-indigo-400" /> : <ImageIcon className="w-3 h-3 text-pink-400" />}
                        <span>{content.media_type}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-xl bg-slate-950/50 p-2.5 border border-slate-800/60 flex items-center justify-between text-xs text-slate-400">
                      <span className="text-[11px] font-medium">{content.media_type || 'TEXT_POST'}</span>
                      <Sparkles className="w-3 h-3 text-indigo-400" />
                    </div>
                  )}

                  {/* Caption Text */}
                  <p className="text-xs text-slate-300 line-clamp-3 leading-relaxed">
                    {content.caption || <em className="text-slate-500">Tidak ada teks caption.</em>}
                  </p>

                  {/* Affiliate Link Badge (if attached) */}
                  {aff.short_links && aff.short_links.length > 0 && (
                    <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5 text-emerald-300 truncate max-w-[170px]">
                        <LinkIcon className="w-3 h-3 shrink-0" />
                        <span className="font-mono text-[11px] truncate">/s/{aff.short_links[0].code}</span>
                      </div>
                      <span className="text-[11px] font-bold text-emerald-400">
                        {aff.human_clicks || aff.total_clicks || 0} Klik
                      </span>
                    </div>
                  )}
                </div>

                {/* Raw Metrics Bar */}
                <div className="px-3.5 py-2.5 bg-slate-950/80 border-t border-slate-800/80 grid grid-cols-4 gap-2 text-center text-xs">
                  {/* Views / Reach */}
                  <div className="flex flex-col">
                    <span className="text-[10px] text-slate-500">Views</span>
                    <span className="font-bold text-slate-200">
                      {m.views != null ? m.views.toLocaleString('id-ID') : m.reach != null ? m.reach.toLocaleString('id-ID') : '-'}
                    </span>
                  </div>

                  {/* Likes */}
                  <div className="flex flex-col">
                    <span className="text-[10px] text-slate-500">Likes</span>
                    <span className="font-bold text-rose-400">
                      {(m.likes || 0).toLocaleString('id-ID')}
                    </span>
                  </div>

                  {/* Comments / Replies */}
                  <div className="flex flex-col">
                    <span className="text-[10px] text-slate-500">Komentar</span>
                    <span className="font-bold text-blue-400">
                      {((m.comments || 0) + (m.replies || 0)).toLocaleString('id-ID')}
                    </span>
                  </div>

                  {/* Shares / Reposts */}
                  <div className="flex flex-col">
                    <span className="text-[10px] text-slate-500">Shares</span>
                    <span className="font-bold text-purple-400">
                      {((m.shares || 0) + (m.reposts || 0) + (m.quotes || 0)).toLocaleString('id-ID')}
                    </span>
                  </div>
                </div>

                {/* Card Actions Footer */}
                <div className="p-2.5 bg-slate-900 border-t border-slate-800 flex items-center justify-between gap-2">
                  <button
                    onClick={() => handleOpenDetail(post)}
                    className="flex-1 py-1.5 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all"
                  >
                    <History className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Velocity & Raw Data</span>
                  </button>

                  {identity.permalink && (
                    <a
                      href={identity.permalink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-all"
                      title="Buka postingan asli"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 6. Post Detail & Velocity Snapshot Modal */}
      {selectedPost && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
            {/* Modal Header */}
            <div className="p-4 sm:p-6 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
              <div className="flex items-center gap-3">
                {getPlatformBadge(selectedPost.identity?.platform)}
                <div>
                  <h3 className="text-base font-bold text-white">
                    Detail & History Postingan
                  </h3>
                  <p className="text-xs text-slate-400 font-mono">
                    ID: {selectedPost.id}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setSelectedPost(null)}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Tabs */}
            <div className="px-6 pt-3 flex items-center gap-2 border-b border-slate-800 bg-slate-900">
              <button
                onClick={() => setActiveDetailTab('velocity')}
                className={`px-4 py-2 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 ${
                  activeDetailTab === 'velocity'
                    ? 'border-indigo-500 text-indigo-400'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <TrendingUp className="w-3.5 h-3.5" />
                <span>Velocity & Snapshot History ({postHistory.length})</span>
              </button>

              <button
                onClick={() => setActiveDetailTab('normalized')}
                className={`px-4 py-2 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 ${
                  activeDetailTab === 'normalized'
                    ? 'border-indigo-500 text-indigo-400'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <FileCode className="w-3.5 h-3.5" />
                <span>Normalized Schema</span>
              </button>

              <button
                onClick={() => setActiveDetailTab('raw')}
                className={`px-4 py-2 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 ${
                  activeDetailTab === 'raw'
                    ? 'border-indigo-500 text-indigo-400'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Raw Meta API Payload</span>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 flex-1 overflow-y-auto space-y-4">
              {activeDetailTab === 'velocity' && (
                <div className="space-y-4">
                  <div className="p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-xs text-indigo-300 flex items-start gap-3">
                    <TrendingUp className="w-5 h-5 shrink-0 text-indigo-400 mt-0.5" />
                    <div>
                      <p className="font-bold">Historical Velocity Engine</p>
                      <p className="text-slate-400 mt-0.5">
                        Data ini mencatat pergerakan metrik per bucket 30-menit. AI Agent dapat menghitung akselerasi konten (*views velocity per hour*) untuk merekomendasikan strategi lanjutan.
                      </p>
                    </div>
                  </div>

                  {historyLoading ? (
                    <div className="py-8 text-center text-xs text-slate-400">
                      Memuat riwayat snapshot...
                    </div>
                  ) : postHistory.length === 0 ? (
                    <div className="py-8 text-center text-xs text-slate-500">
                      Belum ada snapshot historis tambahan. Snapshot dibuat otomatis setiap interval sinkronisasi.
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {postHistory.map((snap, idx) => (
                        <div
                          key={snap.id || idx}
                          className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-indigo-400 font-bold">
                                {snap.time_bucket}
                              </span>
                              <span className="text-slate-500">
                                {formatDate(snap.captured_at)}
                              </span>
                            </div>
                            <div className="flex items-center gap-3 mt-1.5 text-slate-300">
                              <span>Views: <strong>{snap.metrics?.views ?? '-'}</strong></span>
                              <span>Likes: <strong>{snap.metrics?.likes ?? 0}</strong></span>
                              <span>Comments: <strong>{snap.metrics?.comments ?? 0}</strong></span>
                              <span>Clicks: <strong>{snap.affiliate_clicks ?? 0}</strong></span>
                            </div>
                          </div>

                          {snap.delta && snap.delta.hours_elapsed > 0 && (
                            <div className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-right">
                              <span className="text-[10px] text-slate-500 block">Velocity</span>
                              <span className="font-bold text-emerald-400">
                                +{snap.delta.views_velocity_per_hour} views/jam
                              </span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeDetailTab === 'normalized' && (
                <div className="relative">
                  <pre className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-xs font-mono text-indigo-300 overflow-x-auto max-h-96">
                    {JSON.stringify(selectedPost, null, 2)}
                  </pre>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(JSON.stringify(selectedPost, null, 2));
                      setCopiedJson(true);
                      setTimeout(() => setCopiedJson(false), 2000);
                    }}
                    className="absolute top-3 right-3 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5"
                  >
                    {copiedJson ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedJson ? 'Disalin' : 'Salin JSON'}</span>
                  </button>
                </div>
              )}

              {activeDetailTab === 'raw' && (
                <div className="relative">
                  <pre className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-xs font-mono text-pink-300 overflow-x-auto max-h-96">
                    {JSON.stringify(selectedPost.raw, null, 2)}
                  </pre>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(JSON.stringify(selectedPost.raw, null, 2));
                      setCopiedJson(true);
                      setTimeout(() => setCopiedJson(false), 2000);
                    }}
                    className="absolute top-3 right-3 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5"
                  >
                    {copiedJson ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedJson ? 'Disalin' : 'Salin Raw JSON'}</span>
                  </button>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-800 bg-slate-950/50 flex justify-end">
              <button
                onClick={() => setSelectedPost(null)}
                className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
