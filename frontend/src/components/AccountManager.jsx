import React, { useState, useEffect } from 'react';
import api from '../api/client';
import {
  Share2,
  Facebook,
  Instagram,
  Plus,
  CheckCircle2,
  AlertTriangle,
  Trash2,
  ShieldCheck,
  RefreshCw,
  X,
  AtSign,
  Send,
  Bot,
  Power,
  Tag,
} from 'lucide-react';

const CANONICAL_NICHES = [
  { id: 'UNIVERSAL', label: 'Universal (Semua Niche)' },
  { id: 'GADGET_AUDIO', label: 'Gadget & Audio' },
  { id: 'FASHION_WOMEN', label: 'Fashion Wanita' },
  { id: 'FASHION_MEN', label: 'Fashion Pria' },
  { id: 'BEAUTY_SKINCARE', label: 'Kecantikan & Skincare' },
  { id: 'HOME_LIVING', label: 'Perlengkapan Rumah & Dapur' },
  { id: 'MOM_BABY', label: 'Ibu & Bayi' },
  { id: 'AUTOMOTIVE', label: 'Otomotif & Aksesoris' }
];

export const CANONICAL_PERSONAS = [
  { id: 'bestie_hype', label: '💕 Bestie Hype', desc: 'Casual, Playful, Gen Z slang & ekspresif' },
  { id: 'aesthetic_minimalist', label: '🌿 Aesthetic Minimalist', desc: 'Kalem, elegan, fokus visual & rapi' },
  { id: 'witty_curhat', label: '😂 Witty Curhat', desc: 'Humor relatable, cerita santai sehari-hari' },
  { id: 'bargain_hunter', label: '🛍️ Smart Bargain Hunter', desc: 'In This Economy, cari promo & value shock' },
  { id: 'pov_reviewer', label: '🔍 POV Reviewer', desc: 'Format POV jujur, demonstrasi praktis' },
  { id: 'soft_lifestyle', label: '✨ Soft Lifestyle', desc: 'Rekomendasi wishlist, outfit & dekor manis' },
  { id: 'relatable_everyday', label: '🤏 Relatable Everyday', desc: 'Sederhana, membumi, obrolan akrab' },
  { id: 'practical_expert', label: '🧠 Practical Life-Hack', desc: 'Solusi cerdas, tips bermanfaat & efisien' },
  { id: 'ai_adaptive', label: '🤖 AI Adaptive', desc: 'Kombinasi cerdas dinamis yang dipelajari AI' },
];

export default function AccountManager() {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [platform, setPlatform] = useState('facebook');
  const [pageName, setPageName] = useState('');
  const [pageId, setPageId] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [igAccountId, setIgAccountId] = useState('');
  const [allowedNiches, setAllowedNiches] = useState(['UNIVERSAL']);
  const [threadsMediaMode, setThreadsMediaMode] = useState('auto');
  const [contentPersonaId, setContentPersonaId] = useState('ai_adaptive');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState(null);
  const [togglingId, setTogglingId] = useState(null);
  const [editingNichesId, setEditingNichesId] = useState(null);
  const [editingThreadsModeId, setEditingThreadsModeId] = useState(null);
  const [editingPersonaId, setEditingPersonaId] = useState(null);

  const [refreshingTokens, setRefreshingTokens] = useState(false);

  const fetchAccounts = async () => {
    setLoading(true);
    try {
      const res = await api.get('/accounts');
      setAccounts(res.data.accounts || []);
    } catch (err) {
      console.error('Gagal mengambil data akun', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRefreshTokens = async () => {
    setRefreshingTokens(true);
    setMessage(null);
    try {
      const res = await api.post('/accounts/refresh-tokens');
      const count = res.data?.results?.filter(r => r.success)?.length || 0;
      setMessage({
        type: 'success',
        text: `Sukses! ${count} akun (FB, IG, Threads) berhasil divalidasi & diperpanjang masa aktif tokennya.`
      });
      fetchAccounts();
    } catch (err) {
      setMessage({
        type: 'error',
        text: 'Gagal memperbarui token: ' + (err.response?.data?.error || err.message)
      });
    } finally {
      setRefreshingTokens(false);
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  const handleAddAccount = async (e) => {
    e.preventDefault();
    if (!pageName || !pageId) return;
    if (platform === 'telegram' && !accessToken) {
      alert('Bot Token wajib diisi untuk platform Telegram.');
      return;
    }
    setSubmitting(true);
    setMessage(null);

    try {
      await api.post('/accounts', {
        platform,
        page_name: pageName,
        page_id: pageId,
        access_token: accessToken || 'demo_manual_token_mock',
        ig_account_id: platform === 'instagram' ? igAccountId : null,
        allowed_niches: allowedNiches.length > 0 ? allowedNiches : ['UNIVERSAL'],
        threads_media_mode: platform === 'threads' ? threadsMediaMode : 'auto',
        content_persona_id: contentPersonaId || 'ai_adaptive',
      });

      setMessage({ type: 'success', text: 'Akun berhasil ditambahkan!' });
      setShowAddModal(false);
      setPageName('');
      setPageId('');
      setAccessToken('');
      setIgAccountId('');
      setAllowedNiches(['UNIVERSAL']);
      setThreadsMediaMode('auto');
      setContentPersonaId('ai_adaptive');
      fetchAccounts();
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Gagal menambahkan akun.' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdatePersona = async (id, newPersona) => {
    try {
      await api.put(`/accounts/${id}`, { content_persona_id: newPersona });
      setAccounts(prev => prev.map(a => a.id === id ? { ...a, content_persona_id: newPersona } : a));
      setEditingPersonaId(null);
    } catch (err) {
      alert('Gagal memperbarui persona akun: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleUpdateThreadsMediaMode = async (id, newMode) => {
    try {
      await api.put(`/accounts/${id}`, { threads_media_mode: newMode });
      setAccounts(prev => prev.map(a => a.id === id ? { ...a, threads_media_mode: newMode } : a));
      setEditingThreadsModeId(null);
    } catch (err) {
      alert('Gagal memperbarui mode media Threads: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleUpdateNiches = async (id, newNiches) => {
    const canonical = (!newNiches || newNiches.length === 0) ? ['UNIVERSAL'] : newNiches;
    try {
      await api.put(`/accounts/${id}`, { allowed_niches: canonical });
      setAccounts(prev => prev.map(a => a.id === id ? { ...a, allowed_niches: canonical } : a));
      setEditingNichesId(null);
    } catch (err) {
      alert('Gagal memperbarui niche akun: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleToggleActive = async (id, currentStatus) => {
    const nextStatus = currentStatus ? 0 : 1;
    setTogglingId(id);
    
    // Optimistic UI state update
    setAccounts(prev => prev.map(a => a.id === id ? { ...a, is_active: nextStatus } : a));

    try {
      await api.put(`/accounts/${id}`, { is_active: nextStatus });
    } catch (err) {
      // Revert if API call fails
      setAccounts(prev => prev.map(a => a.id === id ? { ...a, is_active: currentStatus } : a));
      alert('Gagal memperbarui status aktivasi akun.');
    } finally {
      setTogglingId(null);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Yakin ingin menghapus akun ini?')) return;
    try {
      await api.delete(`/accounts/${id}`);
      setAccounts(accounts.filter((a) => a.id !== id));
    } catch (err) {
      alert('Gagal menghapus akun.');
    }
  };

  const activeAccountsCount = accounts.filter(
    a => a.is_active === 1 || a.is_active === true || a.is_active === '1'
  ).length;

  return (
    <div className="space-y-6 text-left">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Share2 className="w-5 h-5 text-indigo-400" />
            <span>Manajemen Akun Sosial Media</span>
          </h2>
          <p className="text-xs text-slate-400">
            Hubungkan & kelola aktivasi akun untuk postingan otomatis <span className="text-indigo-300 font-semibold">AI Agent Autopilot</span>
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          <button
            onClick={handleRefreshTokens}
            disabled={refreshingTokens}
            className="px-3.5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white text-xs font-semibold flex items-center gap-2 transition-all shadow-sm"
            title="Validasi dan perpanjang token semua akun aktif (FB, IG, Threads)"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-indigo-400 ${refreshingTokens ? 'animate-spin' : ''}`} />
            <span>{refreshingTokens ? 'Memperbarui...' : 'Auto-Refresh Token'}</span>
          </button>

          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2.5 rounded-xl gradient-btn text-xs font-bold flex items-center gap-2 shadow-lg"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah / Hubungkan Akun</span>
          </button>
        </div>
      </div>

      {/* Summary Info Banner */}
      {!loading && accounts.length > 0 && (
        <div className="p-4 rounded-2xl bg-gradient-to-r from-indigo-950/40 via-slate-900/60 to-slate-900/40 border border-indigo-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-md">
          <div className="flex items-center gap-3 text-slate-300">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center shrink-0">
              <Bot className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <div className="font-semibold text-white flex items-center gap-2">
                <span>Status Integrasi Agen AI:</span>
                <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                  activeAccountsCount > 0 
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                    : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                }`}>
                  {activeAccountsCount > 0 ? `${activeAccountsCount} Akun Aktif` : 'Tidak Ada Akun Aktif'}
                </span>
              </div>
              <p className="text-slate-400 mt-0.5">
                Hanya akun dengan tombol <span className="text-emerald-400 font-semibold">Togel Aktif (ON)</span> yang akan digunakan Agen untuk membuat jadwal postingan affiliate Shopee otomatis.
              </p>
            </div>
          </div>
        </div>
      )}

      {message && (
        <div
          className={`p-4 rounded-2xl border text-sm font-medium flex items-center gap-3 ${
            message.type === 'success'
              ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
              : 'bg-red-500/10 text-red-300 border-red-500/30'
          }`}
        >
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span>{message.text}</span>
        </div>
      )}

      {/* Account Grid */}
      {loading ? (
        <div className="p-12 text-center text-slate-500 text-sm">Memuat daftar akun sosmed...</div>
      ) : accounts.length === 0 ? (
        <div className="p-12 text-center bg-slate-900/40 border border-slate-800 rounded-3xl space-y-3">
          <Share2 className="w-10 h-10 mx-auto text-slate-600" />
          <p className="text-sm font-semibold text-slate-400">Belum ada akun sosial media yang terhubung.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {accounts.map((acc) => {
            const isFb = acc.platform === 'facebook';
            const isIg = acc.platform === 'instagram';
            const isThreads = acc.platform === 'threads';
            const isTg = acc.platform === 'telegram';
            const isActive = Boolean(acc.is_active === 1 || acc.is_active === true || acc.is_active === '1');
            const isCurrentlyToggling = togglingId === acc.id;
            
            let bgClass = 'bg-slate-800 shadow-lg';
            let IconComponent = Share2;
            if (isFb) {
              bgClass = 'bg-fb-blue shadow-lg shadow-blue-500/20';
              IconComponent = Facebook;
            } else if (isIg) {
              bgClass = 'bg-gradient-to-tr from-ig-orange via-ig-pink to-ig-purple shadow-lg shadow-pink-500/20';
              IconComponent = Instagram;
            } else if (isThreads) {
              bgClass = 'bg-black border border-slate-700 shadow-lg shadow-slate-500/20';
              IconComponent = AtSign;
            } else if (isTg) {
              bgClass = 'bg-sky-500 shadow-lg shadow-sky-500/20';
              IconComponent = Send;
            }
            
            return (
              <div
                key={acc.id}
                className={`bg-slate-900/70 border rounded-3xl p-5 backdrop-blur-md flex flex-col justify-between transition-all duration-300 relative overflow-hidden ${
                  isActive 
                    ? 'border-indigo-500/40 shadow-xl shadow-indigo-500/5 ring-1 ring-indigo-500/20' 
                    : 'border-slate-800/80 opacity-75 hover:opacity-100'
                }`}
              >
                {/* Active glow gradient bar at top */}
                {isActive && (
                  <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 via-indigo-500 to-sky-500" />
                )}

                <div>
                  {/* Top Row: Icon + Activation Toggle Switch */}
                  <div className="flex items-center justify-between mb-4">
                    <div
                      className={`w-11 h-11 rounded-2xl flex items-center justify-center text-white font-bold ${bgClass}`}
                    >
                      <IconComponent className="w-5 h-5" />
                    </div>

                    {/* Modern Interactive Toggle Switch */}
                    <div className="flex items-center gap-2.5 bg-slate-950/80 border border-slate-800/90 rounded-2xl px-3 py-1.5 shadow-inner">
                      <div className="flex flex-col items-end">
                        <span className={`text-[10px] font-extrabold tracking-wider uppercase flex items-center gap-1 ${
                          isActive ? 'text-emerald-400' : 'text-slate-500'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`} />
                          {isActive ? 'Aktif' : 'Nonaktif'}
                        </span>
                        <span className="text-[9px] text-slate-500 font-medium">Agen AI</span>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleToggleActive(acc.id, isActive)}
                        disabled={isCurrentlyToggling}
                        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-slate-900 ${
                          isActive ? 'bg-emerald-500 shadow-lg shadow-emerald-500/30' : 'bg-slate-700'
                        } ${isCurrentlyToggling ? 'opacity-50' : ''}`}
                        title={isActive ? 'Klik untuk menonaktifkan akun ini dari postingan Agen AI' : 'Klik untuk mengaktifkan akun ini untuk postingan Agen AI'}
                      >
                        <span className="sr-only">Toggle Aktivasi Agen AI</span>
                        <span
                          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                            isActive ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>
                  </div>

                  <h3 className="font-bold text-base text-white tracking-tight">{acc.page_name}</h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-slate-400">Platform:</span>
                    <span className="text-[11px] uppercase font-bold px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700/50">
                      {acc.platform}
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-500 font-mono mt-2 break-all">
                    {isTg ? 'Chat ID: ' : 'ID Akun: '}{acc.page_id}
                  </p>

                  {acc.ig_account_id && (
                    <p className="text-[11px] text-ig-pink font-mono mt-1 break-all">
                      IG Business ID: {acc.ig_account_id}
                    </p>
                  )}

                  {/* Persona Identity Badges & Quick Selector */}
                  <div className="mt-3 pt-3 border-t border-slate-800/80">
                    <div className="flex items-center justify-between gap-1 mb-1.5">
                      <span className="text-[11px] font-semibold text-slate-300 flex items-center gap-1">
                        <Bot className="w-3 h-3 text-pink-400" /> Persona Identitas:
                      </span>
                      <button
                        type="button"
                        onClick={() => setEditingPersonaId(editingPersonaId === acc.id ? null : acc.id)}
                        className="text-[10px] text-pink-400 hover:text-pink-300 font-bold transition-colors"
                      >
                        {editingPersonaId === acc.id ? 'Tutup' : 'Ubah Persona'}
                      </button>
                    </div>

                    {editingPersonaId === acc.id ? (
                      <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2 animate-in fade-in">
                        <div className="text-[10px] text-slate-400">Pilih karakter persona editorial untuk akun ini:</div>
                        <div className="grid grid-cols-1 gap-1">
                          {CANONICAL_PERSONAS.map(p => {
                            const isSelected = (acc.content_persona_id || 'ai_adaptive') === p.id;
                            return (
                              <button
                                key={p.id}
                                type="button"
                                onClick={() => handleUpdatePersona(acc.id, p.id)}
                                className={`p-1.5 rounded-lg text-left border transition-all ${
                                  isSelected
                                    ? 'bg-pink-500/20 text-white border-pink-500/50 shadow-sm'
                                    : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                                }`}
                              >
                                <div className="text-[11px] font-bold text-slate-200">{p.label}</div>
                                <div className="text-[9px] text-slate-400">{p.desc}</div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <div>
                        {(() => {
                          const pObj = CANONICAL_PERSONAS.find(x => x.id === (acc.content_persona_id || 'ai_adaptive')) || CANONICAL_PERSONAS[CANONICAL_PERSONAS.length - 1];
                          return (
                            <div className="flex flex-col gap-0.5">
                              <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-bold bg-pink-500/10 text-pink-300 border border-pink-500/30 self-start">
                                {pObj.label}
                              </span>
                              <span className="text-[9px] text-slate-400">{pObj.desc}</span>
                            </div>
                          );
                        })()}
                      </div>
                    )}
                  </div>

                  {/* Niche Alignment Badges & Quick Selector */}
                  <div className="mt-3 pt-3 border-t border-slate-800/80">
                    <div className="flex items-center justify-between gap-1 mb-1.5">
                      <span className="text-[11px] font-semibold text-slate-300 flex items-center gap-1">
                        <Tag className="w-3 h-3 text-indigo-400" /> Niche Akun:
                      </span>
                      <button
                        type="button"
                        onClick={() => setEditingNichesId(editingNichesId === acc.id ? null : acc.id)}
                        className="text-[10px] text-indigo-400 hover:text-indigo-300 font-bold transition-colors"
                      >
                        {editingNichesId === acc.id ? 'Tutup' : 'Ubah Niche'}
                      </button>
                    </div>

                    {editingNichesId === acc.id ? (
                      <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2 animate-in fade-in">
                        <div className="text-[10px] text-slate-400">Pilih niche yang diizinkan untuk akun ini:</div>
                        <div className="flex flex-wrap gap-1">
                          {CANONICAL_NICHES.map(n => {
                            const isSelected = (acc.allowed_niches || ['UNIVERSAL']).includes(n.id);
                            return (
                              <button
                                key={n.id}
                                type="button"
                                onClick={() => {
                                  let updated = [...(acc.allowed_niches || ['UNIVERSAL'])];
                                  if (n.id === 'UNIVERSAL') {
                                    updated = ['UNIVERSAL'];
                                  } else {
                                    updated = updated.filter(x => x !== 'UNIVERSAL');
                                    if (isSelected) {
                                      updated = updated.filter(x => x !== n.id);
                                    } else {
                                      updated.push(n.id);
                                    }
                                    if (updated.length === 0) updated = ['UNIVERSAL'];
                                  }
                                  handleUpdateNiches(acc.id, updated);
                                }}
                                className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition-all ${
                                  isSelected
                                    ? 'bg-indigo-600 text-white border-indigo-500 shadow-sm'
                                    : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                                }`}
                              >
                                {n.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {(acc.allowed_niches || ['UNIVERSAL']).map(nId => {
                          const nObj = CANONICAL_NICHES.find(x => x.id === nId);
                          const isUniv = nId === 'UNIVERSAL';
                          return (
                            <span
                              key={nId}
                              className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                                isUniv
                                  ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                                  : 'bg-indigo-500/10 text-indigo-300 border-indigo-500/30'
                              }`}
                            >
                              {nObj?.label || nId}
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Khusus Threads: Pilihan Mode Media Posting */}
                  {acc.platform === 'threads' && (
                    <div className="mt-3 pt-3 border-t border-slate-800/80">
                      <div className="flex items-center justify-between gap-1 mb-1.5">
                        <span className="text-[11px] font-semibold text-slate-300 flex items-center gap-1">
                          <AtSign className="w-3 h-3 text-sky-400" /> Mode Posting Threads:
                        </span>
                        <button
                          type="button"
                          onClick={() => setEditingThreadsModeId(editingThreadsModeId === acc.id ? null : acc.id)}
                          className="text-[10px] text-sky-400 hover:text-sky-300 font-bold transition-colors"
                        >
                          {editingThreadsModeId === acc.id ? 'Tutup' : 'Ubah Mode'}
                        </button>
                      </div>

                      {editingThreadsModeId === acc.id ? (
                        <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2 animate-in fade-in">
                          <div className="text-[10px] text-slate-400">Pilih strategi postingan Threads:</div>
                          <div className="grid grid-cols-1 gap-1.5">
                            {[
                              { id: 'auto', label: '🤖 Auto (Mix Visual & Link Card)', desc: 'Prioritaskan media jika ada, fallback ke Link Card' },
                              { id: 'no_media', label: '🔗 Link Card Preview (Tanpa Media)', desc: 'Teks murni + Link Card Otomatis (Rekomendasi)' },
                              { id: 'with_media', label: '🖼️ Visual Media Saja', desc: 'Wajib Foto / Video' }
                            ].map(m => {
                              const isSelected = (acc.threads_media_mode || 'auto') === m.id;
                              return (
                                <button
                                  key={m.id}
                                  type="button"
                                  onClick={() => handleUpdateThreadsMediaMode(acc.id, m.id)}
                                  className={`p-2 rounded-lg text-left border transition-all ${
                                    isSelected
                                      ? 'bg-sky-500/20 text-white border-sky-500/50 shadow-sm'
                                      : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                                  }`}
                                >
                                  <div className="text-[11px] font-bold">{m.label}</div>
                                  <div className="text-[9px] text-slate-400">{m.desc}</div>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ) : (
                        <div>
                          <span className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                            (acc.threads_media_mode || 'auto') === 'no_media'
                              ? 'bg-sky-500/15 text-sky-300 border-sky-500/35'
                              : (acc.threads_media_mode || 'auto') === 'with_media'
                              ? 'bg-purple-500/15 text-purple-300 border-purple-500/35'
                              : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/35'
                          }`}>
                            {(acc.threads_media_mode || 'auto') === 'no_media'
                              ? '🔗 Link Card Preview (Tanpa Media)'
                              : (acc.threads_media_mode || 'auto') === 'with_media'
                              ? '🖼️ Visual Media Saja'
                              : '🤖 Auto (Mix Visual & Link Card)'}
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Agent Status Badge Banner */}
                  <div className={`mt-3 p-2.5 rounded-xl border text-[11px] flex items-center gap-2 transition-all ${
                    isActive
                      ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-300'
                      : 'bg-slate-800/40 border-slate-800 text-slate-500'
                  }`}>
                    {isActive ? (
                      <>
                        <Bot className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span className="font-medium">Digunakan Agen AI untuk posting konten affiliate</span>
                      </>
                    ) : (
                      <>
                        <Power className="w-4 h-4 text-slate-500 shrink-0" />
                        <span className="font-medium">Diabaikan Agen AI (Tidak akan diposting otomatis)</span>
                      </>
                    )}
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between">
                  <span className="text-[10px] text-slate-500 flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3 text-emerald-400" /> Token Terhubung
                  </span>

                  <button
                    onClick={() => handleDelete(acc.id)}
                    className="p-1.5 text-slate-500 hover:text-rose-400 rounded-lg hover:bg-slate-800/80 transition-colors"
                    title="Hapus Akun"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Account Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto custom-scrollbar">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800">
              <h3 className="font-bold text-base text-white">Hubungkan Akun Sosmed</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddAccount} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Platform</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPlatform('facebook')}
                    className={`py-2.5 rounded-xl text-xs font-bold border flex items-center justify-center gap-2 transition-all ${
                      platform === 'facebook'
                        ? 'bg-fb-blue text-white border-blue-500 shadow-lg shadow-blue-500/20'
                        : 'bg-slate-950 text-slate-400 border-slate-800'
                    }`}
                  >
                    <Facebook className="w-4 h-4" /> Facebook
                  </button>
                  <button
                    type="button"
                    onClick={() => setPlatform('instagram')}
                    className={`py-2.5 rounded-xl text-xs font-bold border flex items-center justify-center gap-2 transition-all ${
                      platform === 'instagram'
                        ? 'bg-gradient-to-tr from-ig-orange via-ig-pink to-ig-purple text-white border-pink-500 shadow-lg shadow-pink-500/20'
                        : 'bg-slate-950 text-slate-400 border-slate-800'
                    }`}
                  >
                    <Instagram className="w-4 h-4" /> Instagram
                  </button>
                  <button
                    type="button"
                    onClick={() => setPlatform('threads')}
                    className={`py-2.5 rounded-xl text-xs font-bold border flex items-center justify-center gap-2 transition-all ${
                      platform === 'threads'
                        ? 'bg-black text-white border-slate-700 shadow-lg shadow-slate-500/10'
                        : 'bg-slate-950 text-slate-400 border-slate-800'
                    }`}
                  >
                    <AtSign className="w-4 h-4" /> Threads
                  </button>
                  <button
                    type="button"
                    onClick={() => setPlatform('telegram')}
                    className={`py-2.5 rounded-xl text-xs font-bold border flex items-center justify-center gap-2 transition-all ${
                      platform === 'telegram'
                        ? 'bg-sky-500 text-white border-sky-400 shadow-lg shadow-sky-500/20'
                        : 'bg-slate-950 text-slate-400 border-slate-800'
                    }`}
                  >
                    <Send className="w-4 h-4" /> Telegram Bot
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  {platform === 'telegram' ? 'Nama Bot Telegram *' : 'Nama Halaman / Akun *'}
                </label>
                <input
                  type="text"
                  required
                  value={pageName}
                  onChange={(e) => setPageName(e.target.value)}
                  placeholder={platform === 'telegram' ? 'Contoh: @MedsosReportBot' : 'Contoh: Toko Online Resmi'}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  {platform === 'threads' 
                    ? 'Threads User ID *' 
                    : platform === 'telegram' 
                    ? 'Telegram Chat ID / Channel ID *' 
                    : 'FB Page / IG Business ID *'}
                </label>
                <input
                  type="text"
                  required
                  value={pageId}
                  onChange={(e) => setPageId(e.target.value)}
                  placeholder={
                    platform === 'threads' 
                      ? 'Contoh: 123456789' 
                      : platform === 'telegram' 
                      ? 'Contoh: -10023456789' 
                      : 'Contoh: 10982347120938'
                  }
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              {platform === 'instagram' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Instagram Business Account ID *</label>
                  <input
                    type="text"
                    required
                    value={igAccountId}
                    onChange={(e) => setIgAccountId(e.target.value)}
                    placeholder="Contoh: 178414000000000"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              )}

              {platform === 'threads' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Mode Media Threads (AI Autopilot)
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'auto', label: '🤖 Auto Mix', desc: 'Mix Visual & Link Card' },
                      { id: 'no_media', label: '🔗 Link Card', desc: 'Tanpa Media' },
                      { id: 'with_media', label: '🖼️ Visual', desc: 'Foto / Video' }
                    ].map(m => {
                      const isSel = threadsMediaMode === m.id;
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => setThreadsMediaMode(m.id)}
                          className={`p-2 rounded-xl text-left border transition-all ${
                            isSel
                              ? 'bg-sky-500/20 text-white border-sky-500/60 shadow-sm'
                              : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
                          }`}
                        >
                          <div className="text-[11px] font-bold">{m.label}</div>
                          <div className="text-[9px] text-slate-400">{m.desc}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Persona Selection */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Persona Identitas Akun (Karakter Tulisan AI)
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 p-3 bg-slate-950 border border-slate-800 rounded-xl max-h-48 overflow-y-auto">
                  {CANONICAL_PERSONAS.map(p => {
                    const isSel = contentPersonaId === p.id;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setContentPersonaId(p.id)}
                        className={`p-2 rounded-xl text-left border transition-all ${
                          isSel
                            ? 'bg-pink-500/20 text-white border-pink-500/60 shadow-sm'
                            : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                        }`}
                      >
                        <div className="text-[11px] font-bold text-slate-200">{p.label}</div>
                        <div className="text-[9px] text-slate-400">{p.desc}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Niche Selection */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Niche yang Diizinkan untuk Akun Ini
                </label>
                <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
                  <div className="flex flex-wrap gap-1.5">
                    {CANONICAL_NICHES.map(n => {
                      const isSelected = allowedNiches.includes(n.id);
                      return (
                        <button
                          key={n.id}
                          type="button"
                          onClick={() => {
                            if (n.id === 'UNIVERSAL') {
                              setAllowedNiches(['UNIVERSAL']);
                            } else {
                              let next = allowedNiches.filter(x => x !== 'UNIVERSAL');
                              if (isSelected) {
                                next = next.filter(x => x !== n.id);
                              } else {
                                next.push(n.id);
                              }
                              if (next.length === 0) next = ['UNIVERSAL'];
                              setAllowedNiches(next);
                            }
                          }}
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-all ${
                            isSelected
                              ? 'bg-indigo-600 text-white border-indigo-500 shadow-sm'
                              : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                          }`}
                        >
                          {n.label}
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-[10px] text-slate-500 leading-tight">
                    Pilih <b>Universal</b> jika akun ini boleh memposting produk dari semua kategori/niche.
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  {platform === 'telegram' ? 'Bot Access Token *' : 'Page Access Token'}
                </label>
                <textarea
                  rows={2}
                  required={platform === 'telegram'}
                  value={accessToken}
                  onChange={(e) => setAccessToken(e.target.value)}
                  placeholder={platform === 'telegram' ? 'Contoh: 123456:ABC-DEF...' : 'EAAxxx... (opsional untuk mode Dry-Run)'}
                  className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-2.5 rounded-xl gradient-btn font-bold text-xs shadow-lg mt-2"
              >
                {submitting ? 'Menyimpan...' : 'Simpan Akun Sosmed'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
