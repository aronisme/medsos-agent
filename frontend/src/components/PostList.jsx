import React, { useState, useEffect } from 'react';
import api from '../api/client';
import {
  Calendar,
  Clock,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Trash2,
  Send,
  Eye,
  RefreshCw,
  X,
  Facebook,
  Instagram,
  Layers,
  AtSign,
  ChevronRight,
  CheckSquare,
  Square,
  MinusSquare,
  ShieldAlert,
  Check,
} from 'lucide-react';

export default function PostList() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [platformFilter, setPlatformFilter] = useState('all');
  const [accountFilter, setAccountFilter] = useState('all');
  const [accounts, setAccounts] = useState([]);
  const [selectedPost, setSelectedPost] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Multi-select & Bulk Delete State
  const [selectedIds, setSelectedIds] = useState([]);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [isDeleteAllMode, setIsDeleteAllMode] = useState(false);

  const fetchAccounts = async () => {
    try {
      const res = await api.get('/accounts');
      setAccounts(res.data.accounts || []);
    } catch (err) {
      console.error('Gagal mengambil daftar akun', err);
    }
  };

  const fetchPosts = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (platformFilter !== 'all') params.append('platform', platformFilter);
      if (accountFilter !== 'all') params.append('account_id', accountFilter);

      const res = await api.get(`/posts?${params.toString()}`);
      setPosts(res.data.posts || []);
      setSelectedIds([]);
    } catch (err) {
      console.error('Gagal mengambil daftar postingan', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  useEffect(() => {
    fetchPosts();
  }, [statusFilter, platformFilter, accountFilter]);

  const filteredAccounts = accounts.filter(acc => 
    platformFilter === 'all' || acc.platform === platformFilter
  );

  // Selection helpers
  const isAllSelected = posts.length > 0 && selectedIds.length === posts.length;
  const isSomeSelected = selectedIds.length > 0 && selectedIds.length < posts.length;

  const toggleSelectPost = (id, e) => {
    e?.stopPropagation();
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleToggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(posts.map(p => p.id));
    }
  };

  const handleClearSelection = () => {
    setSelectedIds([]);
  };

  // Bulk Delete
  const handleBulkDelete = async () => {
    setIsBulkDeleting(true);
    try {
      if (isDeleteAllMode) {
        const res = await api.post('/posts/bulk-delete', { 
          deleteAll: true, 
          status: statusFilter,
          platform: platformFilter,
          account_id: accountFilter
        });
        if (res.data.success) {
          setSelectedIds([]);
          setShowBulkDeleteModal(false);
          fetchPosts();
        }
      } else {
        const res = await api.post('/posts/bulk-delete', { ids: selectedIds });
        if (res.data.success) {
          setPosts(prev => prev.filter(p => !selectedIds.includes(p.id)));
          setSelectedIds([]);
          setShowBulkDeleteModal(false);
        }
      }
    } catch (err) {
      alert('Gagal menghapus postingan: ' + (err.response?.data?.error || err.message));
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const handlePublishNow = async (id) => {
    setActionLoading(true);
    try {
      await api.post(`/posts/${id}/publish`);
      fetchPosts();
      if (selectedPost?.post?.id === id) {
        fetchDetails(id);
      }
    } catch (err) {
      alert(err.response?.data?.error || 'Gagal mempublish postingan.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Yakin ingin menghapus postingan ini?')) return;
    try {
      await api.delete(`/posts/${id}`);
      setPosts(posts.filter((p) => p.id !== id));
      setSelectedIds((prev) => prev.filter(item => item !== id));
      if (selectedPost?.post?.id === id) setSelectedPost(null);
    } catch (err) {
      alert('Gagal menghapus postingan.');
    }
  };

  const fetchDetails = async (id) => {
    try {
      const res = await api.get(`/posts/${id}`);
      setSelectedPost(res.data);
    } catch (err) {
      alert('Gagal mengambil detail postingan.');
    }
  };

  const statusBadges = {
    draft: { label: 'Draft', color: 'bg-slate-800 text-slate-300 border-slate-700' },
    scheduled: { label: 'Terjadwal', color: 'bg-amber-500/10 text-amber-300 border-amber-500/30' },
    posted: { label: 'Posted', color: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30' },
    failed: { label: 'Gagal', color: 'bg-rose-500/10 text-rose-300 border-rose-500/30' },
  };

  return (
    <div className="space-y-6 text-left">
      {/* Header & Filter Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Calendar className="w-5 h-5 text-indigo-400" />
            <span>Manajemen Postingan & Jadwal</span>
          </h2>
          <p className="text-xs text-slate-400">Lihat, kelola, retry, atau publish manual postingan Anda</p>
        </div>

        {/* Filter & Select All buttons */}
        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          {posts.length > 0 && (
            <button
              type="button"
              onClick={handleToggleSelectAll}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition-all ${
                isAllSelected
                  ? 'bg-indigo-600 border-indigo-500 text-white shadow-md'
                  : isSomeSelected
                  ? 'bg-indigo-950/80 border-indigo-500/50 text-indigo-300'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
              title={isAllSelected ? 'Batalkan Pilih Semua' : 'Pilih Semua'}
            >
              {isAllSelected ? (
                <CheckSquare className="w-3.5 h-3.5 text-white" />
              ) : isSomeSelected ? (
                <MinusSquare className="w-3.5 h-3.5 text-indigo-400" />
              ) : (
                <Square className="w-3.5 h-3.5 text-slate-500" />
              )}
              <span>{isAllSelected ? 'Semua' : isSomeSelected ? `${selectedIds.length}` : 'Pilih Semua'}</span>
            </button>
          )}

          <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-2xl border border-slate-800 overflow-x-auto max-w-full">
            {[
              { id: 'all', label: 'Semua' },
              { id: 'draft', label: 'Draft' },
              { id: 'scheduled', label: 'Terjadwal' },
              { id: 'posted', label: 'Posted' },
              { id: 'failed', label: 'Gagal' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setStatusFilter(tab.id)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                  statusFilter === tab.id
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
            <button
              onClick={fetchPosts}
              className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors ml-1"
              title="Muat Ulang"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>
      
      {/* Platform & Account Filter Dropdowns */}
      <div className="flex flex-wrap items-center gap-4 bg-slate-900/40 p-4 rounded-3xl border border-slate-800/80 backdrop-blur-md">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-950 px-3.5 py-1.5 rounded-2xl border border-slate-800">
            <span className="text-[10px] uppercase font-bold text-indigo-400 tracking-wider">Platform:</span>
            <select
              value={platformFilter}
              onChange={(e) => {
                setPlatformFilter(e.target.value);
                setAccountFilter('all');
              }}
              className="bg-transparent border-none text-xs font-semibold text-slate-300 focus:outline-none cursor-pointer"
            >
              <option value="all" className="bg-slate-950 text-slate-300">Semua Platform</option>
              <option value="facebook" className="bg-slate-950 text-slate-300">Facebook</option>
              <option value="instagram" className="bg-slate-950 text-slate-300">Instagram</option>
              <option value="threads" className="bg-slate-950 text-slate-300">Threads</option>
            </select>
          </div>

          <div className="flex items-center gap-2 bg-slate-950 px-3.5 py-1.5 rounded-2xl border border-slate-800">
            <span className="text-[10px] uppercase font-bold text-indigo-400 tracking-wider">Akun:</span>
            <select
              value={accountFilter}
              onChange={(e) => setAccountFilter(e.target.value)}
              className="bg-transparent border-none text-xs font-semibold text-slate-300 focus:outline-none cursor-pointer max-w-[200px] truncate"
            >
              <option value="all" className="bg-slate-950 text-slate-300">Semua Akun</option>
              {filteredAccounts.map((acc) => (
                <option key={acc.id} value={acc.id} className="bg-slate-950 text-slate-300">
                  {acc.page_name ? `${acc.page_name} (${acc.platform})` : `${acc.platform} - ${acc.page_id}`}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="text-[11px] text-slate-500 ml-auto font-medium">
          Ditemukan <span className="text-slate-300 font-bold">{posts.length}</span> postingan cocok
        </div>
      </div>

      {/* Posts List / Table */}
      {loading ? (
        <div className="p-12 text-center text-slate-500 text-sm">Memuat daftar postingan...</div>
      ) : posts.length === 0 ? (
        <div className="p-12 text-center bg-slate-900/40 border border-slate-800 rounded-3xl space-y-3">
          <Layers className="w-10 h-10 mx-auto text-slate-600" />
          <p className="text-sm font-semibold text-slate-400">Tidak ada postingan dalam kategori ini.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {posts.map((post) => {
            const isSelected = selectedIds.includes(post.id);
            const badge = statusBadges[post.status] || statusBadges.draft;

            return (
              <div
                key={post.id}
                onClick={() => fetchDetails(post.id)}
                className={`border rounded-3xl p-5 flex flex-col justify-between backdrop-blur-md transition-all cursor-pointer relative ${
                  isSelected
                    ? 'ring-2 ring-indigo-500 border-indigo-500 bg-indigo-950/20 shadow-xl shadow-indigo-500/20'
                    : 'bg-slate-900/60 border-slate-800/80 hover:border-slate-700 hover:scale-[1.01]'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={(e) => toggleSelectPost(post.id, e)}
                        className={`w-6 h-6 rounded-lg flex items-center justify-center transition-all ${
                          isSelected
                            ? 'bg-indigo-600 text-white border border-indigo-400'
                            : 'bg-slate-800 text-slate-400 hover:text-white border border-slate-700'
                        }`}
                        title={isSelected ? 'Batalkan pilihan' : 'Pilih postingan ini'}
                      >
                        {isSelected ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : <Square className="w-3.5 h-3.5 opacity-60" />}
                      </button>
                      <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold border ${badge.color}`}>
                        {badge.label}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-500 font-medium">
                      #{post.id.slice(0, 7)} • {new Date(post.created_at).toLocaleDateString('id-ID')}
                    </span>
                  </div>

                  {post.title && (
                    <h3 className="text-sm font-bold text-white mb-1 line-clamp-1">{post.title}</h3>
                  )}

                  <p className="text-xs text-slate-300 line-clamp-3 leading-relaxed mb-4">
                    {post.content}
                  </p>
                </div>

                <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
                  {post.scheduled_at ? (
                    <span className="text-[11px] text-amber-400 font-semibold flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(post.scheduled_at).toLocaleString('id-ID', {
                        timeZone: 'Asia/Jakarta',
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })} WIB
                    </span>
                  ) : (
                    <span className="text-[11px] text-slate-500">Manual / Immediate</span>
                  )}

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      fetchDetails(post.id);
                    }}
                    className="text-[11px] font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition-colors"
                  >
                    <span>Detail</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Floating Bulk Actions Toolbar */}
      {selectedIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex flex-wrap items-center gap-3 px-5 py-3.5 rounded-2xl bg-slate-900/95 border border-indigo-500/50 shadow-2xl shadow-indigo-500/30 backdrop-blur-xl animate-in slide-in-from-bottom-5 duration-300 text-xs font-semibold text-white">
          <div className="flex items-center gap-2 pr-3 border-r border-slate-700">
            <span className="px-2.5 py-1 rounded-lg bg-indigo-600 text-white font-extrabold text-xs shadow-sm">
              {selectedIds.length}
            </span>
            <span className="text-slate-200">Postingan Terpilih</span>
          </div>

          <button
            type="button"
            onClick={handleToggleSelectAll}
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-all"
          >
            {isAllSelected ? 'Batal Pilih Semua' : `Pilih Semua (${posts.length})`}
          </button>

          <button
            type="button"
            onClick={handleClearSelection}
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 text-xs font-medium transition-all"
          >
            Batalkan
          </button>

          <div className="h-4 w-px bg-slate-700 mx-1" />

          <button
            type="button"
            onClick={() => {
              setIsDeleteAllMode(false);
              setShowBulkDeleteModal(true);
            }}
            className="px-4 py-1.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-red-600/30 transition-all active:scale-95"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Hapus Terpilih ({selectedIds.length})</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setIsDeleteAllMode(true);
              setShowBulkDeleteModal(true);
            }}
            className="px-3 py-1.5 rounded-xl bg-red-950/80 hover:bg-red-900 border border-red-800/80 text-red-300 text-xs font-medium transition-all"
            title="Hapus semua postingan dalam filter ini"
          >
            <span>Hapus Semua Sesuai Filter</span>
          </button>
        </div>
      )}

      {/* Bulk Delete Modal */}
      {showBulkDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in">
          <div className="relative w-full max-w-md bg-slate-900 border border-red-500/40 rounded-3xl shadow-2xl p-6 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-red-500/20 border border-red-500/30 text-red-400 flex items-center justify-center mx-auto">
              <ShieldAlert className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1.5">
              <h3 className="text-lg font-extrabold text-white">
                {isDeleteAllMode ? 'Hapus Semua Postingan Sesuai Filter?' : `Hapus ${selectedIds.length} Postingan Terpilih?`}
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                {isDeleteAllMode
                  ? `Tindakan ini akan menghapus seluruh ${posts.length} postingan yang cocok dengan filter aktif (Status: ${statusFilter}, Platform: ${platformFilter === 'all' ? 'Semua' : platformFilter}, Akun: ${accountFilter === 'all' ? 'Semua' : 'Terfilter'}) secara permanen.`
                  : `Anda akan menghapus ${selectedIds.length} postingan yang dipilih dari database.`}
              </p>
            </div>

            <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-3">
              <button
                type="button"
                disabled={isBulkDeleting}
                onClick={() => setShowBulkDeleteModal(false)}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-all"
              >
                Batal
              </button>

              <button
                type="button"
                disabled={isBulkDeleting}
                onClick={handleBulkDelete}
                className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-red-600/30 transition-all"
              >
                {isBulkDeleting ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
                <span>{isBulkDeleting ? 'Menghapus...' : 'Ya, Hapus Sekarang'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail & Action Modal */}
      {selectedPost && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header Sticky */}
            <div className="flex items-center justify-between p-5 border-b border-slate-800 shrink-0 bg-slate-900">
              <div>
                <h3 className="font-bold text-base text-white">Detail Postingan</h3>
                <span className="text-[11px] text-slate-500 font-mono">#{selectedPost.post.id}</span>
              </div>
              <button
                onClick={() => setSelectedPost(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                title="Tutup Modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body Scrollable */}
            <div className="p-6 space-y-4 overflow-y-auto custom-scrollbar flex-1">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase font-extrabold text-slate-500 tracking-wider">Status Postingan</span>
                  <p className="text-xs font-bold text-indigo-400 capitalize">{selectedPost.post.status}</p>
                </div>
                {selectedPost.post.scheduled_at && (
                  <div className="text-right">
                    <span className="text-[10px] uppercase font-extrabold text-slate-500 tracking-wider">Jadwal Tayang (WIB)</span>
                    <p className="text-xs font-semibold text-amber-400">
                      {new Date(selectedPost.post.scheduled_at).toLocaleString('id-ID', {
                        timeZone: 'Asia/Jakarta',
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit'
                      })} WIB
                    </p>
                  </div>
                )}
              </div>

              {selectedPost.post.title && (
                <div>
                  <span className="text-[10px] uppercase font-extrabold text-slate-500 tracking-wider">Judul / Headline</span>
                  <p className="text-sm font-bold text-white mt-0.5">{selectedPost.post.title}</p>
                </div>
              )}

              <div>
                <span className="text-[10px] uppercase font-extrabold text-slate-500 tracking-wider">Isi Konten & Caption</span>
                <p className="text-xs text-slate-200 whitespace-pre-wrap bg-slate-950 p-4 rounded-2xl border border-slate-800 leading-relaxed mt-1 font-sans">
                  {selectedPost.post.content}
                </p>
              </div>

              {/* Media List */}
              {selectedPost.post.media?.length > 0 && (
                <div>
                  <span className="text-[10px] uppercase font-extrabold text-slate-500 tracking-wider">Media Terlampir</span>
                  <div className="mt-1.5 flex items-center gap-3 overflow-x-auto pb-1">
                    {selectedPost.post.media.map((m, idx) => {
                      const mediaUrl = typeof m === 'string' ? m : (m?.media_url || m?.url || '');
                      const mediaType = typeof m === 'object' && m?.media_type ? m.media_type : (m?.type || 'image');
                      if (!mediaUrl) return null;

                      return (
                        <div key={idx} className="w-24 h-24 rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 shrink-0 shadow-md">
                          {mediaType === 'video' ? (
                            <video src={mediaUrl} controls className="w-full h-full object-cover" />
                          ) : (
                            <img
                              src={mediaUrl}
                              alt="Media"
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                e.target.onerror = null;
                                e.target.src = 'https://placehold.co/100x100/1e293b/94a3b8?text=Shopee+Image';
                              }}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Target Accounts Status */}
              {selectedPost.post.targets?.length > 0 && (
                <div>
                  <span className="text-[10px] uppercase font-extrabold text-slate-500 tracking-wider">Target Akun Medsos</span>
                  <div className="mt-1.5 space-y-2">
                    {selectedPost.post.targets.map((t) => (
                      <div
                        key={t.id}
                        className="p-3 bg-slate-950 border border-slate-800 rounded-2xl flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center gap-2.5">
                          {t.platform === 'facebook' ? (
                            <Facebook className="w-4 h-4 text-fb-blue" />
                          ) : t.platform === 'instagram' ? (
                            <Instagram className="w-4 h-4 text-ig-pink" />
                          ) : (
                            <AtSign className="w-4 h-4 text-slate-300" />
                          )}
                          <span className="font-bold text-white">{t.page_name || t.platform}</span>
                        </div>
                        <div className="text-right">
                          <span
                            className={`font-extrabold capitalize text-[11px] px-2.5 py-0.5 rounded-full border ${
                              t.status === 'success'
                                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                                : t.status === 'failed'
                                ? 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                                : 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                            }`}
                          >
                            {t.status}
                          </span>
                          {t.error_message && (
                            <p className="text-[10px] text-rose-400 mt-1 max-w-xs truncate">{t.error_message}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer Sticky */}
            <div className="p-4 px-6 border-t border-slate-800 bg-slate-900/95 flex items-center justify-end gap-3 shrink-0">
              <button
                onClick={() => setSelectedPost(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-colors"
              >
                Tutup
              </button>
              {selectedPost.post.status !== 'posted' && (
                <button
                  onClick={() => handlePublishNow(selectedPost.post.id)}
                  disabled={actionLoading}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-indigo-600/30 flex items-center gap-1.5 transition-all"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Publish Sekarang</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
