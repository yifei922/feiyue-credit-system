// i18n 轻量实现（不引入 vue-i18n 包，节省依赖/体积）
// 用法：
//   import { useI18n, setLocale } from '@/i18n'
//   const { t } = useI18n()
//   template: {{ t('app.title') }}
//   setLocale('en-US')
import { ref } from 'vue'
import zhCN from './zh-CN'
import enUS from './en-US'

const messages = { 'zh-CN': zhCN, 'en-US': enUS }

function readStored() {
  try { return localStorage.getItem('lang') || 'zh-CN' } catch (_) { return 'zh-CN' }
}

export const locale = ref(readStored())

export function t(path) {
  const parts = String(path).split('.')
  let v = messages[locale.value]
  for (const p of parts) v = v?.[p]
  return v != null ? v : path
}

export function setLocale(lang) {
  if (messages[lang]) {
    locale.value = lang
    try { localStorage.setItem('lang', lang) } catch (_) {}
  }
}

export function useI18n() {
  return { t, locale, setLocale }
}