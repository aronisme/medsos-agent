import React, { useState, useEffect } from 'react';
import { useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import LoginModal from './components/LoginModal';
import StatsOverview from './components/StatsOverview';
import PostComposer from './components/PostComposer';
import PostList from './components/PostList';
import AccountManager from './components/AccountManager';
import TemplateManager from './components/TemplateManager';
import ApiDocumentation from './components/ApiDocumentation';
import AffiliateGenerator from './components/AffiliateGenerator';
import ShopeeExtractor from './components/ShopeeExtractor';
import AffiliateProducts from './components/AffiliateProducts';
import api from './api/client';

export default function App() {
  const { user, loading } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [health, setHealth] = useState(null);

  // Cross-tab state sharing
  const [composerInitialData, setComposerInitialData] = useState(null);
  const [affiliateInitialUrl, setAffiliateInitialUrl] = useState('');

  useEffect(() => {
    // Health check endpoint
    api.get('/health')
      .then((res) => setHealth(res.data))
      .catch(() => setHealth(null));
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-400">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
          <span className="text-xs font-semibold tracking-wider">Memuat Medsos Agent...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginModal />;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-['Plus_Jakarta_Sans',sans-serif]">
      {/* Top Navbar */}
      <Navbar health={health} />

      {/* Body Content */}
      <div className="flex-1 flex flex-col md:flex-row max-w-7xl w-full mx-auto">
        {/* Sidebar */}
        <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />

        {/* Main Workspace */}
        <main className="flex-1 p-4 lg:p-8 min-w-0">
          {activeTab === 'dashboard' && <StatsOverview setActiveTab={setActiveTab} />}
          
          {activeTab === 'composer' && (
            <PostComposer
              initialData={composerInitialData}
              onPostCreated={() => {
                setComposerInitialData(null);
              }}
            />
          )}

          {activeTab === 'affiliate_products' && (
            <AffiliateProducts
              onSendToComposer={(data) => {
                setComposerInitialData(data);
                setActiveTab('composer');
              }}
              onSendToAffiliate={(canonicalUrl) => {
                setAffiliateInitialUrl(canonicalUrl);
                setActiveTab('shopee_affiliate');
              }}
            />
          )}

          {activeTab === 'shopee_extractor' && (
            <ShopeeExtractor
              onSendToComposer={(productInfo) => {
                setComposerInitialData({
                  title: productInfo.title,
                  content: `🔥 REKOMENDASI PRODUK 🔥\n\n${productInfo.title}\n\nHarga: Rp ${productInfo.price?.toLocaleString('id-ID')}\n\n👉 Cek dan beli di sini:\n${productInfo.url}`,
                  image: productInfo.image,
                  mediaType: 'image'
                });
                setActiveTab('composer');
              }}
              onSendToAffiliate={(canonicalUrl) => {
                setAffiliateInitialUrl(canonicalUrl);
                setActiveTab('shopee_affiliate');
              }}
            />
          )}

          {activeTab === 'posts' && <PostList />}
          {activeTab === 'accounts' && <AccountManager />}
          
          {activeTab === 'templates' && (
            <TemplateManager
              onApplyTemplate={(content, title) => {
                setComposerInitialData({ title, content });
                setActiveTab('composer');
              }}
            />
          )}

          {activeTab === 'shopee_affiliate' && (
            <AffiliateGenerator initialUrl={affiliateInitialUrl} />
          )}

          {activeTab === 'api_docs' && <ApiDocumentation />}
        </main>
      </div>
    </div>
  );
}
