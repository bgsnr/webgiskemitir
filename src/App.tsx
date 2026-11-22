import { useCallback, useEffect, useState } from 'react'
import {
  AlertTriangle,
  BookOpen,
  Compass,
  Droplets,
  FileText,
  Flame,
  LayoutDashboard,
  ListOrdered,
  Map as MapIcon,
  Settings,
  Users,
} from 'lucide-react'
import { MapWorkspace, type LayerState } from './components/MapWorkspace'
import { AdminView, DashboardView, EducationView, ReportsView } from './components/SideViews'
import {
  api,
  type AuthUser,
  type DroughtSummary,
  type ImportJob,
  type MapConfig,
  type Observation,
  type SpatialLayer,
} from './lib/api'

type MenuId =
  | 'dashboard'
  | 'peta-dasar'
  | 'ancaman'
  | 'risiko'
  | 'sumber-air'
  | 'aksesibilitas'
  | 'partisipatif'
  | 'prioritas'
  | 'laporan'
  | 'edukasi'
  | 'admin'

interface MenuItem {
  id: MenuId
  label: string
  section: 'Ikhtisar' | 'Peta Tematik (Multi-Layer)' | 'Operasional'
  isMap: boolean
  defaultPreset?: string
  icon: typeof MapIcon
}

const MENUS: readonly MenuItem[] = [
  { id: 'dashboard', label: 'Dashboard', section: 'Ikhtisar', isMap: false, icon: LayoutDashboard },
  { id: 'peta-dasar', label: 'Peta Dasar', section: 'Peta Tematik (Multi-Layer)', isMap: true, icon: MapIcon },
  {
    id: 'ancaman',
    label: 'Ancaman Kekeringan',
    section: 'Peta Tematik (Multi-Layer)',
    isMap: true,
    defaultPreset: 'ancaman-keterpaparan-air-partisipatif',
    icon: Flame,
  },
  {
    id: 'risiko',
    label: 'Risiko Kekeringan',
    section: 'Peta Tematik (Multi-Layer)',
    isMap: true,
    defaultPreset: 'risiko-dan-prioritas',
    icon: AlertTriangle,
  },
  {
    id: 'sumber-air',
    label: 'Sumber Air',
    section: 'Peta Tematik (Multi-Layer)',
    isMap: true,
    defaultPreset: 'sumber-air-dan-aksesibilitas',
    icon: Droplets,
  },
  {
    id: 'aksesibilitas',
    label: 'Aksesibilitas',
    section: 'Peta Tematik (Multi-Layer)',
    isMap: true,
    defaultPreset: 'sumber-air-dan-aksesibilitas',
    icon: Compass,
  },
  {
    id: 'partisipatif',
    label: 'Peta Partisipatif',
    section: 'Peta Tematik (Multi-Layer)',
    isMap: true,
    defaultPreset: 'ancaman-keterpaparan-air-partisipatif',
    icon: Users,
  },
  {
    id: 'prioritas',
    label: 'Prioritas Penanganan',
    section: 'Peta Tematik (Multi-Layer)',
    isMap: true,
    defaultPreset: 'risiko-dan-prioritas',
    icon: ListOrdered,
  },
  { id: 'laporan', label: 'Laporan Masyarakat', section: 'Operasional', isMap: false, icon: FileText },
  { id: 'edukasi', label: 'Edukasi / Informasi', section: 'Operasional', isMap: false, icon: BookOpen },
  { id: 'admin', label: 'Admin', section: 'Operasional', isMap: false, icon: Settings },
]

export default function App() {
  const [activeMenu, setActiveMenu] = useState<MenuId>('peta-dasar')
  const [mapConfig, setMapConfig] = useState<MapConfig | null>(null)
  const [layers, setLayers] = useState<SpatialLayer[]>([])
  const [summary, setSummary] = useState<DroughtSummary | null>(null)
  const [observations, setObservations] = useState<Observation[]>([])
  const [severityFilter, setSeverityFilter] = useState('all')
  const [user, setUser] = useState<AuthUser | null>(null)
  const [imports, setImports] = useState<ImportJob[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)

  const [layerState, setLayerState] = useState<Record<string, LayerState>>({
    observations: { visible: true, opacity: 1 },
  })
  const [activePresetSlug, setActivePresetSlug] = useState<string | null>(null)
  const [focusCoord, setFocusCoord] = useState<{ lng: number; lat: number; zoom?: number } | null>(
    null
  )

  const loadCoreData = useCallback(async () => {
    setLoadError(null)
    try {
      const [cfg, layerRes, sumRes, obsRes] = await Promise.all([
        api.getMapConfig(),
        api.getLayers(),
        api.getSummary(),
        api.getObservations(),
      ])
      setMapConfig(cfg)
      setLayers(layerRes.items)
      setSummary(sumRes)
      setObservations(obsRes.items)

      setLayerState((prev) => {
        const next: Record<string, LayerState> = {
          observations: prev.observations ?? { visible: true, opacity: 1 },
        }
        for (const l of layerRes.items) {
          next[l.slug] = prev[l.slug] ?? { visible: true, opacity: l.defaultOpacity }
        }
        return next
      })
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Gagal terhubung ke backend bekemitir.')
    }
  }, [])

  useEffect(() => {
    loadCoreData()
    api
      .getMe()
      .then((res) => setUser(res.user))
      .catch(() => setUser(null))
  }, [loadCoreData])

  useEffect(() => {
    if (user?.role === 'admin') {
      api
        .getImports()
        .then((res) => setImports(res.items))
        .catch(() => setImports([]))
    } else {
      setImports([])
    }
  }, [user])

  const handleSeverityFilter = async (sev: string) => {
    setSeverityFilter(sev)
    try {
      const res = await api.getObservations(sev)
      setObservations(res.items)
    } catch {
      // Abaikan kegagalan filter sementara
    }
  }

  const handleApplyPreset = (presetSlug: string) => {
    if (!mapConfig) return
    const preset = mapConfig.overlayPresets.find((p) => p.slug === presetSlug)
    if (!preset) return
    setActivePresetSlug(presetSlug)

    const presetSlugs = new Map(preset.layersConfig.map((c) => [c.layerSlug, c.opacity]))
    setLayerState((prev) => {
      const next: Record<string, LayerState> = {}
      const knownSlugs = [...layers.map((l) => l.slug), 'observations']
      const anyMatched = knownSlugs.some((s) => presetSlugs.has(s))

      for (const slug of knownSlugs) {
        if (presetSlugs.has(slug)) {
          next[slug] = { visible: true, opacity: presetSlugs.get(slug) ?? 0.8 }
        } else {
          // Jika layer preset dari Geodesi belum di-upload, pertahankan layer seed agar peta tidak kosong
          next[slug] = anyMatched
            ? { visible: false, opacity: prev[slug]?.opacity ?? 0.8 }
            : { visible: true, opacity: prev[slug]?.opacity ?? 0.8 }
        }
      }
      return next
    })
  }

  const handleSelectMenu = (item: MenuItem) => {
    setActiveMenu(item.id)
    if (item.isMap && item.defaultPreset) {
      handleApplyPreset(item.defaultPreset)
    }
  }

  const handleFocusObservation = (obs: Observation) => {
    setActiveMenu('peta-dasar')
    setLayerState((prev) => ({ ...prev, observations: { visible: true, opacity: 1 } }))
    setFocusCoord({ lng: obs.lng, lat: obs.lat, zoom: 16 })
  }

  const currentMenu = MENUS.find((m) => m.id === activeMenu) ?? MENUS[0]
  const sections: MenuItem['section'][] = ['Ikhtisar', 'Peta Tematik (Multi-Layer)', 'Operasional']

  return (
    <div className="app-shell">
      <nav className="sidebar" aria-label="Menu Utama WebGIS">
        <div className="brand-block">
          <div className="brand-mark" aria-hidden="true" />
          <div>
            <div className="brand-name">Kemitir Tangguh</div>
            <div className="brand-sub">WebGIS Kekeringan Desa</div>
          </div>
        </div>

        <div className="nav-scroll">
          {sections.map((section) => (
            <div key={section} className="nav-group">
              <div className="nav-group-label">{section}</div>
              {MENUS.filter((m) => m.section === section).map((item) => {
                const Icon = item.icon
                const active = activeMenu === item.id
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={`nav-item ${active ? 'nav-item-active' : ''}`}
                    onClick={() => handleSelectMenu(item)}
                  >
                    <Icon size={15} />
                    <span>{item.label}</span>
                  </button>
                )
              })}
            </div>
          ))}
        </div>

        <div className="sidebar-footer">
          <span className={`status-dot ${loadError ? 'status-err' : 'status-ok'}`} />
          <span>{loadError ? 'Backend terputus' : 'PostGIS Terhubung'}</span>
        </div>
      </nav>

      <main className="workspace-main">
        {loadError && !mapConfig ? (
          <div className="token-empty-state">
            <div className="token-empty-box">
              <h2>Tidak Dapat Terhubung ke Backend</h2>
              <p>{loadError}</p>
              <p className="muted-line">
                Pastikan server <code>bekemitir</code> berjalan (<code>bun run dev</code>) dan{' '}
                <code>VITE_API_BASE_URL</code> di <code>.env</code> sesuai.
              </p>
              <button type="button" className="btn-primary" onClick={loadCoreData}>
                Coba Lagi
              </button>
            </div>
          </div>
        ) : !mapConfig ? (
          <div className="token-empty-state">
            <span className="muted-line">Memuat konfigurasi spasial Desa Kemitir...</span>
          </div>
        ) : currentMenu.isMap ? (
          <MapWorkspace
            mapConfig={mapConfig}
            layers={layers}
            layerState={layerState}
            activePresetSlug={activePresetSlug}
            focusCoord={focusCoord}
            menuTitle={currentMenu.label}
            onToggleLayer={(slug) =>
              setLayerState((prev) => ({
                ...prev,
                [slug]: {
                  visible: !(prev[slug]?.visible ?? true),
                  opacity: prev[slug]?.opacity ?? 0.8,
                },
              }))
            }
            onOpacityChange={(slug, opacity) =>
              setLayerState((prev) => ({
                ...prev,
                [slug]: { visible: prev[slug]?.visible ?? true, opacity },
              }))
            }
            onApplyPreset={handleApplyPreset}
          />
        ) : activeMenu === 'dashboard' ? (
          <DashboardView
            summary={summary}
            mapConfig={mapConfig}
            layers={layers}
            observations={observations}
            onOpenMap={() => setActiveMenu('peta-dasar')}
            onFocusObservation={handleFocusObservation}
          />
        ) : activeMenu === 'laporan' ? (
          <ReportsView
            observations={observations}
            severityFilter={severityFilter}
            onFilterChange={handleSeverityFilter}
            onFocusObservation={handleFocusObservation}
          />
        ) : activeMenu === 'edukasi' ? (
          <EducationView />
        ) : (
          <AdminView
            user={user}
            mapConfig={mapConfig}
            layers={layers}
            imports={imports}
            onAuthChange={setUser}
            onConfigUpdated={setMapConfig}
            onRefreshAll={loadCoreData}
          />
        )}
      </main>
    </div>
  )
}
