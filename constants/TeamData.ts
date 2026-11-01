import {
  PASTOR_HAO_IMAGE_URL,
  PASTOR_IMAGE_URL,
} from './ExternalLinks';

export interface TeamMember {
  name: {
    en: string;
    zh: string;
    'zh-cn': string;
    es: string;
  };
  roleKey: 'seniorPastor' | 'pastor' | 'childrensMinistry';
  imageUrl: string;
  description: {
    en: string;
    zh: string;
    'zh-cn': string;
    es: string;
  };
}

// The Chinese bios are the source, as each person wrote or approved them
// (#557). The English and Spanish are translated from the Chinese, and the
// Simplified Chinese is converted from the Traditional.
export const TEAM_MEMBERS: TeamMember[] = [
  {
    name: {
      en: 'Moses Fang',
      zh: '方舟',
      'zh-cn': '方舟',
      es: 'Moses Fang',
    },
    roleKey: 'seniorPastor',
    imageUrl: PASTOR_IMAGE_URL,
    description: {
      en: 'Originally from Shenyang, China, Pastor Moses Fang responded to God’s call to ministry at the age of sixteen. He began serving in rural areas of China, where he planted churches, led Bible studies, preached, and engaged in pastoral ministry. Over the years, he served as a minister in several different regions.\n\nAfter coming to the United States, he served as the senior pastor of the Boston Chinese Seventh-day Adventist Church. He later graduated from Andrews University with a Master of Divinity (MDiv) degree. Since 2022, he has served as the senior pastor of the New York Chinese Seventh-day Adventist Church, where he continues his ministry in pastoral care and evangelism.',
      zh: '來自中國瀋陽，自16歲蒙主呼召，開始參與傳道事工，在中國農村地區建立教會、帶領查經並從事講道與牧養工作，曾先後在多個地區擔任傳道人。來美後，曾擔任波士頓華人基督復臨安息日會堂主任。後畢業於美國安得烈大學（Andrews University），獲道學碩士（Master of Divinity, MDiv）學位。畢業後，自2022年起擔任紐約華人基督復臨安息日會堂主任，從事教會牧養與傳道事工。',
      'zh-cn':
        '来自中国沈阳，自16岁蒙主呼召，开始参与传道事工，在中国农村地区建立教会、带领查经并从事讲道与牧养工作，曾先后在多个地区担任传道人。来美后，曾担任波士顿华人基督复临安息日会堂主任。后毕业于美国安得烈大学（Andrews University），获道学硕士（Master of Divinity, MDiv）学位。毕业后，自2022年起担任纽约华人基督复临安息日会堂主任，从事教会牧养与传道事工。',
      es: 'Originario de Shenyang, China, el pastor Moses Fang respondió al llamado de Dios al ministerio a los dieciséis años. Comenzó a servir en zonas rurales de China, donde fundó iglesias, dirigió estudios bíblicos, predicó y ejerció el ministerio pastoral. Con los años, sirvió como ministro en varias regiones.\n\nTras llegar a Estados Unidos, fue el pastor principal de la Iglesia Adventista del Séptimo Día China de Boston. Más tarde se graduó de la Universidad Andrews con una Maestría en Divinidad (MDiv). Desde 2022 es el pastor principal de la Iglesia Adventista del Séptimo Día China de Nueva York, donde continúa su ministerio de cuidado pastoral y evangelismo.',
    },
  },
  {
    name: {
      en: 'Sarah Hao',
      zh: '郝雅君',
      'zh-cn': '郝雅君',
      es: 'Sarah Hao',
    },
    roleKey: 'pastor',
    imageUrl: PASTOR_HAO_IMAGE_URL,
    description: {
      en: 'Originally from Shenyang, China, Sarah Hao began her ministry in evangelism and church planting forty years ago. She has devoted much of her life to planting and nurturing churches in rural areas of Northeast China, and has been directly or indirectly involved in establishing more than twenty churches.\n\nShe has long been committed to training lay preachers and church workers, and is particularly gifted in leading devotions, Bible study, and discipleship training. She is currently pursuing a Master of Divinity (MDiv) degree at the Adventist International Institute of Advanced Studies (AIIAS) in the Philippines.',
      zh: '來自中國瀋陽，四十年前開始投身傳道與植堂事工，長期在中國東北農村地區建立和牧養教會。一生中直接或間接參與建立教會二十餘間，並長期致力於培養平信徒傳道人及教會工人，擅長帶領靈修、聖經學習及門徒培訓。現於菲律賓復臨國際高等研究院（Adventist International Institute of Advanced Studies, AIIAS）攻讀道學碩士（Master of Divinity, MDiv）學位。',
      'zh-cn':
        '来自中国沈阳，四十年前开始投身传道与植堂事工，长期在中国东北农村地区建立和牧养教会。一生中直接或间接参与建立教会二十余间，并长期致力于培养平信徒传道人及教会工人，擅长带领灵修、圣经学习及门徒培训。现于菲律宾复临国际高等研究院（Adventist International Institute of Advanced Studies, AIIAS）攻读道学硕士（Master of Divinity, MDiv）学位。',
      es: 'Originaria de Shenyang, China, Sarah Hao comenzó su ministerio de evangelismo y fundación de iglesias hace cuarenta años. Ha dedicado gran parte de su vida a fundar y pastorear iglesias en zonas rurales del noreste de China, y ha participado directa o indirectamente en la fundación de más de veinte iglesias.\n\nDesde hace muchos años se dedica a formar predicadores laicos y obreros de iglesia, y tiene un don especial para dirigir devocionales, estudios bíblicos y la formación de discípulos. Actualmente cursa una Maestría en Divinidad (MDiv) en el Instituto Internacional Adventista de Estudios Avanzados (AIIAS), en Filipinas.',
    },
  },
];
