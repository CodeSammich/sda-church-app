import { TEAM_MEMBERS } from '@/constants/TeamData';

// The team bios are written in Traditional Chinese, and the Simplified text is
// converted from it, the way the app's other Chinese is (#557).
const OpenCC = require('opencc-js/t2cn');
const toSimplified = OpenCC.Converter({ from: 'tw', to: 'cn' });

describe('team profiles', () => {
  it.each(TEAM_MEMBERS.map((member) => [member.name.en, member]))(
    "%s's Simplified Chinese is converted from the Traditional",
    (_name, member) => {
      expect(member.name['zh-cn']).toBe(toSimplified(member.name.zh));
      expect(member.description['zh-cn']).toBe(toSimplified(member.description.zh));
      expect(member.description.zh).not.toBe(member.description['zh-cn']);
      if (member.roleNote) {
        expect(member.roleNote['zh-cn']).toBe(toSimplified(member.roleNote.zh));
      }
    },
  );
});
