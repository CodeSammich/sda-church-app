import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  CHINESE_MISSION_SPOTLIGHT_KEY,
  CHTV_FEED_URL,
  describeChineseMissionSpotlight,
  findChineseMissionSpotlight,
  getChineseMissionSpotlightUrl,
  readChineseMissionSpotlightTitle,
  readChtvFeed,
  readRememberedChineseMissionSpotlight,
} from '@/features/sabbath-school/ChineseMissionSpotlight';

// The shape of YouTube's channel feed, with titles as CHTV writes them.
const entry = (id: string, title: string) => `
  <entry>
    <id>yt:video:${id}</id>
    <yt:videoId>${id}</yt:videoId>
    <yt:channelId>UC5ucz7CvoYYVULo8Qgl-JdA</yt:channelId>
    <title>${title}</title>
    <link rel="alternate" href="https://www.youtube.com/watch?v=${id}"/>
  </entry>`;
const feed = (...entries: string[]) =>
  `<?xml version="1.0" encoding="UTF-8"?><feed xmlns:yt="http://www.youtube.com/xml/schemas/2015">${entries.join('')}</feed>`;

const OCT_24 = entry('SV8mL9YrrFo', '【聖工剪影】2026 第四季 10月24日 城堡裡的學校');
const OCT_31 = entry('Hk98GzA4qPE', '【聖工剪影】2026 第四季 10月31日 三扇窗的視野');
const OTHERS = [
  entry('whtqInYJnGI', '【聖工消息】2026 第四季 10月31日 「求祢向我顯明真理」'),
  entry('aaaaaaaaaaa', '晨鐘課《穿越信仰風暴》11月1日 彼得申述己見'),
  entry('bbbbbbbbbbb', '486 將見我君王'),
];

const sabbath = (month: number, day: number, year = 2026) => new Date(year, month - 1, day);

const answering = (body: string, ok = true) => {
  const fetchText = jest.fn(async () => ({ ok, text: async () => body }));
  return fetchText as unknown as typeof fetch & jest.Mock;
};
const failing = () => jest.fn(async () => { throw new Error('offline'); }) as unknown as typeof fetch & jest.Mock;

const remember = (video: object) =>
  AsyncStorage.setItem(CHINESE_MISSION_SPOTLIGHT_KEY, JSON.stringify(video));
const remembered = async () => JSON.parse((await AsyncStorage.getItem(CHINESE_MISSION_SPOTLIGHT_KEY)) ?? 'null');

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe("reading CHTV's titles", () => {
  it('reads the Sabbath and story from a 聖工剪影 title', () => {
    expect(readChineseMissionSpotlightTitle('【聖工剪影】2026 第四季 10月31日 三扇窗的視野')).toEqual({
      sabbath: '2026-10-31',
      story: '三扇窗的視野',
    });
    // The Chinese Union Mission writes the date without a space.
    expect(readChineseMissionSpotlightTitle('【聖工剪影】2026年 第4季10月10日 歡迎來到 OIKOS')).toEqual({
      sabbath: '2026-10-10',
      story: '歡迎來到 OIKOS',
    });
    expect(readChineseMissionSpotlightTitle('【聖工剪影】2027 第一季 1月2日 新的一年')).toEqual({
      sabbath: '2027-01-02',
      story: '新的一年',
    });
  });

  it('skips other series, the Cantonese version, and dates that are no Sabbath', () => {
    expect(readChineseMissionSpotlightTitle('【聖工消息】2026 第四季 10月31日 「求祢向我顯明真理」')).toBeNull();
    expect(readChineseMissionSpotlightTitle('【聖工剪影】2026年 第4季10月24日 城堡裡的學校（粵語版）')).toBeNull();
    expect(readChineseMissionSpotlightTitle('【聖工剪影】2026 第四季 11月1日 星期日')).toBeNull();
    expect(readChineseMissionSpotlightTitle('【聖工剪影】2026 第四季 2月30日 沒有這天')).toBeNull();
    expect(readChineseMissionSpotlightTitle('【聖工剪影】特別節目')).toBeNull();
  });

  it('keeps an untitled story empty', () => {
    expect(readChineseMissionSpotlightTitle('【聖工剪影】2026 第四季 11月7日')).toEqual({ sabbath: '2026-11-07', story: '' });
  });

  it('finds every 聖工剪影 in the feed, newest first, with XML entities decoded', () => {
    const quoted = entry('ccccccccccc', '【聖工剪影】2026 第四季 10月17日 &quot;迎著風&quot; &amp; 大提琴');
    expect(readChtvFeed(feed(...OTHERS, OCT_24, quoted, OCT_31))).toEqual([
      { sabbath: '2026-10-31', id: 'Hk98GzA4qPE', story: '三扇窗的視野' },
      { sabbath: '2026-10-24', id: 'SV8mL9YrrFo', story: '城堡裡的學校' },
      { sabbath: '2026-10-17', id: 'ccccccccccc', story: '"迎著風" & 大提琴' },
    ]);
    expect(readChtvFeed('<html>Not Found</html>')).toEqual([]);
  });
});

describe('the video a phone offers', () => {
  it("offers this week's video once it's posted, remembers it, and stops asking", async () => {
    const fetchText = answering(feed(...OTHERS, OCT_31, OCT_24));

    await expect(findChineseMissionSpotlight(sabbath(10, 31), fetchText)).resolves.toEqual({
      sabbath: '2026-10-31', id: 'Hk98GzA4qPE', story: '三扇窗的視野',
    });
    await expect(findChineseMissionSpotlight(sabbath(10, 31), fetchText)).resolves.toMatchObject({ id: 'Hk98GzA4qPE' });
    expect(fetchText).toHaveBeenCalledTimes(1);
    expect(fetchText).toHaveBeenCalledWith(CHTV_FEED_URL, expect.objectContaining({ signal: expect.anything() }));
    expect(await remembered()).toMatchObject({ sabbath: '2026-10-31', id: 'Hk98GzA4qPE' });
  });

  it("offers last week's from the feed before this week's is posted, and keeps asking", async () => {
    const fetchText = answering(feed(OCT_31, OCT_24));

    await expect(findChineseMissionSpotlight(sabbath(11, 7), fetchText)).resolves.toMatchObject({ sabbath: '2026-10-31' });
    await findChineseMissionSpotlight(sabbath(11, 7), fetchText);
    expect(fetchText).toHaveBeenCalledTimes(2);
    expect(await remembered()).toMatchObject({ sabbath: '2026-10-31' });
  });

  it('offers the last video it found when the feed is down or offline', async () => {
    await remember({ sabbath: '2026-10-24', id: 'SV8mL9YrrFo', story: '城堡裡的學校' });

    await expect(findChineseMissionSpotlight(sabbath(11, 14), answering('Not Found', false))).resolves.toMatchObject({
      sabbath: '2026-10-24',
    });
    await expect(findChineseMissionSpotlight(sabbath(11, 14), failing())).resolves.toMatchObject({ sabbath: '2026-10-24' });
    await expect(readRememberedChineseMissionSpotlight(sabbath(11, 14))).resolves.toMatchObject({ sabbath: '2026-10-24' });
  });

  it('keeps the newer video when the feed only has older ones', async () => {
    await remember({ sabbath: '2026-10-31', id: 'Hk98GzA4qPE', story: '三扇窗的視野' });

    await expect(findChineseMissionSpotlight(sabbath(11, 21), answering(feed(OCT_24)))).resolves.toMatchObject({
      sabbath: '2026-10-31',
    });
    expect(await remembered()).toMatchObject({ sabbath: '2026-10-31' });
  });

  it('never offers a video for a later Sabbath than this one', async () => {
    await expect(findChineseMissionSpotlight(sabbath(10, 24, 2026), answering(feed(OCT_31)))).resolves.toBeNull();
  });

  it('offers a remembered video for four weeks, then the English page', async () => {
    await remember({ sabbath: '2026-10-03', id: 'mdHfFp0mask', story: '手機箱子的實驗' });

    // October 31 is four weeks on; November 7 is five.
    await expect(readRememberedChineseMissionSpotlight(sabbath(10, 31))).resolves.toMatchObject({ sabbath: '2026-10-03' });
    await expect(readRememberedChineseMissionSpotlight(sabbath(11, 7))).resolves.toBeNull();
    await expect(findChineseMissionSpotlight(sabbath(11, 7), answering('Not Found', false))).resolves.toBeNull();
  });

  it('offers nothing to a phone that has never found one', async () => {
    await expect(findChineseMissionSpotlight(sabbath(12, 5), failing())).resolves.toBeNull();
    await expect(findChineseMissionSpotlight(sabbath(12, 5), answering(feed(...OTHERS)))).resolves.toBeNull();
    expect(await remembered()).toBeNull();
  });

  it('ignores a remembered value it cannot read', async () => {
    await AsyncStorage.setItem(CHINESE_MISSION_SPOTLIGHT_KEY, '{"sabbath":"2026-11-28","id":"<script>"}');
    await expect(readRememberedChineseMissionSpotlight(sabbath(11, 28))).resolves.toBeNull();
    await AsyncStorage.setItem(CHINESE_MISSION_SPOTLIGHT_KEY, 'not JSON');
    await expect(readRememberedChineseMissionSpotlight(sabbath(11, 28))).resolves.toBeNull();
  });

  it('opens the video on YouTube', () => {
    expect(getChineseMissionSpotlightUrl({ sabbath: '2026-10-31', id: 'Hk98GzA4qPE', story: '' })).toBe(
      'https://www.youtube.com/watch?v=Hk98GzA4qPE',
    );
  });
});

describe("the card's words for a Chinese video", () => {
  const thisWeek = { sabbath: '2026-10-31', id: 'Hk98GzA4qPE', story: '三扇窗的視野' };
  const lastWeek = { sabbath: '2026-10-24', id: 'SV8mL9YrrFo', story: '城堡裡的學校' };

  it("calls this week's video this week's", () => {
    expect(describeChineseMissionSpotlight(thisWeek, sabbath(10, 31), 'zh')).toEqual({
      title: '本週聖工剪影',
      description: '10月31日安息日：三扇窗的視野（普通話）',
    });
    expect(describeChineseMissionSpotlight(thisWeek, sabbath(10, 31), 'zh-cn')).toEqual({
      title: '本周圣工剪影',
      description: '10月31日安息日：三扇窗的视野（普通话）',
    });
  });

  it('names an older video by its Sabbath and says this week’s will replace it', () => {
    expect(describeChineseMissionSpotlight(lastWeek, sabbath(10, 31), 'zh')).toEqual({
      title: '10月24日聖工剪影',
      description: '城堡裡的學校（普通話）。本週的影片出來後會換上。',
    });
    expect(describeChineseMissionSpotlight(lastWeek, sabbath(10, 31), 'zh-cn')).toEqual({
      title: '10月24日圣工剪影',
      description: '城堡里的学校（普通话）。本周的视频出来后会换上。',
    });
  });

  it('still says what it is when the title names no story', () => {
    const untitled = { ...thisWeek, story: '' };
    expect(describeChineseMissionSpotlight(untitled, sabbath(10, 31), 'zh').description).toBe('10月31日安息日的聖工剪影（普通話）');
    expect(describeChineseMissionSpotlight(untitled, sabbath(11, 7), 'zh-cn').description).toBe('普通话。本周的视频出来后会换上。');
  });
});
