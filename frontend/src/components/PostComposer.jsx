import React, { useState, useEffect } from 'react';
import api from '../api/client';
import PostPreview from './PostPreview';
import AiGeneratorModal from './AiGeneratorModal';
import ModernSchedulePicker from './ModernSchedulePicker';
import {
  PenTool,
  Upload,
  Calendar,
  Clock,
  Sparkles,
  Facebook,
  Instagram,
  Send,
  Save,
  CheckCircle2,
  AlertCircle,
  Image as ImageIcon,
  Link as LinkIcon,
  Film,
  X,
  AtSign,
  Share2,
} from 'lucide-react';

export default function PostComposer({ onPostCreated }) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  const [mediaType, setMediaType] = useState('image');
  const [postType, setPostType] = useState('feed'); // 'feed' | 'reel'
  const [selectedTargets, setSelectedTargets] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [publishMode, setPublishMode] = useState('now'); // 'now' | 'scheduled' | 'draft'
  const [scheduledAt, setScheduledAt] = useState('');
  const [isAiOpen, setIsAiOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState(null);

  const [replyToId, setReplyToId] = useState('');
  const [quotePostId, setQuotePostId] = useState('');
  const [showThreadsOptions, setShowThreadsOptions] = useState(false);

  // Fetch accounts on mount
  useEffect(() => {
    api.get('/accounts')
      .then((res) => {
        const list = res.data.accounts || [];
        setAccounts(list);
        // Default select all active accounts
        const activeIds = list.filter((a) => a.is_active).map((a) => a.id);
        setSelectedTargets(activeIds);
      })
      .catch((err) => console.error('Gagal mengambil daftar akun sosmed', err));
  }, []);

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isVid = file.type.startsWith('video');
    const cloudName = isVid ? import.meta.env.VITE_CLOUDINARY_CLOUD_NAME_VIDEO : import.meta.env.VITE_CLOUDINARY_CLOUD_NAME_IMAGE;
    const uploadPreset = isVid ? import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET_VIDEO : import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET_IMAGE;

    if (!cloudName || !uploadPreset) {
      setMessage({ type: 'error', text: 'Konfigurasi Cloudinary belum disetting di .env.local' });
      return;
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', uploadPreset);

    setUploading(true);
    setMessage(null);
    try {
      const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/upload`, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Upload gagal');

      setMediaUrl(data.secure_url);
      setMediaType(isVid ? 'video' : 'image');
      if (!isVid) setPostType('feed');
    } catch (err) {
      setMessage({ type: 'error', text: 'Gagal mengunggah media file ke Cloudinary.' });
    } finally {
      setUploading(false);
    }
  };

  const handleToggleTarget = (id) => {
    if (selectedTargets.includes(id)) {
      setSelectedTargets(selectedTargets.filter((t) => t !== id));
    } else {
      setSelectedTargets([...selectedTargets, id]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!content.trim()) {
      setMessage({ type: 'error', text: 'Isi postingan (caption) tidak boleh kosong.' });
      return;
    }
    if (selectedTargets.length === 0 && publishMode !== 'draft') {
      setMessage({ type: 'error', text: 'Pilih minimal satu akun sosmed target postingan.' });
      return;
    }

    const hasIgTarget = selectedTargets.some(id => {
      const acc = accounts.find(a => a.id === id);
      return acc && acc.platform === 'instagram';
    });

    const hasThreadsTarget = selectedTargets.some(id => {
      const acc = accounts.find(a => a.id === id);
      return acc && acc.platform === 'threads';
    });

    if (hasIgTarget && !mediaUrl && publishMode !== 'draft') {
      setMessage({ type: 'error', text: 'Postingan ke Instagram WAJIB menyertakan media (Foto atau Video).' });
      return;
    }

    if (hasThreadsTarget && content.length > 500 && publishMode !== 'draft') {
      setMessage({ type: 'error', text: 'Meta Threads API membatasi caption maksimal 500 karakter.' });
      return;
    }

    setSubmitting(true);
    setMessage(null);

    try {
      const payload = {
        title,
        content,
        media: mediaUrl ? [{ url: mediaUrl, type: mediaType }] : [],
        targets: selectedTargets,
        scheduled_at: publishMode === 'scheduled' ? scheduledAt : null,
        post_type: postType,
        threads_options: {
          replyToId: replyToId.trim() || undefined,
          quotePostId: quotePostId.trim() || undefined,
        },
      };

      // 1. Create post
      const createRes = await api.post('/posts', payload);
      const createdPost = createRes.data.post;

      // 2. If Publish Now
      if (publishMode === 'now') {
        const pubRes = await api.post(`/posts/${createdPost.id}/publish`);
        const results = pubRes.data?.results || [];
        const failed = results.filter((r) => !r.success);
        const succeeded = results.filter((r) => r.success);

        if (failed.length > 0 && succeeded.length === 0) {
          setMessage({
            type: 'error',
            text: `Gagal publish ke Facebook/Instagram. Detail error: ${failed.map((f) => f.error).join('; ')}`,
          });
        } else if (failed.length > 0) {
          setMessage({
            type: 'error',
            text: `Berhasil dipublish ke ${succeeded.length} akun, tetapi gagal di ${failed.length} akun. Detail error: ${failed.map((f) => f.error).join('; ')}`,
          });
        } else {
          const isDry = succeeded.length > 0 && succeeded.every((s) => s.dryRun);
          setMessage({
            type: 'success',
            text: `Postingan berhasil dipublish${isDry ? ' (Mode Simulasi / Dry-Run)' : ' ke Halaman Facebook secara langsung'}!`,
          });
        }
      } else if (publishMode === 'scheduled') {
        setMessage({
          type: 'success',
          text: `Postingan berhasil dijadwalkan pada ${scheduledAt}.`,
        });
      } else {
        setMessage({
          type: 'success',
          text: `Postingan berhasil disimpan sebagai Draft.`,
        });
      }

      // Reset form
      setTitle('');
      setContent('');
      setMediaUrl('');

      if (onPostCreated) onPostCreated(createdPost);
    } catch (err) {
      setMessage({
        type: 'error',
        text: err.response?.data?.error || 'Gagal menyimpan / mempublish postingan.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 text-left">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <PenTool className="w-5 h-5 text-indigo-400" />
            <span>Buat Postingan Baru</span>
          </h2>
          <p className="text-xs text-slate-400">Tulis, jadwalkan, atau publish konten ke Facebook Page & Instagram</p>
        </div>
      </div>

      {message && (
        <div
          className={`p-4 rounded-2xl border text-sm font-medium flex items-center gap-3 ${
            message.type === 'success'
              ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
              : 'bg-red-500/10 text-red-300 border-red-500/30'
          }`}
        >
          {message.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-400" />
          ) : (
            <AlertCircle className="w-5 h-5 shrink-0 text-red-400" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      {/* Main Grid: Form + Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Form Column */}
        <div className="lg:col-span-7 space-y-5">
          <form onSubmit={handleSubmit} className="bg-slate-900/60 border border-slate-800/80 rounded-3xl p-6 space-y-5 backdrop-blur-md">
            {/* Title (Optional) */}
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                Judul Internal / Topik (Opsional)
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Contoh: Promo Akhir Pekan Skincare"
                className="w-full px-4 py-2.5 bg-slate-950/70 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>

            {/* Content / Caption Editor */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                  Isi Konten / Caption *
                </label>
                <button
                  type="button"
                  onClick={() => setIsAiOpen(true)}
                  className="px-3 py-1 bg-indigo-500/10 text-indigo-300 border border-indigo-500/30 hover:bg-indigo-500/20 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm"
                >
                  <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Bantu AI Mistral</span>
                </button>
              </div>
              <textarea
                required
                rows={5}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Tulis caption postingan Anda di sini..."
                className={`w-full p-4 bg-slate-950/70 border rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none leading-relaxed ${
                  content.length > 500 && selectedTargets.some(id => accounts.find(a => a.id === id)?.platform === 'threads')
                    ? 'border-rose-500/80 focus:border-rose-500'
                    : 'border-slate-800 focus:border-indigo-500'
                }`}
              />
              <div className="flex items-center justify-between mt-1 text-[11px] text-slate-400">
                <span className="flex items-center gap-1">
                  <AtSign className="w-3 h-3 text-slate-400" />
                  Maksimal 500 Karakter (Meta Threads API)
                </span>
                <span className={`font-mono font-bold ${
                  content.length > 500 ? 'text-rose-400' : 'text-slate-400'
                }`}>
                  {content.length}/500
                </span>
              </div>
            </div>

            {/* Threads Advanced Settings Accordion */}
            <div className="p-4 bg-slate-950/60 border border-slate-800/90 rounded-2xl space-y-3">
              <button
                type="button"
                onClick={() => setShowThreadsOptions(!showThreadsOptions)}
                className="w-full flex items-center justify-between text-xs font-bold text-slate-300 hover:text-white transition-colors"
              >
                <div className="flex items-center gap-2">
                  <AtSign className="w-4 h-4 text-indigo-400" />
                  <span>Pengaturan Lanjutan Threads (Reply / Quote)</span>
                </div>
                <span className="text-[10px] text-indigo-400 font-normal">
                  {showThreadsOptions ? 'Sembunyikan ▲' : 'Tampilkan Opsi ▼'}
                </span>
              </button>

              {showThreadsOptions && (
                <div className="pt-2 border-t border-slate-800 space-y-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                      Reply To Post ID (Opsional - Untuk Balasan / Thread Sequence)
                    </label>
                    <input
                      type="text"
                      value={replyToId}
                      onChange={(e) => setReplyToId(e.target.value)}
                      placeholder="Contoh ID Post Threads: 178414000000000"
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                      Quote Post ID (Opsional - Untuk Mengutip Postingan Lain)
                    </label>
                    <input
                      type="text"
                      value={quotePostId}
                      onChange={(e) => setQuotePostId(e.target.value)}
                      placeholder="Contoh ID Post Threads: 178414999999999"
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 font-mono"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Media Upload / URL */}
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                Media (Foto / Video)
              </label>

              {mediaUrl ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-3 p-3 bg-slate-950 border border-slate-800 rounded-xl">
                    <div className="w-12 h-12 bg-slate-900 rounded-lg overflow-hidden shrink-0 flex items-center justify-center border border-slate-800">
                      {mediaType === 'video' ? (
                        <video src={mediaUrl} className="w-full h-full object-cover" />
                      ) : (
                        <img src={mediaUrl} alt="Upload" className="w-full h-full object-cover" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-slate-200 font-medium truncate">{mediaUrl}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <button
                          type="button"
                          onClick={() => setMediaType('image')}
                          className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-all ${
                            mediaType === 'image'
                              ? 'bg-indigo-600 border-indigo-500 text-white'
                              : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                          }`}
                        >
                          📷 Foto
                        </button>
                        <button
                          type="button"
                          onClick={() => setMediaType('video')}
                          className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-all ${
                            mediaType === 'video'
                              ? 'bg-purple-600 border-purple-500 text-white'
                              : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                          }`}
                        >
                          🎥 Video
                        </button>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setMediaUrl('')}
                      className="p-1.5 text-slate-400 hover:text-red-400 rounded-lg hover:bg-slate-900"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <label className="flex-1 cursor-pointer flex items-center justify-center gap-2 px-4 py-3 bg-slate-950/70 border border-dashed border-slate-800 hover:border-indigo-500/50 rounded-xl text-xs font-semibold text-slate-400 hover:text-indigo-400 transition-all">
                      <Upload className="w-4 h-4" />
                      <span>{uploading ? 'Mengunggah...' : 'Upload Foto / Video File'}</span>
                      <input
                        type="file"
                        accept="image/*,video/*"
                        onChange={handleFileUpload}
                        disabled={uploading}
                        className="hidden"
                      />
                    </label>
                  </div>
                  <div className="relative">
                    <LinkIcon className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
                    <input
                      type="url"
                      value={mediaUrl}
                      onChange={(e) => setMediaUrl(e.target.value)}
                      placeholder="atau tempel URL Gambar publik (https://...)"
                      className="w-full pl-9 pr-4 py-2 bg-slate-950/70 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>
              )}

              {mediaUrl && mediaType === 'video' && (
                <div className="mt-3 p-3 bg-slate-950 border border-indigo-500/30 rounded-xl space-y-2">
                  <label className="block text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                    <Film className="w-3.5 h-3.5 text-indigo-400" /> Format Terbit Video
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setPostType('feed')}
                      className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all ${
                        postType === 'feed'
                          ? 'bg-indigo-600 border-indigo-500 text-white shadow-md'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      📹 Video Feed Standard
                    </button>
                    <button
                      type="button"
                      onClick={() => setPostType('reel')}
                      className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all ${
                        postType === 'reel'
                          ? 'bg-gradient-to-r from-pink-600 to-purple-600 border-pink-500 text-white shadow-md'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      🎬 Facebook Reel (3-Phase API)
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Target Social Accounts */}
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                Pilih Akun Tujuan Postingan
              </label>
              {accounts.length === 0 ? (
                <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs text-amber-300">
                  Belum ada akun sosial media terhubung. Buka tab <strong>Akun Sosmed</strong> untuk menambahkan.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {accounts.map((acc) => {
                    const isSelected = selectedTargets.includes(acc.id);
                    const isFb = acc.platform === 'facebook';
                    const isIg = acc.platform === 'instagram';
                    const isThreads = acc.platform === 'threads';
                    
                    let bgClass = 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700';
                    let iconBgClass = 'bg-slate-800';
                    let IconComponent = Share2;
                    
                    if (isFb) {
                      IconComponent = Facebook;
                      iconBgClass = 'bg-fb-blue';
                      if (isSelected) bgClass = 'bg-fb-blue/10 border-fb-blue text-white';
                    } else if (isIg) {
                      IconComponent = Instagram;
                      iconBgClass = 'bg-gradient-to-tr from-ig-orange via-ig-pink to-ig-purple';
                      if (isSelected) bgClass = 'bg-ig-pink/10 border-ig-pink text-white';
                    } else if (isThreads) {
                      IconComponent = AtSign;
                      iconBgClass = 'bg-black border border-slate-700';
                      if (isSelected) bgClass = 'bg-slate-800/80 border-slate-500 text-white';
                    }
                    
                    return (
                      <div
                        key={acc.id}
                        onClick={() => handleToggleTarget(acc.id)}
                        className={`cursor-pointer p-3 rounded-xl border flex items-center gap-3 transition-all ${bgClass}`}
                      >
                        <div
                          className={`w-8 h-8 rounded-lg flex items-center justify-center text-white shrink-0 font-bold text-xs ${iconBgClass}`}
                        >
                          <IconComponent className="w-4 h-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-white truncate">{acc.page_name}</p>
                          <span className="text-[10px] text-slate-400 uppercase font-semibold">
                            {acc.platform}
                          </span>
                        </div>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {}}
                          className="w-4 h-4 accent-indigo-500 rounded cursor-pointer"
                        />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Publishing Action Options */}
            <div className="pt-2 border-t border-slate-800 space-y-3">
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                Opsi Eksekusi Postingan
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setPublishMode('now')}
                  className={`py-2.5 px-3 rounded-xl text-xs font-bold border flex items-center justify-center gap-1.5 transition-all ${
                    publishMode === 'now'
                      ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg'
                      : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Publish Sekarang</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPublishMode('scheduled')}
                  className={`py-2.5 px-3 rounded-xl text-xs font-bold border flex items-center justify-center gap-1.5 transition-all ${
                    publishMode === 'scheduled'
                      ? 'bg-amber-600 border-amber-500 text-white shadow-lg'
                      : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>Jadwalkan</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPublishMode('draft')}
                  className={`py-2.5 px-3 rounded-xl text-xs font-bold border flex items-center justify-center gap-1.5 transition-all ${
                    publishMode === 'draft'
                      ? 'bg-slate-800 border-slate-700 text-white shadow-lg'
                      : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Simpan Draft</span>
                </button>
              </div>

              {publishMode === 'scheduled' && (
                <ModernSchedulePicker
                  value={scheduledAt}
                  onChange={(val) => setScheduledAt(val)}
                />
              )}

              {/* Main Submit Button */}
              <button
                type="submit"
                disabled={submitting}
                className="w-full mt-4 py-3 rounded-2xl gradient-btn font-bold text-sm flex items-center justify-center gap-2 shadow-xl"
              >
                {submitting ? (
                  <span>Memproses...</span>
                ) : publishMode === 'now' ? (
                  <>
                    <Send className="w-4 h-4" />
                    <span>Kirim & Publish Sekarang</span>
                  </>
                ) : publishMode === 'scheduled' ? (
                  <>
                    <Calendar className="w-4 h-4" />
                    <span>Jadwalkan Postingan</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>Simpan ke Draft</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Live Preview Column */}
        <div className="lg:col-span-5">
          <div className="sticky top-20">
            <PostPreview
              content={content}
              title={title}
              mediaUrl={mediaUrl}
              mediaType={mediaType}
              selectedAccounts={accounts.filter((a) => selectedTargets.includes(a.id))}
              replyToId={replyToId}
              quotePostId={quotePostId}
            />
          </div>
        </div>
      </div>

      {/* AI Modal */}
      <AiGeneratorModal
        isOpen={isAiOpen}
        onClose={() => setIsAiOpen(false)}
        onApplyCaption={(cap, genTitle) => {
          setContent(cap);
          if (genTitle && !title) setTitle(genTitle);
        }}
      />
    </div>
  );
}
