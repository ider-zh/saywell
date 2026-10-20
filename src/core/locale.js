export const UI_LANGUAGES = ['auto', 'en', 'zh-CN'];
export function resolveLanguage(preference = 'auto', browserLanguage = 'en') {
  if (preference === 'en' || preference === 'zh-CN') return preference;
  return /^zh(?:-|_|$)/i.test(browserLanguage) ? 'zh-CN' : 'en';
}
