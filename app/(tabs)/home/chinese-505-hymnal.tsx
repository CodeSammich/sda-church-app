import { ChineseHymnalReader } from '@/features/hymnal/ChineseHymnalReader';
import {
  getSortedChinese505Hymns,
  openChinese505Hymn,
} from '@/features/hymnal/Chinese505Hymnal';

const coverImage = require('../../../assets/images/hymnals/chinese-505-hymnal.jpg');

export default function Chinese505HymnalScreen() {
  return (
    <ChineseHymnalReader
      edition={505}
      coverImage={coverImage}
      getHymns={getSortedChinese505Hymns}
      openHymn={(hymnNumber) => openChinese505Hymn(Number(hymnNumber))}
    />
  );
}
