import React, { useState, useEffect } from 'react';
import {
  X,
  Calendar,
  Eye,
  Heart,
  MessageCircle,
  Share2,
  MousePointerClick,
  Sparkles,
  Award,
  Layers,
  Clock,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Video,
  Image as ImageIcon,
  ExternalLink,
  ShieldAlert
} from 'lucide-react';
import api from '../api/client';

export default function ProductMemoryModal({ product, onClose, onRefresh }) {
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState([]);
  const [decisions, setDecisions] = useState([]);
  const [diagnosing, setDiagnosing] = useState(false);
  const [diagnosisResult, setDiagnosisResult] = useState(null);
  const [productUrl, setProductUrl] = useState(product?.product_url || product?.affiliate_url || '');
  const [savingUrl, setSavingUrl] = useState(false);
  const [urlSaved, setUrlSaved] = useState(false);

  useEffect(() => {
    if (!product?.id) return;
    setProductUrl(product?.product_url || product?.affiliate_url || '');
    fetchMemory();
  }, [product]);

  const handleSaveProductUrl = async () => {
    if (!productUrl.trim()) return;
    try {
      setSavingUrl(true);
      await api.put(`/affiliate-products/${product.id}`, { product_url: productUrl.trim() });
      setUrlSaved(true);
      setTimeout(() => setUrlSaved(false), 3000);
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error('Error saving product URL:', err);
    } finally {
      setSavingUrl(false);
    }
  };


  const fetchMemory = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/agent-orchestrator/memory/product/${product.id}`);
      if (res.data.success) {
        setHistory(res.data.history || []);
        setDecisions(res.data.decisions || []);
      }
    } catch (err) {
      console.error('Error fetching product memory:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRunDiagnosis = async () => {
    try {
      setDiagnosing(true);
      const res = await api.post(`/agent-orchestrator/product/${product.id}/diagnose`);
      if (res.data.success) {
        setDiagnosisResult(res.data.diagnosis);
        if (onRefresh) onRefresh();
      }
    } catch (err) {
      console.error('Error running diagnosis:', err);
    } finally {
      setDiagnosing(false);
    }
  };

  const handleOverrideStatus = async (newStatus) => {
    try {
      await api.post(`/agent-orchestrator/product/${product.id}/override-status`, { status: newStatus });
      if (onRefresh) onRefresh();
      fetchMemory();
    } catch (err) {
      console.error('Error overriding status:', err);
    }
  };

  if (!product) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-5xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Modal Header */}
        <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 font-bold text-lg">
              🧠
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-100 line-clamp-1">{product.title}</h2>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase ${
                  product.lifecycle_status === 'PROVEN' || product.lifecycle_status === 'SCALING'
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : product.lifecycle_status === 'STOPPED'
                    ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                    : 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30'
                }`}>
                  {product.lifecycle_status || 'NEW'}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Kategori: <span className="text-indigo-300 font-medium">{product.category || product.agent_profile?.niche || 'Umum'}</span> • 
                Harga: <span className="text-emerald-400 font-medium">Rp {Number(product.price || 0).toLocaleString('id-ID')}</span>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">

          {/* Product URL Input & Verification Banner */}
          <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
            <div className="flex-1 min-w-0 w-full">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] uppercase font-extrabold text-slate-400 tracking-wider">
                  Link Asal Produk Shopee
                </span>
                {(!productUrl || !productUrl.startsWith('http')) ? (
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    <span>Wajib Diisi untuk Pembuatan Link Affiliate</span>
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>Link Valid</span>
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 w-full">
                <input
                  type="text"
                  value={productUrl}
                  onChange={(e) => setProductUrl(e.target.value)}
                  placeholder="https://shopee.co.id/product/..."
                  className="w-full px-3.5 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
                <button
                  onClick={handleSaveProductUrl}
                  disabled={savingUrl || !productUrl.trim()}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shrink-0 transition-all disabled:opacity-50"
                >
                  {savingUrl ? 'Menyimpan...' : urlSaved ? 'Tersimpan ✓' : 'Simpan Link'}
                </button>
              </div>
            </div>
          </div>

          {/* Product Profile & Intelligence Card */}

          {product.agent_profile && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80">
                <div className="flex items-center gap-2 text-indigo-400 text-xs font-bold mb-2">
                  <Sparkles className="w-4 h-4" />
                  <span>Target Persona</span>
                </div>
                <p className="text-sm font-medium text-slate-200">{product.agent_profile.target_audience || '-'}</p>
                <p className="text-xs text-slate-500 mt-1">Tier: {product.agent_profile.price_tier || 'Mid-Range'}</p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80">
                <div className="flex items-center gap-2 text-rose-400 text-xs font-bold mb-2">
                  <AlertTriangle className="w-4 h-4" />
                  <span>Pain Points Konsumen</span>
                </div>
                <ul className="text-xs text-slate-300 space-y-1">
                  {(product.agent_profile.pain_points || []).slice(0, 3).map((p, i) => (
                    <li key={i} className="line-clamp-1">• {p}</li>
                  ))}
                </ul>
              </div>

              <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80">
                <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold mb-2">
                  <Award className="w-4 h-4" />
                  <span>Keunggulan Utama (USP)</span>
                </div>
                <ul className="text-xs text-slate-300 space-y-1">
                  {(product.agent_profile.usp || []).slice(0, 3).map((u, i) => (
                    <li key={i} className="line-clamp-1">• {u}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Actions & Diagnostic Section */}
          <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl bg-indigo-950/20 border border-indigo-500/20">
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold text-slate-300">Aksi Cepat:</span>
              <button
                onClick={handleRunDiagnosis}
                disabled={diagnosing}
                className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-2 shadow-lg shadow-indigo-600/25 transition-all disabled:opacity-50"
              >
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>{diagnosing ? 'Mendiagnosis...' : 'Jalankan Diagnosis'}</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">Override Status:</span>
              {['TESTING', 'PROVEN', 'SCALING', 'STOPPED'].map((st) => (
                <button
                  key={st}
                  onClick={() => handleOverrideStatus(st)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                    product.lifecycle_status === st
                      ? 'bg-slate-700 text-white border border-slate-600'
                      : 'bg-slate-800/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          {/* Diagnosis Result Banner */}
          {diagnosisResult && (
            <div className={`p-4 rounded-2xl border ${
              diagnosisResult.can_stop 
                ? 'bg-red-950/30 border-red-500/30 text-red-300' 
                : 'bg-amber-950/30 border-amber-500/30 text-amber-300'
            }`}>
              <div className="flex items-center gap-2 font-bold text-xs mb-1">
                <AlertTriangle className="w-4 h-4" />
                <span>Hasil Diagnosis: {diagnosisResult.diagnosis_category}</span>
              </div>
              <p className="text-xs leading-relaxed">{diagnosisResult.finding}</p>
              <div className="mt-2 text-xs font-semibold text-white flex items-center gap-1.5">
                <span>Rekomendasi Aksi:</span>
                <span className="underline underline-offset-2">{diagnosisResult.recommended_action}</span>
              </div>
            </div>
          )}

          {/* Memory Postings Timeline */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-indigo-400" />
                <h3 className="text-sm font-bold text-slate-200">
                  Buku Besar Riwayat Postingan ({history.length} Postingan)
                </h3>
              </div>
            </div>

            {loading ? (
              <div className="py-12 flex flex-col items-center justify-center gap-3 text-slate-500">
                <div className="w-6 h-6 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
                <span className="text-xs">Memuat memori produk...</span>
              </div>
            ) : history.length === 0 ? (
              <div className="py-10 text-center text-slate-500 text-xs border border-dashed border-slate-800 rounded-2xl">
                Produk ini belum pernah diposting oleh agent.
              </div>
            ) : (
              <div className="space-y-4">
                {history.map((post, idx) => {
                  const ctx = post.context_at_post || {};
                  const raw = post.raw_metrics || {};
                  const scores = post.scores || {};
                  const isVideo = ctx.media_type === 'video';

                  return (
                    <div
                      key={post.id || idx}
                      className="p-4 rounded-2xl bg-slate-950/50 border border-slate-800/80 hover:border-slate-700 transition-all flex flex-col md:flex-row gap-4"
                    >
                      {/* Media Thumbnails */}
                      <div className="w-full md:w-36 h-28 rounded-xl bg-slate-800 overflow-hidden shrink-0 relative flex items-center justify-center border border-slate-700/50">
                        {ctx.media_urls && ctx.media_urls.length > 0 ? (
                          isVideo ? (
                            <div className="w-full h-full flex flex-col items-center justify-center bg-slate-900 text-indigo-400 gap-1">
                              <Video className="w-8 h-8" />
                              <span className="text-[10px] font-bold uppercase">1 Video Demo</span>
                            </div>
                          ) : (
                            <img
                              src={ctx.media_urls[0]}
                              alt="Media post"
                              className="w-full h-full object-cover"
                            />
                          )
                        ) : (
                          <ImageIcon className="w-6 h-6 text-slate-600" />
                        )}
                        <span className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-black/70 backdrop-blur-md text-[10px] font-bold text-slate-300 uppercase">
                          {ctx.platform || 'FB'}
                        </span>
                      </div>

                      {/* Post Details & Context */}
                      <div className="flex-1 min-w-0 flex flex-col justify-between">
                        <div>
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <span className="text-xs font-bold text-indigo-300 line-clamp-1">
                              Angle: {ctx.copy_angle || 'Standard'} • Template: {ctx.template_name || 'PAS'}
                            </span>
                            <span className="text-[11px] text-slate-500 shrink-0">
                              {post.published_at ? new Date(post.published_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '-'}
                            </span>
                          </div>

                          <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                            {post.raw_metrics?.caption || ctx.caption_preview || 'Konten promosi otomatis dari agent.'}
                          </p>
                        </div>

                        {/* Metric Scorecard Pill */}
                        <div className="mt-3 pt-3 border-t border-slate-800/80 flex flex-wrap items-center gap-4 text-xs">
                          <div className="flex items-center gap-1.5 text-slate-400" title="Views">
                            <Eye className="w-3.5 h-3.5 text-slate-500" />
                            <span>{raw.views || 0}</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-slate-400" title="Likes">
                            <Heart className="w-3.5 h-3.5 text-rose-500" />
                            <span>{raw.likes || 0}</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-slate-400" title="Comments">
                            <MessageCircle className="w-3.5 h-3.5 text-blue-400" />
                            <span>{raw.comments || 0}</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-emerald-400 font-bold" title="Affiliate Clicks">
                            <MousePointerClick className="w-3.5 h-3.5" />
                            <span>{raw.affiliate_clicks || 0} Klik</span>
                          </div>
                          <div className="ml-auto flex items-center gap-2">
                            <span className="text-[11px] text-slate-500">Skor:</span>
                            <span className="px-2 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 font-bold text-xs border border-indigo-500/30">
                              {scores.overall_score || 5.0} / 10
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* AI Decision Transparency Logs */}
          {decisions.length > 0 && (
            <div className="pt-4 border-t border-slate-800">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
                Log Transparansi Keputusan AI Produk Ini
              </h4>
              <div className="space-y-2">
                {decisions.map((dec) => (
                  <div key={dec.id} className="p-3 rounded-xl bg-slate-950/40 border border-slate-800/60 text-xs">
                    <div className="flex items-center justify-between text-indigo-400 font-bold mb-0.5">
                      <span>{dec.summary}</span>
                      <span className="text-[10px] text-slate-500 font-normal">
                        {new Date(dec.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-slate-400 leading-relaxed">{dec.reasoning}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

      </div>
    </div>
  );
}
