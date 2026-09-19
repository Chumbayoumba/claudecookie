import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import sitemap from '@/app/sitemap'
import { en } from '@/lib/i18n/dictionaries/en'
import { buildApiJsonLd } from '@/lib/seo'

const root = resolve(__dirname, '../..')

describe('API discovery surface', () => {
  it('keeps /api in the sitemap with a current lastmod', () => {
    const entries = sitemap()
    const api = entries.filter((entry) => entry.url.endsWith('/api/') || entry.url.endsWith('/api'))
    expect(api.length).toBeGreaterThanOrEqual(3)
    for (const entry of api) {
      expect(String(entry.lastModified)).toContain('2026-09-19')
    }
  })

  it('publishes OpenAPI with human docs and the three write routes', () => {
    const spec = JSON.parse(readFileSync(resolve(root, 'public/openapi.json'), 'utf8')) as {
      externalDocs?: { url?: string }
      paths: Record<string, unknown>
    }
    expect(spec.externalDocs?.url).toBe('https://claudecookie.com/api/')
    expect(spec.paths['/api/v1/convert']).toBeTruthy()
    expect(spec.paths['/api/v1/check']).toBeTruthy()
    expect(spec.paths['/api/v1/credential']).toBeTruthy()
  })

  it('publishes llms.txt that names the public API', () => {
    const text = readFileSync(resolve(root, 'public/llms.txt'), 'utf8')
    expect(text).toContain('/api/v1/convert')
    expect(text).toContain('/api/v1/check')
    expect(text).toContain('/api/v1/credential')
    expect(text).toContain('https://claudecookie.com/api/')
    expect(text).toContain('https://github.com/Chumbayoumba/claudecookie')
  })

  it('marks the API page as a WebAPI with FAQ markup', () => {
    const data = buildApiJsonLd({
      locale: 'en',
      headline: en.pages.api.title,
      description: en.meta.api.description,
      datePublished: '2026-09-18',
      dateModified: en.pages.api.updated,
      faq: en.pages.api.faq,
      trail: [
        { name: en.common.tools, path: '/' },
        { name: en.pages.api.title, path: '/api' },
      ],
    })
    const types = data['@graph'].map((node) => node['@type'])
    expect(types).toContain('WebAPI')
    expect(types).toContain('TechArticle')
    expect(types).toContain('FAQPage')
    const crumbs = data['@graph'].find((node) => node['@type'] === 'BreadcrumbList') as {
      itemListElement: { item: { '@id': string } }[]
    }
    expect(crumbs.itemListElement[0]?.item['@id']).toBe('https://claudecookie.com/')
    expect(crumbs.itemListElement[1]?.item['@id']).toBe('https://claudecookie.com/api/')
  })
})
