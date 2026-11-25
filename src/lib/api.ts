export const API_BASE = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000').replace(
  /\/$/,
  ''
)
export const MAPBOX_TOKEN = (import.meta.env.VITE_MAPBOX_ACCESS_TOKEN || '').trim()

export interface ApiEnvelope<T> {
  success: boolean
  data?: T
  error?: { code: string; message: string }
  meta?: { nextCursor?: string | null; limit?: number }
}

export interface BasemapItem {
  id: string
  name: string
  type: 'raster' | 'vector'
  tiles?: string[]
  styleUrl?: string
  tileSize?: number
  attribution: string
  isDefault: boolean
}

export interface LayerGroup {
  code: string
  name: string
  description: string
  displayOrder: number
}

export interface OverlayPreset {
  id: string
  slug: string
  name: string
  description: string
  layersConfig: { layerSlug: string; opacity: number; order: number }[]
  isPublic: boolean
}

export interface MapConfig {
  camera: { center: [number, number]; zoom: number; pitch: number; bearing: number }
  terrain: {
    enabled: boolean
    mode: 'external_dem' | 'pmtiles_dtm' | 'off'
    type: 'raster-dem'
    url: string | null
    encoding: 'terrarium' | 'mapbox'
    tileSize: number
    exaggeration: number
  }
  orthophoto: {
    enabled: boolean
    r2PmtilesKey: string | null
    pmtilesUrl: string | null
    opacity: number
  }
  basemaps: BasemapItem[]
  layerGroups: LayerGroup[]
  overlayPresets: OverlayPreset[]
  updatedAt: string
}

export interface SpatialLayer {
  id: string
  slug: string
  name: string
  description: string
  groupCode: string | null
  layerCode: string | null
  displayOrder: number
  defaultOpacity: number
  metadata: Record<string, unknown>
  layerType: 'vector_mvt' | 'raster_pmtiles'
  geometryType: 'Point' | 'LineString' | 'Polygon' | 'MultiPolygon' | 'Geometry' | 'Raster'
  tileUrlTemplate: string | null
  pmtilesUrl: string | null
  minZoom: number
  maxZoom: number
  bbox: [number, number, number, number]
  styleConfig: Record<string, unknown>
  isPublic: boolean
  featureCount: number
  updatedAt: string
}

export interface Observation {
  id: string
  category: string
  severity: 'normal' | 'waspada' | 'siaga' | 'awas'
  title: string
  notes: string
  properties: Record<string, unknown>
  observedAt: string
  lng: number
  lat: number
}

export interface DroughtSummary {
  totalObservations: number
  bySeverity: { normal: number; waspada: number; siaga: number; awas: number }
  latestObservedAt: string | null
  totalPublicLayers: number
}

export interface AuthUser {
  id: string
  email: string
  name: string
  role: 'anon' | 'petugas' | 'admin'
}

export interface ImportJob {
  id: string
  layerName: string
  layerSlug: string
  fileType: string
  status: string
  errorMessage: string | null
  createdAt: string
}

async function apiRequest<T>(path: string, init: RequestInit = {}, allowRefresh = true): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init.headers || {}),
    },
  })

  if (res.status === 401 && allowRefresh && !path.startsWith('/api/v1/auth/')) {
    const refresh = await fetch(`${API_BASE}/api/v1/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    })
    if (refresh.ok) return apiRequest<T>(path, init, false)
  }

  const json = (await res.json()) as ApiEnvelope<T>
  if (!res.ok || !json.success || json.data === undefined) {
    throw new Error(json.error?.message || `HTTP ${res.status}`)
  }
  return json.data
}

export const api = {
  getMapConfig: () => apiRequest<MapConfig>('/api/v1/map-config'),
  patchMapConfig: (patch: Record<string, unknown>) =>
    apiRequest<MapConfig>('/api/v1/map-config', { method: 'PATCH', body: JSON.stringify(patch) }),
  getLayers: () => apiRequest<{ items: SpatialLayer[] }>('/api/v1/layers'),
  getSummary: () => apiRequest<DroughtSummary>('/api/v1/summaries/drought'),
  getObservations: (severity?: string) => {
    const qs = new URLSearchParams({ limit: '50' })
    if (severity && severity !== 'all') qs.set('severity', severity)
    return apiRequest<{ items: Observation[] }>(`/api/v1/observations?${qs.toString()}`)
  },
  getMe: () => apiRequest<{ user: AuthUser }>('/api/v1/auth/me'),
  login: (email: string, password: string) =>
    apiRequest<{ user: AuthUser }>('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password, clientType: 'web' }),
    }),
  logout: () => apiRequest<{ loggedOut: boolean }>('/api/v1/auth/logout', { method: 'POST' }),
  getImports: () => apiRequest<{ items: ImportJob[] }>('/api/v1/imports'),
}
