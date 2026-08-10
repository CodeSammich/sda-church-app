import { ChineseHymnalReader } from '@/features/hymnal/ChineseHymnalReader';
import {
  getSortedChinese707Hymns,
  openChinese707Hymn,
} from '@/features/hymnal/Chinese707Hymnal';

const coverImage = require('../../../public/chinese_707_hymnal_original_simplified_notation_version.jpg');
const getHymns = () => getSortedChinese707Hymns(1);
const openHymn = (hymnNumber: number | string) =>
  openChinese707Hymn(1, hymnNumber);
const titles = {
  en: 'Hymns of Praise — 707 New Simplified Notation',
  zh: '頌讚詩歌 — 707 新編簡譜版',
  'zh-cn': '颂赞诗歌 — 707 新编简谱版',
  es: 'Himnos de Alabanza — Edición 707 de Notación Simplificada Nueva',
};

export default function Chinese707NewSimplifiedHymnalScreen() {
  return (
    <ChineseHymnalReader
      edition={707}
      coverImage={coverImage}
      route="/home/chinese-707-new-simplified-hymnal"
      getHymns={getHymns}
      openHymn={openHymn}
      titles={titles}
    />
  );
}
