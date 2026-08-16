import React, { useState } from 'react';
import { Link as LinkIcon, Copy, Check, Zap, ChevronDown, ChevronUp, ExternalLink, RefreshCw, Loader2 } from 'lucide-react';
import api from '../api/client';

export default function AffiliateGenerator({ initialUrl }) {
  const [productUrl, setProductUrl] = useState(initialUrl || '');

  React.useEffect(() => {
    if (initialUrl) {
      setProductUrl(initialUrl);
    }
  }, [initialUrl]);
  
  // Tracking state
  const [showTracking, setShowTracking] = useState(false);
  const [sub1, setSub1] = useState(''); // Sub-publisher ID
  const [sub2, setSub2] = useState(''); // Network Click ID
  const [sub3, setSub3] = useState(''); // Referral Source
  const [sub4, setSub4] = useState(''); // Custom 1
  const [sub5, setSub5] = useState(''); // Custom 2

  const [generatedLink, setGeneratedLink] = useState('');
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);


  const normalizeSubId = (str) => {
    if (!str) return '';
    // Replace spaces and hyphens with underscores, remove special chars
    // We MUST NOT have hyphens inside a value to avoid breaking the 5-part structure.
    return str.replace(/[-\s]+/g, '_').replace(/[^a-zA-Z0-9_]/g, '').substring(0, 50);
  };

  const generatePreset = () => {
    const randomHex = Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0');
    setSub1('MA_agent');
    setSub2(`c_${randomHex}`);
    setSub3('social_post');
    setSub4('auto');
    setSub5('');
  };

  const processUrl = async () => {
    if (!productUrl) return;

    setLoading(true);
    setGeneratedLink('');

    try {
      const response = await api.post('/v1/affiliate/shopee', {
        product_url: productUrl,
        tracking: {
          sub_publisher_id: sub1,
          network_click_id: sub2,
          referral_source: sub3,
          custom_1: sub4,
          custom_2: sub5
        }
      });

      if (response.data.success) {
        setGeneratedLink(response.data.short_url);
        setCopied(false);
      } else {
        setGeneratedLink(`Error: ${response.data.error}`);
      }
    } catch (e) {
      console.error("Invalid URL", e);
      setGeneratedLink('Error: ' + (e.response?.data?.error || 'Gagal menghubungi server'));
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    if (!generatedLink || generatedLink.startsWith('Error')) return;
    navigator.clipboard.writeText(generatedLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-3xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <LinkIcon className="text-orange-500 w-6 h-6" />
          Shopee Affiliate
        </h1>
        <p className="text-slate-400 text-sm mt-1">
          Generate affiliate links instantly with advanced tracking capabilities.
        </p>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 md:p-6 shadow-xl relative overflow-hidden">
        {/* Decor */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-orange-500/5 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />

        <div className="space-y-6 relative">
          
          {/* Main Inputs */}
          <div className="grid grid-cols-1 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Product URL (Direct or Feed)
              </label>
              <input 
                type="text" 
                value={productUrl}
                onChange={(e) => setProductUrl(e.target.value)}
                placeholder="https://shopee.co.id/..." 
                className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-sm rounded-lg focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 p-3 placeholder:text-slate-600 transition-colors"
              />
            </div>
          </div>

          {/* Advanced Tracking Accordion */}
          <div className="border border-slate-800 rounded-lg bg-slate-900/50 overflow-hidden transition-all">
            <button 
              onClick={() => setShowTracking(!showTracking)}
              className="w-full flex items-center justify-between p-4 text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800/50 transition-colors"
            >
              <span className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-400" />
                Advanced Tracking (sub_id)
              </span>
              {showTracking ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            
            {showTracking && (
              <div className="p-4 border-t border-slate-800 space-y-4">
                <div className="flex justify-between items-center">
                  <p className="text-xs text-slate-500">
                    Karakter spasi dan tanda minus (-) akan otomatis diganti _
                  </p>
                  <button 
                    onClick={generatePreset}
                    className="flex items-center gap-1.5 text-xs font-semibold text-orange-400 hover:text-orange-300 bg-orange-400/10 hover:bg-orange-400/20 px-3 py-1.5 rounded-full transition-colors"
                  >
                    <RefreshCw className="w-3 h-3" />
                    Generate Tracking ID
                  </button>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Sub-publisher ID</label>
                    <input type="text" value={sub1} onChange={e => setSub1(e.target.value)} className="w-full bg-slate-950 border border-slate-800 text-slate-300 text-sm rounded-md p-2 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Network Click ID</label>
                    <input type="text" value={sub2} onChange={e => setSub2(e.target.value)} className="w-full bg-slate-950 border border-slate-800 text-slate-300 text-sm rounded-md p-2 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Referral Source</label>
                    <input type="text" value={sub3} onChange={e => setSub3(e.target.value)} className="w-full bg-slate-950 border border-slate-800 text-slate-300 text-sm rounded-md p-2 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Custom Value 1</label>
                    <input type="text" value={sub4} onChange={e => setSub4(e.target.value)} className="w-full bg-slate-950 border border-slate-800 text-slate-300 text-sm rounded-md p-2 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none" />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-medium text-slate-400 mb-1">Custom Value 2</label>
                    <input type="text" value={sub5} onChange={e => setSub5(e.target.value)} className="w-full bg-slate-950 border border-slate-800 text-slate-300 text-sm rounded-md p-2 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none" />
                  </div>
                </div>
              </div>
            )}
          </div>

          <button 
            onClick={processUrl}
            disabled={!productUrl || loading}
            className="w-full flex justify-center items-center gap-2 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold py-3 px-4 rounded-lg shadow-lg shadow-orange-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'GENERATE LINK'}
          </button>

          {/* Result Area */}
          {generatedLink && (
            <div className="mt-8 pt-6 border-t border-slate-800 animate-in fade-in slide-in-from-bottom-2">
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Generated Affiliate Link
              </label>
              
              <div className="flex gap-2">
                <div className="relative flex-1 group">
                  <input 
                    type="text" 
                    readOnly 
                    value={generatedLink}
                    className={`w-full bg-slate-950 border text-sm rounded-lg p-3 pr-10 outline-none font-mono selection:bg-orange-500/30
                      ${generatedLink.startsWith('Error') ? 'border-red-500/50 text-red-400' : 'border-emerald-500/30 text-emerald-300'}
                    `}
                  />
                  {!generatedLink.startsWith('Error') && (
                    <a 
                      href={generatedLink} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="absolute right-3 top-3 text-slate-500 hover:text-orange-400 transition-colors"
                      title="Open in new tab"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  )}
                </div>
                
                <button
                  onClick={copyToClipboard}
                  disabled={generatedLink.startsWith('Error')}
                  className={`flex items-center justify-center gap-2 px-6 rounded-lg font-medium transition-all ${
                    copied 
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 disabled:opacity-50'
                  }`}
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copied ? 'COPIED' : 'COPY'}
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
