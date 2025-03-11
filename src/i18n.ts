import { createI18n } from 'vue-i18n';
import en from './locales/en.json';
import pl from './locales/pl.json';

// Get user's preferred language
const getUserLanguage = (): string => {
  // Check localStorage first
  const savedLanguage = localStorage.getItem('userLanguage');
  if (savedLanguage && ['en', 'pl'].includes(savedLanguage)) {
    return savedLanguage;
  }
  
  // Fall back to browser language
  const browserLang = navigator.language.split('-')[0];
  return ['en', 'pl'].includes(browserLang) ? browserLang : 'en';
};

export const i18n = createI18n({
  legacy: false, // Use Composition API
  locale: getUserLanguage(),
  fallbackLocale: 'en',
  messages: {
    en,
    pl
  }
});

export default i18n; 