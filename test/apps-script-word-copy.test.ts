import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createContext, runInContext } from 'node:vm';

// The Word copy of a printed bulletin for printing on a Mac in Songti TC (#627).

const loadAppsScript = (context: Record<string, unknown>) => {
  const vmContext = createContext({ Logger: { log: () => undefined }, ...context });
  runInContext(
    ['BulletinApi.gs', 'SabbathEncouragement.gs', 'PrintedBulletin.gs']
      .map((file) => readFileSync(join(process.cwd(), 'google-apps-script', file), 'utf8'))
      .join('\n'),
    vmContext,
  );
  return vmContext;
};

// A cut-down document.xml as Google Docs exports a bulletin: a Chinese title
// in the Docs font, an English line, the 0.9-spaced giving notes, a line with
// no paragraph properties, a picture, an empty paragraph, and the section with
// its document grid.
const DOCUMENT_XML =
  '<w:document><w:body>' +
  '<w:p w:rsidR="00A1"><w:pPr><w:spacing w:before="0" w:after="0" w:line="240" w:lineRule="auto"/><w:jc w:val="center"/><w:rPr><w:sz w:val="20"/></w:rPr></w:pPr>' +
  '<w:r><w:rPr><w:rFonts w:ascii="UoqMunThenKhung" w:hAnsi="UoqMunThenKhung" w:eastAsia="UoqMunThenKhung" w:cs="UoqMunThenKhung"/><w:spacing w:val="10"/><w:sz w:val="26"/></w:rPr><w:t>崇拜聚會</w:t></w:r></w:p>' +
  '<w:p><w:pPr><w:jc w:val="left"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:eastAsia="Times New Roman" w:eastAsiaTheme="minorEastAsia" w:hint="default"/><w:sz w:val="20"/></w:rPr><w:t>THE CHURCH AT WORSHIP</w:t></w:r>' +
  '<w:r><w:rPr><w:rFonts w:ascii="Noto Sans SC" w:hAnsi="Noto Sans SC" w:eastAsia="Noto Sans SC" w:cs="Noto Sans SC"/><w:sz w:val="20"/></w:rPr><w:t>张</w:t></w:r></w:p>' +
  '<w:p><w:pPr><w:spacing w:line="216" w:lineRule="auto"/><w:rPr><w:sz w:val="20"/></w:rPr></w:pPr><w:r><w:rPr><w:sz w:val="20"/></w:rPr><w:t>Cash offerings</w:t></w:r></w:p>' +
  '<w:p><w:r><w:t>Plain</w:t></w:r></w:p>' +
  '<w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:drawing><wp:inline>cover</wp:inline></w:drawing></w:r></w:p>' +
  '<w:p/>' +
  '<w:sectPr><w:pgSz w:w="15840" w:h="12240"/><w:docGrid w:linePitch="360"/></w:sectPr>' +
  '</w:body></w:document>';

const STYLES_XML =
  '<w:styles><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:eastAsia="Arial" w:cs="Arial"/><w:sz w:val="22"/></w:rPr></w:rPrDefault>' +
  '<w:pPrDefault><w:pPr><w:spacing w:line="276" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults></w:styles>';

const paragraphs = (xml: string) => xml.match(/<w:p(?:\s[^>]*[^/>])?>[\s\S]*?<\/w:p>|<w:p\/>/g) ?? [];

describe('the Word copy for printing on a Mac (#627)', () => {
  const convert = (lineHeight = 1.15) => {
    const context = loadAppsScript({});
    return runInContext(
      `convertPrintedDocxDocumentXml_(${JSON.stringify(DOCUMENT_XML)}, {
        chineseFonts: ['UoqMunThenKhung', 'Noto Sans SC'],
        lineHeight: ${lineHeight},
        defaultSize: 11,
        defaultMultiple: 1.15,
      })`,
      context,
    ) as string;
  };

  it('gives each paragraph of text an exact height from its largest font size', () => {
    const [title, english, giving, plain] = paragraphs(convert());

    // 13 points × 1.15, in twentieths of a point.
    expect(title).toContain('<w:spacing w:before="0" w:after="0" w:line="299" w:lineRule="exact"/>');
    // No w:spacing yet: it goes before w:jc, as the schema orders them, and
    // the default 1.15 spacing applies: 10 points × 1.15 × 1.15.
    expect(english).toContain('<w:pPr><w:spacing w:line="265" w:lineRule="exact"/><w:jc w:val="left"/>');
    // The giving notes keep their 0.9.
    expect(giving).toContain('<w:spacing w:line="207" w:lineRule="exact"/>');
    // No properties or sizes: the defaults, 11 points at 1.15 spacing.
    expect(plain).toContain('<w:p><w:pPr><w:spacing w:line="291" w:lineRule="exact"/></w:pPr>');
    // A run's letter spacing is a w:spacing too, and stays as it was.
    expect(title).toContain('<w:spacing w:val="10"/>');
  });

  it('leaves paragraphs with pictures, and empty ones, as they were, and drops the document grid', () => {
    const converted = convert();
    const picture = '<w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:drawing><wp:inline>cover</wp:inline></w:drawing></w:r></w:p>';

    expect(converted).toContain(picture);
    expect(converted).toContain('<w:p/>');
    expect(converted).not.toContain('docGrid');
    expect(converted).toContain('<w:pgSz w:w="15840" w:h="12240"/>');
    expect(converted.match(/w:lineRule="exact"/g)).toHaveLength(4);
  });

  it('prints every Chinese character in Songti TC and leaves English in Times New Roman', () => {
    const [title, english] = paragraphs(convert());

    // The Docs Chinese font and the fallback font: Songti TC in every slot.
    expect(title).toContain('<w:rFonts w:ascii="Songti TC" w:hAnsi="Songti TC" w:cs="Songti TC" w:eastAsia="Songti TC"/>');
    expect(english).toContain('<w:rFonts w:ascii="Songti TC" w:hAnsi="Songti TC" w:cs="Songti TC" w:eastAsia="Songti TC"/><w:sz w:val="20"/></w:rPr><w:t>张');
    // English keeps its font, with Songti TC for any Chinese, and no theme or
    // hint to override it.
    expect(english).toContain('<w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:eastAsia="Songti TC"/>');
    expect(convert()).not.toMatch(/eastAsiaTheme|w:hint|UoqMunThenKhung|Noto Sans SC/);
  });

  it('reads the default size and spacing, and sets Songti TC as the default East Asian font', () => {
    const context = loadAppsScript({});

    expect(runInContext(`readPrintedDocxDefaults_(${JSON.stringify(STYLES_XML)})`, context)).toEqual({
      size: 11,
      multiple: 1.15,
    });
    expect(runInContext(`readPrintedDocxDefaults_('')`, context)).toEqual({ size: 11, multiple: 1 });
    expect(runInContext(`setPrintedDocxEastAsiaFonts_(${JSON.stringify(STYLES_XML)}, [])`, context)).toContain(
      '<w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial" w:eastAsia="Songti TC"/>',
    );
  });

  // The Apps Script services, faked: the Doc in its folder, the Drive export,
  // and Utilities' zip.
  const setup = (overrides: { properties?: Record<string, string>; exportCode?: number; trashed?: boolean } = {}) => {
    const properties: Record<string, string> = {
      'PHYSICAL_BULLETIN_DOC_ID_QUEENS_2026-11-07': 'doc-1',
      ...overrides.properties,
    };
    const fetched: Array<{ url: string; headers: Record<string, string> }> = [];
    const trashed: string[] = [];
    const created: Array<{ name: string; type: string; parts: Record<string, string> }> = [];
    const part = (name: string, data: string) => ({
      getName: () => name,
      getDataAsString: () => data,
    });
    const folder = {
      getFilesByName: (name: string) => {
        const old = [{ setTrashed: () => trashed.push(name) }];
        return { hasNext: () => old.length > 0, next: () => old.shift() };
      },
      createFile: (blob: { name: string; type: string; parts: Record<string, string> }) => {
        created.push(blob);
        return { getId: () => 'copy-1', getUrl: () => 'https://drive.example/copy-1' };
      },
    };
    const context = loadAppsScript({
      PropertiesService: {
        getScriptProperties: () => ({ getProperty: (key: string) => properties[key] ?? null }),
      },
      DriveApp: {
        getFileById: (id: string) => {
          if (id !== 'doc-1') throw new Error('No such file');
          return {
            isTrashed: () => Boolean(overrides.trashed),
            getName: () => '2026-11-07 Bulletin - Regular Worship',
            getParents: () => ({ hasNext: () => true, next: () => folder }),
          };
        },
      },
      ScriptApp: { getOAuthToken: () => 'token-1' },
      UrlFetchApp: {
        fetch: (url: string, options: { headers: Record<string, string> }) => {
          fetched.push({ url, headers: options.headers });
          // Drive labels the export as Word, not as a zip.
          const blob = {
            type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            getContentType: () => blob.type,
            setContentType: (type: string) => {
              blob.type = type;
              return blob;
            },
          };
          return { getResponseCode: () => overrides.exportCode ?? 200, getBlob: () => blob };
        },
      },
      Utilities: {
        // As in Apps Script, which refuses any other content type.
        unzip: (blob: { getContentType: () => string }) => {
          if (blob.getContentType() !== 'application/zip') {
            throw new Error('Exception: Invalid argument: ContentType: should be of type: application/zip');
          }
          return [
            part('[Content_Types].xml', '<Types/>'),
            part('word/document.xml', DOCUMENT_XML),
            part('word/styles.xml', STYLES_XML),
            part('word/media/image1.png', 'png'),
          ];
        },
        newBlob: (data: string, _type: string, name: string) => part(name, data),
        zip: (blobs: Array<ReturnType<typeof part>>, name: string) => {
          const zipped = {
            name,
            type: '',
            parts: Object.fromEntries(blobs.map((blob) => [blob.getName(), blob.getDataAsString()])),
            setContentType: (type: string) => {
              zipped.type = type;
              return zipped;
            },
          };
          return zipped;
        },
      },
    });
    return { context, fetched, trashed, created };
  };

  it('exports the Doc as it stands, converts it, and saves it next to the Doc, replacing the last copy', () => {
    const { context, fetched, trashed, created } = setup({
      properties: { PRINTED_BULLETIN_WORD_LINE_HEIGHT: '1.2' },
    });

    const result = runInContext(
      `createPrintedBulletinWordCopy({ date: '2026-11-07', location: 'queens' })`,
      context,
    );

    expect(fetched).toEqual([
      {
        url:
          'https://www.googleapis.com/drive/v3/files/doc-1/export?mimeType=' +
          encodeURIComponent('application/vnd.openxmlformats-officedocument.wordprocessingml.document'),
        headers: { Authorization: 'Bearer token-1' },
      },
    ]);
    const name = '2026-11-07 Bulletin - Regular Worship (Word, Songti TC).docx';
    expect(trashed).toEqual([name]);
    expect(created).toHaveLength(1);
    expect(created[0].name).toBe(name);
    expect(created[0].type).toBe('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    // Every part is kept; only document.xml and styles.xml change.
    expect(Object.keys(created[0].parts)).toEqual([
      '[Content_Types].xml',
      'word/document.xml',
      'word/styles.xml',
      'word/media/image1.png',
    ]);
    expect(created[0].parts['word/media/image1.png']).toBe('png');
    // The Script Property's 1.2: 13 points × 1.2.
    expect(created[0].parts['word/document.xml']).toContain('w:line="312" w:lineRule="exact"');
    expect(created[0].parts['word/styles.xml']).toContain('w:eastAsia="Songti TC"');
    expect(result).toEqual({
      name,
      url: 'https://drive.example/copy-1',
      downloadUrl: 'https://drive.google.com/uc?export=download&id=copy-1',
    });
  });

  it('ignores a line height outside 0.8 to 2', () => {
    const { context, created } = setup({ properties: { PRINTED_BULLETIN_WORD_LINE_HEIGHT: '12' } });
    runInContext(`createPrintedBulletinWordCopy({ date: '2026-11-07', location: 'queens' })`, context);

    expect(created[0].parts['word/document.xml']).toContain('w:line="299" w:lineRule="exact"');
  });

  it('finds an older Queens Doc saved by date alone', () => {
    const { context, created } = setup({
      properties: {
        'PHYSICAL_BULLETIN_DOC_ID_QUEENS_2026-11-07': '',
        'PHYSICAL_BULLETIN_DOC_ID_2026-11-07': 'doc-1',
      },
    });
    runInContext(`createPrintedBulletinWordCopy({ date: '2026-11-07', location: 'queens' })`, context);

    expect(created).toHaveLength(1);
  });

  it('says so, in English and Simplified Chinese, when there is no Doc yet or the export fails', () => {
    const run = (options: Parameters<typeof setup>[0], request: string) => {
      const { context, created } = setup(options);
      const message = runInContext(
        `try { createPrintedBulletinWordCopy(${request}); 'made'; } catch (error) { error.message; }`,
        context,
      );
      return { message, created };
    };
    const noDoc = 'There is no Google Doc for this Sabbath and location yet. Create it first, then make the Word copy.\n这个安息日和地点还没有 Google 文档。请先创建，再制作 Word 副本。';

    expect(run({}, `{ date: '2026-11-07', location: 'brooklyn' }`).message).toBe(noDoc);
    expect(run({ trashed: true }, `{ date: '2026-11-07', location: 'queens' }`).message).toBe(noDoc);
    expect(run({ properties: { 'PHYSICAL_BULLETIN_DOC_ID_QUEENS_2026-11-07': 'gone' } }, `{ date: '2026-11-07', location: 'queens' }`).message).toBe(noDoc);
    expect(run({}, `{ date: '', location: 'queens' }`).message).toBe('Sabbath date is required. / 安息日日期为必填。');
    const failed = run({ exportCode: 403 }, `{ date: '2026-11-07', location: 'queens' }`);
    expect(failed.message).toContain('Google Drive could not export the Doc as Word (403).');
    expect(failed.message).toContain('Google 云端硬盘无法将文档导出为 Word（403）');
    expect(failed.created).toEqual([]);
  });

  it('makes the print version in step 3, for everyone to print from, with LibreOffice as the free option', () => {
    const context = loadAppsScript({});
    const html = runInContext(`buildPrintedBulletinPromptHtml_('2026-11-07')`, context) as string;

    expect(html).toContain('3. Print the final version / 第三步：打印最终版');
    expect(html).toContain('make the print version: a Word file with the final fonts and spacing');
    expect(html).toContain('制作打印版：使用最终字体和行距的 Word 文件');
    // Sending it to the pastor comes first; Word or LibreOffice is the fallback.
    expect(html).toContain('Send it to the pastor on WhatsApp to print on a Mac. If no Mac is available, print it from Word or free');
    expect(html).toContain('通过 WhatsApp 发给牧师，在 Mac 上打印。如果没有 Mac，可用 Word 或免费的');
    expect(html.indexOf('Send it to the pastor')).toBeLessThan(html.indexOf('>LibreOffice</a>'));
    // It says what a computer without Songti TC shows.
    expect(html).toContain('>LibreOffice</a>, with a similar Chinese font.');
    expect(html).toContain('中文会使用相近的字体');
    expect(html.match(/href="https:\/\/www\.libreoffice\.org\/download\/download-libreoffice\/">LibreOffice<\/a>/g)).toHaveLength(2);
    expect(html).toContain('id="wordCopy">Make print version / 制作打印版</button>');
    expect(html).toContain('createPrintedBulletinWordCopy({date:date,location:locationValue})');
    expect(html).toContain('Download print version (.docx) / 下载打印版（.docx）');
    // Only the download: the copy is for printing, not for opening in Drive.
    expect(html).not.toContain('Open in Google Drive');
    expect(html).not.toContain('Make Word copy');
    expect(html).not.toMatch(/pdf/i);
  });

  it('says in Fonts… that Songti TC is in the print version, on a Mac', () => {
    const context = loadAppsScript({
      PropertiesService: { getScriptProperties: () => ({ getProperty: () => null }) },
    });
    const html = runInContext(
      'buildPrintedBulletinFontsHtml_(getPrintedBulletinFontSettings_())',
      context,
    ) as string;

    expect(html).toContain("Songti TC (宋體-繁) isn't here: Google Docs can't print it.");
    expect(html).toContain('The print version, step 3 of Create Google Doc…, has it on a Mac.');
    expect(html).toContain('这里没有宋体-繁（Songti TC）');
    expect(html).not.toContain('<option value="Songti TC"');
  });
});
