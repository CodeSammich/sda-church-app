import { CHURCH_BUILDING_IMAGE_URL } from '@/constants/ExternalLinks';
import type { TeamMember } from '@/constants/TeamData';
import type { Bulletin, BulletinLocation, KeyScreensBulletinState } from '@/services/BulletinService';

/**
 * Made-up data for the key screens (#456): the bulletin and the Team page as a
 * key-screens build shows them, so the key screens' shots, the text read from
 * them, and the run's downloads hold no member's name or face. Every name here
 * is made up. Only a key-screens build loads this file: BulletinService.ts and
 * the Team page require it only when EXPO_PUBLIC_KEY_SCREENS is 1, which Expo
 * writes into the app when it's built, so a store build leaves it out.
 *
 * The data holds the worst cases on purpose, so the key screens' text checks
 * can name exact lines: the longest first name, a role with three people, an
 * empty slot, a name the API withholds, and a long English title.
 */

/**
 * The bulletin as the API sends it, with the fields it sends that the app
 * doesn't read yet, such as announcements (#562).
 */
type ApiLocation = BulletinLocation & { announcements: string };
type ApiBulletin = Omit<Bulletin, 'queens' | 'brooklyn'> & {
  announcements: string;
  sunsetTime: string;
  queens: ApiLocation;
  brooklyn: ApiLocation;
};

const quarterOf = (date: string) => `Q${Math.floor((Number(date.slice(5, 7)) - 1) / 3) + 1}`;

const translated = (en: string, zh: string, zhCn: string, es: string) => ({
  en,
  zh,
  'zh-cn': zhCn,
  es,
});

/**
 * The Bulletin API's answer for a Sabbath, as BulletinApi.gs builds it: names
 * as the public API shortens them (the first name and the last name's
 * initial, "Name withheld" for a name not in Latin letters), several people
 * joined by " / " or " & ", blank fields for an empty slot, and the hymns as
 * typed in the sheet, such as "AH 12 Joyful, Joyful, We Adore Thee".
 */
const makeBulletin = (date: string): ApiBulletin => ({
  date,
  quarter: quarterOf(date),
  specialRemark: 'Thanksgiving Sabbath: fellowship lunch for everyone after the service',
  tithePurpose: 'Local Church Budget',
  pastorTravel: '',
  announcements: '',
  sunsetTime: '',
  metadataTranslations: {
    specialRemark: translated(
      'Thanksgiving Sabbath: fellowship lunch for everyone after the service',
      '感恩安息日：崇拜後全體團契午餐',
      '感恩安息日：崇拜后全体团契午餐',
      'Sábado de Acción de Gracias: almuerzo de confraternidad para todos después del culto',
    ),
    tithePurpose: translated('Local Church Budget', '本地教會預算', '本地教会预算', 'Presupuesto de la iglesia local'),
    pastorTravel: translated('', '', '', ''),
  },
  queens: {
    hymnOfPraise: { english: 'AH 12 Joyful, Joyful, We Adore Thee', chinese: '' },
    sermonTitle: {
      english: 'When the Waters Rise: Trusting God Through the Storms of Life',
      chinese: '當洪水上漲時：在人生風暴中信靠上帝',
    },
    hymnOfResponse: { english: 'AH 348 The Church Has One Foundation', chinese: '' },
    bibleVerses: 'Psalm 46:1-3',
    sabbathSchoolHymns: ['AH 1 Praise to the Lord', 'AH 530 It Is Well With My Soul'],
    specialMusicTitle: 'It Is Well With My Soul (violin and piano)',
    announcements: '',
    sermon: 'Jonathan P.',
    chairPastoralPrayer: 'Michael H.',
    offeringPrayer: 'Name withheld',
    translation: 'Name withheld',
    chineseTeacher: 'Name withheld',
    englishTeacher: 'Daniel K.',
    youthTeacher: '',
    kidsTeacher: 'Ruth & Samuel T.',
    specialMusic: 'Hannah W. & Joshua W.',
    pianist: 'Lydia S.',
    ssChair: 'Anna-Katharina R.',
    ssOpeningPrayer: 'Grace L. / Peter W. / Mary C.',
    closingPrayer: 'Esther N.',
    flowerOffering: '',
  },
  brooklyn: {
    hymnOfPraise: { english: 'AH 1 Praise to the Lord', chinese: '' },
    sermonTitle: { english: 'A Light to My Path', chinese: '我路上的光' },
    hymnOfResponse: { english: 'AH 348 The Church Has One Foundation', chinese: '' },
    bibleVerses: 'Psalm 119:105',
    sabbathSchoolHymns: ['AH 100 Great Is Thy Faithfulness'],
    specialMusicTitle: '',
    announcements: '',
    sermon: 'Thomas B.',
    chairPastoralPrayer: 'Sarah J.',
    offeringPrayer: 'Name withheld',
    technician: 'Kevin M.',
    encouragement: 'Naomi F.',
    sabbathSchool: 'Caleb D.',
  },
});

/**
 * Stands in for the Bulletin API's response in a key-screens build: the
 * made-up bulletin for the date, or, for a path's `state=load-failed`, the
 * API out of service, as when it's busy or being deployed. Only `ok`, `status`
 * and `json`, which fetchBulletin reads, and the bulletin goes through JSON as
 * it would over the network.
 */
export const getKeyScreensBulletinResponse = (
  date: string,
  state?: KeyScreensBulletinState | null,
): Pick<Response, 'ok' | 'status' | 'json'> => {
  if (state === 'load-failed') {
    return { ok: false, status: 503, json: async () => ({ ok: false, error: 'Service unavailable' }) };
  }
  const body = JSON.stringify({ ok: true, bulletin: makeBulletin(date) });
  return { ok: true, status: 200, json: async () => JSON.parse(body) };
};

/**
 * The Team page's staff in a key-screens build: made up, with the church
 * building's photo, the one the page's header already shows, in place of a
 * face. The pastor's name is the longest, so a wrapped name shows on the first
 * card, and the second has a role note, as the Bible worker's does.
 */
export const KEY_SCREENS_TEAM_MEMBERS: TeamMember[] = [
  {
    name: translated('Jonathan Applewood-Sinclair', '林以諾', '林以诺', 'Jonathan Applewood-Sinclair'),
    roleKey: 'seniorPastor',
    imageUrl: CHURCH_BUILDING_IMAGE_URL,
    description: translated(
      'A made-up pastor for the key screens. He grew up in a small farming town, studied theology, and served three churches before coming to New York, where he leads Bible studies and visits members at home.',
      '這是一位為測試畫面虛構的牧師。他在一個小農村長大，讀過神學，先後在三間教會服事，之後來到紐約，帶領查經並探訪會友。',
      '这是一位为测试画面虚构的牧师。他在一个小农村长大，读过神学，先后在三间教会服事，之后来到纽约，带领查经并探访会友。',
      'Un pastor inventado para las pantallas clave. Creció en un pequeño pueblo agrícola, estudió teología y sirvió en tres iglesias antes de llegar a Nueva York, donde dirige estudios bíblicos y visita a los miembros en sus casas.',
    ),
  },
  {
    name: translated('Miriam Castellanos', '王美恩', '王美恩', 'Miriam Castellanos'),
    roleKey: 'bibleWorker',
    roleNote: translated('Elder at her home church', '母會長老', '母会长老', 'Anciana en su iglesia de origen'),
    imageUrl: CHURCH_BUILDING_IMAGE_URL,
    description: translated(
      'A made-up Bible worker for the key screens. She teaches the baptism class and leads the weekday prayer meeting.',
      '這是一位為測試畫面虛構的聖經助理。她教導洗禮班，並帶領週間禱告會。',
      '这是一位为测试画面虚构的圣经助理。她教导洗礼班，并带领周间祷告会。',
      'Una obrera bíblica inventada para las pantallas clave. Enseña la clase bautismal y dirige la reunión de oración entre semana.',
    ),
  },
];
