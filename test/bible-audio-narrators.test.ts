import BIBLE_AUDIO_DOWNLOAD_SIZES from '@/constants/BibleAudioDownloadSizes.json';
import {
  BIBLE_AUDIO_NARRATOR_NAMES,
  BIBLE_AUDIO_NARRATOR_ORDER,
  getBibleAudioNarratorName,
} from '@/constants/BibleAudioNarrators';
import { BIBLE_AUDIO_DOWNLOAD_NARRATORS } from '@/services/BibleAudioDownloads';
import { SUPPORTED_TRANSLATIONS } from '@/services/BibleService';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// What Bible audio narrators are called, and the one order they're listed in
// (#556): the language first, so a member needn't know who Souer is.
jest.mock('@/modules/backup-exclusion', () => ({ excludeFromBackup: jest.fn(() => true) }));
jest.mock('expo-network', () => ({ NetworkStateType: {}, addNetworkStateListener: jest.fn(), getNetworkStateAsync: jest.fn() }));

const LANGUAGES = ['en', 'zh', 'zh-cn', 'es'] as const;

describe('Bible audio narrators', () => {
  it('name each by its language, then the narrator if the recording names one, then the translation', () => {
    expect(LANGUAGES.map((language) => getBibleAudioNarratorName('souer', language))).toEqual([
      'English – Souer (BSB)',
      '英語 – Souer（BSB）',
      '英语 – Souer（BSB）',
      'Inglés – Souer (BSB)',
    ]);
    for (const narrator of ['souer', 'hays', 'david', 'gilbert']) {
      expect(getBibleAudioNarratorName(narrator, 'en')).toMatch(/^English – [A-Z][a-z]+ \(BSB\)$/);
    }
    expect(getBibleAudioNarratorName('cuv-mandarin', 'en')).toBe('Mandarin (Chinese Union Version)');
    expect(getBibleAudioNarratorName('cuv-cantonese', 'zh')).toBe('粵語（和合本）');
    expect(getBibleAudioNarratorName('rv1909', 'es')).toBe('Español (Reina-Valera 1909)');
    expect(getBibleAudioNarratorName('someone', 'en')).toBeNull();
    expect(getBibleAudioNarratorName(null, 'en')).toBeNull();
  });

  it('name every narrator in every language, and every one the app can download', () => {
    for (const narrator of BIBLE_AUDIO_NARRATOR_ORDER) {
      for (const language of LANGUAGES) expect(BIBLE_AUDIO_NARRATOR_NAMES[narrator]?.[language]).toBeTruthy();
    }
    expect(Object.keys(BIBLE_AUDIO_NARRATOR_NAMES).sort()).toEqual([...BIBLE_AUDIO_NARRATOR_ORDER].sort());
    expect([...BIBLE_AUDIO_DOWNLOAD_NARRATORS].sort()).toEqual(Object.keys(BIBLE_AUDIO_DOWNLOAD_SIZES).sort());
  });

  it('list them in one fixed order, as the translation picker lists their translations', () => {
    const translationOf: Record<string, string> = {
      souer: 'BSB',
      hays: 'BSB',
      david: 'BSB',
      gilbert: 'BSB',
      'cuv-mandarin': 'cmn_cuv',
      'cuv-cantonese': 'cmn_cuv',
      rv1909: 'spa_r09',
    };
    const picker = SUPPORTED_TRANSLATIONS.map(({ id }) => id);
    const positions = BIBLE_AUDIO_NARRATOR_ORDER.map((narrator) => picker.indexOf(translationOf[narrator]));
    expect(positions.every((position) => position >= 0)).toBe(true);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
    expect(BIBLE_AUDIO_DOWNLOAD_NARRATORS).toEqual(['souer', 'hays', 'david', 'cuv-mandarin', 'cuv-cantonese', 'rv1909']);
  });

  it('use the same names in the Bible audio settings and Offline Bible Audio', () => {
    const bible = readFileSync(join(__dirname, '..', 'app/(tabs)/bible/index.tsx'), 'utf8');
    expect(bible).toMatch(/getBibleAudioNarratorName\(getBibleAudioNarrator\(supportedTranslation\.id, reader\), language\)/);
    const page = readFileSync(join(__dirname, '..', 'components/OfflineBibleAudio.tsx'), 'utf8');
    // No names of its own.
    expect(page).not.toMatch(/souer: \{|'cuv-mandarin': \{/);
    expect(page).toContain('getBibleAudioNarratorName(');
  });
});
