import { useState, type FormEvent } from 'react'
import { MapPin, RefreshCw, ShieldCheck } from 'lucide-react'
import tokens from '../design-tokens.json'
import {
  api,
  type AuthUser,
  type DroughtSummary,
  type ImportJob,
  type MapConfig,
  type Observation,
  type SpatialLayer,
} from '../lib/api'

const SEVERITY_COLOR: Record<string, string> = tokens.droughtSeverity

export function DashboardView({
  summary,
  mapConfig,
  layers,
  observations,
  onOpenMap,
  onFocusObservation,
}: {
  summary: DroughtSummary | null
  mapConfig: MapConfig
  layers: SpatialLayer[]
  observations: Observation[]
  onOpenMap: () => void
  onFocusObservation: (obs: Observation) => void
}) {
  return (
    <div className="page-container">
      <header className="page-header">
        <div>
          <h1>Dashboard Pemantauan Kekeringan</h1>
          <p>
            Pusat data spasial Desa Kemitir — integrasi data ilmiah GIS, sumber air, dan laporan
            lapangan Android.
          </p>
        </div>
        <button type="button" className="btn-primary" onClick={onOpenMap}>
          Buka Peta 3D Interaktif
        </button>
      </header>

      <div className="stat-grid">
        <div className="stat-card">
          <span className="stat-label">Total Observasi Lapangan</span>
          <strong className="stat-value">{summary?.totalObservations ?? 0}</strong>
        </div>
        <div className="stat-card">
          <span className="stat-label">Status Awas</span>
          <strong className="stat-value" style={{ color: SEVERITY_COLOR.awas }}>
            {summary?.bySeverity.awas ?? 0}
          </strong>
        </div>
        <div className="stat-card">
          <span className="stat-label">Status Siaga</span>
          <strong className="stat-value" style={{ color: SEVERITY_COLOR.siaga }}>
            {summary?.bySeverity.siaga ?? 0}
          </strong>
        </div>
        <div className="stat-card">
          <span className="stat-label">Layer Spasial Publik</span>
          <strong className="stat-value">{layers.length}</strong>
        </div>
      </div>

      <div className="two-col">
        <section className="panel">
          <div className="panel-head">
            <h2>Laporan & Observasi Terbaru</h2>
            <span className="muted-line">Klik baris untuk lihat di peta 3D</span>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Judul</th>
                <th>Kategori</th>
                <th>Status</th>
                <th>Waktu</th>
              </tr>
            </thead>
            <tbody>
              {observations.slice(0, 6).map((obs) => (
                <tr key={obs.id} className="clickable-row" onClick={() => onFocusObservation(obs)}>
                  <td>{obs.title}</td>
                  <td>
                    <code>{obs.category}</code>
                  </td>
                  <td>
                    <span
                      className="sev-badge"
                      style={{
                        borderColor: SEVERITY_COLOR[obs.severity],
                        color: SEVERITY_COLOR[obs.severity],
                      }}
                    >
                      {obs.severity}
                    </span>
                  </td>
                  <td className="mono-num">{new Date(obs.observedAt).toLocaleDateString('id-ID')}</td>
                </tr>
              ))}
              {observations.length === 0 && (
                <tr>
                  <td colSpan={4} className="muted-line">
                    Belum ada data observasi di database.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>

        <section className="panel">
          <div className="panel-head">
            <h2>Konfigurasi Spasial Aktif</h2>
          </div>
          <dl className="kv-list">
            <div>
              <dt>Mode 3D Terrain</dt>
              <dd>
                <code>{mapConfig.terrain.mode}</code> ({mapConfig.terrain.encoding})
              </dd>
            </div>
            <div>
              <dt>Sumber DEM</dt>
              <dd className="mono-break">{mapConfig.terrain.url ?? 'Nonaktif'}</dd>
            </div>
            <div>
              <dt>Orthofoto Drone (Opsi B)</dt>
              <dd>{mapConfig.orthophoto.enabled ? 'Aktif (PMTiles R2)' : 'Belum diaktifkan (Opsi A)'}</dd>
            </div>
            <div>
              <dt>Preset Overlay Tersedia</dt>
              <dd>{mapConfig.overlayPresets.length} kombinasi multi-layer</dd>
            </div>
          </dl>
        </section>
      </div>
    </div>
  )
}

export function ReportsView({
  observations,
  severityFilter,
  onFilterChange,
  onFocusObservation,
}: {
  observations: Observation[]
  severityFilter: string
  onFilterChange: (sev: string) => void
  onFocusObservation: (obs: Observation) => void
}) {
  return (
    <div className="page-container">
      <header className="page-header">
        <div>
          <h1>Laporan Masyarakat & Observasi Lapangan</h1>
          <p>Data disinkronkan dari aplikasi Android ke database PostGIS tunggal.</p>
        </div>
        <select
          aria-label="Filter keparahan"
          className="ctrl-select"
          value={severityFilter}
          onChange={(e) => onFilterChange(e.target.value)}
        >
          <option value="all">Semua Keparahan</option>
          <option value="awas">Awas</option>
          <option value="siaga">Siaga</option>
          <option value="waspada">Waspada</option>
          <option value="normal">Normal</option>
        </select>
      </header>

      <section className="panel">
        <table className="data-table">
          <thead>
            <tr>
              <th>Judul & Catatan</th>
              <th>Kategori</th>
              <th>Keparahan</th>
              <th>Koordinat</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {observations.map((obs) => (
              <tr key={obs.id}>
                <td>
                  <strong>{obs.title}</strong>
                  {obs.notes && <div className="muted-line">{obs.notes}</div>}
                </td>
                <td>
                  <code>{obs.category}</code>
                </td>
                <td>
                  <span
                    className="sev-badge"
                    style={{
                      borderColor: SEVERITY_COLOR[obs.severity],
                      color: SEVERITY_COLOR[obs.severity],
                    }}
                  >
                    {obs.severity}
                  </span>
                </td>
                <td className="mono-num">
                  {obs.lat.toFixed(4)}, {obs.lng.toFixed(4)}
                </td>
                <td>
                  <button
                    type="button"
                    className="ctrl-btn"
                    onClick={() => onFocusObservation(obs)}
                  >
                    <MapPin size={13} /> Peta
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  )
}

export function EducationView() {
  return (
    <div className="page-container">
      <header className="page-header">
        <div>
          <h1>Informasi & Edukasi Kemitir Tangguh Bencana</h1>
          <p>Panduan membaca peta risiko kekeringan dan langkah kesiapsiagaan warga desa.</p>
        </div>
      </header>

      <div className="two-col">
        <section className="panel">
          <h2>Cara Membaca Kelas Kekeringan</h2>
          <ul className="edu-list">
            <li>
              <strong style={{ color: SEVERITY_COLOR.normal }}>Normal / Rendah:</strong> Ketersediaan
              air sumur dan irigasi mencukupi kebutuhan harian.
            </li>
            <li>
              <strong style={{ color: SEVERITY_COLOR.waspada }}>Waspada / Sedang:</strong> Debit mata
              air mulai menyusut; warga disarankan mulai menghemat pemakaian air.
            </li>
            <li>
              <strong style={{ color: SEVERITY_COLOR.siaga }}>Siaga / Tinggi:</strong> Sebagian sumur
              warga mengering; perlu penjadwalan distribusi air dari tandon/embung.
            </li>
            <li>
              <strong style={{ color: SEVERITY_COLOR.awas }}>Awas / Prioritas 1:</strong> Krisis air
              bersih dan kekeringan lahan meluas; prioritas utama dropping air bersih.
            </li>
          </ul>
        </section>

        <section className="panel">
          <h2>Alur Partisipasi Warga</h2>
          <ol className="edu-list">
            <li>Warga mengirim laporan kondisi atau titik pemetaan lewat aplikasi Android.</li>
            <li>Data masuk ke database desa bersama koordinat GPS dan dokumentasi foto.</li>
            <li>Admin desa memvalidasi laporan dengan membandingkannya terhadap Peta Ancaman.</li>
            <li>Data tervalidasi langsung tampil di WebGIS sebagai dasar prioritas penanganan.</li>
          </ol>
        </section>
      </div>
    </div>
  )
}

export function AdminView({
  user,
  mapConfig,
  layers,
  imports,
  onAuthChange,
  onConfigUpdated,
  onRefreshAll,
}: {
  user: AuthUser | null
  mapConfig: MapConfig
  layers: SpatialLayer[]
  imports: ImportJob[]
  onAuthChange: (user: AuthUser | null) => void
  onConfigUpdated: (next: MapConfig) => void
  onRefreshAll: () => void
}) {
  const [email, setEmail] = useState('admin@kemitir.id')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [statusMsg, setStatusMsg] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const [terrainMode, setTerrainMode] = useState(mapConfig.terrain.mode)
  const [terrainUrl, setTerrainUrl] = useState(
    mapConfig.terrain.url ?? 'mapbox://mapbox.mapbox-terrain-dem-v1'
  )
  const [exaggeration, setExaggeration] = useState(mapConfig.terrain.exaggeration)
  const [orthoKey, setOrthoKey] = useState(mapConfig.orthophoto.r2PmtilesKey ?? '')

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      const res = await api.login(email, password)
      onAuthChange(res.user)
      setPassword('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login gagal.')
    } finally {
      setBusy(false)
    }
  }

  const handleSaveMapConfig = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setStatusMsg(null)
    setBusy(true)
    try {
      const updated = await api.patchMapConfig({
        terrainMode,
        terrainUrl,
        terrainExaggeration: Number(exaggeration),
        orthophotoPmtilesKey: orthoKey.trim() === '' ? null : orthoKey.trim(),
      })
      onConfigUpdated(updated)
      setStatusMsg('Konfigurasi Peta 3D berhasil disimpan ke PostgreSQL.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan konfigurasi.')
    } finally {
      setBusy(false)
    }
  }

  if (!user) {
    return (
      <div className="page-container">
        <div className="login-box panel">
          <div className="login-head">
            <ShieldCheck size={18} />
            <h1>Login Admin WebGIS</h1>
          </div>
          <p className="muted-line">
            Autentikasi menggunakan <code>httpOnly Cookie</code> dari backend <code>bekemitir</code>.
          </p>
          <form onSubmit={handleLogin} className="form-stack">
            <label>
              <span>Email</span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <label>
              <span>Kata Sandi</span>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            {error && <div className="alert-error">{error}</div>}
            <button type="submit" className="btn-primary" disabled={busy}>
              {busy ? 'Memverifikasi...' : 'Masuk'}
            </button>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div className="page-container">
      <header className="page-header">
        <div>
          <h1>Panel Admin — {user.name}</h1>
          <p>
            Masuk sebagai <code>{user.email}</code> ({user.role})
          </p>
        </div>
        <div className="map-controls-inline">
          <button type="button" className="ctrl-btn" onClick={onRefreshAll}>
            <RefreshCw size={14} /> Muat Ulang
          </button>
          <button
            type="button"
            className="ctrl-btn"
            onClick={async () => {
              await api.logout()
              onAuthChange(null)
            }}
          >
            Keluar
          </button>
        </div>
      </header>

      <div className="two-col">
        <section className="panel">
          <h2>Pengaturan Peta 3D (Opsi A → Opsi B)</h2>
          <p className="muted-line">
            Perubahan di sini otomatis berlaku di WebGIS dan Android tanpa build ulang.
          </p>
          <form onSubmit={handleSaveMapConfig} className="form-stack">
            <label>
              <span>Mode Terrain</span>
              <select
                value={terrainMode}
                onChange={(e) =>
                  setTerrainMode(e.target.value as MapConfig['terrain']['mode'])
                }
              >
                <option value="external_dem">Opsi A — Mapbox 3D Terrain (external_dem)</option>
                <option value="pmtiles_dtm">Opsi B — DTM Drone R2 (pmtiles_dtm)</option>
                <option value="off">2D Saja (off)</option>
              </select>
            </label>
            <label>
              <span>URL Sumber Terrain DEM</span>
              <input
                type="text"
                value={terrainUrl}
                onChange={(e) => setTerrainUrl(e.target.value)}
              />
            </label>
            <label>
              <span>Skala Ketinggian 3D (Exaggeration: {exaggeration}x)</span>
              <input
                type="range"
                min={0.5}
                max={3}
                step={0.1}
                value={exaggeration}
                onChange={(e) => setExaggeration(Number(e.target.value))}
              />
            </label>
            <label>
              <span>Key Orthofoto Drone R2 (Opsional — Opsi B)</span>
              <input
                type="text"
                placeholder="pmtiles/orthofoto-kemitir.pmtiles"
                value={orthoKey}
                onChange={(e) => setOrthoKey(e.target.value)}
              />
            </label>
            {error && <div className="alert-error">{error}</div>}
            {statusMsg && <div className="alert-ok">{statusMsg}</div>}
            <button type="submit" className="btn-primary" disabled={busy}>
              Simpan Konfigurasi Peta 3D
            </button>
          </form>
        </section>

        <section className="panel">
          <h2>Katalog Layer Terdaftar ({layers.length})</h2>
          <table className="data-table">
            <thead>
              <tr>
                <th>Slug</th>
                <th>Geometri</th>
                <th>Fitur</th>
              </tr>
            </thead>
            <tbody>
              {layers.map((l) => (
                <tr key={l.id}>
                  <td>
                    <code>{l.slug}</code>
                  </td>
                  <td>{l.geometryType}</td>
                  <td className="mono-num">{l.featureCount}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <h2 style={{ marginTop: 20 }}>Riwayat Import Shapefile / Raster ({imports.length})</h2>
          {imports.length === 0 ? (
            <p className="muted-line">Belum ada antrean import file.</p>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Layer</th>
                  <th>Tipe</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {imports.map((job) => (
                  <tr key={job.id}>
                    <td>{job.layerName}</td>
                    <td>
                      <code>{job.fileType}</code>
                    </td>
                    <td>{job.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </div>
  )
}
