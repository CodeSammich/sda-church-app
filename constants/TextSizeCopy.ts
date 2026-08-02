import type { SupportedLanguage } from './LanguageContext';

const menuLabels: Record<
  SupportedLanguage,
  Readonly<{ current: string; title: string }>
> = {
  en: { current: 'Current', title: 'Text size' },
  zh: { current: '目前', title: '文字大小' },
  'zh-cn': { current: '当前', title: '文字大小' },
  es: { current: 'Actual', title: 'Tamaño del texto' },
};

export const getTextSizeMenuCopy = (
  language: SupportedLanguage,
  textScale: number,
) => {
  const labels = menuLabels[language] ?? menuLabels.en;
  return {
    description: `${labels.current}: ${Math.round(textScale * 100)}%`,
    title: labels.title,
  };
};
