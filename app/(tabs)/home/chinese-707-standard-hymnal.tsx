import { ChineseHymnalReader } from '@/features/hymnal/ChineseHymnalReader';
import {
  getSortedChinese707Hymns,
  openChinese707Hymn,
} from '@/features/hymnal/Chinese707Hymnal';

const coverImage = require('../../../public/chinese_707_hymnal_leather_bound_version.jpg');
const getHymns = () => getSortedChinese707Hymns(3);
const openHymn = (hymnNumber: number | string) =>
  openChinese707Hymn(3, hymnNumber);
const titles = {
  en: 'Hymns of Praise — 707 Standard Edition',
  zh: '頌讚詩歌 — 707 標準版',
  'zh-cn': '颂赞诗歌 — 707 标准版',
  es: 'Himnos de Alabanza — Edición 707 Estándar',
};

export default function Chinese707StandardHymnalScreen() {
  return (
    <ChineseHymnalReader
      edition={707}
      coverImage={coverImage}
      route="/home/chinese-707-standard-hymnal"
      getHymns={getHymns}
      openHymn={openHymn}
      titles={titles}
    />
  );
}
