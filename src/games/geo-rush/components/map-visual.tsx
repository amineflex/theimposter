import { memo } from 'react'
import { geoEquirectangular, geoIdentity, geoPath } from 'd3-geo'
import { feature } from 'topojson-client'
import worldData from 'world-atlas/countries-50m.json'
import type { Feature, FeatureCollection } from 'geojson'
import type { Topology, GeometryCollection } from 'topojson-specification'

const topology = worldData as unknown as Topology
const collection = feature(topology, topology.objects.countries as GeometryCollection) as unknown as FeatureCollection
const features = collection.features
const worldProjection = geoEquirectangular().fitExtent([[8, 8], [792, 392]], { type: 'Sphere' })
const drawWorld = geoPath(worldProjection)
const WORLD_VIEW_BOX = '0 0 800 400'

function focusedViewBox(selected: Feature | undefined): string {
  if (!selected) return WORLD_VIEW_BOX
  const [[x0, y0], [x1, y1]] = drawWorld.bounds(selected)
  const width = Math.min(800, Math.max(140, (x1 - x0) * 2, (y1 - y0) * 4))
  const height = width / 2
  const x = Math.min(800 - width, Math.max(0, (x0 + x1 - width) / 2))
  const y = Math.min(400 - height, Math.max(0, (y0 + y1 - height) / 2))
  return [x, y, width, height].map((value) => Number(value.toFixed(3))).join(' ')
}

function WorldMapView({ geometryIndex, focused = false, markerCoordinates }: {
  geometryIndex: number
  focused?: boolean
  markerCoordinates?: readonly [number, number]
}) {
  const selected = features[geometryIndex]
  const rawMarker = markerCoordinates ? worldProjection([markerCoordinates[0], markerCoordinates[1]]) : null
  // Arrondi explicite : évite les écarts flottants infimes entre SSR et navigateur.
  const marker = rawMarker?.map((coordinate) => Number(coordinate.toFixed(3))) as [number, number] | undefined
  return (
    <svg viewBox={focused ? focusedViewBox(selected) : WORLD_VIEW_BOX} className="h-auto w-full" role="img" aria-label={focused ? 'Carte agrandie avec un pays coloré' : 'Carte du monde avec un pays coloré'}>
      <rect width="800" height="400" rx="24" fill="var(--color-blue)" opacity=".18" />
      {features.map((item, index) => <path key={`${item.id}-${index}`} d={drawWorld(item as Feature) ?? ''} fill={index === geometryIndex ? 'var(--color-yellow)' : 'var(--color-paper)'} stroke="var(--color-ink)" strokeWidth={index === geometryIndex ? 2.4 : .7} vectorEffect="non-scaling-stroke" />)}
      {marker && (
        <g transform={`translate(${marker[0]} ${marker[1]})`} aria-label="Emplacement exact de la capitale">
          <circle r="12" fill="var(--color-red)" stroke="var(--color-ink)" strokeWidth="3" vectorEffect="non-scaling-stroke" />
          <circle r="4" fill="var(--color-paper)" />
        </g>
      )}
    </svg>
  )
}

function CountrySilhouetteView({ geometryIndex }: { geometryIndex: number }) {
  const item = features[geometryIndex]
  const silhouette = item ? geoPath(geoIdentity().reflectY(true).fitExtent([[30, 15], [370, 185]], item as Feature))(item as Feature) : null
  return (
    <svg viewBox="0 0 400 200" className="h-44 w-full" role="img" aria-label="Silhouette d'un pays">
      {silhouette && <path d={silhouette} fill="var(--color-green)" stroke="var(--color-ink)" strokeWidth="4" strokeLinejoin="round" />}
    </svg>
  )
}

export const WorldMap = memo(WorldMapView)
export const CountrySilhouette = memo(CountrySilhouetteView)
