import { memo } from 'react'
import { geoCentroid, geoEquirectangular, geoIdentity, geoPath } from 'd3-geo'
import { feature } from 'topojson-client'
import worldData from 'world-atlas/countries-50m.json'
import type { Feature, FeatureCollection } from 'geojson'
import type { Topology, GeometryCollection } from 'topojson-specification'

const topology = worldData as unknown as Topology
const collection = feature(topology, topology.objects.countries as GeometryCollection) as unknown as FeatureCollection
const features = collection.features
const worldProjection = geoEquirectangular().fitExtent([[8, 8], [792, 392]], { type: 'Sphere' })
const drawWorld = geoPath(worldProjection)

function WorldMapView({ geometryIndex }: { geometryIndex: number }) {
  const selected = features[geometryIndex]
  const rawMarker = selected ? worldProjection(geoCentroid(selected as Feature)) : null
  // Arrondi explicite : évite les écarts flottants infimes entre SSR et navigateur.
  const marker = rawMarker?.map((coordinate) => Number(coordinate.toFixed(3))) as [number, number] | undefined
  return (
    <svg viewBox="0 0 800 400" className="h-auto w-full" role="img" aria-label="Carte du monde avec un pays coloré">
      <rect width="800" height="400" rx="24" fill="var(--color-blue)" opacity=".18" />
      {features.map((item, index) => <path key={`${item.id}-${index}`} d={drawWorld(item as Feature) ?? ''} fill={index === geometryIndex ? 'var(--color-yellow)' : 'var(--color-paper)'} stroke="var(--color-ink)" strokeWidth={index === geometryIndex ? 2.4 : .7} vectorEffect="non-scaling-stroke" />)}
      {marker && <g transform={`translate(${marker[0]} ${marker[1]})`}><circle r="10" fill="var(--color-yellow)" stroke="var(--color-ink)" strokeWidth="3" vectorEffect="non-scaling-stroke" /><circle r="3" fill="var(--color-red)" /></g>}
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
