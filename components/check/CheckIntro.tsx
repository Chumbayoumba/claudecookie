'use client'

import { motion } from 'motion/react'
import { Checker } from './Checker'
import { localePath, type Locale } from '@/lib/i18n/config'
import type { Dictionary } from '@/lib/i18n/dictionaries/en'

const EASE = [0.165, 0.84, 0.44, 1] as const

interface CheckIntroProps {
  locale: Locale
  dict: Dictionary
}

export function CheckIntro({ locale, dict }: CheckIntroProps) {
  return (
    <div className="mt-8 max-w-3xl">
      <motion.p
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: EASE }}
        className="font-sans text-detail-xs font-semibold tracking-[0.12em] text-clay uppercase"
      >
        {dict.check.eyebrow}
      </motion.p>

      <div className="mt-8">
        <Checker locale={locale} dict={dict} />
      </div>

      <motion.section
        initial={{ opacity: 0, y: 14 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-80px' }}
        transition={{ duration: 0.5, ease: EASE }}
        className="mt-16"
      >
        <h2 className="font-sans text-detail-xs font-semibold tracking-[0.08em] text-ink-faint uppercase">
          {dict.check.readsTitle}
        </h2>
        <div className="mt-6 grid gap-px overflow-hidden rounded-large border border-line bg-line sm:grid-cols-3">
          {dict.check.reads.map((item) => (
            <div key={item.title} className="h-full bg-surface p-5">
              <h3 className="font-sans text-detail-l font-medium text-ink">{item.title}</h3>
              <p className="mt-2 text-paragraph-xs text-ink-secondary">{item.body}</p>
            </div>
          ))}
        </div>

        <div className="mt-6 rounded-large border border-line bg-bg-secondary p-5">
          <h3 className="font-sans text-detail-xs font-semibold tracking-[0.08em] text-ink-faint uppercase">
            {dict.check.formatsTitle}
          </h3>
          <p className="mt-3 text-paragraph-xs text-ink-secondary">{dict.check.formatsBody}</p>
          <p className="mt-4 text-detail-s text-ink-faint">
            {dict.check.privacyNote}{' '}
            <a
              href={localePath(locale, '/privacy')}
              className="ant-link text-ink-secondary hover:text-ink"
            >
              {dict.check.privacyLink}
            </a>
            .
          </p>
        </div>
      </motion.section>
    </div>
  )
}
