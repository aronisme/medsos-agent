import React, { useState } from 'react';
import {
  ShoppingBag,
  Link as LinkIcon,
  Sparkles,
  Loader2,
  Copy,
  Check,
  ExternalLink,
  Download,
  Play,
  Film,
  Image as ImageIcon,
  Star,
  Package,
  Layers,
  MapPin,
  Tag,
  Share2,
  FileText,
  AlertCircle,
  Clock,
  CheckCircle2,
  XCircle,
  HelpCircle,
  FolderArchive
} from 'lucide-react';
import api from '../api/client';

export default function ShopeeExtractor({ onSendToComposer, onSendToAffiliate }) {
  const [inputUrl, setInputUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [productData, setProductData] = useState(null);
  const [metaData, setMetaData] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [savedToBank, setSavedToBank] = useState(false);
  const [savingToBank, setSavingToBank] = useState(false);

  // Active media viewer state
  const [activeMediaType, setActiveMediaType] = useState('image'); // 'image' | 'video'
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [selectedVideoIndex, setSelectedVideoIndex] = useState(0);

  // Copy states
  const [copiedJson, setCopiedJson] = useState(false);
  const [copiedMediaUrl, setCopiedMediaUrl] = useState(false);

  // Description expand state
  const [descExpanded, setDescExpanded] = useState(false);

  const handleExtract = async (overrideUrl) => {
    const targetUrl = overrideUrl || inputUrl;
    if (!targetUrl || !targetUrl.trim()) return;

    setLoading(true);
    setErrorMsg(null);
    setProductData(null);
    setMetaData(null);

    try {
      const response = await api.post('/shopee/extract', {
        url: targetUrl.trim()
      });

      if (response.data.success && response.data.data) {
        setProductData(response.data.data);
        setMetaData(response.data.meta);
        setSelectedImageIndex(0);
        setSelectedVideoIndex(0);
        // Default to video if available, otherwise image
        if (response.data.data.videos && response.data.data.videos.length > 0) {
          setActiveMediaType('video');
        } else {
          setActiveMediaType('image');
        }
      } else {
        setErrorMsg(response.data.error?.message || 'Gagal mengekstrak data produk.');
      }
    } catch (err) {
      console.error('Extraction error:', err);
      const errMsg = err.response?.data?.error?.message || err.message || 'Gagal terhubung ke server extractor.';
      setErrorMsg(errMsg);
    } finally {
      setLoading(false);
    }
  };

  const copyJsonToClipboard = () => {
    if (!productData) return;
    navigator.clipboard.writeText(JSON.stringify(productData, null, 2));
    setCopiedJson(true);
    setTimeout(() => setCopiedJson(false), 2000);
  };

  const copyMediaUrlToClipboard = (url) => {
    if (!url) return;
    navigator.clipboard.writeText(url);
    setCopiedMediaUrl(true);
    setTimeout(() => setCopiedMediaUrl(false), 2000);
  };

  const formatRupiah = (number) => {
    if (typeof number !== 'number' || isNaN(number)) return '-';
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0
    }).format(number);
  };

  const handleSaveToAffiliateProducts = async () => {
    if (!productData) return;
    setSavingToBank(true);
    try {
      await api.post('/affiliate-products', {
        title: productData.title,
        price: productData.price,
        original_price: productData.original_price,
        discount: productData.discount,
        rating: productData.shop?.rating || 5.0,
        shop_name: productData.shop?.name,
        shop_location: productData.shop?.location,
        product_url: productData.canonical_url || inputUrl,
        description: productData.description,
        images: productData.images || [],
        videos: productData.videos || [],
        variants: productData.variants || [],
        category: 'Shopee Extracted'
      });
      setSavedToBank(true);
      setTimeout(() => setSavedToBank(false), 3000);
    } catch (err) {
      console.error('Error saving to affiliate products:', err);
      alert('Gagal menyimpan ke Produk Affiliate: ' + (err.response?.data?.error || err.message));
    } finally {
      setSavingToBank(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
            <div className="p-2 bg-gradient-to-tr from-orange-500 to-amber-500 rounded-xl shadow-lg shadow-orange-500/20 text-white">
              <ShoppingBag className="w-6 h-6" />
            </div>
            Shopee Product Extractor
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Ambil judul, harga, diskon, galeri foto HD CDN, video MP4, varian, dan deskripsi hanya dengan paste link produk.
          </p>
        </div>
      </div>

      {/* Input Box Card */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 md:p-6 shadow-xl relative overflow-hidden backdrop-blur-sm">
        <div className="absolute top-0 right-0 w-80 h-80 bg-orange-500/5 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />

        <div className="space-y-4 relative">
          <label className="block text-sm font-semibold text-slate-200">
            Paste URL Produk Shopee (Desktop, Mobile, atau Shortlink)
          </label>

          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                <LinkIcon className="w-4 h-4" />
              </div>
              <input
                type="text"
                value={inputUrl}
                onChange={(e) => setInputUrl(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleExtract()}
                placeholder="https://shopee.co.id/product/... atau https://s.shopee.co.id/..."
                className="w-full bg-slate-950/80 border border-slate-800 text-slate-100 text-sm rounded-xl focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 pl-10 pr-4 py-3.5 placeholder:text-slate-600 transition-all outline-none"
              />
            </div>

            <button
              onClick={() => handleExtract()}
              disabled={!inputUrl.trim() || loading}
              className="flex items-center justify-center gap-2 bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 hover:from-orange-600 hover:to-amber-600 text-white font-bold px-6 py-3.5 rounded-xl shadow-lg shadow-orange-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] shrink-0"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Mengekstrak...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Ekstrak Data</span>
                </>
              )}
            </button>
          </div>

          {/* Error Message Alert */}
          {errorMsg && (
            <div className="flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm animate-in fade-in">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold">Ekstraksi Gagal</p>
                <p className="text-xs text-red-400/90 mt-0.5">{errorMsg}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Extracted Product Result */}
      {productData && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
          {/* Diagnostics Panel Bar */}
          {metaData && (
            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1.5 font-medium text-slate-300">
                  <Clock className="w-3.5 h-3.5 text-amber-400" />
                  Durasi: <strong className="text-white font-semibold">{metaData.duration_ms} ms</strong>
                </span>
                <span className="text-slate-600">|</span>
                <span className="flex items-center gap-1 text-slate-400">
                  Strategy: <span className="bg-slate-800 text-indigo-300 px-2 py-0.5 rounded-md font-mono">{metaData.strategy}</span>
                </span>
              </div>

              {/* Field Availability Badges */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-slate-400">Status Data:</span>
                {Object.entries(metaData.fields || {}).map(([key, isAvailable]) => (
                  <span
                    key={key}
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-medium capitalize ${
                      isAvailable
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : 'bg-slate-800/80 text-slate-500 border border-slate-700/50'
                    }`}
                  >
                    {isAvailable ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                    {key}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Main Product Display Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl grid grid-cols-1 lg:grid-cols-12 gap-0">
            {/* Media Gallery (Left Column - 5 cols) */}
            <div className="lg:col-span-5 p-5 md:p-6 bg-slate-950/50 border-b lg:border-b-0 lg:border-r border-slate-800 flex flex-col gap-4">
              {/* Media Type Switcher (Tabs) */}
              <div className="flex items-center gap-2 p-1 bg-slate-900 border border-slate-800 rounded-xl">
                <button
                  onClick={() => setActiveMediaType('image')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-semibold transition-all ${
                    activeMediaType === 'image'
                      ? 'bg-indigo-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <ImageIcon className="w-3.5 h-3.5" />
                  <span>Foto ({productData.images?.length || 0})</span>
                </button>
                <button
                  onClick={() => setActiveMediaType('video')}
                  disabled={!productData.videos || productData.videos.length === 0}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                    activeMediaType === 'video'
                      ? 'bg-orange-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Film className="w-3.5 h-3.5" />
                  <span>Video ({productData.videos?.length || 0})</span>
                </button>
              </div>

              {/* Main Media Viewer */}
              <div className="relative aspect-square w-full bg-slate-900 border border-slate-800 rounded-xl overflow-hidden flex items-center justify-center group">
                {activeMediaType === 'video' && productData.videos?.length > 0 ? (
                  <video
                    src={productData.videos[selectedVideoIndex]?.url}
                    poster={productData.videos[selectedVideoIndex]?.thumbnail || productData.images?.[0]}
                    controls
                    autoPlay
                    playsInline
                    className="w-full h-full object-contain bg-black"
                  />
                ) : (
                  <img
                    src={productData.images?.[selectedImageIndex] || '/placeholder.png'}
                    alt={productData.title || 'Product Image'}
                    className="w-full h-full object-contain p-2"
                  />
                )}

                {/* Direct Media Link & Download Overlay */}
                <div className="absolute top-3 right-3 flex items-center gap-2 opacity-90 transition-opacity">
                  {activeMediaType === 'video' && productData.videos?.[selectedVideoIndex] && (
                    <a
                      href={productData.videos[selectedVideoIndex].url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 bg-slate-950/80 hover:bg-slate-900 border border-slate-700 text-orange-400 rounded-lg shadow-md transition-colors"
                      title="Download / Buka Video Langsung"
                    >
                      <Download className="w-4 h-4" />
                    </a>
                  )}
                  {activeMediaType === 'image' && productData.images?.[selectedImageIndex] && (
                    <a
                      href={productData.images[selectedImageIndex]}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 bg-slate-950/80 hover:bg-slate-900 border border-slate-700 text-slate-300 hover:text-white rounded-lg shadow-md transition-colors"
                      title="Download / Buka Gambar HD"
                    >
                      <Download className="w-4 h-4" />
                    </a>
                  )}
                </div>
              </div>

              {/* Thumbnail Strip */}
              {activeMediaType === 'image' && productData.images?.length > 1 && (
                <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
                  {productData.images.map((imgUrl, idx) => (
                    <button
                      key={idx}
                      onClick={() => setSelectedImageIndex(idx)}
                      className={`relative w-16 h-16 rounded-lg overflow-hidden border-2 shrink-0 transition-all ${
                        selectedImageIndex === idx
                          ? 'border-orange-500 scale-105 shadow-md shadow-orange-500/20'
                          : 'border-slate-800 opacity-60 hover:opacity-100'
                      }`}
                    >
                      <img src={imgUrl} alt={`Thumb ${idx}`} className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}

              {/* Video Strip (if multiple) */}
              {activeMediaType === 'video' && productData.videos?.length > 1 && (
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {productData.videos.map((vid, idx) => (
                    <button
                      key={idx}
                      onClick={() => setSelectedVideoIndex(idx)}
                      className={`relative w-16 h-16 rounded-lg overflow-hidden border-2 shrink-0 transition-all ${
                        selectedVideoIndex === idx
                          ? 'border-orange-500 scale-105'
                          : 'border-slate-800 opacity-60 hover:opacity-100'
                      }`}
                    >
                      {vid.thumbnail ? (
                        <img src={vid.thumbnail} alt={`Video ${idx}`} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-slate-900 flex items-center justify-center text-orange-400">
                          <Play className="w-5 h-5" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Product Details (Right Column - 7 cols) */}
            <div className="lg:col-span-7 p-6 md:p-8 flex flex-col justify-between space-y-6">
              <div className="space-y-5">
                {/* Badges & Shop location */}
                <div className="flex flex-wrap items-center gap-2.5">
                  {productData.discount_percentage && (
                    <span className="px-2.5 py-1 bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-bold rounded-lg flex items-center gap-1">
                      <Tag className="w-3 h-3" />
                      Diskon {productData.discount_percentage}
                    </span>
                  )}
                  {productData.rating !== null && (
                    <span className="px-2.5 py-1 bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-semibold rounded-lg flex items-center gap-1">
                      <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                      {productData.rating} {productData.rating_count ? `(${productData.rating_count} ulasan)` : ''}
                    </span>
                  )}
                  {productData.sold_count !== null && (
                    <span className="px-2.5 py-1 bg-slate-800 text-slate-300 text-xs font-medium rounded-lg">
                      Terjual {productData.sold_count.toLocaleString('id-ID')}
                    </span>
                  )}
                  {productData.stock !== null && (
                    <span className="px-2.5 py-1 bg-slate-800 text-slate-300 text-xs font-medium rounded-lg flex items-center gap-1">
                      <Package className="w-3 h-3 text-slate-400" />
                      Stok: {productData.stock}
                    </span>
                  )}
                </div>

                {/* Title */}
                <div>
                  <h2 className="text-xl md:text-2xl font-bold text-white leading-snug">
                    {productData.title || 'Nama Produk Tidak Ditemukan'}
                  </h2>
                  <a
                    href={productData.canonical_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-orange-400 hover:text-orange-300 mt-2 font-medium transition-colors"
                  >
                    <span>Buka Produk di Shopee</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>

                {/* Price Box */}
                <div className="p-4 bg-slate-950/60 border border-slate-800/80 rounded-xl flex items-baseline gap-3">
                  <span className="text-3xl font-extrabold text-orange-400 tracking-tight">
                    {formatRupiah(productData.price)}
                  </span>
                  {productData.original_price && productData.original_price > productData.price && (
                    <span className="text-sm text-slate-500 line-through">
                      {formatRupiah(productData.original_price)}
                    </span>
                  )}
                </div>

                {/* Shop Card */}
                {productData.shop && (productData.shop.name || productData.shop.location) && (
                  <div className="p-3.5 bg-slate-900/60 border border-slate-800 rounded-xl flex items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-orange-500/20 border border-orange-500/30 flex items-center justify-center text-orange-400 font-bold">
                        {productData.shop.name ? productData.shop.name.charAt(0).toUpperCase() : 'S'}
                      </div>
                      <div>
                        <p className="font-semibold text-slate-200">{productData.shop.name || 'Shopee Seller'}</p>
                        {productData.shop.location && (
                          <p className="text-slate-400 flex items-center gap-1 mt-0.5">
                            <MapPin className="w-3 h-3 text-slate-500" />
                            {productData.shop.location}
                          </p>
                        )}
                      </div>
                    </div>
                    {productData.shop.rating && (
                      <span className="text-amber-400 font-semibold flex items-center gap-1">
                        <Star className="w-3 h-3 fill-amber-400" /> {productData.shop.rating}
                      </span>
                    )}
                  </div>
                )}

                {/* Variants List */}
                {productData.variants && productData.variants.length > 0 && (
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-indigo-400" />
                      Variasi Produk ({productData.variants.length})
                    </label>
                    <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto pr-1">
                      {productData.variants.map((v, i) => (
                        <div
                          key={i}
                          className="px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs flex items-center gap-2 text-slate-300"
                        >
                          <span className="font-medium">{v.name}</span>
                          {v.price && <span className="text-orange-400 font-semibold">{formatRupiah(v.price)}</span>}
                          {v.stock !== null && <span className="text-slate-500">({v.stock})</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Description Box */}
                {productData.description && (
                  <div className="space-y-2 border-t border-slate-800/80 pt-4">
                    <label className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-slate-400" />
                      Deskripsi Produk
                    </label>
                    <div
                      className={`text-xs text-slate-300 leading-relaxed bg-slate-950/40 p-3.5 rounded-xl border border-slate-800/50 whitespace-pre-line transition-all ${
                        descExpanded ? '' : 'max-h-28 overflow-hidden relative'
                      }`}
                    >
                      {productData.description}
                      {!descExpanded && (
                        <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-slate-950 to-transparent pointer-events-none" />
                      )}
                    </div>
                    <button
                      onClick={() => setDescExpanded(!descExpanded)}
                      className="text-xs font-semibold text-orange-400 hover:text-orange-300 transition-colors"
                    >
                      {descExpanded ? 'Sembunyikan Deskripsi' : 'Baca Selengkapnya...'}
                    </button>
                  </div>
                )}
              </div>

              {/* Action Buttons Toolbar */}
              <div className="pt-4 border-t border-slate-800 flex flex-wrap gap-3">
                <button
                  onClick={copyJsonToClipboard}
                  className={`flex-1 min-w-[140px] flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs font-bold transition-all ${
                    copiedJson
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                  }`}
                >
                  {copiedJson ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  <span>{copiedJson ? 'JSON DISALIN' : 'SALIN CLEAN JSON'}</span>
                </button>

                <button
                  onClick={handleSaveToAffiliateProducts}
                  disabled={savingToBank}
                  className={`flex-1 min-w-[160px] flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs font-bold transition-all active:scale-[0.98] ${
                    savedToBank
                      ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700'
                  }`}
                >
                  {savingToBank ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Menyimpan...</span>
                    </>
                  ) : savedToBank ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                      <span>TERSIMPAN DI BANK!</span>
                    </>
                  ) : (
                    <>
                      <FolderArchive className="w-4 h-4 text-indigo-400" />
                      <span>SIMPAN KE PRODUK AFFILIATE</span>
                    </>
                  )}
                </button>

                {onSendToComposer && (
                  <button
                    onClick={() =>
                      onSendToComposer({
                        title: productData.title,
                        price: productData.price,
                        image: productData.images?.[0],
                        url: productData.canonical_url
                      })
                    }
                    className="flex-1 min-w-[160px] flex items-center justify-center gap-2 py-3 px-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-indigo-600/20 transition-all active:scale-[0.98]"
                  >
                    <Share2 className="w-4 h-4" />
                    <span>BUAT POSTINGAN</span>
                  </button>
                )}

                {onSendToAffiliate && (
                  <button
                    onClick={() => onSendToAffiliate(productData.canonical_url)}
                    className="flex-1 min-w-[160px] flex items-center justify-center gap-2 py-3 px-4 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white rounded-xl text-xs font-bold shadow-lg shadow-orange-500/20 transition-all active:scale-[0.98]"
                  >
                    <LinkIcon className="w-4 h-4" />
                    <span>BUAT LINK AFFILIATE</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
