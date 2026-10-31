import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { SiteBaseLayer, SitePlanItem, SitePlanZone } from '../../api/siteTypes';

/** Esri's imagery needs no key and covers the world; OSM is clearer for roads and paths. */
const TILES: Record<SiteBaseLayer, { url: string; attribution: string; maxZoom: number }> = {
  Satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Esri, Maxar, Earthstar Geographics',
    maxZoom: 19,
  },
  Street: {
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '© OpenStreetMap',
    maxZoom: 19,
  },
};

export interface SiteMapHandle {
  /** Where the map is looking now, so the view can be saved as the user left it. */
  view(): { lat: number; lng: number; zoom: number } | null;
}

interface Props {
  centre: { lat: number; lng: number; zoom: number };
  baseLayer: SiteBaseLayer;
  nightMode: boolean;
  items: SitePlanItem[];
  zones: SitePlanZone[];
  /** Layers switched off are not drawn; an item with no layer is always drawn. */
  hiddenLayers: ReadonlySet<string>;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onMove: (id: string, lat: number, lng: number) => void;
  /** A click on open ground while something is armed for placing. */
  onDropAt: ((lat: number, lng: number) => void) | null;
  /** Reports every click while a shape is being drawn. */
  onDrawPoint: ((lat: number, lng: number) => void) | null;
  /** The shape being drawn, so the user sees it take form. */
  draft: [number, number][];
  handleRef?: (handle: SiteMapHandle | null) => void;
}

/**
 * The site on real ground. Leaflet over Esri imagery rather than Google Maps: no API key to obtain, buy or leak,
 * and the same worldwide coverage — what matters here is the ground, not the road data.
 *
 * Drawing is imperative because Leaflet owns the DOM; the React side only says what should be on the map.
 */
export function SiteMap({
  centre, baseLayer, nightMode, items, zones, hiddenLayers, selectedId, onSelect, onMove, onDropAt, onDrawPoint, draft, handleRef,
}: Props) {
  const { t } = useTranslation();
  const hostRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const tilesRef = useRef<L.TileLayer | null>(null);
  const drawnRef = useRef<L.LayerGroup | null>(null);

  // Callbacks change on every render; the map handlers read them from here instead of being re-bound.
  const latest = useRef({ onSelect, onMove, onDropAt, onDrawPoint });
  latest.current = { onSelect, onMove, onDropAt, onDrawPoint };

  const visible = useMemo(
    () => ({
      items: items.filter((i) => !i.layer || !hiddenLayers.has(i.layer)),
      zones: zones.filter((z) => !z.layer || !hiddenLayers.has(z.layer)),
    }),
    [items, zones, hiddenLayers],
  );

  useEffect(() => {
    if (!hostRef.current || mapRef.current) return;
    const map = L.map(hostRef.current, { center: [centre.lat, centre.lng], zoom: centre.zoom, zoomControl: true });
    mapRef.current = map;
    drawnRef.current = L.layerGroup().addTo(map);

    map.on('click', (event: L.LeafletMouseEvent) => {
      const { onDropAt: drop, onDrawPoint: draw, onSelect: select } = latest.current;
      if (draw) draw(event.latlng.lat, event.latlng.lng);
      else if (drop) drop(event.latlng.lat, event.latlng.lng);
      else select(null);
    });

    handleRef?.({
      view: () => {
        const m = mapRef.current;
        if (!m) return null;
        const c = m.getCenter();
        return { lat: c.lat, lng: c.lng, zoom: m.getZoom() };
      },
    });

    return () => {
      handleRef?.(null);
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The base layer is swapped rather than the map rebuilt, so the view is not lost.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    tilesRef.current?.remove();
    const tile = TILES[baseLayer];
    tilesRef.current = L.tileLayer(tile.url, { attribution: tile.attribution, maxZoom: tile.maxZoom }).addTo(map);
    tilesRef.current.getContainer()?.style.setProperty('filter', nightMode ? 'brightness(0.35) saturate(0.6)' : 'none');
  }, [baseLayer, nightMode]);

  useEffect(() => {
    const map = mapRef.current;
    const group = drawnRef.current;
    if (!map || !group) return;
    group.clearLayers();

    for (const zone of visible.zones) {
      if (zone.points.length < 2) continue;
      const shape =
        zone.kind === 'Area'
          ? L.polygon(zone.points, { color: zone.color, weight: 2, fillOpacity: nightMode ? 0.12 : 0.18 })
          : L.polyline(zone.points, { color: zone.color, weight: zone.kind === 'Barrier' ? 4 : 3, dashArray: zone.kind === 'Barrier' ? '6 4' : undefined });
      const size = zone.areaM2 != null ? `${Math.round(zone.areaM2).toLocaleString()} m²` : zone.lengthM != null ? `${Math.round(zone.lengthM)} m` : '';
      shape.bindTooltip(`${zone.name}${size ? ` · ${size}` : ''}`, { sticky: true });
      group.addLayer(shape);
    }

    // Lights go under the markers so a tower is never hidden by its own glow.
    if (nightMode) {
      for (const item of visible.items.filter((i) => i.isLight && i.lightRadiusM)) {
        group.addLayer(
          L.circle([item.lat, item.lng], {
            radius: item.lightRadiusM!,
            stroke: false,
            fillColor: '#fde68a',
            fillOpacity: 0.08 + ((item.lightIntensity ?? 70) / 100) * 0.22,
            interactive: false,
          }),
        );
      }
    }

    for (const item of visible.items) {
      const selected = item.id === selectedId;
      const name = item.label ?? item.equipmentCode ?? '';
      const short = item.isLight ? '💡' : item.equipmentCode ?? name.slice(0, 3);
      const icon = L.divIcon({
        className: '',
        iconSize: [0, 0],
        html: `<div class="site-pin${selected ? ' site-pin-selected' : ''}" style="transform:rotate(${item.rotationDeg}deg)">
                 <span class="site-pin-text">${escapeHtml(short)}</span>
                 ${item.quantity > 1 ? `<span class="site-pin-count">${item.quantity}</span>` : ''}
               </div>`,
      });

      const marker = L.marker([item.lat, item.lng], { icon, draggable: true, riseOnHover: true });
      marker.bindTooltip(
        `${escapeHtml(name)}${item.quantity > 1 ? ` × ${item.quantity}` : ''}${
          item.equipmentId ? `<br><small>${t('site.stock')}: ${item.equipmentStock}</small>` : ''
        }`,
        { direction: 'top' },
      );
      marker.on('click', (event) => {
        L.DomEvent.stopPropagation(event);
        latest.current.onSelect(item.id);
      });
      marker.on('dragend', () => {
        const at = marker.getLatLng();
        latest.current.onMove(item.id, at.lat, at.lng);
      });
      group.addLayer(marker);
    }

    if (draft.length > 0) {
      group.addLayer(L.polyline(draft, { color: '#1677ff', weight: 2, dashArray: '5 4' }));
      for (const point of draft) {
        group.addLayer(L.circleMarker(point, { radius: 4, color: '#1677ff', fillOpacity: 1 }));
      }
    }
  }, [visible, selectedId, nightMode, draft, t]);

  // The job changed under us: jump to its ground rather than leaving the map where it was.
  useEffect(() => {
    mapRef.current?.setView([centre.lat, centre.lng], centre.zoom);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [centre.lat, centre.lng]);

  return <div ref={hostRef} style={{ width: '100%', height: '100%', borderRadius: 6, cursor: onDropAt || onDrawPoint ? 'crosshair' : 'grab' }} />;
}

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c);
