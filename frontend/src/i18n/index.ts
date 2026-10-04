import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import dayjs from 'dayjs';
import 'dayjs/locale/tr';
import 'dayjs/locale/ar';
import 'dayjs/locale/en';
import tr from '../locales/tr.json';
import en from '../locales/en.json';
import ar from '../locales/ar.json';

export const LANGUAGES = [
  { code: 'tr', label: 'Türkçe', dir: 'ltr' },
  { code: 'en', label: 'English', dir: 'ltr' },
  { code: 'ar', label: 'العربية', dir: 'rtl' },
] as const;

export type LanguageCode = (typeof LANGUAGES)[number]['code'];

const STORAGE_KEY = 'stagetrack.lang';

function storedLanguage(): LanguageCode {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    if (LANGUAGES.some((l) => l.code === value)) return value as LanguageCode;
  } catch {
    /* ignore */
  }
  return 'tr';
}

function applyDocumentLanguage(code: string) {
  const language = LANGUAGES.find((l) => l.code === code) ?? LANGUAGES[0];
  document.documentElement.lang = language.code;
  document.documentElement.dir = language.dir;
  dayjs.locale(language.code);
  try {
    localStorage.setItem(STORAGE_KEY, language.code);
  } catch {
    /* ignore */
  }
}

i18n.use(initReactI18next).init({
  resources: { tr: { translation: tr }, en: { translation: en }, ar: { translation: ar } },
  lng: storedLanguage(),
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  returnNull: false,
});

applyDocumentLanguage(i18n.language);
i18n.on('languageChanged', applyDocumentLanguage);

export const isRtl = (code: string) => LANGUAGES.find((l) => l.code === code)?.dir === 'rtl';

export default i18n;
