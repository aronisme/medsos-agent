import React, { useState, useEffect } from 'react';
import api from '../api/client';
import {
  MessageSquare,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  Sparkles,
  ShieldCheck,
  Send,
  RefreshCw,
  Plus,
  Trash2,
  AtSign,
  AlertTriangle,
  Flame,
  Bot,
  Sliders,
  ExternalLink,
} from 'lucide-react';

export default function ThreadsAutoMarketing() {
  const [activeSubTab, setActiveSubTab] = useState('candidates'); // 'candidates' | 'inbound' | 'keywords'
  const [mode, setMode] = useState('SAFE'); // 'SAFE' | 'SEMI_AUTO'
  const [statusFilter, setStatusFilter] = useState('PENDING');

  const [candidates, setCandidates] = useState([]);
  const [inboundLogs, setInboundLogs] = useState([]);
  const [keywords, setKeywords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [message, setMessage] = useState(null);

  // New Keyword Form
  const [newKeyword, setNewKeyword] = useState('');
  const [newCategory, setNewCategory] = useState('fashion');
  const [newPriority, setNewPriority] = useState(1);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [candRes, logsRes, kwRes] = await Promise.allSettled([
        api.get(`/threads-marketing/candidates?status=${statusFilter}`),
        api.get('/threads-marketing/inbound-logs'),
        api.get('/threads-marketing/keywords'),
      ]);

      if (candRes.status === 'fulfilled') setCandidates(candRes.value.data.candidates || []);
      if (logsRes.status === 'fulfilled') setInboundLogs(logsRes.value.data.logs || []);
      if (kwRes.status === 'fulfilled') setKeywords(kwRes.value.data.keywords || []);
    } catch (err) {
      console.error('Error fetching threads marketing data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [statusFilter]);

  const handleApprove = async (candidateId, publishMode = 'REPLY') => {
    setActionLoading(candidateId);
    setMessage(null);
    try {
      const res = await api.post(`/threads-marketing/candidates/${candidateId}/approve`, { publishMode });
      setMessage({ type: 'success', text: res.data.message || 'Balasan/Quote Post berhasil dipublikasikan ke Threads!' });
      fetchData();
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.error || err.message });
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (candidateId) => {
    setActionLoading(candidateId);
    setMessage(null);
    try {
      await api.post(`/threads-marketing/candidates/${candidateId}/reject`, { reason: 'Ditolak pengguna' });
      setMessage({ type: 'info', text: 'Kandidat telah ditolak.' });
      fetchData();
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.error || err.message });
    } finally {
      setActionLoading(null);
    }
  };

  const handleAddKeyword = async (e) => {
    e.preventDefault();
    if (!newKeyword.trim()) return;
    try {
      await api.post('/threads-marketing/keywords', {
        keyword: newKeyword,
        category: newCategory,
        priority: newPriority,
      });
      setNewKeyword('');
      setMessage({ type: 'success', text: 'Kata kunci berhasil ditambahkan ke daftar pemantauan!' });
      fetchData();
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.error || err.message });
    }
  };

  const handleDeleteKeyword = async (id) => {
    if (!window.confirm('Hapus kata kunci ini?')) return;
    try {
      await api.delete(`/threads-marketing/keywords/${id}`);
      fetchData();
    } catch (err) {
      alert('Gagal menghapus kata kunci.');
    }
  };

  const handleAutoGenerateKeywords = async () => {
    setActionLoading('auto_keywords');
    setMessage(null);
    try {
      const res = await api.post('/threads-marketing/keywords/auto-generate');
      setMessage({ type: 'success', text: res.data.message || 'Kata kunci berhasil di-generate dari katalog produk!' });
      fetchData();
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.error || err.message });
    } finally {
      setActionLoading(null);
    }
  };

  const handleClearAllKeywords = async () => {
    if (!window.confirm('Yakin ingin menghapus seluruh kata kunci pantauan?')) return;
    setActionLoading('clear_all_keywords');
    setMessage(null);
    try {
      const res = await api.delete('/threads-marketing/keywords/clear-all');
      setMessage({ type: 'info', text: res.data.message || 'Seluruh kata kunci berhasil dihapus.' });
      fetchData();
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.error || err.message });
    } finally {
      setActionLoading(null);
    }
  };

  const handleTriggerScan = async () => {
    setScanning(true);
    setMessage(null);
    try {
      const res = await api.post('/threads-marketing/trigger-scan', { type: 'all' });
      setMessage({
        type: 'success',
        text: `Pemindaian selesai! Scanned Inbound: ${res.data.inbound?.totalScanned || 0} komentar, Outbound Candidates baru: ${res.data.outbound?.candidatesCreated || 0}`,
      });
      fetchData();
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.error || err.message });
    } finally {
      setScanning(false);
    }
  };

  const pendingCount = candidates.filter(c => c.status === 'PENDING').length;

  return (
    <div className="space-y-6 text-left">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <AtSign className="w-5 h-5 text-indigo-400" />
            <span>Threads Auto-Marketing & Social Listening</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Otomasi Inbound Auto-Reply Komentar & Outbound Contextual Discovery berbasis kepatuhan ketat.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleTriggerScan}
            disabled={scanning}
            className="px-3.5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white text-xs font-semibold flex items-center gap-2 transition-all shadow-sm"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-indigo-400 ${scanning ? 'animate-spin' : ''}`} />
            <span>{scanning ? 'Memindai...' : 'Jalankan Scan Sekarang'}</span>
          </button>
        </div>
      </div>

      {/* Alert Banner */}
      {message && (
        <div
          className={`p-4 rounded-2xl border text-xs font-medium flex items-center gap-3 ${
            message.type === 'success'
              ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
              : message.type === 'error'
              ? 'bg-red-500/10 text-red-300 border-red-500/30'
              : 'bg-indigo-500/10 text-indigo-300 border-indigo-500/30'
          }`}
        >
          {message.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 shrink-0" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      {/* Sub-Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
        <button
          onClick={() => setActiveSubTab('candidates')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            activeSubTab === 'candidates'
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
              : 'bg-slate-900/60 text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Antrean Kandidat Outbound</span>
          {pendingCount > 0 && (
            <span className="px-1.5 py-0.2 bg-amber-500 text-slate-950 font-extrabold text-[10px] rounded-full">
              {pendingCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveSubTab('inbound')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            activeSubTab === 'inbound'
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
              : 'bg-slate-900/60 text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          <MessageSquare className="w-3.5 h-3.5" />
          <span>Riwayat Inbound Auto-Reply</span>
        </button>

        <button
          onClick={() => setActiveSubTab('keywords')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            activeSubTab === 'keywords'
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
              : 'bg-slate-900/60 text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          <Search className="w-3.5 h-3.5" />
          <span>Kata Kunci Listening</span>
        </button>
      </div>

      {/* SUB-TAB 1: CANDIDATES QUEUE */}
      {activeSubTab === 'candidates' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/40 p-3.5 rounded-2xl border border-slate-800">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-400">Filter Status:</span>
              {['PENDING', 'APPROVED', 'SENT', 'REJECTED', 'EXPIRED', 'ALL'].map((st) => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                    statusFilter === st
                      ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40'
                      : 'bg-slate-950 text-slate-500 hover:text-slate-300'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-[11px] text-slate-400 font-medium">
                Mode Operasi: <b className="text-white font-bold">SAFE (Manual Approval)</b>
              </span>
            </div>
          </div>

          {loading ? (
            <div className="p-12 text-center text-slate-500 text-sm">Memuat antrean kandidat...</div>
          ) : candidates.length === 0 ? (
            <div className="p-12 text-center bg-slate-900/30 border border-slate-800/80 rounded-3xl space-y-2">
              <Search className="w-8 h-8 mx-auto text-slate-600" />
              <p className="text-sm font-semibold text-slate-400">Tidak ada kandidat dengan status {statusFilter}.</p>
              <p className="text-xs text-slate-500">
                Klik tombol "Jalankan Scan Sekarang" di atas untuk mencari postingan publik terbaru.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {candidates.map((cand) => (
                <div
                  key={cand.id}
                  className="bg-slate-900/60 border border-slate-800 rounded-3xl p-5 backdrop-blur-md flex flex-col justify-between space-y-4"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-7 h-7 rounded-full bg-slate-800 flex items-center justify-center font-bold text-xs text-indigo-400">
                          @
                        </span>
                        <div>
                          <p className="text-xs font-bold text-white">@{cand.author_username || 'anonymous'}</p>
                          <p className="text-[10px] text-slate-500 font-mono">ID: {cand.thread_id}</p>
                        </div>
                      </div>

                      <span
                        className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase ${
                          cand.status === 'PENDING'
                            ? 'bg-amber-500/10 text-amber-300 border border-amber-500/30'
                            : cand.status === 'SENT'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {cand.status}
                      </span>
                    </div>

                    <div className="p-3 rounded-2xl bg-slate-950/70 border border-slate-800 text-xs text-slate-300 leading-relaxed italic">
                      "{cand.post_text}"
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                      <div className="p-2 rounded-xl bg-slate-900/90 border border-slate-800/80">
                        <span className="text-slate-500 block text-[10px]">Niat Beli (Intent)</span>
                        <span className="font-bold text-amber-400">
                          {Math.round((cand.buying_intent_score || 0) * 100)}%
                        </span>
                      </div>
                      <div className="p-2 rounded-xl bg-slate-900/90 border border-slate-800/80">
                        <span className="text-slate-500 block text-[10px]">Relevansi Produk</span>
                        <span className="font-bold text-emerald-400">
                          {Math.round((cand.relevance_score || 0) * 100)}%
                        </span>
                      </div>
                    </div>

                    <div className="text-xs">
                      <span className="text-slate-500 block text-[10px] uppercase font-bold mb-1">
                        Rekomendasi Produk Terkait:
                      </span>
                      <p className="font-semibold text-indigo-300 truncate">
                        {cand.matched_product_title || cand.matched_product_id}
                      </p>
                    </div>
                  </div>

                  {cand.status === 'PENDING' && (
                    <div className="flex flex-col gap-2 pt-3 border-t border-slate-800">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleApprove(cand.id, 'REPLY')}
                          disabled={actionLoading === cand.id}
                          className="flex-1 py-2 rounded-xl gradient-btn text-xs font-bold flex items-center justify-center gap-1.5 shadow-md"
                          title="Balas langsung di kolom komentar postingan orang tersebut"
                        >
                          <Send className="w-3.5 h-3.5" />
                          <span>{actionLoading === cand.id ? 'Mengirim...' : 'Balas Utas'}</span>
                        </button>

                        <button
                          onClick={() => handleApprove(cand.id, 'QUOTE')}
                          disabled={actionLoading === cand.id}
                          className="flex-1 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-md transition-all"
                          title="Buat postingan baru di profil kita yang mengutip (Quote) postingan orang tersebut"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>{actionLoading === cand.id ? 'Mengirim...' : 'Kutip (Quote)'}</span>
                        </button>

                        <button
                          onClick={() => handleReject(cand.id)}
                          disabled={actionLoading === cand.id}
                          className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-rose-400 text-xs font-semibold"
                          title="Tolak Kandidat"
                        >
                          <XCircle className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SUB-TAB 2: INBOUND LOGS */}
      {activeSubTab === 'inbound' && (
        <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div>
              <h3 className="font-bold text-sm text-white flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-emerald-400" />
                <span>Riwayat Auto-Reply Komentar Masuk (Inbound)</span>
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Daftar interaksi audiens pada postingan kita yang dibalas secara otomatis oleh AI dengan link produk Shopee.
              </p>
            </div>
            <span className="text-[11px] font-semibold text-slate-400 bg-slate-800/60 px-3 py-1 rounded-full border border-slate-700/50 w-fit">
              Total {inboundLogs.length} Interaksi
            </span>
          </div>

          {inboundLogs.length === 0 ? (
            <div className="p-12 text-center text-slate-500 text-xs flex flex-col items-center gap-2">
              <Bot className="w-8 h-8 text-slate-600" />
              <span>Belum ada aktivitas auto-reply yang tercatat. Jalankan pemindaian untuk mendeteksi komentar baru.</span>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-500 text-[11px]">
                    <th className="pb-3 min-w-[220px]">Postingan & Akun</th>
                    <th className="pb-3 min-w-[220px]">Komentar Pengguna</th>
                    <th className="pb-3 min-w-[200px]">Produk Terkait</th>
                    <th className="pb-3 min-w-[250px]">Balasan AI Terkirim</th>
                    <th className="pb-3 min-w-[90px]">Waktu</th>
                    <th className="pb-3 min-w-[80px]">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {inboundLogs.map((log) => {
                    const platform = log.platform?.toLowerCase() || 'threads';
                    const platformBadge = 
                      platform === 'facebook' ? (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">Facebook</span>
                      ) : platform === 'instagram' ? (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-pink-500/10 text-pink-400 border border-pink-500/20">Instagram</span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-500/10 text-purple-400 border border-purple-500/20">Threads</span>
                      );

                    return (
                      <tr key={log.id} className="text-slate-300 hover:bg-slate-800/30 transition-colors">
                        {/* 1. Postingan & Akun */}
                        <td className="py-3.5 pr-3 align-top">
                          <div className="space-y-1.5">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {platformBadge}
                              <span className="font-semibold text-slate-200 text-[11px]">
                                {log.account_name || 'Social Profile'}
                              </span>
                              {log.username && log.username !== log.account_name && (
                                <span className="text-[10px] text-slate-500">(@{log.username})</span>
                              )}
                            </div>

                            {/* Caption cuplikan */}
                            {log.thread_caption ? (
                              <p className="text-[11px] text-slate-400 line-clamp-2 italic bg-slate-950/40 p-2 rounded-xl border border-slate-800/40 leading-relaxed">
                                "{log.thread_caption}"
                              </p>
                            ) : (
                              <span className="text-[10px] font-mono text-slate-500">Post ID: {log.thread_id || log.target_reply_id}</span>
                            )}

                            {/* Link Postingan Asli 100% Akurat */}
                            {log.permalink ? (
                              <a
                                href={log.permalink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-600/15 hover:bg-indigo-600/25 text-indigo-400 hover:text-indigo-300 font-semibold text-[10px] transition-all border border-indigo-500/30 w-fit"
                              >
                                <span>Buka Postingan Asli</span>
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            ) : log.thread_id ? (
                              <span className="text-[10px] font-mono text-slate-600">ID #{log.thread_id}</span>
                            ) : null}
                          </div>
                        </td>

                        {/* 2. Komentar Masuk */}
                        <td className="py-3.5 pr-3 align-top">
                          <div className="space-y-1.5">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-white">@{log.author_username || log.author_id}</span>
                              {log.intent && (
                                <span className="px-1.5 py-0.2 rounded text-[9px] font-semibold bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
                                  {log.intent === 'LINK_REQUEST' ? 'Minta Link' : log.intent === 'PRICE_INQUIRY' ? 'Tanya Harga' : log.intent === 'PRODUCT_QUESTION' ? 'Tanya Produk' : log.intent}
                                </span>
                              )}
                            </div>
                            <div className="bg-slate-950/60 p-2 rounded-xl border border-slate-800/60 text-slate-200 text-[11px] leading-relaxed">
                              {log.incoming_comment_text || log.comment_text || '(Pertanyaan Produk)'}
                            </div>
                          </div>
                        </td>

                        {/* 3. Produk Terkait */}
                        <td className="py-3.5 pr-3 align-top">
                          <div className="space-y-1">
                            <p className="font-bold text-indigo-300 line-clamp-2 leading-tight">
                              {log.product_title || log.product_id}
                            </p>
                            {log.product_id && (
                              <span className="inline-block text-[10px] font-mono text-slate-500">
                                ID: {log.product_id.slice(0, 14)}...
                              </span>
                            )}
                          </div>
                        </td>

                        {/* 4. Balasan AI Terkirim */}
                        <td className="py-3.5 pr-3 align-top">
                          <div className="bg-slate-950/40 p-2.5 rounded-xl border border-indigo-500/20 text-slate-300 text-[11px] space-y-1.5">
                            <div className="flex items-center gap-1 text-[10px] text-indigo-400 font-semibold">
                              <Bot className="w-3 h-3" />
                              <span>AI Auto-Reply</span>
                            </div>
                            <p className="line-clamp-3 text-slate-300 leading-relaxed">
                              {log.final_reply_text || '-'}
                            </p>
                          </div>
                        </td>

                        {/* 5. Waktu */}
                        <td className="py-3.5 pr-3 align-top text-[11px] text-slate-400 whitespace-nowrap">
                          <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3 text-slate-500" />
                            <span>
                              {new Date(log.replied_at || log.created_at).toLocaleTimeString('id-ID', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}{' '}
                              WIB
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-600 mt-0.5">
                            {new Date(log.replied_at || log.created_at).toLocaleDateString('id-ID', {
                              day: 'numeric',
                              month: 'short',
                            })}
                          </div>
                        </td>

                        {/* 6. Status */}
                        <td className="py-3.5 align-top">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            log.status === 'SENT' 
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' 
                              : log.status === 'FAILED'
                              ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                              : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                          }`}>
                            {log.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* SUB-TAB 3: KEYWORDS LISTENING */}
      {activeSubTab === 'keywords' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 bg-slate-900/60 border border-slate-800 rounded-3xl p-5 h-fit">
            <h3 className="font-bold text-sm text-white mb-3 flex items-center gap-2">
              <Plus className="w-4 h-4 text-indigo-400" />
              <span>Tambah Kata Kunci Baru</span>
            </h3>

            <form onSubmit={handleAddKeyword} className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">Kata Kunci Target *</label>
                <input
                  type="text"
                  required
                  value={newKeyword}
                  onChange={(e) => setNewKeyword(e.target.value)}
                  placeholder="Contoh: rekomendasi baju murah"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">Kategori Produk</label>
                <input
                  type="text"
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  placeholder="Contoh: fashion / elektronik"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">Prioritas Pencarian</label>
                <select
                  value={newPriority}
                  onChange={(e) => setNewPriority(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value={1}>Tinggi (Setiap Siklus)</option>
                  <option value={2}>Sedang (Setiap 2 Siklus)</option>
                  <option value={3}>Rendah (Berkala)</option>
                </select>
              </div>

              <button type="submit" className="w-full py-2.5 rounded-xl gradient-btn font-bold text-xs shadow-lg mt-2">
                Simpan Kata Kunci
              </button>
            </form>
          </div>

          <div className="lg:col-span-2 bg-slate-900/60 border border-slate-800 rounded-3xl p-5">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <h3 className="font-bold text-sm text-white flex items-center gap-2">
                <Search className="w-4 h-4 text-indigo-400" />
                <span>Daftar Kata Kunci Aktif ({keywords.length})</span>
              </h3>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleAutoGenerateKeywords}
                  disabled={actionLoading === 'auto_keywords'}
                  className="px-3 py-1.5 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30 text-indigo-300 text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm"
                >
                  <Sparkles className={`w-3.5 h-3.5 ${actionLoading === 'auto_keywords' ? 'animate-spin' : ''}`} />
                  <span>{actionLoading === 'auto_keywords' ? 'Mengenerate...' : '✨ Generate Top 15'}</span>
                </button>

                {keywords.length > 0 && (
                  <button
                    onClick={handleClearAllKeywords}
                    disabled={actionLoading === 'clear_all_keywords'}
                    className="px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300 text-xs font-bold transition-all shadow-sm"
                  >
                    <span>Hapus Semua</span>
                  </button>
                )}
              </div>
            </div>

            <div className="p-3 mb-3.5 rounded-2xl bg-indigo-950/30 border border-indigo-500/20 text-[11px] text-indigo-300 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 shrink-0 text-indigo-400" />
              <span>
                <b>Proteksi Kuota API:</b> Sistem memindai <b>3 kata kunci per siklus</b> secara bergiliran agar kuota mingguan Anda tetap aman & hemat.
              </span>
            </div>

            {keywords.length === 0 ? (
              <div className="p-8 text-center bg-slate-950/40 border border-slate-800/80 rounded-2xl space-y-3">
                <p className="text-xs text-slate-400 font-medium">Belum ada kata kunci pantauan yang aktif.</p>
                <button
                  onClick={handleAutoGenerateKeywords}
                  disabled={actionLoading === 'auto_keywords'}
                  className="px-4 py-2 rounded-xl gradient-btn text-xs font-bold inline-flex items-center gap-2 shadow-lg"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Generate Kata Kunci Otomatis dari Produk Shopee</span>
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {keywords.map((kw) => (
                  <div
                    key={kw.id}
                    className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800/80 flex items-center justify-between"
                  >
                    <div>
                      <h4 className="font-bold text-xs text-white flex items-center gap-2">
                        <span>"{kw.keyword}"</span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-400 uppercase">
                          {kw.category || 'General'}
                        </span>
                      </h4>
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        Terakhir dicari:{' '}
                        {kw.last_searched_at
                          ? new Date(kw.last_searched_at).toLocaleString('id-ID')
                          : 'Belum pernah'}
                      </p>
                    </div>

                    <button
                      onClick={() => handleDeleteKeyword(kw.id)}
                      className="p-1.5 text-slate-500 hover:text-rose-400 rounded-lg hover:bg-slate-800 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
