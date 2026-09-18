import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { ApiDocsPage } from '@/components/api/ApiDocsPage'
import { getDictionary } from '@/lib/i18n'
import { LOCALES, isLocale, type Locale } from '@/lib/i18n/config'
import { buildMetadata } from '@/lib/seo'

const PATH = '/api'

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }))
}

interface PageProps {
  params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale: raw } = await params
  if (!isLocale(raw)) return {}
  const dict = getDictionary(raw)

  return buildMetadata({
    locale: raw,
    path: PATH,
    title: dict.meta.api.title,
    description: dict.meta.api.description,
  })
}

export default async function ApiPage({ params }: PageProps) {
  const { locale: raw } = await params
  if (!isLocale(raw)) notFound()
  return <ApiDocsPage locale={raw as Locale} />
}
