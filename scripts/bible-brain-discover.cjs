#!/usr/bin/env node
/**
 * Lists Bible Brain's Bibles and audio filesets for a language, and checks
 * whether each audio fileset has a New Testament and an Old Testament chapter,
 * so the Worker's ALLOWED_FILESETS and the app's configuration use confirmed
 * IDs (#241). It only reads from Bible Brain, and never prints the key.
 *
 *   node scripts/bible-brain-discover.cjs                    Cantonese (yue)
 *   node scripts/bible-brain-discover.cjs --language cmn     Mandarin
 *
 * Read the key into BIBLE_BRAIN_KEY first without echoing it (docs/operations/
 * bible-brain-audio.md shows how), and never commit it.
 */
const API_BASE = 'https://4.dbt.io/api';

const redact = (text) => String(text).replace(/key=[^&\s]+/g, 'key=…');

/** GETs a Bible Brain path, returning { status, body }. */
const get = async (key, path, params = {}) => {
  const url = new URL(`${API_BASE}/${path}`);
  for (const [name, value] of Object.entries({ ...params, v: '4', key })) {
    url.searchParams.set(name, value);
  }
  try {
    const response = await fetch(url, { headers: { Accept: 'application/json' } });
    const text = await response.text();
    let body = null;
    try {
      body = JSON.parse(text);
    } catch {
      body = null;
    }
    return { status: response.status, body };
  } catch (error) {
    return { status: 0, body: null, error: redact(error.message) };
  }
};

/** The fileset entries of a /bibles item, whatever bucket they're grouped under. */
const filesetsOf = (bible) =>
  Object.values(bible.filesets || {})
    .flat()
    .filter((fileset) => fileset && fileset.id);

const isAudio = (fileset) => String(fileset.type || '').startsWith('audio');

const chapterCheck = async (key, filesetId, book, chapter) => {
  const { status, body } = await get(key, `bibles/filesets/${filesetId}/${book}/${chapter}`);
  const file = (body?.data || []).find((item) => String(item.book_id).toUpperCase() === book);
  if (!file?.path) return `${book} ${chapter}: none (HTTP ${status})`;
  const host = new URL(file.path).host;
  const duration = file.duration ? `${Math.round(file.duration)} s` : 'unknown length';
  return `${book} ${chapter}: yes, ${duration}, from ${host}`;
};

const main = async () => {
  const key = process.env.BIBLE_BRAIN_KEY;
  if (!key) {
    console.error('Set BIBLE_BRAIN_KEY in your shell for this command.');
    process.exit(2);
  }
  const languageIndex = process.argv.indexOf('--language');
  const language = languageIndex === -1 ? 'yue' : process.argv[languageIndex + 1];

  const { status, body, error } = await get(key, 'bibles', { language_code: language, limit: '100' });
  if (!body?.data) {
    console.error(`Bible Brain didn't list Bibles for "${language}" (HTTP ${status}${error ? `, ${error}` : ''}).`);
    process.exit(1);
  }
  console.log(`Bibles for language "${language}": ${body.data.length}\n`);

  const audioIds = [];
  for (const bible of body.data) {
    console.log(`${bible.abbr || bible.id}: ${bible.name || ''}${bible.vname ? ` / ${bible.vname}` : ''}`);
    for (const fileset of filesetsOf(bible)) {
      console.log(`  ${fileset.id}  ${fileset.type}  ${fileset.size || ''}`);
      if (!isAudio(fileset) || audioIds.includes(fileset.id)) continue;
      audioIds.push(fileset.id);
      console.log(`    ${await chapterCheck(key, fileset.id, 'MAT', 1)}`);
      console.log(`    ${await chapterCheck(key, fileset.id, 'GEN', 1)}`);
      const copyright = await get(key, `bibles/filesets/${fileset.id}/copyright`);
      const notice = copyright.body?.copyright?.copyright || copyright.body?.copyright;
      if (typeof notice === 'string') console.log(`    Copyright: ${notice.trim()}`);
    }
    console.log('');
  }

  console.log('Audio filesets found. Put the ones the app uses in the Worker\'s wrangler.toml:');
  console.log(`ALLOWED_FILESETS = "${audioIds.join(',')}"`);
};

main();
