# AGENTS.md — webgiskemitir (WebGIS Kemitir Tangguh Bencana)

Frontend WebGIS berbasis **React 19 + Vite + TypeScript + Bun** untuk sistem pemantauan dan penanggulangan kekeringan Desa Kemitir (KKN).
Repo ini adalah klien web dari backend [`bekemitir`](https://github.com/bgsnr/bekemitir) dan berbagi 1 database serta 1 design system dengan aplikasi mobile Expo [`appgiskemitir`](https://github.com/bgsnr/appgiskemitir).

## Runtime & Commands (Bun)

Proyek ini memakai `bun.lock`. Gunakan `bun` / `bunx` (bukan npm/yarn/pnpm):

```bash
bun install
bun run dev
bun run build
bun run lint
```

## Kontrak Backend (Single Source of Truth)

- **Base API:** `${import.meta.env.VITE_API_BASE_URL}/api/v1`
- **Dokumentasi OpenAPI 3.1:** `GET /api/v1/openapi.json` & `GET /api/v1/docs` (sumber di `../bekemitir/openapi.json`)
- **Jangan mengarang nama field JSON.** Selalu cocokkan dengan kontrak `openapi.json` dari `bekemitir`.
- **Envelope respons:** `{ success: boolean, data, error, meta }`.

## Autentikasi Web (Cookie `httpOnly`)

- Wajib kirim `credentials: 'include'` pada semua `fetch` ke `/api/v1/*`.
- **Dilarang** menyimpan JWT di `localStorage` atau `sessionStorage` di klien web.
- Login: `POST /api/v1/auth/login` dengan `{ email, password, clientType: 'web' }`.
- Saat `401`: panggil `POST /api/v1/auth/refresh` (cookie refresh dikirim otomatis oleh browser) lalu ulangi request.

## Peta 3D & Multi-Layer Overlay (Mapbox GL JS)

- Gunakan **Mapbox GL JS** (`mapbox-gl`) dengan token publik `import.meta.env.VITE_MAPBOX_ACCESS_TOKEN` (berawalan `pk.`, **dilarang** menaruh token rahasia `sk.` atau meng-commit `.env`).
- **Wajib Server-Driven:** Saat halaman peta dimuat, panggil:
  1. `GET /api/v1/map-config` → mengambil kamera default Desa Kemitir, konfigurasi **3D Terrain** (Opsi A default `mapbox://mapbox.mapbox-terrain-dem-v1`; otomatis beralih ke Opsi B bila Admin mengubahnya), daftar basemap Mapbox, `orthophoto`, `layerGroups`, `overlayPresets`, dan `designTokens`.
  2. `GET /api/v1/layers` → mengambil daftar seluruh layer spasial aktif beserta `tileUrlTemplate` (`.mvt`), `pmtilesUrl`, `styleConfig`, `groupCode`, `defaultOpacity`, dan `metadata`.
- **Dilarang** hardcode daftar layer atau memuat GeoJSON besar. Gunakan Vector Tiles MVT dari backend `bekemitir` (`type: 'vector'`, URL `/api/v1/tiles/:slug/{z}/{x}/{y}.mvt`).

## 11 Menu Utama WebGIS

1. Dashboard
2. Peta Dasar
3. Peta Ancaman Kekeringan
4. Peta Risiko Kekeringan
5. Sumber Air
6. Aksesibilitas
7. Peta Partisipatif *(harus bisa di-overlay & dibandingkan dengan Peta Ancaman)*
8. Prioritas Penanganan
9. Laporan Masyarakat
10. Edukasi / Informasi
11. Admin *(validasi masyarakat, upload `.zip` shapefile, kelola layer & `PATCH /api/v1/map-config`)*

Halaman peta tematik (menu 2–8) wajib memakai **1 komponen peta multi-layer yang sama** dengan preset layer awal berbeda.

## Design System Bersama

Gunakan token warna dan tipografi dari [src/design-tokens.json](src/design-tokens.json) (identik dengan `bekemitir/docs/design-tokens.json` dan `data.designTokens` dari `GET /api/v1/map-config`) agar identitas visual konsisten dengan `appgiskemitir`.
