import { useStorage } from '@vueuse/core'
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

// 支持的语言列表
export const supportedLanguages = [
  { code: 'en', name: 'English' },
  { code: 'zhCN', name: '简体中文' },
]

// 创建 composable 函数
export function useLanguage() {
  const { locale } = useI18n()

  // 使用持久化存储，记住用户的语言选择
  const savedLocale = useStorage('user-locale', 'en')

  // 初始化时从存储中设置语言
  if (savedLocale.value) {
    locale.value = savedLocale.value
  }

  // 语言显示名称
  const currentLanguageName = ref(getLanguageName(locale.value))

  // 监听语言变化
  watch(locale, (newLocale) => {
    savedLocale.value = newLocale
    currentLanguageName.value = getLanguageName(newLocale)
    document.documentElement.setAttribute('lang', newLocale)
  })

  // 切换语言的方法
  function setLanguage(lang: string) {
    if (supportedLanguages.some(l => l.code === lang)) {
      locale.value = lang
    }
  }

  // 获取语言的显示名称
  function getLanguageName(code: string): string {
    const lang = supportedLanguages.find(lang => lang.code === code)
    return lang ? lang.name : 'English'
  }

  return {
    locale,
    currentLanguageName,
    supportedLanguages,
    setLanguage,
  }
}
