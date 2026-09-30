import { CANTONESE_ADVENTIST_AUDIO_URLS } from '@/constants/CantoneseAdventistAudioManifest';

const ASSET_URL_PATTERN =
  /^https:\/\/assets\.adventistconnect\.org\/newyork2\/\d{4}\/\d{2}\/\d+\/(CANTONESE_B\d{2}C\d{3}\.mp3)$/;

describe('Cantonese audio manifest', () => {
  const entries = Object.entries(CANTONESE_ADVENTIST_AUDIO_URLS);

  it('has one church-hosted URL for every chapter', () => {
    expect(entries).toHaveLength(1189);
    expect(new Set(Object.values(CANTONESE_ADVENTIST_AUDIO_URLS)).size).toBe(
      1189,
    );
    expect(CANTONESE_ADVENTIST_AUDIO_URLS['CANTONESE_B01C001.mp3']).toBeDefined();
    expect(CANTONESE_ADVENTIST_AUDIO_URLS['CANTONESE_B19C150.mp3']).toBeDefined();
    expect(CANTONESE_ADVENTIST_AUDIO_URLS['CANTONESE_B66C022.mp3']).toBeDefined();
  });

  it("points only at the church's Adventist Connect copies", () => {
    for (const [filename, url] of entries) {
      expect(ASSET_URL_PATTERN.exec(url)?.[1]).toBe(filename);
    }
  });
});
