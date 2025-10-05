import type { I18n } from 'vue-i18n'

import { createI18n } from 'vue-i18n'

import { en, zhCN } from '../locales'

/**
 * Language code remapping for compatibility with various browser locales.
 * This ensures that, for example, 'en-US' and 'en-GB' both map to 'en'.
 * TODO: Remove zh-Hant/zh-HK remaps when full support is available.
 */
const languageRemap: Record<string, string> = {
  'zh-CN': 'zhCN',
  'en-US': 'en',
  'en': 'en',
}

const messages = {
  en,
  zhCN,
}

type LocaleKey = keyof typeof messages

function getLocale(): LocaleKey {
  let language = localStorage.getItem('settings/language') || navigator.language || 'en'
  language = languageRemap[language] ?? language
  if (Object.keys(messages).includes(language))
    return language as LocaleKey
  return 'en'
}

export const i18n: I18n = createI18n({
  legacy: false,
  locale: getLocale(),
  fallbackLocale: 'en',
  globalInjection: true,
  messages,
})
