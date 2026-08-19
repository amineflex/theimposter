import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { WorldMap } from '../components/map-visual'
import { geometryIndexFor } from '../data/geometry'

describe('carte GeoRush', () => {
  it('agrandit le pays pour les questions de capitale', () => {
    const geometryIndex = geometryIndexFor('056')
    expect(renderToStaticMarkup(createElement(WorldMap, { geometryIndex }))).toContain('viewBox="0 0 800 400"')
    const focused = renderToStaticMarkup(createElement(WorldMap, {
      geometryIndex,
      focused: true,
      markerCoordinates: [4.34878, 50.85045],
    }))
    expect(focused).not.toContain('viewBox="0 0 800 400"')
    expect(focused).toContain('Emplacement exact de la capitale')
    expect(focused).toContain('<circle')
  })
})
