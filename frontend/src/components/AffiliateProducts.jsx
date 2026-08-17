import React, { useState, useEffect, useMemo } from 'react';
import api from '../api/client';
import {
  ShoppingBag,
  Search,
  Filter,
  Plus,
  Upload,
  Download,
  Copy,
  Check,
  ExternalLink,
  Share2,
  Trash2,
  Edit3,
  Film,
  Image as ImageIcon,
  Star,
  Layers,
  MapPin,
  Tag,
  FileText,
  AlertCircle,
  CheckCircle2,
  Loader2,
  X,
  Sparkles,
  Link as LinkIcon,
  Eye,
  SlidersHorizontal,
  LayoutGrid,
  List,
  Store,
  ArrowUpDown,
  RefreshCw,
  FolderDown
} from 'lucide-react';

export default function AffiliateProducts({ onSendToComposer, onSendToAffiliate }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);

  // Search, Filter & Sort State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedMediaType, setSelectedMediaType] = useState('all'); // 'all' | 'video' | 'image'
  const [sortBy, setSortBy] = useState('newest'); // 'newest' | 'oldest' | 'price_asc' | 'price_desc' | 'rating'
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'list'

  // Modals & Detail State
  const [selectedProductDetail, setSelectedProductDetail] = useState(null);
  const [activeDetailMediaIndex, setActiveDetailMediaIndex] = useState(0);
  const [activeDetailMediaType, setActiveDetailMediaType] = useState('image'); // 'image' | 'video'

  const [showImportModal, setShowImportModal] = useState(false);
  const [importJsonText, setImportJsonText] = useState('');
  const [importing, setImporting] = useState(false);
  const [importPreviewCount, setImportPreviewCount] = useState(0);
  const [importError, setImportError] = useState(null);

  const [showAddEditModal, setShowAddEditModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null); // null if adding new

  // Copy feedback state
  const [copiedId, setCopiedId] = useState(null);
  const [generatingAffiliateForId, setGeneratingAffiliateForId] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);

  const showToast = (text, type = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Fetch Products
  const fetchProducts = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await api.get('/affiliate-products', {
        params: {
          search: searchQuery,
          category: selectedCategory,
          media_type: selectedMediaType,
          sort_by: sortBy
        }
      });
      setProducts(res.data.products || []);
    } catch (err) {
      console.error('Error fetching affiliate products:', err);
      setErrorMsg(err.response?.data?.error || err.message || 'Gagal memuat daftar produk.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, [selectedCategory, selectedMediaType, sortBy]);

  // Handle Search submit / debounce
  const handleSearchSubmit = (e) => {
    e?.preventDefault();
    fetchProducts();
  };

  // Categories list extracted from data
  const categoriesList = useMemo(() => {
    const cats = new Set(['all']);
    products.forEach((p) => {
      if (p.category) cats.add(p.category);
    });
    return Array.from(cats);
  }, [products]);

  // Format IDR Rupiah
  const formatRupiah = (number) => {
    if (typeof number !== 'number' || isNaN(number)) {
      const parsed = parseInt(String(number).replace(/[^0-9]/g, ''), 10);
      if (isNaN(parsed) || parsed === 0) return '-';
      number = parsed;
    }
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0
    }).format(number);
  };

  // Delete product
  const handleDeleteProduct = async (id, e) => {
    e?.stopPropagation();
    if (!window.confirm('Yakin ingin menghapus produk ini dari database Produk Affiliate?')) return;
    try {
      await api.delete(`/affiliate-products/${id}`);
      setProducts((prev) => prev.filter((p) => p.id !== id));
      if (selectedProductDetail?.id === id) {
        setSelectedProductDetail(null);
      }
      showToast('Produk berhasil dihapus.');
    } catch (err) {
      alert('Gagal menghapus produk: ' + (err.response?.data?.error || err.message));
    }
  };

  // Generate Affiliate Link helper
  const getOrGenerateAffiliateLink = async (product) => {
    if (product.affiliate_url && product.affiliate_url.trim()) {
      return product.affiliate_url.trim();
    }
    if (!product.product_url) return '';

    try {
      const res = await api.post('/v1/affiliate/shopee', {
        product_url: product.product_url
      });
      if (res.data.success && res.data.short_url) {
        const generatedLink = res.data.short_url;
        // Save back to product
        await api.put(`/affiliate-products/${product.id}`, {
          affiliate_url: generatedLink
        });
        // Update local state
        setProducts((prev) =>
          prev.map((p) => (p.id === product.id ? { ...p, affiliate_url: generatedLink } : p))
        );
        if (selectedProductDetail?.id === product.id) {
          setSelectedProductDetail((prev) => ({ ...prev, affiliate_url: generatedLink }));
        }
        return generatedLink;
      }
    } catch (err) {
      console.warn('Gagal auto-generate affiliate link, gunakan url asli:', err);
    }
    return product.product_url;
  };

  // Send to Post Composer
  const handleSendToComposer = async (product, mediaOption = 'all', e) => {
    e?.stopPropagation();
    setGeneratingAffiliateForId(product.id);

    try {
      const affiliateLink = await getOrGenerateAffiliateLink(product);

      // Promo caption template
      let captionText = `🔥 REKOMENDASI PRODUK POPULER 🔥\n\n${product.title}\n\n`;
      if (product.price) {
        captionText += `💰 Harga: ${formatRupiah(product.price)}`;
        if (product.original_price && product.original_price > product.price) {
          captionText += ` (Diskon ${product.discount || ''} dari ${formatRupiah(product.original_price)})`;
        }
        captionText += '\n';
      }
      if (product.rating) {
        captionText += `⭐ Rating: ${product.rating} / 5.0 ${product.sold_count ? `(${product.sold_count})` : ''}\n`;
      }
      if (product.shop_name) {
        captionText += `🏬 Toko: ${product.shop_name} ${product.shop_location ? `(${product.shop_location})` : ''}\n`;
      }

      captionText += `\n👉 Cek detail & beli di sini:\n${affiliateLink || product.product_url}\n\n#rekomendasishopee #shopeehaul #racunshopee #affiliateshopee`;

      // Build mediaList
      let mediaItems = [];
      const hasVideos = product.videos && product.videos.length > 0;
      const hasImages = product.images && product.images.length > 0;

      if (mediaOption === 'video_only' && hasVideos) {
        mediaItems = product.videos.map((v) => ({ url: typeof v === 'string' ? v : v.url, type: 'video' }));
      } else if (mediaOption === 'primary_only' && hasImages) {
        mediaItems = [{ url: product.images[0], type: 'image' }];
      } else {
        // All media
        if (hasVideos) {
          product.videos.forEach((v) => {
            if (v) mediaItems.push({ url: typeof v === 'string' ? v : v.url, type: 'video' });
          });
        }
        if (hasImages) {
          product.images.forEach((img) => {
            if (img) mediaItems.push({ url: typeof img === 'string' ? img : img.url, type: 'image' });
          });
        }
      }

      if (mediaItems.length === 0 && product.media && product.media.length > 0) {
        mediaItems = product.media;
      }

      if (onSendToComposer) {
        onSendToComposer({
          title: product.title,
          content: captionText,
          mediaList: mediaItems,
          mediaUrl: mediaItems[0]?.url || '',
          mediaType: mediaItems[0]?.type || 'image',
          productUrl: product.product_url,
          affiliateUrl: affiliateLink
        });
      }
    } catch (err) {
      console.error('Error preparing post for composer:', err);
      alert('Terjadi kesalahan saat memproses data postingan.');
    } finally {
      setGeneratingAffiliateForId(null);
    }
  };

  // Open detail modal
  const openDetailModal = (product) => {
    setSelectedProductDetail(product);
    setActiveDetailMediaIndex(0);
    if (product.videos && product.videos.length > 0) {
      setActiveDetailMediaType('video');
    } else {
      setActiveDetailMediaType('image');
    }
  };

  // Copy text helper
  const copyToClipboard = (key, text) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedId(key);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Handle Import JSON from Shopee Scraper
  const handleImportJson = async () => {
    if (!importJsonText.trim()) return;
    setImporting(true);
    setImportError(null);

    try {
      let parsed = JSON.parse(importJsonText.trim());
      if (!Array.isArray(parsed)) {
        if (parsed.products && Array.isArray(parsed.products)) parsed = parsed.products;
        else if (parsed.items && Array.isArray(parsed.items)) parsed = parsed.items;
        else if (parsed.data && Array.isArray(parsed.data)) parsed = parsed.data;
        else parsed = [parsed];
      }

      const res = await api.post('/affiliate-products/bulk', parsed);
      if (res.data.success) {
        showToast(`Berhasil mengimpor ${res.data.imported_count || parsed.length} produk!`);
        setShowImportModal(false);
        setImportJsonText('');
        fetchProducts();
      } else {
        setImportError(res.data.error || 'Gagal mengimpor produk.');
      }
    } catch (err) {
      console.error('Error importing JSON:', err);
      setImportError('Format JSON tidak valid. Pastikan Anda mengunggah atau mem-paste JSON yang benar.');
    } finally {
      setImporting(false);
    }
  };

  // Handle File Upload for JSON import
  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result;
      if (typeof content === 'string') {
        setImportJsonText(content);
        try {
          const parsed = JSON.parse(content);
          const count = Array.isArray(parsed) ? parsed.length : 1;
          setImportPreviewCount(count);
        } catch (err) {
          setImportPreviewCount(0);
        }
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 text-left animate-in fade-in duration-300 pb-16">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-5 py-3.5 rounded-2xl bg-indigo-600 text-white shadow-2xl shadow-indigo-500/40 border border-indigo-400/30 text-sm font-semibold animate-in slide-in-from-bottom-5">
          <CheckCircle2 className="w-5 h-5 text-emerald-300" />
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-slate-900/80 border border-slate-800/80 p-6 rounded-3xl backdrop-blur-md">
        <div>
          <div className="flex items-center gap-3 mb-1.5">
            <div className="p-2.5 bg-gradient-to-tr from-orange-500 via-pink-500 to-indigo-600 rounded-2xl shadow-lg shadow-orange-500/20 text-white">
              <ShoppingBag className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2">
                <span>Produk Affiliate</span>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-orange-500/20 border border-orange-500/30 text-orange-400 font-bold">
                  {products.length} Produk
                </span>
              </h1>
              <p className="text-xs text-slate-400">
                Pusat katalog & materi promosi (Foto HD, Video MP4, Judul, Deskripsi, Link Affiliate & Toko)
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => {
              setEditingProduct(null);
              setShowAddEditModal(true);
            }}
            className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-2 border border-slate-700 transition-all active:scale-[0.98]"
          >
            <Plus className="w-4 h-4 text-indigo-400" />
            <span>Tambah Manual</span>
          </button>

          <button
            onClick={() => {
              setImportJsonText('');
              setImportError(null);
              setImportPreviewCount(0);
              setShowImportModal(true);
            }}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-orange-500/25 transition-all active:scale-[0.98]"
          >
            <FolderDown className="w-4 h-4" />
            <span>Import Shopee Scraper</span>
          </button>

          <button
            onClick={fetchProducts}
            disabled={loading}
            className="p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-slate-200 border border-slate-700 transition-all"
            title="Refresh Data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-indigo-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Search, Filter & View Controls */}
      <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        {/* Search Bar */}
        <form onSubmit={handleSearchSubmit} className="relative flex-1 min-w-[240px]">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari judul, toko, kota, deskripsi..."
            className="w-full bg-slate-950/90 border border-slate-800 text-slate-100 text-xs rounded-xl pl-10 pr-10 py-2.5 focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 placeholder:text-slate-600 outline-none transition-all"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setTimeout(fetchProducts, 0);
              }}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-slate-300"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </form>

        {/* Filter Badges & Selects */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Media Type Filter */}
          <div className="flex items-center bg-slate-950 border border-slate-800 rounded-xl p-1 text-xs">
            <button
              onClick={() => setSelectedMediaType('all')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                selectedMediaType === 'all'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Semua Media
            </button>
            <button
              onClick={() => setSelectedMediaType('video')}
              className={`px-3 py-1.5 rounded-lg font-medium flex items-center gap-1.5 transition-all ${
                selectedMediaType === 'video'
                  ? 'bg-orange-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Film className="w-3.5 h-3.5 text-orange-400" />
              <span>Ada Video</span>
            </button>
            <button
              onClick={() => setSelectedMediaType('image')}
              className={`px-3 py-1.5 rounded-lg font-medium flex items-center gap-1.5 transition-all ${
                selectedMediaType === 'image'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <ImageIcon className="w-3.5 h-3.5 text-indigo-400" />
              <span>Foto Saja</span>
            </button>
          </div>

          {/* Sort Select */}
          <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-300">
            <ArrowUpDown className="w-3.5 h-3.5 text-indigo-400" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-transparent text-slate-200 text-xs outline-none cursor-pointer pr-2"
            >
              <option value="newest" className="bg-slate-900">Terbaru</option>
              <option value="oldest" className="bg-slate-900">Terlama</option>
              <option value="price_asc" className="bg-slate-900">Harga Terendah</option>
              <option value="price_desc" className="bg-slate-900">Harga Tertinggi</option>
              <option value="rating" className="bg-slate-900">Rating Tertinggi</option>
            </select>
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center bg-slate-950 border border-slate-800 rounded-xl p-1 text-slate-400">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-slate-800 text-white' : 'hover:text-slate-200'}`}
              title="Grid View"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-lg transition-all ${viewMode === 'list' ? 'bg-slate-800 text-white' : 'hover:text-slate-200'}`}
              title="List View"
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="py-24 text-center flex flex-col items-center justify-center gap-3">
          <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
          <p className="text-sm font-semibold text-slate-400">Memuat Katalog Produk Affiliate...</p>
        </div>
      ) : errorMsg ? (
        <div className="p-6 bg-red-500/10 border border-red-500/20 rounded-3xl text-center space-y-2">
          <AlertCircle className="w-8 h-8 mx-auto text-red-400" />
          <p className="text-sm font-bold text-red-300">Gagal Memuat Produk</p>
          <p className="text-xs text-red-400/80">{errorMsg}</p>
        </div>
      ) : products.length === 0 ? (
        <div className="py-20 px-4 text-center bg-slate-900/40 border border-slate-800/80 rounded-3xl space-y-4">
          <div className="w-16 h-16 mx-auto rounded-3xl bg-slate-800/60 border border-slate-700 flex items-center justify-center text-slate-500">
            <ShoppingBag className="w-8 h-8" />
          </div>
          <div className="max-w-md mx-auto space-y-1.5">
            <h3 className="text-base font-bold text-white">Belum Ada Produk Affiliate</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Anda dapat mengimpor produk langsung dari hasil ekspor <b>Shopee Scraper</b> atau menambahkannya secara manual.
            </p>
          </div>
          <div className="flex justify-center gap-3 pt-2">
            <button
              onClick={() => setShowImportModal(true)}
              className="px-5 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-orange-600/20 transition-all"
            >
              <FolderDown className="w-4 h-4" />
              <span>Import dari Shopee Scraper</span>
            </button>
            <button
              onClick={() => {
                setEditingProduct(null);
                setShowAddEditModal(true);
              }}
              className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-2 border border-slate-700 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Produk Manual</span>
            </button>
          </div>
        </div>
      ) : viewMode === 'grid' ? (
        /* GRID CARDS VIEW */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {products.map((product) => {
            const hasVideo = (product.videos && product.videos.length > 0) || Boolean(product.product_video);
            const coverImage = product.images?.[0] || product.media?.[0]?.url || 'https://via.placeholder.com/300?text=No+Image';
            const isGeneratingAff = generatingAffiliateForId === product.id;

            return (
              <div
                key={product.id}
                onClick={() => openDetailModal(product)}
                className="group bg-slate-900/70 hover:bg-slate-900 border border-slate-800/80 hover:border-indigo-500/50 rounded-3xl overflow-hidden transition-all duration-300 hover:shadow-2xl hover:shadow-indigo-500/10 flex flex-col justify-between cursor-pointer relative"
              >
                {/* Media Thumbnail Box */}
                <div className="relative aspect-square w-full bg-slate-950 overflow-hidden">
                  <img
                    src={coverImage}
                    alt={product.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    loading="lazy"
                    onError={(e) => {
                      e.target.src = 'https://via.placeholder.com/300?text=No+Image';
                    }}
                  />

                  {/* Gradient Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-black/30 pointer-events-none" />

                  {/* Top Badges */}
                  <div className="absolute top-3 left-3 right-3 flex items-center justify-between gap-1 pointer-events-none">
                    {/* Media Indicator */}
                    <div className="flex items-center gap-1.5">
                      {hasVideo && (
                        <span className="flex items-center gap-1 px-2 py-1 rounded-lg bg-orange-600/90 text-white text-[10px] font-bold shadow-md backdrop-blur-md">
                          <Film className="w-3 h-3" />
                          <span>VIDEO</span>
                        </span>
                      )}
                      {product.images && product.images.length > 1 && (
                        <span className="flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-900/80 text-slate-200 text-[10px] font-bold shadow-md backdrop-blur-md border border-slate-700/50">
                          <ImageIcon className="w-3 h-3 text-indigo-400" />
                          <span>{product.images.length} Foto</span>
                        </span>
                      )}
                    </div>

                    {/* Discount Badge */}
                    {product.discount && (
                      <span className="px-2 py-1 rounded-lg bg-red-600 text-white text-[10px] font-extrabold shadow-md">
                        {product.discount}
                      </span>
                    )}
                  </div>

                  {/* Rating & Sold overlay */}
                  <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-[11px] text-slate-300 pointer-events-none">
                    {product.rating ? (
                      <span className="flex items-center gap-1 bg-slate-950/80 px-2 py-0.5 rounded-md border border-slate-800 text-amber-400 font-bold backdrop-blur-md">
                        <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                        <span>{product.rating}</span>
                      </span>
                    ) : <span />}

                    {product.sold_count && (
                      <span className="bg-slate-950/80 px-2 py-0.5 rounded-md border border-slate-800 text-slate-300 font-medium backdrop-blur-md">
                        {product.sold_count}
                      </span>
                    )}
                  </div>
                </div>

                {/* Card Body */}
                <div className="p-4 flex-1 flex flex-col justify-between gap-3">
                  <div>
                    {/* Store Info */}
                    {product.shop_name && (
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mb-1">
                        <Store className="w-3 h-3 text-orange-400" />
                        <span className="font-semibold truncate text-slate-300">{product.shop_name}</span>
                        {product.shop_location && (
                          <span className="text-slate-500 text-[10px] truncate">• {product.shop_location}</span>
                        )}
                      </div>
                    )}

                    {/* Product Title */}
                    <h3 className="text-xs font-bold text-slate-100 line-clamp-2 leading-relaxed group-hover:text-indigo-300 transition-colors">
                      {product.title}
                    </h3>
                  </div>

                  {/* Price Block */}
                  <div className="pt-2 border-t border-slate-800/80 flex items-baseline justify-between gap-2">
                    <div>
                      <span className="text-sm font-extrabold text-orange-400">
                        {formatRupiah(product.price)}
                      </span>
                      {product.original_price && product.original_price > product.price && (
                        <span className="block text-[10px] text-slate-500 line-through">
                          {formatRupiah(product.original_price)}
                        </span>
                      )}
                    </div>

                    {product.category && (
                      <span className="text-[10px] bg-slate-800/80 text-slate-400 px-2 py-0.5 rounded-md truncate max-w-[90px]">
                        {product.category}
                      </span>
                    )}
                  </div>
                </div>

                {/* Quick Action Footer */}
                <div className="p-3 bg-slate-950/60 border-t border-slate-800/80 flex items-center justify-between gap-1.5">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      openDetailModal(product);
                    }}
                    className="flex-1 py-1.5 px-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1 transition-all"
                  >
                    <Eye className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Detail</span>
                  </button>

                  <button
                    onClick={(e) => handleSendToComposer(product, 'all', e)}
                    disabled={isGeneratingAff}
                    className="flex-1 py-1.5 px-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-[11px] font-bold flex items-center justify-center gap-1 shadow-md shadow-indigo-600/20 transition-all active:scale-[0.98]"
                    title="Kirim ke Post Composer"
                  >
                    {isGeneratingAff ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Share2 className="w-3.5 h-3.5" />
                    )}
                    <span>Posting</span>
                  </button>

                  <button
                    onClick={(e) => handleDeleteProduct(product.id, e)}
                    className="p-1.5 hover:bg-red-500/20 text-slate-500 hover:text-red-400 rounded-xl transition-all"
                    title="Hapus Produk"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* LIST TABLE VIEW */
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-3xl overflow-hidden backdrop-blur-md">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/80 text-slate-400 uppercase text-[10px] font-bold tracking-wider border-b border-slate-800">
                <tr>
                  <th className="p-4">Produk</th>
                  <th className="p-4">Harga</th>
                  <th className="p-4">Toko & Lokasi</th>
                  <th className="p-4">Media</th>
                  <th className="p-4">Rating / Terjual</th>
                  <th className="p-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {products.map((product) => {
                  const coverImage = product.images?.[0] || product.media?.[0]?.url || 'https://via.placeholder.com/100?text=No+Img';
                  const isGeneratingAff = generatingAffiliateForId === product.id;

                  return (
                    <tr
                      key={product.id}
                      onClick={() => openDetailModal(product)}
                      className="hover:bg-slate-800/40 cursor-pointer transition-colors"
                    >
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <img
                            src={coverImage}
                            alt=""
                            className="w-12 h-12 rounded-xl object-cover bg-slate-950 border border-slate-800 shrink-0"
                          />
                          <div className="min-w-0 max-w-md">
                            <p className="font-bold text-slate-100 line-clamp-1 hover:text-indigo-400">
                              {product.title}
                            </p>
                            {product.category && (
                              <span className="text-[10px] text-slate-500">{product.category}</span>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="p-4">
                        <span className="font-extrabold text-orange-400 text-sm">
                          {formatRupiah(product.price)}
                        </span>
                        {product.discount && (
                          <span className="ml-1.5 px-1.5 py-0.5 bg-red-500/20 text-red-400 text-[10px] font-bold rounded">
                            {product.discount}
                          </span>
                        )}
                      </td>

                      <td className="p-4">
                        <p className="font-semibold text-slate-200">{product.shop_name || '-'}</p>
                        <p className="text-slate-500 text-[10px]">{product.shop_location || '-'}</p>
                      </td>

                      <td className="p-4">
                        <div className="flex items-center gap-1.5">
                          {product.videos?.length > 0 && (
                            <span className="px-2 py-0.5 rounded bg-orange-600/20 text-orange-400 text-[10px] font-bold border border-orange-500/30">
                              Video
                            </span>
                          )}
                          <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-400 text-[10px] font-bold">
                            {product.images?.length || 0} Foto
                          </span>
                        </div>
                      </td>

                      <td className="p-4">
                        <div className="flex items-center gap-1 text-amber-400 font-bold">
                          <Star className="w-3 h-3 fill-amber-400" />
                          <span>{product.rating || '5.0'}</span>
                        </div>
                        <p className="text-[10px] text-slate-500">{product.sold_count || '0 terjual'}</p>
                      </td>

                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => openDetailModal(product)}
                            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs"
                            title="Lihat Detail"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={(e) => handleSendToComposer(product, 'all', e)}
                            disabled={isGeneratingAff}
                            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-md shadow-indigo-600/20"
                          >
                            {isGeneratingAff ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Share2 className="w-3.5 h-3.5" />
                            )}
                            <span>Posting</span>
                          </button>
                          <button
                            onClick={(e) => handleDeleteProduct(product.id, e)}
                            className="p-2 hover:bg-red-500/20 text-slate-500 hover:text-red-400 rounded-lg"
                            title="Hapus"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* RICH DETAIL MODAL                                                        */}
      {/* ========================================================================= */}
      {selectedProductDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-md overflow-y-auto animate-in fade-in">
          <div className="relative w-full max-w-5xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col my-auto max-h-[92vh]">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60 shrink-0">
              <div className="flex items-center gap-2.5 min-w-0 pr-4">
                <div className="p-2 bg-orange-500/20 border border-orange-500/30 rounded-xl text-orange-400">
                  <ShoppingBag className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-white truncate">{selectedProductDetail.title}</h3>
                  <p className="text-[11px] text-slate-400">Detail Produk & Galeri Media Affiliate</p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => {
                    setEditingProduct(selectedProductDetail);
                    setShowAddEditModal(true);
                  }}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 border border-slate-700 transition-all"
                >
                  <Edit3 className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Edit</span>
                </button>

                <button
                  onClick={() => setSelectedProductDetail(null)}
                  className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body Grid */}
            <div className="p-5 sm:p-6 overflow-y-auto grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1">
              {/* LEFT COLUMN: Media Gallery & Player (5 Cols) */}
              <div className="lg:col-span-5 space-y-4">
                {/* Media Type Switcher */}
                <div className="flex items-center gap-2 p-1 bg-slate-950 border border-slate-800 rounded-xl text-xs">
                  <button
                    onClick={() => {
                      setActiveDetailMediaType('image');
                      setActiveDetailMediaIndex(0);
                    }}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg font-bold transition-all ${
                      activeDetailMediaType === 'image'
                        ? 'bg-indigo-600 text-white shadow'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <ImageIcon className="w-3.5 h-3.5" />
                    <span>Foto ({selectedProductDetail.images?.length || 0})</span>
                  </button>

                  <button
                    onClick={() => {
                      setActiveDetailMediaType('video');
                      setActiveDetailMediaIndex(0);
                    }}
                    disabled={!selectedProductDetail.videos || selectedProductDetail.videos.length === 0}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg font-bold transition-all disabled:opacity-30 disabled:cursor-not-allowed ${
                      activeDetailMediaType === 'video'
                        ? 'bg-orange-600 text-white shadow'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Film className="w-3.5 h-3.5" />
                    <span>Video ({selectedProductDetail.videos?.length || 0})</span>
                  </button>
                </div>

                {/* Main Media Stage */}
                <div className="relative aspect-square w-full bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden flex items-center justify-center group shadow-inner">
                  {activeDetailMediaType === 'video' && selectedProductDetail.videos?.[activeDetailMediaIndex] ? (
                    <video
                      key={selectedProductDetail.videos[activeDetailMediaIndex]}
                      src={
                        typeof selectedProductDetail.videos[activeDetailMediaIndex] === 'string'
                          ? selectedProductDetail.videos[activeDetailMediaIndex]
                          : selectedProductDetail.videos[activeDetailMediaIndex].url
                      }
                      controls
                      autoPlay
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <img
                      src={
                        selectedProductDetail.images?.[activeDetailMediaIndex] ||
                        'https://via.placeholder.com/500?text=No+Image'
                      }
                      alt={selectedProductDetail.title}
                      className="w-full h-full object-contain"
                    />
                  )}

                  {/* Floating Media Action Toolbar */}
                  <div className="absolute top-3 right-3 flex items-center gap-1.5 opacity-90 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => {
                        const currentUrl =
                          activeDetailMediaType === 'video'
                            ? selectedProductDetail.videos?.[activeDetailMediaIndex]
                            : selectedProductDetail.images?.[activeDetailMediaIndex];
                        copyToClipboard('media_url', typeof currentUrl === 'string' ? currentUrl : currentUrl?.url);
                      }}
                      className="p-2 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-slate-200 border border-slate-700/80 shadow-lg text-xs flex items-center gap-1"
                      title="Salin URL Media"
                    >
                      {copiedId === 'media_url' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>

                    <a
                      href={
                        activeDetailMediaType === 'video'
                          ? selectedProductDetail.videos?.[activeDetailMediaIndex]
                          : selectedProductDetail.images?.[activeDetailMediaIndex]
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-slate-200 border border-slate-700/80 shadow-lg text-xs"
                      title="Buka Media di Tab Baru"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>

                {/* Thumbnails Slider (for photos) */}
                {activeDetailMediaType === 'image' && selectedProductDetail.images?.length > 1 && (
                  <div className="flex items-center gap-2 overflow-x-auto pb-2">
                    {selectedProductDetail.images.map((img, idx) => (
                      <button
                        key={idx}
                        onClick={() => setActiveDetailMediaIndex(idx)}
                        className={`relative w-16 h-16 rounded-xl overflow-hidden border-2 shrink-0 transition-all ${
                          activeDetailMediaIndex === idx
                            ? 'border-indigo-500 scale-95 shadow-md shadow-indigo-500/20'
                            : 'border-slate-800 hover:border-slate-600 opacity-70 hover:opacity-100'
                        }`}
                      >
                        <img src={img} alt="" className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* RIGHT COLUMN: Product Information & Controls (7 Cols) */}
              <div className="lg:col-span-7 space-y-4">
                {/* Title & Copy */}
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="text-base sm:text-lg font-bold text-white leading-snug">
                      {selectedProductDetail.title}
                    </h2>
                    <button
                      onClick={() => copyToClipboard('title', selectedProductDetail.title)}
                      className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 rounded-lg shrink-0"
                      title="Salin Judul"
                    >
                      {copiedId === 'title' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>

                  {/* Badges Bar */}
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    {selectedProductDetail.category && (
                      <span className="px-2.5 py-0.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold">
                        {selectedProductDetail.category}
                      </span>
                    )}

                    {selectedProductDetail.rating && (
                      <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-bold">
                        <Star className="w-3.5 h-3.5 fill-amber-400" />
                        <span>{selectedProductDetail.rating}</span>
                      </span>
                    )}

                    {selectedProductDetail.sold_count && (
                      <span className="px-2.5 py-0.5 rounded-lg bg-slate-800 text-slate-300 text-xs">
                        {selectedProductDetail.sold_count}
                      </span>
                    )}
                  </div>
                </div>

                {/* Price Section */}
                <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-2xl flex items-baseline justify-between gap-3">
                  <div>
                    <span className="text-2xl font-black text-orange-400">
                      {formatRupiah(selectedProductDetail.price)}
                    </span>
                    {selectedProductDetail.original_price && selectedProductDetail.original_price > selectedProductDetail.price && (
                      <span className="ml-2 text-xs text-slate-500 line-through">
                        {formatRupiah(selectedProductDetail.original_price)}
                      </span>
                    )}
                  </div>

                  {selectedProductDetail.discount && (
                    <span className="px-2.5 py-1 bg-red-600 text-white font-extrabold text-xs rounded-xl shadow">
                      {selectedProductDetail.discount}
                    </span>
                  )}
                </div>

                {/* Store Information */}
                {selectedProductDetail.shop_name && (
                  <div className="p-3.5 bg-slate-950/60 border border-slate-800 rounded-xl flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-orange-500/20 border border-orange-500/30 flex items-center justify-center text-orange-400 font-bold">
                        {selectedProductDetail.shop_name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-bold text-slate-200">{selectedProductDetail.shop_name}</p>
                        {selectedProductDetail.shop_location && (
                          <p className="text-slate-400 text-[11px] flex items-center gap-1 mt-0.5">
                            <MapPin className="w-3 h-3 text-slate-500" />
                            <span>{selectedProductDetail.shop_location}</span>
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Product Variants (if any) */}
                {selectedProductDetail.variants && selectedProductDetail.variants.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-xs font-bold text-slate-400 flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-indigo-400" />
                      <span>Varian ({selectedProductDetail.variants.length})</span>
                    </p>
                    <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                      {selectedProductDetail.variants.map((v, i) => (
                        <span
                          key={i}
                          className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-[11px] text-slate-300 font-medium"
                        >
                          {typeof v === 'string' ? v : v.name || v.title}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Links Box */}
                <div className="space-y-2 p-3.5 bg-slate-950/80 border border-slate-800 rounded-2xl text-xs">
                  {/* Product URL */}
                  {selectedProductDetail.product_url && (
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-slate-400 font-medium flex items-center gap-1 shrink-0">
                        <LinkIcon className="w-3.5 h-3.5 text-slate-500" />
                        <span>Link Produk:</span>
                      </span>
                      <div className="flex items-center gap-1.5 min-w-0">
                        <input
                          type="text"
                          readOnly
                          value={selectedProductDetail.product_url}
                          className="bg-slate-900 border border-slate-800 text-slate-300 text-[11px] rounded-lg px-2.5 py-1 w-48 sm:w-64 truncate outline-none"
                        />
                        <button
                          onClick={() => copyToClipboard('prod_url', selectedProductDetail.product_url)}
                          className="p-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg"
                          title="Salin Link Produk"
                        >
                          {copiedId === 'prod_url' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                        <a
                          href={selectedProductDetail.product_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg"
                          title="Buka di Tab Baru"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    </div>
                  )}

                  {/* Affiliate URL */}
                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-800/80">
                    <span className="text-orange-400 font-bold flex items-center gap-1 shrink-0">
                      <Sparkles className="w-3.5 h-3.5 text-orange-400" />
                      <span>Link Affiliate:</span>
                    </span>
                    <div className="flex items-center gap-1.5 min-w-0">
                      <input
                        type="text"
                        readOnly
                        value={selectedProductDetail.affiliate_url || 'Belum dibuat (Otomatis dibuat saat posting)'}
                        className={`bg-slate-900 border text-[11px] rounded-lg px-2.5 py-1 w-48 sm:w-64 truncate outline-none ${
                          selectedProductDetail.affiliate_url
                            ? 'border-orange-500/40 text-orange-300'
                            : 'border-slate-800 text-slate-500 italic'
                        }`}
                      />
                      {selectedProductDetail.affiliate_url && (
                        <>
                          <button
                            onClick={() => copyToClipboard('aff_url', selectedProductDetail.affiliate_url)}
                            className="p-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg"
                            title="Salin Link Affiliate"
                          >
                            {copiedId === 'aff_url' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                          <a
                            href={selectedProductDetail.affiliate_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg"
                            title="Buka Link Affiliate"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Description */}
                {selectedProductDetail.description && (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-bold text-slate-400 flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-slate-400" />
                        <span>Deskripsi Produk</span>
                      </p>
                      <button
                        onClick={() => copyToClipboard('desc', selectedProductDetail.description)}
                        className="text-[11px] font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                      >
                        {copiedId === 'desc' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>Salin Deskripsi</span>
                      </button>
                    </div>

                    <div className="text-xs text-slate-300 leading-relaxed bg-slate-950/80 p-3.5 rounded-xl border border-slate-800 max-h-36 overflow-y-auto whitespace-pre-wrap">
                      {selectedProductDetail.description}
                    </div>
                  </div>
                )}

                {/* Action Buttons Toolbar */}
                <div className="pt-3 border-t border-slate-800 flex flex-wrap gap-2.5">
                  <button
                    onClick={() => handleSendToComposer(selectedProductDetail, 'all')}
                    disabled={generatingAffiliateForId === selectedProductDetail.id}
                    className="flex-1 min-w-[200px] py-3 px-4 bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
                  >
                    {generatingAffiliateForId === selectedProductDetail.id ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Membuat Link & Postingan...</span>
                      </>
                    ) : (
                      <>
                        <Share2 className="w-4 h-4" />
                        <span>KIRIM KE BUAT POSTINGAN (SEMUA MEDIA)</span>
                      </>
                    )}
                  </button>

                  {onSendToAffiliate && selectedProductDetail.product_url && (
                    <button
                      onClick={() => {
                        onSendToAffiliate(selectedProductDetail.product_url);
                        setSelectedProductDetail(null);
                      }}
                      className="py-3 px-4 bg-slate-800 hover:bg-slate-700 text-orange-400 rounded-xl text-xs font-bold flex items-center justify-center gap-2 border border-slate-700 transition-all"
                    >
                      <Sparkles className="w-4 h-4" />
                      <span>Generator Link</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* IMPORT FROM SHOPEE SCRAPER MODAL                                         */}
      {/* ========================================================================= */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in">
          <div className="relative w-full max-w-xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-orange-500/20 border border-orange-500/30 rounded-xl text-orange-400">
                  <FolderDown className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Import dari Shopee Scraper</h3>
                  <p className="text-[11px] text-slate-400">Unggah atau paste data JSON hasil ekspor Shopee Scraper</p>
                </div>
              </div>
              <button
                onClick={() => setShowImportModal(false)}
                className="p-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* File Upload Drop Area */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-2">
                  1. Pilih File JSON (.json) Hasil Ekspor
                </label>
                <input
                  type="file"
                  accept=".json,application/json"
                  onChange={handleFileUpload}
                  className="w-full text-xs text-slate-400 file:mr-3 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-indigo-600 file:text-white hover:file:bg-indigo-500 file:cursor-pointer bg-slate-950 p-2 rounded-xl border border-slate-800"
                />
              </div>

              <div className="relative flex py-1 items-center">
                <div className="flex-grow border-t border-slate-800"></div>
                <span className="flex-shrink mx-3 text-[11px] text-slate-500 font-bold uppercase">Atau Paste JSON</span>
                <div className="flex-grow border-t border-slate-800"></div>
              </div>

              {/* Textarea Paste */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-2">
                  2. Paste Konten JSON Produk
                </label>
                <textarea
                  value={importJsonText}
                  onChange={(e) => {
                    setImportJsonText(e.target.value);
                    try {
                      const p = JSON.parse(e.target.value);
                      setImportPreviewCount(Array.isArray(p) ? p.length : 1);
                    } catch {
                      setImportPreviewCount(0);
                    }
                  }}
                  placeholder='[ { "Product Name": "Bella Square...", "Price": "Rp 9.500", ... } ]'
                  rows={6}
                  className="w-full bg-slate-950 border border-slate-800 text-slate-100 text-xs rounded-xl p-3.5 font-mono focus:ring-2 focus:ring-orange-500/50 outline-none placeholder:text-slate-700"
                />
              </div>

              {/* Preview Info */}
              {importPreviewCount > 0 && (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center gap-2 text-emerald-400 text-xs font-semibold">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Terdeteksi {importPreviewCount} produk siap diimpor ke database Produk Affiliate!</span>
                </div>
              )}

              {/* Error Info */}
              {importError && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl flex items-center gap-2 text-red-400 text-xs">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{importError}</span>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-5 bg-slate-950/60 border-t border-slate-800 flex items-center justify-end gap-3">
              <button
                onClick={() => setShowImportModal(false)}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-all"
              >
                Batal
              </button>
              <button
                onClick={handleImportJson}
                disabled={!importJsonText.trim() || importing}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-orange-500/25 disabled:opacity-50 transition-all"
              >
                {importing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Mengimpor Data...</span>
                  </>
                ) : (
                  <>
                    <FolderDown className="w-4 h-4" />
                    <span>Impor Sekarang</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ADD / EDIT PRODUCT MODAL (MANUAL INPUT & MEDIA MANAGEMENT)                 */}
      {/* ========================================================================= */}
      {showAddEditModal && (
        <AddEditProductModal
          product={editingProduct}
          onClose={() => setShowAddEditModal(false)}
          onSaved={() => {
            setShowAddEditModal(false);
            fetchProducts();
            showToast(editingProduct ? 'Produk berhasil diperbarui!' : 'Produk berhasil ditambahkan!');
          }}
        />
      )}
    </div>
  );
}

// =============================================================================
// SUB-COMPONENT: Add/Edit Product Modal with Manual Media Uploader & URL Input
// =============================================================================
function AddEditProductModal({ product, onClose, onSaved }) {
  const isEdit = Boolean(product);

  const [title, setTitle] = useState(product?.title || '');
  const [price, setPrice] = useState(product?.price || '');
  const [originalPrice, setOriginalPrice] = useState(product?.original_price || '');
  const [discount, setDiscount] = useState(product?.discount || '');
  const [category, setCategory] = useState(product?.category || 'Umum');
  const [shopName, setShopName] = useState(product?.shop_name || '');
  const [shopLocation, setShopLocation] = useState(product?.shop_location || '');
  const [productUrl, setProductUrl] = useState(product?.product_url || '');
  const [affiliateUrl, setAffiliateUrl] = useState(product?.affiliate_url || '');
  const [rating, setRating] = useState(product?.rating || 5.0);
  const [soldCount, setSoldCount] = useState(product?.sold_count || '');
  const [description, setDescription] = useState(product?.description || '');

  // Media Manager state
  const [images, setImages] = useState(product?.images || []);
  const [videos, setVideos] = useState(product?.videos || []);
  const [newMediaUrl, setNewMediaUrl] = useState('');
  const [newMediaType, setNewMediaType] = useState('image'); // 'image' | 'video'
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Add media URL manually
  const handleAddMediaUrl = () => {
    if (!newMediaUrl.trim()) return;
    const url = newMediaUrl.trim();
    if (newMediaType === 'video') {
      setVideos((prev) => [...prev, url]);
    } else {
      setImages((prev) => [...prev, url]);
    }
    setNewMediaUrl('');
  };

  // Remove media
  const handleRemoveImage = (index) => {
    setImages((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleRemoveVideo = (index) => {
    setVideos((prev) => prev.filter((_, idx) => idx !== index));
  };

  // Upload local media file via Cloudinary (if configured)
  const handleUploadFile = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setUploading(true);
    for (const file of files) {
      const isVid = file.type.startsWith('video');
      const cloudName = isVid
        ? import.meta.env.VITE_CLOUDINARY_CLOUD_NAME_VIDEO
        : import.meta.env.VITE_CLOUDINARY_CLOUD_NAME_IMAGE;
      const uploadPreset = isVid
        ? import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET_VIDEO
        : import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET_IMAGE;

      if (!cloudName || !uploadPreset) {
        alert('Konfigurasi Cloudinary belum disetting di .env.local untuk upload file lokal.');
        setUploading(false);
        return;
      }

      const formData = new FormData();
      formData.append('file', file);
      formData.append('upload_preset', uploadPreset);

      try {
        const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/upload`, {
          method: 'POST',
          body: formData
        });
        const data = await res.json();
        if (data.secure_url) {
          if (isVid) {
            setVideos((prev) => [...prev, data.secure_url]);
          } else {
            setImages((prev) => [...prev, data.secure_url]);
          }
        }
      } catch (err) {
        console.error('Upload failed:', err);
        alert('Gagal mengunggah file.');
      }
    }
    setUploading(false);
  };

  // Submit Save
  const handleSave = async (e) => {
    e.preventDefault();
    if (!title.trim()) {
      alert('Judul produk wajib diisi.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        title: title.trim(),
        price,
        original_price: originalPrice || null,
        discount,
        category,
        shop_name: shopName,
        shop_location: shopLocation,
        product_url: productUrl,
        affiliate_url: affiliateUrl,
        rating: parseFloat(rating) || 5.0,
        sold_count: soldCount,
        description,
        images,
        videos
      };

      if (isEdit) {
        await api.put(`/affiliate-products/${product.id}`, payload);
      } else {
        await api.post('/affiliate-products', payload);
      }
      onSaved();
    } catch (err) {
      console.error('Error saving product:', err);
      alert('Gagal menyimpan produk: ' + (err.response?.data?.error || err.message));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto animate-in fade-in">
      <div className="relative w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col my-auto max-h-[92vh]">
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-500/20 border border-indigo-500/30 rounded-xl text-indigo-400">
              <Plus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">
                {isEdit ? 'Edit Data Produk Affiliate' : 'Tambah Produk Affiliate Baru'}
              </h3>
              <p className="text-[11px] text-slate-400">Kelola informasi produk dan materi media promosi</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSave} className="p-6 space-y-5 overflow-y-auto flex-1 text-xs">
          {/* Title */}
          <div>
            <label className="block font-bold text-slate-300 mb-1.5">Judul Produk *</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Contoh: Bella Square Hijab Segi Empat Polycotton..."
              className="w-full bg-slate-950 border border-slate-800 text-slate-100 rounded-xl p-3 focus:ring-2 focus:ring-indigo-500/50 outline-none"
            />
          </div>

          {/* Pricing Row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block font-bold text-slate-300 mb-1.5">Harga Jual (Rp) *</label>
              <input
                type="number"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="9500"
                className="w-full bg-slate-950 border border-slate-800 text-slate-100 rounded-xl p-3 focus:ring-2 focus:ring-indigo-500/50 outline-none"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-300 mb-1.5">Harga Asli (Coret)</label>
              <input
                type="number"
                value={originalPrice}
                onChange={(e) => setOriginalPrice(e.target.value)}
                placeholder="15000"
                className="w-full bg-slate-950 border border-slate-800 text-slate-100 rounded-xl p-3 focus:ring-2 focus:ring-indigo-500/50 outline-none"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-300 mb-1.5">Diskon (%)</label>
              <input
                type="text"
                value={discount}
                onChange={(e) => setDiscount(e.target.value)}
                placeholder="35%"
                className="w-full bg-slate-950 border border-slate-800 text-slate-100 rounded-xl p-3 focus:ring-2 focus:ring-indigo-500/50 outline-none"
              />
            </div>
          </div>

          {/* URLs Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-bold text-slate-300 mb-1.5">Link Produk Shopee</label>
              <input
                type="url"
                value={productUrl}
                onChange={(e) => setProductUrl(e.target.value)}
                placeholder="https://shopee.co.id/product/..."
                className="w-full bg-slate-950 border border-slate-800 text-slate-100 rounded-xl p-3 focus:ring-2 focus:ring-indigo-500/50 outline-none"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-300 mb-1.5">Link Affiliate (Opsional)</label>
              <input
                type="url"
                value={affiliateUrl}
                onChange={(e) => setAffiliateUrl(e.target.value)}
                placeholder="https://s.shopee.co.id/... (Otomatis jika kosong)"
                className="w-full bg-slate-950 border border-slate-800 text-slate-100 rounded-xl p-3 focus:ring-2 focus:ring-indigo-500/50 outline-none"
              />
            </div>
          </div>

          {/* Store & Category Row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block font-bold text-slate-300 mb-1.5">Nama Toko</label>
              <input
                type="text"
                value={shopName}
                onChange={(e) => setShopName(e.target.value)}
                placeholder="Official Store / Nama Seller"
                className="w-full bg-slate-950 border border-slate-800 text-slate-100 rounded-xl p-3 focus:ring-2 focus:ring-indigo-500/50 outline-none"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-300 mb-1.5">Lokasi Toko</label>
              <input
                type="text"
                value={shopLocation}
                onChange={(e) => setShopLocation(e.target.value)}
                placeholder="Jakarta Barat"
                className="w-full bg-slate-950 border border-slate-800 text-slate-100 rounded-xl p-3 focus:ring-2 focus:ring-indigo-500/50 outline-none"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-300 mb-1.5">Kategori</label>
              <input
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="Fashion Muslim / Gadget"
                className="w-full bg-slate-950 border border-slate-800 text-slate-100 rounded-xl p-3 focus:ring-2 focus:ring-indigo-500/50 outline-none"
              />
            </div>
          </div>

          {/* ================================================================= */}
          {/* MEDIA MANAGEMENT SECTION                                          */}
          {/* ================================================================= */}
          <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-2xl space-y-3">
            <label className="block font-bold text-indigo-400 text-xs flex items-center gap-1.5">
              <ImageIcon className="w-4 h-4" />
              <span>Kelola Galeri Media (Foto HD & Video MP4)</span>
            </label>

            {/* Add Media via URL Input */}
            <div className="flex gap-2">
              <select
                value={newMediaType}
                onChange={(e) => setNewMediaType(e.target.value)}
                className="bg-slate-900 border border-slate-800 text-slate-300 rounded-xl px-2.5 py-2 outline-none"
              >
                <option value="image">Foto (URL)</option>
                <option value="video">Video (URL)</option>
              </select>
              <input
                type="url"
                value={newMediaUrl}
                onChange={(e) => setNewMediaUrl(e.target.value)}
                placeholder="Paste URL foto/video CDN..."
                className="flex-1 bg-slate-900 border border-slate-800 text-slate-100 rounded-xl px-3 py-2 outline-none"
              />
              <button
                type="button"
                onClick={handleAddMediaUrl}
                className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold"
              >
                Tambah
              </button>
            </div>

            {/* Add Media via Upload Local File */}
            <div className="flex items-center gap-2 pt-1">
              <label className="cursor-pointer px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-medium flex items-center gap-2 border border-slate-700">
                <Upload className="w-3.5 h-3.5 text-indigo-400" />
                <span>Upload File dari Komputer</span>
                <input
                  type="file"
                  multiple
                  accept="image/*,video/*"
                  onChange={handleUploadFile}
                  className="hidden"
                />
              </label>
              {uploading && <span className="text-indigo-400 flex items-center gap-1"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Mengunggah...</span>}
            </div>

            {/* Previews List */}
            <div className="flex flex-wrap gap-2.5 pt-2">
              {/* Videos */}
              {videos.map((vid, idx) => (
                <div key={'vid-' + idx} className="relative w-20 h-20 rounded-xl bg-slate-900 border border-orange-500/40 overflow-hidden group">
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                    <Film className="w-6 h-6 text-orange-400" />
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveVideo(idx)}
                    className="absolute top-1 right-1 p-1 bg-red-600 text-white rounded-md shadow"
                    title="Hapus Video"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}

              {/* Images */}
              {images.map((img, idx) => (
                <div key={'img-' + idx} className="relative w-20 h-20 rounded-xl bg-slate-900 border border-slate-800 overflow-hidden group">
                  <img src={img} alt="" className="w-full h-full object-cover" />
                  {idx === 0 && (
                    <span className="absolute bottom-0 inset-x-0 bg-indigo-600 text-white text-[9px] font-bold text-center py-0.5">
                      Cover
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => handleRemoveImage(idx)}
                    className="absolute top-1 right-1 p-1 bg-red-600 text-white rounded-md shadow"
                    title="Hapus Foto"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block font-bold text-slate-300 mb-1.5">Deskripsi Produk</label>
            <textarea
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Spesifikasi, bahan, ukuran, dan keunggulan produk..."
              className="w-full bg-slate-950 border border-slate-800 text-slate-100 rounded-xl p-3 focus:ring-2 focus:ring-indigo-500/50 outline-none whitespace-pre-wrap"
            />
          </div>

          {/* Footer Actions */}
          <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold shadow-lg shadow-indigo-600/25 flex items-center gap-2"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              <span>{isEdit ? 'Simpan Perubahan' : 'Tambah Produk'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
