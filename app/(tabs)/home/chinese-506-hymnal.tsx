import { ChineseHymnalReader } from '@/features/hymnal/ChineseHymnalReader';
import {
  getSortedChinese506Hymns,
  openChinese506Hymn,
} from '@/features/hymnal/Chinese506Hymnal';

const coverImage = require('../../../assets/images/hymnals/chinese-506-hymnal.jpg');

export default function Chinese506HymnalScreen() {
  return (
    <ChineseHymnalReader
      edition={506}
      coverImage={coverImage}
      getHymns={getSortedChinese506Hymns}
      openHymn={(hymnNumber) => openChinese506Hymn(Number(hymnNumber))}
    />
  );
}
