import React, { useState, useEffect } from 'react';
import {
  FolderArchive,
  Search,
  Filter,
  RefreshCw,
  Sparkles,
  Layers,
  ArrowRight,
  TrendingUp,
  AlertCircle,
  Eye,
  MousePointerClick,
  Award,
  Clock,
  ShieldAlert,
  ChevronRight,
  SlidersHorizontal
} from 'lucide-react';
import api from '../api/client';
import ProductMemoryModal from './ProductMemoryModal';

export default function ProductQuarterBoard() {
  const [loading, setLoading] = useState(true);
  const [quarterStatus, setQuarterStatus] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [activeColumn, setActiveColumn] = useState('ALL');

  useEffect(() => {
    fetchQuarterStatus();
  }, []);

  const fetchQuarterStatus = async () => {
    try {
      setLoading(true);
      const res = await api.get('/agent-orchestrator/quarter/status');
      if (res.data.success) {
        setQuarterStatus(res.data);
      }
    } catch (err) {
      console.error('Error fetching quarter status:', err);
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    { id: 'NEW', title: 'Stok Baru', color: 'slate', desc: 'Belum pernah diuji' },
    { id: 'TESTING', title: 'Sedang Uji Coba', color: 'indigo', desc: 'Batch tes 1–2x' },
    { id: 'PROMISING', title: 'Menjanjikan', color: 'cyan', desc: 'Sinyal CTR positif' },
    { id: 'PROVEN', title: 'Pemenang (Proven)', color: 'emerald', desc: 'Konsisten klik tinggi' },
    { id: 'SCALING', title: 'Skala Prioritas', color: 'purple', desc: 'Rotasi rutin' },
    { id: 'COOLING', title: 'Cooling Down', color: 'amber', desc: 'Masa jeda sementara' },
    { id: 'STOPPED', title: 'Di-Stop Kuartal Ini', color: 'rose', desc: 'Evaluasi tidak optimal' },
  ];

  const filterProducts = (list = []) => {
    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase().trim();
    return list.filter(p =>
      (p.title && p.title.toLowerCase().includes(q)) ||
      (p.category && p.category.toLowerCase().includes(q)) ||
      (p.shop_name && p.shop_name.toLowerCase().includes(q))
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/60 p-6 rounded-3xl border border-slate-800/80">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-3 py-0.5 rounded-full text-xs font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              Kuartal: {quarterStatus?.current_quarter || '2026-Q3'}
            </span>
            <span className="text-xs text-slate-500">•</span>
            <span className="text-xs text-slate-400 font-medium">
              Total {quarterStatus?.total_products || 0} Produk Terdaftar
            </span>
          </div>
          <h1 className="text-xl font-extrabold text-slate-100 tracking-tight">
            Papan Siklus Hidup Produk (Lifecycle Kanban)
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Pantau perjalanan setiap produk dari stok awal, tahap pengujian A/B, pemenang skala, hingga keputusan kuartal.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari produk / niche..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-2 bg-slate-950/80 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 w-52 md:w-64"
            />
          </div>

          <button
            onClick={fetchQuarterStatus}
            disabled={loading}
            className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700/60 transition-colors disabled:opacity-50"
            title="Refresh Papan"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Overview Stat Widgets */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-slate-900/40 border border-slate-800">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 mb-1">
            <Eye className="w-4 h-4 text-indigo-400" />
            <span>Total Tayangan Kuartal</span>
          </div>
          <p className="text-xl font-extrabold text-slate-100">
            {Number(quarterStatus?.total_views || 0).toLocaleString('id-ID')}
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/40 border border-slate-800">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 mb-1">
            <MousePointerClick className="w-4 h-4 text-emerald-400" />
            <span>Total Klik Link</span>
          </div>
          <p className="text-xl font-extrabold text-emerald-400">
            {Number(quarterStatus?.total_clicks || 0).toLocaleString('id-ID')}
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/40 border border-slate-800">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 mb-1">
            <TrendingUp className="w-4 h-4 text-cyan-400" />
            <span>Rata-rata CTR</span>
          </div>
          <p className="text-xl font-extrabold text-cyan-300">
            {quarterStatus?.avg_ctr || '0.00'}%
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/40 border border-slate-800">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 mb-1">
            <Award className="w-4 h-4 text-purple-400" />
            <span>Produk Pemenang (Proven)</span>
          </div>
          <p className="text-xl font-extrabold text-purple-300">
            {(quarterStatus?.breakdown?.proven_count || 0) + (quarterStatus?.breakdown?.scaling_count || 0)} Produk
          </p>
        </div>
      </div>

      {/* Mobile Column Switcher */}
      <div className="flex md:hidden overflow-x-auto pb-2 gap-2 custom-scrollbar">
        <button
          onClick={() => setActiveColumn('ALL')}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${
            activeColumn === 'ALL' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400'
          }`}
        >
          Semua Kolom
        </button>
        {columns.map((col) => (
          <button
            key={col.id}
            onClick={() => setActiveColumn(col.id)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${
              activeColumn === col.id ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400'
            }`}
          >
            {col.title} ({quarterStatus?.pools?.[col.id]?.length || 0})
          </button>
        ))}
      </div>

      {/* Kanban Board Columns Container (Horizontal Scroll Flex Container) */}
      <div className="flex gap-4 items-start overflow-x-auto pb-6 pt-1 custom-scrollbar min-w-0 w-full">
        {columns.map((col) => {
          if (activeColumn !== 'ALL' && activeColumn !== col.id) return null;

          const rawProducts = quarterStatus?.pools?.[col.id] || [];
          const productList = filterProducts(rawProducts);

          const colBadgeColors = {
            slate: 'bg-slate-800 text-slate-300 border-slate-700',
            indigo: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
            cyan: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
            emerald: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
            purple: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
            amber: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
            rose: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
          };

          return (
            <div
              key={col.id}
              className="flex flex-col bg-slate-900/60 border border-slate-800 rounded-3xl w-72 shrink-0 max-h-[75vh] overflow-hidden shadow-xl"
            >
              {/* Column Header */}
              <div className="p-4 border-b border-slate-800/80 bg-slate-950/50 flex flex-col gap-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-extrabold text-slate-100 tracking-tight">{col.title}</span>
                  <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${colBadgeColors[col.color] || colBadgeColors.slate}`}>
                    {productList.length}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 font-medium">{col.desc}</p>
              </div>

              {/* Column Cards */}
              <div className="p-3 space-y-2.5 overflow-y-auto custom-scrollbar flex-1 max-h-[calc(75vh-80px)]">
                {productList.length === 0 ? (
                  <div className="py-12 text-center text-slate-600 text-xs font-medium border border-dashed border-slate-800/80 rounded-2xl">
                    Tidak ada produk
                  </div>
                ) : (
                  productList.map((prod) => {
                    const summary = prod.quarterly_summary || {};
                    const thumb = prod.images?.[0] || prod.media?.[0]?.url || null;

                    return (
                      <div
                        key={prod.id}
                        onClick={() => setSelectedProduct(prod)}
                        className="p-3 rounded-2xl bg-slate-950/80 border border-slate-800/90 hover:border-indigo-500/60 hover:bg-slate-950 cursor-pointer transition-all hover:shadow-xl hover:-translate-y-0.5 group"
                      >
                        {/* Thumbnail & Title */}
                        <div className="flex gap-3 mb-2.5">
                          {thumb ? (
                            <img
                              src={thumb}
                              alt=""
                              className="w-14 h-14 rounded-xl object-cover bg-slate-800 shrink-0 border border-slate-800"
                            />
                          ) : (
                            <div className="w-14 h-14 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-600 shrink-0 text-base font-bold">
                              🛍️
                            </div>
                          )}
                          <div className="min-w-0 flex-1 flex flex-col justify-between">
                            <h4 className="text-xs font-bold text-slate-200 line-clamp-2 group-hover:text-indigo-300 transition-colors leading-tight">
                              {prod.title}
                            </h4>
                            <div className="flex items-center justify-between gap-1 mt-1">
                              <span className="text-xs text-emerald-400 font-extrabold">
                                Rp {Number(prod.price || 0).toLocaleString('id-ID')}
                              </span>
                              {prod.discount ? (
                                <span className="text-[10px] text-rose-400 font-semibold bg-rose-500/10 px-1.5 py-0.5 rounded">
                                  {prod.discount}
                                </span>
                              ) : null}
                            </div>
                            
                            {/* Peringatan jika Link Produk Kosong */}
                            {(!prod.product_url && !prod.affiliate_url) && (
                              <div className="mt-1.5">
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-400 bg-rose-500/15 border border-rose-500/30 px-2 py-0.5 rounded-md">
                                  <AlertTriangle className="w-3 h-3" />
                                  <span>Link Kosong</span>
                                </span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Card Performance Pill */}
                        <div className="pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                          <span className="text-slate-500 font-medium">Uji: <strong className="text-slate-300">{summary.total_attempts || 0}x</strong></span>
                          <span className="text-emerald-400 font-bold flex items-center gap-1">
                            <MousePointerClick className="w-3 h-3" />
                            {summary.total_clicks || 0} Klik
                          </span>
                        </div>

                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>


      {/* Deep Memory Inspector Modal */}
      {selectedProduct && (
        <ProductMemoryModal
          product={selectedProduct}
          onClose={() => setSelectedProduct(null)}
          onRefresh={fetchQuarterStatus}
        />
      )}

    </div>
  );
}
