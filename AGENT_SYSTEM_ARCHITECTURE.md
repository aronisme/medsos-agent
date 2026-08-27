# 🤖 Arsitektur Sistem AI Autonomous Marketing Agent

Dokumentasi komprehensif ini merinci arsitektur lengkap, alur data (*data pipeline*), state machine siklus produk, logika pengambilan keputusan, sistem **Identity-Aware Content Agent & Multi-Account Isolation**, integrasi multi-platform, strategi publikasi dua fase (*Two-Phase First-Reply*), serta panduan teknis bagi developer agar pengembangan sistem agen di masa depan tetap stabil, sinkron, dan bebas dari *bug* keterputusan alur (*broken pipeline*).

---

## 📑 Daftar Isi
1. [Filosofi & Ringkasan Eksekutif](#1-filosofi--ringkasan-eksekutif)
2. [Diagram Arsitektur Alur Data (End-to-End Pipeline)](#2-diagram-arsitektur-alur-data-end-to-end-pipeline)
3. [Peta Struktur Berkas & Modul](#3-peta-struktur-berkas--modul)
4. [Deep-Dive 7 Pilar Agen Otonom](#4-deep-dive-7-pilar-agen-otonom)
   - [Pilar 1: Product Intelligence Profiler](#pilar-1-product-intelligence-profiler)
   - [Pilar 2: Kurasi Media & Dual-Layer Multi-Account Isolation](#pilar-2-kurasi-media--dual-layer-multi-account-isolation)
   - [Pilar 3: Identity-Aware Copywriting, Creator Archetypes & Contextual MAB](#pilar-3-identity-aware-copywriting-creator-archetypes--contextual-mab)
   - [Pilar 4: Two-Layer Anti-Robot Detector & 3-Space Cross-Account Diversity](#pilar-4-two-layer-anti-robot-detector--3-space-cross-account-diversity)
   - [Pilar 5: Dynamic Prime-Time Grid Scheduler & Niche Alignment](#pilar-5-dynamic-prime-time-grid-scheduler--niche-alignment)
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

Sistem **AI Autonomous Marketing Agent** dibangun dengan konsep *Closed-Loop Continuous Learning* (Siklus Pembelajaran Tertutup Tanpa Intervensi Manual) yang berlandaskan pada prinsip:
> **"User controls Identity. AI controls Expression. Data controls Optimization."**

Tujuan utama agen adalah:
1. **Mengotomatisasi Penuh (0-Touch Autopilot)**: Memilih produk Shopee dari katalog, menyusun materi visual, meracik copywriting berdasarkan sudut pandang terbukti, menjadwalkan ke jam-jam emas (*Peak Golden Hours*), hingga mempublikasikan ke Facebook dan Threads.
2. **Attribution & Validasi Tautan Ketat**: Setiap postingan menghasilkan *shortlink* unik internal (`/s/:code`) yang diteruskan ke link resmi Shopee Affiliate (`tracking: source, campaign, content`) untuk mendeteksi klik manusia (*human clicks*) secara real-time.
3. **Pemisahan Konteks Platform (Facebook Caption Link vs Threads Dual-Mode)**: 
   - **Facebook**: Copywriting mendalam dengan tautan langsung di badan caption.
   - **Threads (Dual-Mode)**:
     - **Mode 1: Visual Media + First-Reply**: Copywriting santai tanpa hashtag, media foto/video terlampir, dan tautan afiliasi disajikan otomatis pada **balasan/komentar pertama (*first reply*)** menggunakan `reply_to_id`.
     - **Mode 2: No-Media + Native Link Card Preview**: Postingan teks murni dengan tautan pendek langsung di caption. Crawler Meta Threads secara otomatis merender kartu thumbnail, judul, harga, dan rating Shopee interaktif (*0-media upload*), dengan `first_reply` dinonaktifkan otomatis.
4. **Isolasi Lintas Akun & Anti-Robot (Identity-Aware Content Agent)**:
   - Pengguna memilih Persona Identitas Akun (*Bestie Hype, Aesthetic Minimalist, Witty Curhat, dll.*).
   - AI menulis menggunakan 6 Arketipe Penceritaan Organik dengan sebutan produk alami (*Natural Product Reference*), bebas dari format outline kaku dan frasa robotik klise AI.
   - Media visual dan draf teks diisolasi secara real-time lintas akun dengan validasi diversitas 3 ruang (*Current Batch, Scheduled Posts, Recent Memories*).
5. **Niche-Aligned Delivery & Anti-Pollution**: Agen memvalidasi kesesuaian kategori produk dengan `allowed_niches` pada akun, menjamin tidak ada foto/video yang dipakai berulang pada platform yang sama, serta menolak teks yang memiliki kemiripan semantik $> 65\%$.
6. **Lifecycle Governance (Quarterly Stop)**: Agen secara proaktif mendiagnosis produk yang berkinerja buruk dan mengistirahatkannya (`STOP_FOR_QUARTER`) agar slot posting dialokasikan ke produk berpotensi tinggi.

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

    subgraph SCHEDULER["3. Prime-Time Grid Scheduler & Identity Setup"]
        E --> F[orchestratorService]
        G[knowledge_insights] -->|Jam Emas WIB| F
        H[social_accounts WHERE is_active=1] -->|Cek allowed_niches, content_persona_id & threads_media_mode| F
    end

    subgraph CONTENT_GEN["4. Visual Isolation & Direct AI Copywriting"]
        F --> I[mediaEvaluatorService]
        I -->|Dual-Layer & In-Cycle Reservation Lock| J{threads_media_mode == no_media OR Media Habis?}
        J -- Ya di Threads --> J1[Mode Teks Murni: media=[] link_preview_ready]
        J -- Tidak --> J2[Max 2 Foto Segar / 1 Video Demo Terisolasi Akun]
        F --> K[templateService: Contextual MAB Strategy]
        K -->|Persona -> Archetype -> Angle -> CTA| L[Strategi Penceritaan Terpilih]
        J1 & J2 & L --> M[copywritingService: Direct AI Generation]
        M -->|Natural Reference & No-Bullet Rules| N[Draf Caption Organik]
        N --> O[contentFingerprint: 2-Layer Anti-Robot & 3-Space Validator]
        O -->|Similarity < 65% & Anti-Robot Pass| P[Simpan ke Koleksi posts status=scheduled]
        O -->|Similarity >= 65% / Robot Pattern| Q[Reject & Kocok Ulang Kandidat]
    end

    subgraph TWO_PHASE_DISPATCH["5. Two-Phase Dispatcher & Analytics Sync"]
        P --> R[scheduler.js: Fast-Path 1 Menit]
        R --> S1[Phase 1: publishThreadsPost / postToFacebook]
        S1 -->|Simpan root_post_id| S2{first_reply.enabled?}
        S2 -- Ya --> S3[Phase 2: publishThreadsReply reply_to_id]
        S2 -- Tidak --> S4[Selesai Publikasi / Link Card Rendered by Meta]
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
│   │   ├── mediaEvaluatorService.js    # Filter media anti-reuse per platform & per akun + Real-time in-cycle lock
│   │   ├── templateService.js          # Definisi 9 Persona, 6 Arketipe & Contextual Multi-Armed Bandit (MAB)
│   │   ├── copywritingService.js       # Direct AI Generator (Natural Product References, Persona rules)
│   │   ├── contentFingerprint.js       # Two-Layer Anti-Robot Detector & 3-Space Cross-Account Diversity Validator
│   │   ├── productPostMemoryService.js # Buku besar memori postingan (product_post_memory) & skor dekomposisi
│   │   ├── metricsCalculator.js        # Kalkulasi CTR, skor normalisasi, & evaluasi A/B testing
│   │   ├── experimentService.js        # Pengelola eksperimen A/B testing hipotesis
│   │   ├── diagnosticService.js        # Root-cause analyzer terhubung akun aktif (Traffic, Content, Offer, Product)
│   │   ├── decisionLogger.js           # Logger transparansi keputusan AI (agent_decisions_log)
│   │   ├── knowledgeSynthesizer.js     # Pembelajaran pola data menjadi wawasan (knowledge_insights)
│   │   └── aiQueueService.js           # Lapisan wrapper pemanggilan OpenAI/Gemini/Groq/Mistral dengan rate-limiter
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
    ├── accounts.js                     # CRUD akun sosial media, allowed_niches, content_persona_id & threads_media_mode
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

### Pilar 2: Kurasi Media & Dual-Layer Multi-Account Isolation
*File: `backend/src/services/agent/mediaEvaluatorService.js`*
- **Aturan Ketat**:
  1. **Dual-Layer Usage Tracking**: 
     - `used_media_by_platform`: Media yang sudah pernah digunakan pada platform tertentu (misal FB) tidak boleh diulang di platform tersebut.
     - `used_media_by_account`: Media yang sudah pernah diposting oleh akun tertentu dicatat per `account_id`.
  2. **Real-Time In-Cycle Reservation Lock**: Foto/video yang dipilih oleh Akun A dalam satu siklus batch otonom langsung dikunci di memori, sehingga Akun B (walaupun sama-sama memposting produk yang sama) dijamin mendapatkan foto/video yang berbeda.
  3. Maksimal **1 Video Demo Segar** ATAU Maksimal **2 Foto Produk Bersih** per postingan visual.
  4. **Penanganan Khusus Threads (Native Link Card Preview Fallback)**:
     - Jika mode akun disetel ke `threadsMediaMode = 'no_media'`, atau jika stok foto/video segar produk telah habis di Threads, kurasi media mengembalikan `{ media_type: 'text', selected_media: [], no_fresh_media: false }`.
     - Produk tidak digagalkan/di-reject, melainkan diterbitkan dalam mode Teks Murni ber-link yang secara native memicu crawler Meta Threads untuk membuat kartu preview interaktif (*Link Card Preview*).
  5. Pada Facebook/Instagram, jika media habis, agen menolak kurasi (`no_fresh_media: true`) dan memilih produk lain.

---

### Pilar 3: Identity-Aware Copywriting, Creator Archetypes & Contextual MAB
*Files: `backend/src/services/agent/templateService.js` & `backend/src/services/agent/copywritingService.js`*
- **Struktur Strategi Penceritaan**:
  $$\text{Account Persona (User)} \longrightarrow \text{Story Archetype (AI)} \longrightarrow \text{Marketing Angle} \longrightarrow \text{CTA Class}$$
- **9 Persona Kanonikal Akun**:
  1. 💕 **Bestie Hype**: Casual, Playful, Gen Z slang & ekspresif (*"MAAF TERIAK 😭"*, *"KAAAK TOLONG 😭🤌"*).
  2. 🌿 **Aesthetic Minimalist**: Kalem, elegan, fokus visual & rapi (*"effortless"*, *"clean look"*, *"flowy"*).
  3. 😂 **Witty Curhat**: Humor relatable, cerita santai sehari-hari.
  4. 🛍️ **Smart Bargain Hunter**: Fokus perbandingan harga murah vs kualitas mewah (*"IN THIS ECONOMY ‼️"*).
  5. 🔍 **POV Reviewer**: Format POV jujur, demonstrasi praktis saat memakai produk.
  6. ✨ **Soft Lifestyle**: Rekomendasi wishlist, outfit & dekor manis.
  7. 🤏 **Relatable Everyday**: Sederhana, membumi, obrolan akrab sehari-hari.
  8. 🧠 **Practical Life-Hack**: Solusi cerdas, tips bermanfaat & efisien.
  9. 🤖 **AI Adaptive**: Kombinasi cerdas dinamis yang dipelajari AI.
- **6 Arketipe Penceritaan Organik**:
  `witty_question`, `emotional_reaction`, `pov_lifehack`, `value_shock`, `aesthetic_wishlist`, `honest_spill`.
- **Direct AI Generation & Natural References**:
  - Judul e-commerce mentah (*`[PROMO] [MALL ORI] Sandal Flatshoes Korea`*) diekstraksi menjadi sebutan percakapan alami (*`flatshoes ini`*, *`cardigan rajut ini`*, *`wadah sabun ini`*).
  - Teks ditulis secara holistik oleh AI tanpa slot template buatan kaku (*`Solusi: {PRODUCT_NAME}`* ditiadakan).
- **Multi-Armed Bandit (MAB)**: 80% memilih strategi dengan performa CTR rata-rata tertinggi (eksploitasi) dan 20% menguji varian strategi baru (eksplorasi).

---

### Pilar 4: Two-Layer Anti-Robot Detector & 3-Space Cross-Account Diversity
*File: `backend/src/services/agent/contentFingerprint.js`*
- **Two-Layer Anti-Robot Defense**:
  - **Layer 1 (Blacklist Frasa Bot)**: Memblokir frasa klise robotik (*"Solusi terbaiknya"*, *"Keunggulan produk"*, *"Kenapa harus checkout"*, *"Spesifikasi"*).
  - **Layer 2 (Structural AI Outline Detector)**: Memblokir dan meratakan format bullet points kaku (`• Poin 1`, `1. Poin 2`, `2. Poin 3`).
- **Composite Diversity Scoring**:
  - Menghitung skor kemiripan berbobot: Semantic Tokens (35%), Lexical N-Grams (25%), Structural length & lines (20%), Hook similarity (10%), CTA similarity (10%).
- **Validasi Lintas 3 Ruang (*3-Space Cross-Account Check*)**:
  Draf konten baru divalidasi terhadap:
  1. **Current Batch**: Draf akun lain yang dibuat dalam siklus yang sama.
  2. **Scheduled Posts**: Seluruh postingan status scheduled/draft milik pengguna di database.
  3. **Recent Memories**: Postingan yang telah terbit dalam 7 hari terakhir.
  Jika kemiripan komposit $\ge 65\%$, postingan ditolak (*rejected*) dan AI memilih strategi/kandidat lain.

---

### Pilar 5: Dynamic Prime-Time Grid Scheduler & Niche Alignment
*File: `backend/src/services/agent/orchestratorService.js`*
- **Struktur Slot Harian**: 3 Sesi Utama (Pagi, Siang, Malam) dengan 3 Slot per Sesi (Total 9 slot prime-time per hari per akun).
- **Penyesuaian Jam Emas (Learned Golden Peak)**: Jika modul pembelajaran (`knowledgeSynthesizer`) mendeteksi bahwa Sesi Malam memiliki CTR tertinggi, agen secara dinamis mengalokasikan 5 slot padat di sekitar jam emas tersebut (`is_golden_peak: true`) dan memprioritaskan produk **PROVEN / Pemenang**.
- **Validasi Niche Akun (`allowed_niches`)**: Agen memeriksa apakah niche produk termasuk dalam `allowed_niches` milik akun target. Jika akun disetel ke niche spesifik (misal `FASHION`), akun tersebut tidak akan dipasangi produk `ELEKTRONIK` kecuali disetel `UNIVERSAL`.

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
            ↓ (Ya: Mode Media)      ↓ (Tidak: Mode No-Media)
[FASE 2: Publish First Reply]   [Selesai Publikasi / Link Card Rendered by Meta]
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
| **Threads** | ✅ Dual-Mode (Caption Link Card Preview ATAU First-Reply) | Target 150–350 karakter (Maksimal API 500) | **Target Utama Autopilot**. Mendukung posting visual dengan first-reply, atau posting teks murni dengan Link Card Preview native Meta. |
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
  cta_type?: 'conversation_cta' | 'curiosity_cta' | 'soft_cta' | 'direct_link_cta' | 'link_card_cta' | 'no_cta';
  status: 'draft' | 'scheduled' | 'posted' | 'failed';
  
  // Objek First-Reply (Khusus Threads Mode With-Media)
  first_reply?: {
    enabled: boolean;            // false jika Threads no_media
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

### 2. `social_accounts` (Akun Terhubung & Preferensi Mode)
```typescript
interface SocialAccountDocument {
  id: string;
  user_id: string;
  platform: 'facebook' | 'instagram' | 'threads' | 'telegram';
  page_name: string;
  page_id: string;
  is_active: boolean | number;
  allowed_niches: string[];      // ['UNIVERSAL'] atau ['FASHION_WOMEN', 'BEAUTY_SKINCARE']
  threads_media_mode?: 'auto' | 'no_media' | 'with_media'; // Khusus Threads
  content_persona_id?: string;   // 'bestie_hype' | 'aesthetic_minimalist' | 'witty_curhat' | 'bargain_hunter' | 'pov_reviewer' | 'soft_lifestyle' | 'relatable_everyday' | 'practical_expert' | 'ai_adaptive'
}
```

### 3. `product_post_memory`
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
    account_id: string;
    account_name: string;
    persona_id: string;          // e.g. 'bestie_hype'
    persona_name: string;        // e.g. '💕 Bestie Hype'
    archetype_id: string;        // e.g. 'emotional_reaction'
    archetype_name: string;      // e.g. 'Emotional Reaction & Bestie Hype'
    natural_product_reference: string; // e.g. 'flatshoes ini'
    shortlink_code: string;
    posting_hour: number;
    copy_angle: string;
    template_id: string;
    template_name: string;
    media_type: 'image' | 'video' | 'text';
    media_urls: string[];
    content_fingerprint: string;
    caption_preview: string;
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

### 4. `affiliate_products` (Cuplikan Pelacakan Media)
```typescript
interface AffiliateProductDocument {
  id: string;
  title: string;
  price: number;
  images: string[];
  videos: string[];
  used_media_by_platform?: {
    facebook?: string[];
    threads?: string[];
  };
  used_media_by_account?: {
    [account_id: string]: string[];
  };
  lifecycle_status: 'NEW' | 'TESTING' | 'PROMISING' | 'PROVEN' | 'STOPPED';
}
```

### 5. `threads_post_context`
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
