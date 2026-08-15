import { ChineseHymnalReader } from '@/features/hymnal/ChineseHymnalReader';
import {
  getSortedChinese707Hymns,
  openChinese707Hymn,
} from '@/features/hymnal/Chinese707Hymnal';

const coverImage = require('../../../public/chinese_707_hymnal_simplified_four_part_harmony.jpg');
const getHymns = () => getSortedChinese707Hymns(2);
const openHymn = (hymnNumber: number | string) =>
  openChinese707Hymn(2, hymnNumber);
const titles = {
  en: 'Hymns of Praise — 707 Four-Part Harmony',
  zh: '頌讚詩歌 — 707 簡譜四聲部版',
  'zh-cn': '颂赞诗歌 — 707 简谱四声部版',
  es: 'Himnos de Alabanza — Edición 707 a Cuatro Voces',
};

export default function Chinese707FourPartHymnalScreen() {
  return (
    <ChineseHymnalReader
      edition={707}
      coverImage={coverImage}
      route="/home/chinese-707-four-part-hymnal"
      getHymns={getHymns}
      openHymn={openHymn}
      titles={titles}
    />
  );
}
