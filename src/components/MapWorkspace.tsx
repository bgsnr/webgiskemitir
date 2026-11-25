import { useEffect, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { Layers, Mountain, SlidersHorizontal, X } from 'lucide-react'
import tokens from '../design-tokens.json'
import { API_BASE, MAPBOX_TOKEN, type MapConfig, type SpatialLayer } from '../lib/api'

export interface LayerState {
  visible: boolean
  opacity: number
}

interface Props {
  mapConfig: MapConfig
  layers: SpatialLayer[]
  layerState: Record<string, LayerState>
  activePresetSlug: string | null
  focusCoord: { lng: number; lat: number; zoom?: number } | null
  menuTitle: string
  onToggleLayer: (slug: string) => void
  onOpacityChange: (slug: string, opacity: number) => void
  onApplyPreset: (slug: string) => void
}

const OBSERVATIONS_PSEUDO_LAYER: SpatialLayer = {
  id: 'builtin-observations',
  slug: 'observations',
  name: 'Titik Observasi & Laporan Lapangan',
  description: 'Titik observasi kekeringan dari survei lapangan & aplikasi Android (MVT PostGIS).',
  groupCode: 'laporan',
  layerCode: 'L-60',
  displayOrder: 90,
  defaultOpacity: 1,
  metadata: {},
  layerType: 'vector_mvt',
  geometryType: 'Point',
  tileUrlTemplate: '/api/v1/tiles/observations/{z}/{x}/{y}.mvt',
  pmtilesUrl: null,
  minZoom: 0,
  maxZoom: 20,
  bbox: [110.26, -7.24, 110.32, -7.2],
  styleConfig: {},
  isPublic: true,
  featureCount: 0,
  updatedAt: '',
}

function attachMvtLayer(
  map: mapboxgl.Map,
  layer: SpatialLayer,
  state: LayerState
): void {
  if (!layer.tileUrlTemplate) return
  const sourceId = `src-${layer.slug}`
  const tilesUrl = `${API_BASE}${layer.tileUrlTemplate}`

  if (!map.getSource(sourceId)) {
    map.addSource(sourceId, {
      type: 'vector',
      tiles: [tilesUrl],
      minzoom: layer.minZoom,
      maxzoom: layer.maxZoom,
    })
  }

  const visibility = state.visible ? 'visible' : 'none'

  if (layer.slug === 'observations' || layer.geometryType === 'Point') {
    const id = `lyr-${layer.slug}-pt`
    if (!map.getLayer(id)) {
      map.addLayer({
        id,
        type: 'circle',
        source: sourceId,
        'source-layer': layer.slug,
        layout: { visibility },
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 12, 5, 16, 8],
          'circle-stroke-color': '#FFFFFF',
          'circle-stroke-width': 1.5,
          'circle-opacity': state.opacity,
          'circle-color': [
            'match',
            ['get', 'severity'],
            'awas',
            tokens.droughtSeverity.awas,
            'siaga',
            tokens.droughtSeverity.siaga,
            'waspada',
            tokens.droughtSeverity.waspada,
            'normal',
            tokens.droughtSeverity.normal,
            tokens.brand.primary,
          ],
        },
      })
    }
    return
  }

  if (layer.geometryType === 'LineString') {
    const id = `lyr-${layer.slug}-line`
    if (!map.getLayer(id)) {
      map.addLayer({
        id,
        type: 'line',
        source: sourceId,
        'source-layer': layer.slug,
        layout: { visibility },
        paint: {
          'line-color': String(layer.styleConfig.strokeColor || tokens.brand.primary),
          'line-width': 2,
          'line-opacity': state.opacity,
        },
      })
    }
    return
  }

  // Polygon / MultiPolygon / Geometry
  const fillId = `lyr-${layer.slug}-fill`
  const outlineId = `lyr-${layer.slug}-outline`
  if (!map.getLayer(fillId)) {
    const colorProp = String(layer.styleConfig.fillColorProp || 'status_kekeringan')
    map.addLayer({
      id: fillId,
      type: 'fill',
      source: sourceId,
      'source-layer': layer.slug,
      layout: { visibility },
      paint: {
        'fill-opacity': state.opacity * 0.55,
        'fill-color': [
          'match',
          ['coalesce', ['get', colorProp], ['get', 'kelas'], ''],
          'awas',
          tokens.droughtSeverity.awas,
          'tinggi',
          tokens.hazardClass.tinggi,
          'siaga',
          tokens.droughtSeverity.siaga,
          'sedang',
          tokens.hazardClass.sedang,
          'waspada',
          tokens.droughtSeverity.waspada,
          'rendah',
          tokens.hazardClass.rendah,
          'normal',
          tokens.droughtSeverity.normal,
          tokens.brand.primary,
        ],
      },
    })
  }
  if (!map.getLayer(outlineId)) {
    map.addLayer({
      id: outlineId,
      type: 'line',
      source: sourceId,
      'source-layer': layer.slug,
      layout: { visibility },
      paint: {
        'line-color': String(layer.styleConfig.strokeColor || '#0F172A'),
        'line-width': 1.5,
        'line-opacity': Math.min(1, state.opacity + 0.15),
      },
    })
  }
}

export function MapWorkspace({
  mapConfig,
  layers,
  layerState,
  activePresetSlug,
  focusCoord,
  menuTitle,
  onToggleLayer,
  onOpacityChange,
  onApplyPreset,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const [styleReady, setStyleReady] = useState(false)
  const [is3D, setIs3D] = useState(mapConfig.terrain.enabled)
  const [basemapId, setBasemapId] = useState(
    () => mapConfig.basemaps.find((b) => b.isDefault)?.id ?? mapConfig.basemaps[0]?.id ?? 'satellite-streets'
  )
  const [drawerOpen, setDrawerOpen] = useState(true)
  const [inspected, setInspected] = useState<{
    layerName: string
    props: Record<string, unknown>
    lngLat: [number, number]
  } | null>(null)

  const allLayers = [...layers, OBSERVATIONS_PSEUDO_LAYER]
  const hasValidToken = Boolean(MAPBOX_TOKEN && MAPBOX_TOKEN.startsWith('pk.') && !MAPBOX_TOKEN.includes('ganti_dengan'))

  // Init Mapbox GL JS sekali saja (1 instance untuk semua menu peta tematik)
  useEffect(() => {
    if (!containerRef.current || !hasValidToken || mapRef.current) return

    mapboxgl.accessToken = MAPBOX_TOKEN
    const initialBasemap =
      mapConfig.basemaps.find((b) => b.id === basemapId) ?? mapConfig.basemaps[0]

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: initialBasemap?.styleUrl ?? 'mapbox://styles/mapbox/satellite-streets-v12',
      center: mapConfig.camera.center,
      zoom: mapConfig.camera.zoom,
      pitch: mapConfig.terrain.enabled ? mapConfig.camera.pitch : 0,
      bearing: mapConfig.camera.bearing,
      antialias: true,
    })

    map.addControl(new mapboxgl.NavigationControl({ visualizePitch: true }), 'bottom-left')
    map.addControl(new mapboxgl.ScaleControl({ unit: 'metric' }), 'bottom-left')

    map.on('style.load', () => {
      setStyleReady(true)
    })

    map.on('click', (e) => {
      const clickableIds = map
        .getStyle()
        ?.layers?.map((l) => l.id)
        .filter((id) => id.startsWith('lyr-')) ?? []
      if (clickableIds.length === 0) return

      const hits = map.queryRenderedFeatures(e.point, { layers: clickableIds })
      if (hits.length === 0) {
        setInspected(null)
        return
      }
      const top = hits[0] as {
        sourceLayer?: string
        layer?: { id?: string }
        properties?: Record<string, unknown> | null
      }
      setInspected({
        layerName: top.sourceLayer || top.layer?.id || 'Fitur Spasial',
        props: top.properties ?? {},
        lngLat: [Number(e.lngLat.lng.toFixed(5)), Number(e.lngLat.lat.toFixed(5))],
      })
    })

    mapRef.current = map
    return () => {
      map.remove()
      mapRef.current = null
      setStyleReady(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasValidToken])

  // Sinkronisasi 3D Terrain (Opsi A Mapbox DEM / Opsi B) saat style siap atau toggle 3D berubah
  useEffect(() => {
    const map = mapRef.current
    if (!map || !styleReady) return

    if (is3D && mapConfig.terrain.enabled && mapConfig.terrain.url) {
      if (!map.getSource('kemitir-dem')) {
        map.addSource('kemitir-dem', {
          type: 'raster-dem',
          url: mapConfig.terrain.url,
          tileSize: mapConfig.terrain.tileSize,
          maxzoom: 14,
        })
      }
      map.setTerrain({ source: 'kemitir-dem', exaggeration: mapConfig.terrain.exaggeration })
      if (map.getPitch() < 20) {
        map.easeTo({ pitch: mapConfig.camera.pitch || 45, duration: 500 })
      }
    } else {
      map.setTerrain(null)
      if (map.getPitch() > 0) {
        map.easeTo({ pitch: 0, duration: 400 })
      }
    }
  }, [styleReady, is3D, mapConfig])

  // Sinkronisasi multi-layer MVT (visibility & opacity)
  useEffect(() => {
    const map = mapRef.current
    if (!map || !styleReady) return

    for (const layer of allLayers) {
      const st = layerState[layer.slug] ?? { visible: true, opacity: layer.defaultOpacity }
      attachMvtLayer(map, layer, st)

      const vis = st.visible ? 'visible' : 'none'
      const fillId = `lyr-${layer.slug}-fill`
      const outlineId = `lyr-${layer.slug}-outline`
      const lineId = `lyr-${layer.slug}-line`
      const ptId = `lyr-${layer.slug}-pt`

      if (map.getLayer(fillId)) {
        map.setLayoutProperty(fillId, 'visibility', vis)
        map.setPaintProperty(fillId, 'fill-opacity', st.opacity * 0.55)
      }
      if (map.getLayer(outlineId)) {
        map.setLayoutProperty(outlineId, 'visibility', vis)
        map.setPaintProperty(outlineId, 'line-opacity', Math.min(1, st.opacity + 0.15))
      }
      if (map.getLayer(lineId)) {
        map.setLayoutProperty(lineId, 'visibility', vis)
        map.setPaintProperty(lineId, 'line-opacity', st.opacity)
      }
      if (map.getLayer(ptId)) {
        map.setLayoutProperty(ptId, 'visibility', vis)
        map.setPaintProperty(ptId, 'circle-opacity', st.opacity)
      }
    }
  }, [styleReady, layers, layerState])

  // Fly to coordinate jika diklik dari daftar Laporan Masyarakat
  useEffect(() => {
    const map = mapRef.current
    if (!map || !focusCoord) return
    map.flyTo({
      center: [focusCoord.lng, focusCoord.lat],
      zoom: focusCoord.zoom ?? 16,
      pitch: is3D ? 50 : 0,
      duration: 900,
    })
  }, [focusCoord, is3D])

  const handleBasemapSwitch = (nextId: string) => {
    const target = mapConfig.basemaps.find((b) => b.id === nextId)
    if (!target?.styleUrl || !mapRef.current) return
    setBasemapId(nextId)
    setStyleReady(false)
    mapRef.current.setStyle(target.styleUrl)
  }

  if (!hasValidToken) {
    return (
      <div className="token-empty-state">
        <div className="token-empty-box">
          <h2>Token Mapbox Belum Dikonfigurasi</h2>
          <p>
            Buka file <code>webgiskemitir/.env</code> lalu isi <code>VITE_MAPBOX_ACCESS_TOKEN</code>{' '}
            dengan Public Token (<code>pk.eyJ1...</code>) dari dashboard Mapbox Anda, lalu restart{' '}
            <code>bun run dev</code>.
          </p>
          <p className="muted-line">
            Backend aktif: <code>{API_BASE}</code> · Terrain default:{' '}
            <code>{mapConfig.terrain.url}</code>
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="map-stage">
      <div ref={containerRef} className="map-canvas" />

      {/* Top Left Contextual Toolbar */}
      <div className="map-topbar">
        <div className="map-crumb">
          <span className="map-crumb-title">{menuTitle}</span>
          <span className="map-crumb-meta">
            {is3D ? '3D Terrain' : '2D'} · {allLayers.filter((l) => layerState[l.slug]?.visible).length}/
            {allLayers.length} layer aktif
          </span>
        </div>

        <div className="map-controls-inline">
          <button
            type="button"
            className={`ctrl-btn ${is3D ? 'ctrl-btn-active' : ''}`}
            onClick={() => setIs3D((v) => !v)}
            title="Aktifkan/Matikan 3D Terrain"
          >
            <Mountain size={14} />
            <span>{is3D ? '3D Aktif' : '2D'}</span>
          </button>

          <select
            aria-label="Pilih Peta Latar"
            className="ctrl-select"
            value={basemapId}
            onChange={(e) => handleBasemapSwitch(e.target.value)}
          >
            {mapConfig.basemaps.map((bm) => (
              <option key={bm.id} value={bm.id}>
                {bm.name}
              </option>
            ))}
          </select>

          <button
            type="button"
            className={`ctrl-btn ${drawerOpen ? 'ctrl-btn-active' : ''}`}
            onClick={() => setDrawerOpen((v) => !v)}
          >
            <Layers size={14} />
            <span>Layer</span>
          </button>
        </div>
      </div>

      {/* Right Multi-Layer Overlay Drawer */}
      {drawerOpen && (
        <aside className="layer-drawer">
          <div className="drawer-header">
            <div className="drawer-title">
              <SlidersHorizontal size={14} />
              <span>Kontrol Multi-Layer</span>
            </div>
            <button
              type="button"
              className="icon-btn"
              onClick={() => setDrawerOpen(false)}
              aria-label="Tutup panel layer"
            >
              <X size={15} />
            </button>
          </div>

          <div className="drawer-section">
            <div className="section-label">Preset Overlay Cepat</div>
            <div className="preset-list">
              {mapConfig.overlayPresets.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={`preset-btn ${activePresetSlug === p.slug ? 'preset-btn-active' : ''}`}
                  onClick={() => onApplyPreset(p.slug)}
                  title={p.description}
                >
                  {p.name}
                </button>
              ))}
            </div>
          </div>

          <div className="drawer-section drawer-scroll">
            <div className="section-label">Layer Spasial (PostGIS MVT)</div>
            {allLayers.map((layer) => {
              const st = layerState[layer.slug] ?? { visible: true, opacity: layer.defaultOpacity }
              return (
                <div key={layer.slug} className="layer-row">
                  <label className="layer-check">
                    <input
                      type="checkbox"
                      checked={st.visible}
                      onChange={() => onToggleLayer(layer.slug)}
                    />
                    <span className="layer-name">
                      {layer.layerCode ? <code className="layer-code">{layer.layerCode}</code> : null}
                      {layer.name}
                    </span>
                  </label>
                  {st.visible && (
                    <div className="layer-opacity">
                      <span>Opasitas</span>
                      <input
                        type="range"
                        min={10}
                        max={100}
                        value={Math.round(st.opacity * 100)}
                        onChange={(e) => onOpacityChange(layer.slug, Number(e.target.value) / 100)}
                      />
                      <span className="mono-num">{Math.round(st.opacity * 100)}%</span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          <div className="drawer-section legend-section">
            <div className="section-label">Legenda Kekeringan</div>
            <div className="legend-grid">
              <div className="legend-item">
                <i style={{ background: tokens.droughtSeverity.normal }} /> Normal / Rendah
              </div>
              <div className="legend-item">
                <i style={{ background: tokens.droughtSeverity.waspada }} /> Waspada / Sedang
              </div>
              <div className="legend-item">
                <i style={{ background: tokens.droughtSeverity.siaga }} /> Siaga / Tinggi
              </div>
              <div className="legend-item">
                <i style={{ background: tokens.droughtSeverity.awas }} /> Awas / Prioritas 1
              </div>
            </div>
          </div>
        </aside>
      )}

      {/* Click-to-Inspect Feature Card */}
      {inspected && (
        <div className="inspect-card">
          <div className="inspect-head">
            <div>
              <strong>{inspected.layerName}</strong>
              <span className="mono-num">
                {inspected.lngLat[1]}, {inspected.lngLat[0]}
              </span>
            </div>
            <button
              type="button"
              className="icon-btn"
              onClick={() => setInspected(null)}
              aria-label="Tutup inspektor"
            >
              <X size={14} />
            </button>
          </div>
          <table className="inspect-table">
            <tbody>
              {Object.entries(inspected.props).map(([k, v]) => (
                <tr key={k}>
                  <th>{k}</th>
                  <td>{String(v ?? '—')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
