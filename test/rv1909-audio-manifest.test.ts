import { RV1909_ADVENTIST_AUDIO_URLS } from '@/constants/Rv1909AdventistAudioManifest';

const ASSET_URL_PATTERN =
  /^https:\/\/assets\.adventistconnect\.org\/newyork2\/\d{4}\/\d{2}\/\d+\/(RV1909_B\d{2}C\d{3}\.mp3)$/;

describe('Reina-Valera 1909 audio manifest', () => {
  const entries = Object.entries(RV1909_ADVENTIST_AUDIO_URLS);

  it('has one church-hosted URL for every chapter', () => {
    expect(entries).toHaveLength(1189);
    expect(new Set(Object.values(RV1909_ADVENTIST_AUDIO_URLS)).size).toBe(1189);
  });

  it("points only at the church's Adventist Connect copies", () => {
    for (const [filename, url] of entries) {
      expect(ASSET_URL_PATTERN.exec(url)?.[1]).toBe(filename);
    }
  });
});
