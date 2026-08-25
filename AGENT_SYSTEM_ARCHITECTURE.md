# 🤖 Arsitektur Sistem AI Autonomous Marketing Agent

Dokumentasi komprehensif ini merinci arsitektur lengkap, alur data (*data pipeline*), state machine siklus produk, logika pengambilan keputusan, integrasi multi-platform, strategi publikasi dua fase (*Two-Phase First-Reply*), serta panduan teknis bagi developer agar pengembangan sistem agen di masa depan tetap stabil, sinkron, dan bebas dari *bug* keterputusan alur (*broken pipeline*).

---

## 📑 Daftar Isi
1. [Filosofi & Ringkasan Eksekutif](#1-filosofi--ringkasan-eksekutif)
2. [Diagram Arsitektur Alur Data (End-to-End Pipeline)](#2-diagram-arsitektur-alur-data-end-to-end-pipeline)
3. [Peta Struktur Berkas & Modul](#3-peta-struktur-berkas--modul)
4. [Deep-Dive 7 Pilar Agen Otonom](#4-deep-dive-7-pilar-agen-otonom)
   - [Pilar 1: Product Intelligence Profiler](#pilar-1-product-intelligence-profiler)
   - [Pilar 2: Kurasi Media & Anti-Reuse Per Platform](#pilar-2-kurasi-media--anti-reuse-per-platform)
   - [Pilar 3: Contextual Bandit Copywriting & Threads First-Reply Engine](#pilar-3-contextual-bandit-copywriting--threads-first-reply-engine)
   - [Pilar 4: Semantic Content Fingerprinting](#pilar-4-semantic-content-fingerprinting)
   - [Pilar 5: Dynamic Prime-Time Grid Scheduler](#pilar-5-dynamic-prime-time-grid-scheduler)
   - [Pilar 6: Product Post Memory Ledger & Lifecycle State Machine](#pilar-6-product-post-memory-ledger--lifecycle-state-machine)
   - [Pilar 7: Diagnostic Root-Cause Analyzer & Decision Stream](#pilar-7-diagnostic-root-cause-analyzer--decision-stream)
5. [Arsitektur Publikasi Dua Fase (Two-Phase State Machine & Idempotency)](#5-arsitektur-publikasi-dua-fase-two-phase-state-machine--idempotency)
6. [Aturan Khusus Platform Sosial Media & Status Aktivasi Akun](#6-aturan-khusus-platform-sosial-media--status-aktivasi-akun)
7. [Skema Database & Koleksi Firestore](#7-skema-database--koleksi-firestore)
8. [Background Worker, Throttling & Cron Lifecycle](#8-background-worker-throttling--cron-lifecycle)
9. [Katalog REST API Endpoints](#9-katalog-rest-api-endpoints)
10. [Prinsip Emas Pengembangan & Troubleshooting Developer](#10-prinsip-emas-pengembangan--troubleshooting-developer)

---

## 1. Filosofi & Ringkasan Eksekutif

Sistem **AI Autonomous Marketing Agent** dibangun dengan konsep *Closed-Loop Continuous Learning* (Siklus Pembelajaran Tertutup Tanpa Intervensi Manual). 

Tujuan utama agen adalah:
1. **Mengotomatisasi Penuh (0-Touch Autopilot)**: Memilih produk Shopee dari katalog, menyusun materi visual, meracik copywriting berdasarkan sudut pandang terbukti, menjadwalkan ke jam-jam emas (*Peak Golden Hours*), hingga mempublikasikan ke Facebook dan Threads.
2. **Attribution & Validasi Tautan Ketat**: Setiap postingan menghasilkan *shortlink* unik internal (`/s/:code`) yang diteruskan ke link resmi Shopee Affiliate (`tracking: source, campaign, content`) untuk mendeteksi klik manusia (*human clicks*) secara real-time.
3. **Pemisahan Konteks Platform (Facebook Caption Link vs Threads First-Reply)**: 
   - **Facebook**: Copywriting mendalam dengan tautan langsung di badan caption.
   - **Threads**: Copywriting bergaya percakapan santai (*conversation-first*), bebas dari tumpukan hashtag tradisional (*clean policy*), dan tautan afiliasi disajikan otomatis pada **balasan/komentar pertama (*first reply*)** menggunakan `reply_to_id`.
4. **Mencegah Polusi Akun (Anti-Duplicate & Fresh Media)**: Agen menjamin tidak ada foto/video yang dipakai berulang pada platform yang sama, serta menolak teks yang memiliki kemiripan semantik $> 85\%$.
5. **Lifecycle Governance (Quarterly Stop)**: Agen secara proaktif mendiagnosis produk yang berkinerja buruk dan mengistirahatkannya (`STOP_FOR_QUARTER`) agar slot posting dialokasikan ke produk berpotensi tinggi.

---

## 2. Diagram Arsitektur Alur Data (End-to-End Pipeline)

```mermaid
flowchart TD
    subgraph INVENTORY["1. Katalog Produk Shopee"]
        A[affiliate_products] --> B{Validasi URL Shopee}
        B -- Valid --> C[Product Pools: NEW / TESTING / PROMISING / PROVEN]
        B -- Tidak Valid --> X[Skip / Protect Link]
    end

    subgraph PROFILING["2. Product Intelligence"]
        C --> D[productIntelligenceService]
        D -->|AI Extraction| E[Niche, Target Persona, Pain Points, USP]
    end

    subgraph SCHEDULER["3. Prime-Time Grid Scheduler"]
        E --> F[orchestratorService]
        G[knowledge_insights] -->|Jam Emas WIB| F
        H[social_accounts WHERE is_active=1] -->|Akun Aktif| F
    end

    subgraph CONTENT_GEN["4. Visual & Dual-Engine Copywriting"]
        F --> I[mediaEvaluatorService]
        I -->|Cek used_media_by_platform| J[Max 2 Foto Segar / 1 Video Demo]
        F --> K[templateService: Multi-Armed Bandit]
        K -->|80% Top CTR / 20% Explore| L[Template Terpilih]
        J & L --> M[copywritingService: Facebook Prompt vs Threads Prompt]
        M -->|Threads Dual-Output| N1[Caption Root Post + First Reply Object]
        M -->|Facebook Single-Output| N2[Caption dengan Tautan Langsung]
        N1 & N2 --> O[contentFingerprint]
        O -->|Similarity < 85%| P[Simpan ke Koleksi posts status=scheduled]
        O -->|Similarity >= 85%| Q[Reject & Kocok Ulang]
    end

    subgraph TWO_PHASE_DISPATCH["5. Two-Phase Dispatcher & Analytics Sync"]
        P --> R[scheduler.js: Fast-Path 1 Menit]
        R --> S1[Phase 1: publishThreadsPost / postToFacebook]
        S1 -->|Simpan root_post_id| S2{first_reply.enabled?}
        S2 -- Ya --> S3[Phase 2: publishThreadsReply reply_to_id]
        S2 -- Tidak --> S4[Selesai Publikasi]
        S3 & S4 --> T[Shortlink Redirect & Human Click Tracker]
        T & S1 --> U[syncService.js: Tarik Views & Clicks via Database ID]
        U --> V[product_post_memory Ledger]
    end

    subgraph LEARNING_DIAG["6. Learning & Diagnostic Layer"]
        V --> W[knowledgeSynthesizer: Sintesis Jam & Angle Terbaik]
        W --> G
        V --> Y[diagnosticService: Root-Cause Analyzer]
        Y -->|Diagnosa Dinamis Akun Aktif| Z[agent_decisions_log Stream]
        Y -->|Gagal 3x Multi-Angle| AA[Update Produk STOP_FOR_QUARTER]
    end
```

---

## 3. Peta Struktur Berkas & Modul

```text
backend/src/
├── services/
│   ├── agent/
│   │   ├── orchestratorService.js      # Otak orkestrator siklus otonom, alokasi slot dinamis & inventory
│   │   ├── productIntelligenceService.js# Ekstraksi persona, pain points, & USP dari Shopee
│   │   ├── mediaEvaluatorService.js    # Filter media anti-reuse per platform (max 2 foto / 1 video)
│   │   ├── templateService.js          # Pustaka template & Contextual Multi-Armed Bandit (MAB)
│   │   ├── copywritingService.js       # Generator copy (Facebook Storytelling vs Threads Conversation-First)
│   │   ├── contentFingerprint.js       # Kalkulator kemiripan teks (Levenshtein / Jaccard / Cosine)
│   │   ├── productPostMemoryService.js # Buku besar memori postingan (product_post_memory) & skor dekomposisi
│   │   ├── metricsCalculator.js        # Kalkulasi CTR, skor normalisasi, & evaluasi A/B testing
│   │   ├── experimentService.js        # Pengelola eksperimen A/B testing hipotesis
│   │   ├── diagnosticService.js        # Root-cause analyzer terhubung akun aktif (Traffic, Content, Offer, Product)
│   │   ├── decisionLogger.js           # Logger transparansi keputusan AI (agent_decisions_log)
│   │   ├── knowledgeSynthesizer.js     # Pembelajaran pola data menjadi wawasan (knowledge_insights)
│   │   └── aiQueueService.js           # Lapisan wrapper pemanggilan OpenAI/Gemini/Deepseek dengan rate-limiter
│   ├── postAnalytics/
│   │   ├── syncService.js              # Sinkronisasi analitik berkala Meta API & pelacak link via Database ID
│   │   ├── normalizer.js               # Normalisasi metrik antar platform sosial media
│   │   ├── linkMatcher.js              # Pencocokan link afiliasi dari teks caption & first reply
│   │   ├── facebookAnalytics.js        # Adapter Graph API Facebook Page & Reels Insights
│   │   ├── instagramAnalytics.js       # Adapter Graph API Instagram Media & Insights
│   │   └── threadsAnalytics.js         # Adapter Graph API Threads Posts & Engagement
│   ├── threads/
│   │   ├── inbound/inboundService.js   # Pemindai balasan masuk Threads untuk auto-reply kontekstual
│   │   └── outbound/outboundService.js # Pemantau kata kunci tren Threads untuk social listening
│   ├── threadsService.js               # Kontrak domain Threads API (publishThreadsPost & publishThreadsReply)
│   ├── telegramService.js              # Pengiriman laporan kinerja harian & notifikasi siklus
│   ├── tokenRefreshService.js          # Auto-refresh masa aktif long-lived Meta tokens
│   └── postService.js                  # Two-Phase State Machine Dispatcher publikasi postingan
├── workers/
│   └── scheduler.js                    # Worker tunggal berkala (Cron / Google Apps Script trigger)
└── routes/
    ├── agent-orchestrator.js           # REST API kontrol agen, status kuartal, & log keputusan
    ├── accounts.js                     # CRUD akun sosial media & toggle aktivasi (is_active)
    ├── affiliate.js & redirect.js      # Builder Shopee Affiliate & Shortlink Handler (/s/:code)
    └── affiliate-products.js           # CRUD inventori produk Shopee
```

---

## 4. Deep-Dive 7 Pilar Agen Otonom

### Pilar 1: Product Intelligence Profiler
*File: `backend/src/services/agent/productIntelligenceService.js`*
- **Tujuan**: Menganalisis judul, deskripsi, harga, diskon, rating, dan varian produk dari Shopee.
- **Output JSON Terstruktur**:
  ```json
  {
    "niche": "Gadget & Audio",
    "target_audience": "Mahasiswa & Pekerja Remote",
    "pain_points": ["Kabel headset sering kusut", "Baterai TWS cepat habis"],
    "usp": ["Daya tahan baterai 40 jam", "Fitur Active Noise Cancelling"],
    "price_tier": "Mid-Range",
    "recommended_angles": ["Problem-Agitate-Solution", "Honest Review"]
  }
  ```
- **Caching**: Profil disimpan di field `agent_profile` pada dokumen `affiliate_products`. Jika sudah ada, agen tidak menganalisis ulang.

---

### Pilar 2: Kurasi Media & Anti-Reuse Per Platform
*File: `backend/src/services/agent/mediaEvaluatorService.js`*
- **Aturan Ketat**:
  1. Media yang **sudah pernah diposting pada platform tertentu (misal: Facebook)** disimpan pada `used_media_by_platform.facebook` dan **dilarang dipakai lagi di Facebook**.
  2. Media tersebut **tetap boleh dipakai di platform lain (misal: Threads)** jika belum pernah digunakan di Threads.
  3. Maksimal **1 Video Demo Segar** ATAU Maksimal **2 Foto Produk Bersih** per postingan.
  4. Jika semua media produk sudah habis terpakai pada platform tersebut, agen menolak kurasi (`no_fresh_media: true`) dan memilih produk lain.

---

### Pilar 3: Contextual Bandit Copywriting & Threads First-Reply Engine
*Files: `backend/src/services/agent/templateService.js` & `backend/src/services/agent/copywritingService.js`*
- **Algoritma Epsilon-Greedy**:
  - **80% Eksploitasi**: Memilih template dengan CTR (*Click-Through Rate*) tertinggi untuk kombinasi `platform + objective`.
  - **20% Eksplorasi**: Memilih template alternatif/baru secara acak untuk mencegah kejenuhan audiens.
- **Kebijakan Gaya Penulisan Threads (Clean & Conversation-First)**:
  - **Zero Hashtag Clutter**: Menghilangkan tumpukan hashtag tradisional (`#Shopee #RacunShopee` ditiadakan) agar teks tampil natural seperti percakapan organik.
  - **5 Kelas CTA Dinamis**:
    1. `conversation_cta`: Memantik opini / pertanyaan santai (*"menurut kalian mending peach apa matcha?"*).
    2. `curiosity_cta`: Memancing penasaran (*"ternyata yang termurah justru yang ini 😭"*).
    3. `soft_cta`: Menawarkan link secara halus (*"detailnya aku spill di reply ya 👇"*).
    4. `direct_link_cta`: Ajakan link langsung (*"yang nanya link, aku drop di bawah 👇"*).
    5. `no_cta`: Tanpa CTA sama sekali (murni relatable sharing / humor).
  - **Panjang Teks Fleksibel**: Target gaya 150–350 karakter (maksimal aman API < 480 karakter).
  - **Dual-Output**: Menghasilkan `caption` (postingan utama) dan `first_reply_text` (teks komentar balasan pertama yang memuat link afiliasi).

---

### Pilar 4: Semantic Content Fingerprinting
*File: `backend/src/services/agent/contentFingerprint.js`*
- **Tujuan**: Mencegah akun terkena penalti spam dari algoritma akibat teks caption yang terlalu mirip.
- **Mekanisme**: Menghitung kemiripan menggunakan kombinasi **Jaccard Token Similarity** dan **Levenshtein Distance** terhadap postingan 7 hari terakhir. Jika tingkat kemiripan $\ge 85\%$, draf postingan otomatis ditolak (*rejected*) dan dikocok ulang.

---

### Pilar 5: Dynamic Prime-Time Grid Scheduler
*File: `backend/src/services/agent/orchestratorService.js`*
- **Struktur Slot Harian**: 3 Sesi Utama (Pagi, Siang, Malam) dengan 3 Slot per Sesi (Total 9 slot prime-time per hari per akun).
- **Penyesuaian Jam Emas (Learned Golden Peak)**: Jika modul pembelajaran (`knowledgeSynthesizer`) mendeteksi bahwa Sesi Malam memiliki CTR tertinggi, agen secara dinamis mengalokasikan 5 slot padat di sekitar jam emas tersebut (`is_golden_peak: true`) dan memprioritaskan produk **PROVEN / Pemenang**.

---

### Pilar 6: Product Post Memory Ledger & Lifecycle State Machine
*File: `backend/src/services/agent/productPostMemoryService.js`*
- Setiap postingan dicatat ke koleksi `product_post_memory`.
- **Siklus Hidup Produk**:
  ```text
  [NEW] -> (Diposting 1-2x) -> [TESTING]
                                  │
          ┌───────────────────────┼───────────────────────┐
          ↓ (CTR >= 2.5% & Klik >= 30) ↓ (CTR >= 1.5% & Klik >= 15) ↓ (Gagal 3x Multi-Angle/Plat)
      [PROVEN]                [PROMISING]               [STOPPED]
  (Fokus Skala Jam Emas)   (Diberi Slot Testing Lanjut) (Diistirahatkan Kuartal Ini)
  ```

---

### Pilar 7: Diagnostic Root-Cause Analyzer & Decision Stream
*Files: `backend/src/services/agent/diagnosticService.js` & `backend/src/services/agent/decisionLogger.js`*
- Terhubung secara dinamis ke tabel `social_accounts` yang berstatus `is_active: 1`.
- Mendiagnosis produk bermasalah ke dalam 4 kategori akar masalah:
  1. **TRAFFIC_PROBLEM**: Produk baru diuji pada 1 platform dan masih ada platform aktif lain yang belum diuji (misal: baru diuji di Facebook, belum diuji di Threads). Tindakan: Uji di platform aktif berikutnya.
  2. **CONTENT_PROBLEM**: Baru diuji 1 sudut pandang/media. Tindakan: Uji sudut pandang berbeda (PAS vs Honest Review vs Promo).
  3. **OFFER_PROBLEM**: Tayangan tinggi ($> 1500$) tapi klik $< 2$. Tindakan: Revisi promo/harga.
  4. **PRODUCT_PROBLEM**: Sudah diuji $\ge 3$ kali melintasi seluruh platform aktif dan berbagai sudut pandang namun tetap tidak menghasilkan klik. Tindakan: `STOP_FOR_QUARTER` (Status produk diubah menjadi STOPPED).

---

## 5. Arsitektur Publikasi Dua Fase (Two-Phase State Machine & Idempotency)

*Files: `backend/src/services/threadsService.js` & `backend/src/services/postService.js`*

Untuk mencegah eksekusi rapuh atau pengiriman balasan ganda saat jaringan *timeout*, sistem menggunakan mesin status dua fase:

```text
[Draf Post Terjadwal] ──► [FASE 1: Publish Root Post]
                                    │
                        ┌───────────┴───────────┐
                        ↓ (Sukses)              ↓ (Gagal)
                [ROOT_PUBLISHED]          [ROOT_FAILED] (Bisa di-retry)
                        │
             [first_reply.enabled?]
                        │
            ┌───────────┴───────────┐
            ↓ (Ya)                  ↓ (Tidak)
[FASE 2: Publish First Reply]   [Selesai]
(reply_to_id = root_post_id)
            │
    ┌───────┴───────┐
    ↓ (Sukses)      ↓ (Gagal)
[REPLY_PUBLISHED] [REPLY_FAILED] (Catat error, root tetap aman)
```

- **Idempotency Guard**: Sebelum memanggil `publishThreadsReply()`, sistem memeriksa apakah `first_reply.status === 'published'` dan `first_reply.reply_id` sudah ada. Jika sudah ada, balasan tidak akan diposting ulang.
- **Primary Attribution**: Metrik performa dan klik dipetakan langsung dari relasi `product_id` dan `reply_id` di database, dengan regex sebagai *secondary fallback*.

---

## 6. Aturan Khusus Platform Sosial Media & Status Aktivasi Akun

> [!IMPORTANT]
> **ATURAN WAJIB PENGEMBANGAN: SELALU FILTER AKUN AKTIF (`is_active == 1`)**
> Jangan pernah menuliskan array platform statis seperti `['facebook', 'instagram', 'threads']` dalam kode pengambil keputusan. Selalu periksa `social_accounts` yang aktif di database pengguna!

| Platform | Penempatan Link | Batasan Karakter | Perlakuan Autopilot |
| :--- | :--- | :--- | :--- |
| **Facebook Page** | ✅ Langsung di Caption | Bebas (Rekomendasi 200–600 karakter) | **Target Utama Autopilot**. Storytelling mengalir, gambar feed, video, dan Reels. |
| **Threads** | ✅ Auto First-Reply (`reply_to_id`) | Target 150–350 karakter (Maksimal API 500) | **Target Utama Autopilot**. Caption percakapan bersih tanpa tumpukan hashtag, link disajikan di komentar balasan pertama. |
| **Instagram** | ❌ Teks caption tidak bisa diklik | 2200 karakter | **Dikecualikan dari Autopilot Link Caption**. Digunakan untuk posting manual via Post Composer / AI Generator. |
| **Telegram** | ✅ Bot broadcast & webhook | 4096 karakter | Digunakan untuk Laporan Kinerja Harian & Notifikasi Eksekusi Agen. |

---

## 7. Skema Database & Koleksi Firestore

### 1. `posts` (Struktur Dokumen Postingan Terjadwal)
```typescript
interface PostDocument {
  id: string;
  user_id: string;
  title: string;
  content: string;               // Teks root post
  product_id?: string;
  cta_type?: 'conversation_cta' | 'curiosity_cta' | 'soft_cta' | 'direct_link_cta' | 'no_cta';
  status: 'draft' | 'scheduled' | 'posted' | 'failed';
  
  // Objek First-Reply (Khusus Threads)
  first_reply?: {
    enabled: boolean;
    text: string;                // Contoh: "Spill link produk di sini ya 👇\n🛒 https://..."
    product_id: string;
    affiliate_url: string;
    status: 'pending' | 'published' | 'failed' | 'skipped';
    reply_id: string | null;     // ID balasan dari Threads API
    reply_attempts: number;
    reply_last_error?: string | null;
    reply_published_at?: string | null;
  };

  targets: Array<{
    id: string;
    account_id: string;
    platform: 'facebook' | 'threads';
    page_name: string;
    status: 'pending' | 'processing' | 'success' | 'failed';
    post_id_on_platform?: string | null; // root_post_id
    error_message?: string | null;
    attempt_count: number;
  }>;
}
```

### 2. `product_post_memory`
```typescript
interface ProductPostMemory {
  id: string;                    // mem_{post_id}
  post_id: string;
  product_id: string;
  user_id: string;
  quarter: string;
  post_id_on_platform?: string;  // ID root post
  reply_id_on_platform?: string; // ID first reply
  context_at_post: {
    platform: 'facebook' | 'threads';
    account_name: string;
    shortlink_code: string;
    posting_hour: number;
    copy_angle: string;
    template_id: string;
    media_type: 'image' | 'video';
    media_urls: string[];
    content_fingerprint: string;
  };
  raw_metrics: {
    views: number;
    reach: number;
    likes: number;
    comments: number;
    shares: number;
    affiliate_clicks: number;
  };
  published_at: string;
}
```

### 3. `threads_post_context`
```typescript
interface ThreadsPostContext {
  id: string;                    // ctx_{thread_root_id}
  account_id: string;
  thread_id: string;             // Root Thread ID
  reply_id?: string | null;      // First Reply ID
  post_id: string;
  user_id: string;
  product_id: string;
  caption: string;
  first_reply?: string;
  published_at: string;
  status: 'ACTIVE' | 'ARCHIVED';
}
```

---

## 8. Background Worker, Throttling & Cron Lifecycle

Worker dijalankan melalui `backend/src/workers/scheduler.js`. Endpoint ini dipanggil setiap menit oleh Google Apps Script atau penyedia Cron eksternal.

```text
[Cron Trigger Setiap 1 Menit] -> GET /api/cron/process-scheduled
                                       │
     ┌─────────────────────────────────┴─────────────────────────────────┐
     ↓ (Setiap Menit)                                                    ↓ (Serverless Throttling via 'scheduler_locks')
Fast-Path Publisher:                                               1. Inbound Threads Scan (Setiap 10m)
Kirim postingan terjadwal & first reply                            2. Autonomous Cycle Scheduler (Setiap 15m)
yang scheduled_at <= now                                           3. Analytics Sync Meta & Shortlinks (Setiap 30m)
                                                                   4. Outbound Social Listening (Setiap 30m)
                                                                   5. Token Auto-Refresh (Setiap 12h)
                                                                   6. Telegram Daily Performance Report (Pukul 08:00 WIB)
```

---

## 9. Katalog REST API Endpoints

Semua endpoint agen berada di bawah rute `/api/agent-orchestrator` dan mewajibkan autentikasi JWT:

| Method | Endpoint | Fungsi |
| :--- | :--- | :--- |
| `POST` | `/api/agent-orchestrator/cycle/run` | Memicu eksekusi 1 putaran siklus otonom secara instan (`forceRun: true`). |
| `GET` | `/api/agent-orchestrator/quarter/status` | Mengambil status kuartal, total views, clicks, CTR global, dan sebaran pool produk. |
| `GET` | `/api/agent-orchestrator/decisions` | Mengambil riwayat log transparansi keputusan AI (dukungan `?limit=` & `?product_id=`). |
| `DELETE`| `/api/agent-orchestrator/decisions` | Menghapus seluruh log keputusan AI milik pengguna. |
| `GET` | `/api/agent-orchestrator/insights` | Mengambil wawasan aktif hasil pembelajaran knowledge layer. |
| `GET` | `/api/agent-orchestrator/memory/product/:id` | Mengambil riwayat lengkap buku besar memori postingan produk tertentu. |
| `POST` | `/api/agent-orchestrator/product/:id/diagnose`| Menjalankan evaluasi diagnosa manual pada produk tertentu. |
| `POST` | `/api/agent-orchestrator/product/:id/override-status` | Mengubah status lifecycle produk secara manual (`NEW`, `TESTING`, `STOPPED`, dll). |
| `GET` | `/api/agent-orchestrator/config` | Mengambil konfigurasi agen (status autopilot, kuota harian). |
| `POST` | `/api/agent-orchestrator/config` | Memperbarui konfigurasi agen. |

---

## 10. Prinsip Emas Pengembangan & Troubleshooting Developer

### 1. Jangan Pernah Asumsikan Platform Tersedia (No Hardcoded Platforms)
- Selalu ambil dari database `social_accounts` dengan filter `is_active in [1, true, '1']`.

### 2. Pisahkan Siklus Root Post dan First Reply (Two-Phase Contract)
- Jangan gabungkan posting root dan balasan dalam operasi tunggal yang rapuh. Gunakan `publishThreadsPost()` dan `publishThreadsReply()`, serta catat status masing-masing di dokumen `posts.first_reply`.

### 3. Jaga Idempotency pada Auto-Reply
- Selalu periksa `post.first_reply.status === 'published'` sebelum mengirim balasan agar retry scheduler tidak mengirimkan komentar berulang.

### 4. Jadikan Database ID sebagai Sumber Kebenaran Utama Attribution
- Petakan metrik dari `threads_post_context` dan `posts.first_reply.product_id` langsung ke buku besar memori. Regex hanya berfungsi sebagai *fallback*.

---
*Dokumentasi ini telah diperbarui dan disinkronkan dengan seluruh pembaruan arsitektur terkini untuk repositori `medsos Agent`.*
