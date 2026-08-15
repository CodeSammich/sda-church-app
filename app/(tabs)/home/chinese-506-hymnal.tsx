import { ChineseHymnalReader } from '@/features/hymnal/ChineseHymnalReader';
import {
  getSortedChinese506Hymns,
  openChinese506Hymn,
} from '@/features/hymnal/Chinese506Hymnal';

const coverImage = require('../../../public/chinese_506_hymnal.jpg');

export default function Chinese506HymnalScreen() {
  return (
    <ChineseHymnalReader
      edition={506}
      coverImage={coverImage}
      route="/home/chinese-506-hymnal"
      getHymns={getSortedChinese506Hymns}
      openHymn={(hymnNumber) => openChinese506Hymn(Number(hymnNumber))}
    />
  );
}
