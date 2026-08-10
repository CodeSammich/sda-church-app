import { ChineseHymnalReader } from '@/features/hymnal/ChineseHymnalReader';
import {
  getSortedChinese505Hymns,
  openChinese505Hymn,
} from '@/features/hymnal/Chinese505Hymnal';

const coverImage = require('../../../public/chinese_505_hymnal.jpg');

export default function Chinese505HymnalScreen() {
  return (
    <ChineseHymnalReader
      edition={505}
      coverImage={coverImage}
      route="/home/chinese-505-hymnal"
      getHymns={getSortedChinese505Hymns}
      openHymn={(hymnNumber) => openChinese505Hymn(Number(hymnNumber))}
    />
  );
}
