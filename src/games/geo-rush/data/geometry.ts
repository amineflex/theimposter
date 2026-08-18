import worldData from 'world-atlas/countries-50m.json'

const INDEX_BY_ID = new Map(
  worldData.objects.countries.geometries.map((geometry, index) => [String(geometry.id).padStart(3, '0'), index]),
)

export function geometryIndexFor(numericId: string): number {
  const index = INDEX_BY_ID.get(numericId)
  if (index == null) throw new Error(`Géométrie introuvable pour ${numericId}.`)
  return index
}
