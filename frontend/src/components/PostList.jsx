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
} from 'lucide-react';

export default function PostList() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedPost, setSelectedPost] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchPosts = async () => {
    setLoading(true);
    try {
      const url = statusFilter === 'all' ? '/posts' : `/posts?status=${statusFilter}`;
      const res = await api.get(url);
      setPosts(res.data.posts || []);
    } catch (err) {
      console.error('Gagal mengambil daftar postingan', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPosts();
  }, [statusFilter]);

  const handlePublishNow = async (id) => {
    setActionLoading(true);
    try {
      await api.post(`/posts/${id}/publish`);
      fetchPosts();
      if (selectedPost?.post?.id === id) {
        // Refresh details modal
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

        {/* Filter buttons */}
        <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-2xl border border-slate-800 self-start sm:self-auto overflow-x-auto max-w-full">
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
            const badge = statusBadges[post.status] || statusBadges.draft;
            return (
              <div
                key={post.id}
                className="bg-slate-900/60 border border-slate-800/80 hover:border-slate-700 rounded-3xl p-5 flex flex-col justify-between backdrop-blur-md transition-all hover:scale-[1.01]"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold border ${badge.color}`}>
                      {badge.label}
                    </span>
                    <span className="text-[10px] text-slate-500 font-medium">
                      #{post.id} • {new Date(post.created_at).toLocaleDateString('id-ID')}
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
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  ) : (
                    <span className="text-[11px] text-slate-500">Manual / Immediate</span>
                  )}

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => fetchDetails(post.id)}
                      className="p-1.5 text-slate-400 hover:text-indigo-400 hover:bg-slate-800 rounded-lg transition-colors"
                      title="Lihat Detail"
                    >
                      <Eye className="w-4 h-4" />
                    </button>

                    {post.status !== 'posted' && (
                      <button
                        onClick={() => handlePublishNow(post.id)}
                        disabled={actionLoading}
                        className="p-1.5 text-slate-400 hover:text-emerald-400 hover:bg-slate-800 rounded-lg transition-colors"
                        title="Publish Sekarang / Retry"
                      >
                        <Send className="w-4 h-4" />
                      </button>
                    )}

                    <button
                      onClick={() => handleDelete(post.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors"
                      title="Hapus"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Details Modal */}
      {selectedPost && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl relative text-left">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800">
              <h3 className="font-bold text-base text-white">Detail Postingan #{selectedPost.post.id}</h3>
              <button
                onClick={() => setSelectedPost(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-500">Status</span>
                <p className="text-xs font-semibold text-indigo-400 capitalize">{selectedPost.post.status}</p>
              </div>

              {selectedPost.post.title && (
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-500">Judul</span>
                  <p className="text-sm font-bold text-white">{selectedPost.post.title}</p>
                </div>
              )}

              <div>
                <span className="text-[10px] uppercase font-bold text-slate-500">Isi Konten</span>
                <p className="text-xs text-slate-300 whitespace-pre-wrap bg-slate-950 p-3 rounded-xl border border-slate-800 leading-relaxed mt-1">
                  {selectedPost.post.content}
                </p>
              </div>

              {/* Media List */}
              {selectedPost.post.media?.length > 0 && (
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-500">Media Terlampir</span>
                  <div className="mt-1 flex items-center gap-2 overflow-x-auto">
                    {selectedPost.post.media.map((m, idx) => (
                      <div key={idx} className="w-20 h-20 rounded-xl overflow-hidden bg-slate-950 border border-slate-800 shrink-0">
                        {m.media_type === 'video' ? (
                          <video src={m.media_url} className="w-full h-full object-cover" />
                        ) : (
                          <img src={m.media_url} alt="Media" className="w-full h-full object-cover" />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Target Accounts Status */}
              {selectedPost.post.targets?.length > 0 && (
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-500">Status Target Sosmed</span>
                  <div className="mt-1 space-y-2">
                    {selectedPost.post.targets.map((t) => (
                      <div
                        key={t.id}
                        className="p-3 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center gap-2">
                          {t.platform === 'facebook' ? (
                            <Facebook className="w-4 h-4 text-fb-blue" />
                          ) : (
                            <Instagram className="w-4 h-4 text-ig-pink" />
                          )}
                          <span className="font-semibold text-white">{t.page_name || t.platform}</span>
                        </div>
                        <div className="text-right">
                          <span
                            className={`font-bold capitalize text-[11px] ${
                              t.status === 'success'
                                ? 'text-emerald-400'
                                : t.status === 'failed'
                                ? 'text-rose-400'
                                : 'text-amber-400'
                            }`}
                          >
                            {t.status}
                          </span>
                          {t.error_message && (
                            <p className="text-[10px] text-rose-400 mt-0.5 max-w-xs truncate">{t.error_message}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="mt-6 pt-3 border-t border-slate-800 flex justify-end gap-2">
              {selectedPost.post.status !== 'posted' && (
                <button
                  onClick={() => handlePublishNow(selectedPost.post.id)}
                  disabled={actionLoading}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow-md flex items-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Publish Sekarang</span>
                </button>
              )}
              <button
                onClick={() => setSelectedPost(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold"
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
