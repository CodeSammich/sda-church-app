import { ChineseHymnalReader } from '@/components/ChineseHymnalReader';
import {
  getSortedChinese505Hymns,
  openChinese505Hymn,
} from '@/constants/Chinese505Hymnal';

const coverImage = require('../../../public/chinese_505_hymnal.jpg');

export default function Chinese505HymnalScreen() {
  return (
    <ChineseHymnalReader
      edition={505}
      coverImage={coverImage}
      route="/resources/chinese-505-hymnal"
      getHymns={getSortedChinese505Hymns}
      openHymn={(hymnNumber) => openChinese505Hymn(Number(hymnNumber))}
    />
  );
}
