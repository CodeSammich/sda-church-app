import { getTextSizeMenuCopy } from '@/constants/TextSizeCopy';

describe('You route text-size entry', () => {
  it.each([
    ['en', 'Text size', 'Current: 125%'],
    ['zh', '文字大小', '目前: 125%'],
    ['zh-cn', '文字大小', '当前: 125%'],
    ['es', 'Tamaño del texto', 'Actual: 125%'],
  ] as const)(
    'provides complete %s copy',
    (language, title, description) => {
      expect(getTextSizeMenuCopy(language, 1.25)).toEqual({
        description,
        title,
      });
    },
  );

  it('rounds the persisted scale for a stable percentage label', () => {
    expect(getTextSizeMenuCopy('en', 1.549999999).description).toBe(
      'Current: 155%',
    );
  });
});
