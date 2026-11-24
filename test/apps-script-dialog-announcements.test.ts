import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createContext, runInContext } from 'node:vm';

// The Create Word Doc dialog's announcements (#562), run in a browser-like
// page: Weekly Data's one, filled in as the app shows it, to change, remove or
// add to for one print.

// jsdom comes with jest-expo, through jest-environment-jsdom. The app's own
// tests run in React Native's environment, so the page gets a window of its own.
const { JSDOM } = require(require.resolve('jsdom', { paths: [require.resolve('jest-environment-jsdom')] }));

type Request = { announcements?: { english: string; chinese: string }[] };

const WEEKLY_DATA = [{ english: 'Fellowship lunch after the service.\nEveryone is welcome.', chinese: '崇拜後有愛筵。\n歡迎大家。' }];

// The dialog's page, with a google.script.run that answers like the server
// and records each print request.
const openDialog = (announcements = WEEKLY_DATA) => {
  const context = createContext({ Logger: { log: () => undefined } });
  const folder = join(process.cwd(), 'google-apps-script');
  for (const file of readdirSync(folder).filter((name) => name.endsWith('.gs'))) {
    runInContext(readFileSync(join(folder, file), 'utf8'), context, { filename: file });
  }
  runInContext("getBulletinIntakeSheetUrl_ = function () { return 'https://example.invalid/sheet'; };", context);
  const html = runInContext("buildPrintedBulletinPromptHtml_('2026-11-28')", context) as string;
  // jsdom runs none of the page's own scripts with outside-only, so the
  // dialog's script is read from its element and removed through the DOM,
  // then run below once google.script.run is in place.
  const dom = new JSDOM(html, { runScripts: 'outside-only' });
  const window = dom.window as Window & typeof globalThis & { google?: unknown };
  const document: Document = window.document;
  const scriptElements = [...document.querySelectorAll('script')];
  expect(scriptElements.length).toBeGreaterThan(0);
  const script = scriptElements.map((element) => element.textContent ?? '').join('\n');
  scriptElements.forEach((element) => element.remove());

  const requests: Request[] = [];
  const answers: Record<string, (...args: never[]) => unknown> = {
    getPrintedBulletinPromptData: () => ({ announcements, verse: 'John 3:16', verseLabels: null, verseProblem: '' }),
    getPrintedBulletinPromptWarning: () => ({ requiresConfirmation: false }),
    createPrintedBulletinFromRequest: (request: never) => {
      requests.push(JSON.parse(JSON.stringify(request)));
      return { action: 'created', url: 'https://example.invalid/doc' };
    },
  };
  const run = () => {
    let success: (value: unknown) => void = () => undefined;
    const runner: Record<string, unknown> = new Proxy(
      {},
      {
        get: (_target, name: string) => {
          if (name === 'withSuccessHandler') return (handler: typeof success) => ((success = handler), runner);
          if (name === 'withFailureHandler') return () => runner;
          return (...args: never[]) => success(answers[name]?.(...args));
        },
      },
    );
    return runner;
  };
  window.google = { script: { get run() { return run(); }, host: { close: () => undefined } } };
  window.eval(script);

  const cards = () => [...document.querySelectorAll<HTMLElement>('.announcement-entry')];
  const type = (card: HTMLElement, side: 'english' | 'chinese', text: string) => {
    const box = card.querySelector<HTMLTextAreaElement>(`.announcement-${side}`)!;
    box.value = text;
    box.dispatchEvent(new window.Event('input', { bubbles: true }));
  };
  const print = () => {
    document.getElementById('bulletinForm')!.dispatchEvent(new window.Event('submit', { cancelable: true }));
    return requests[requests.length - 1];
  };
  return { cards, type, print, document };
};

describe("the Create Word Doc dialog's announcements (#562)", () => {
  it("fills in Weekly Data's, as the app shows them", () => {
    const { cards, document } = openDialog();
    expect(
      cards().map((card) => [
        card.querySelector<HTMLTextAreaElement>('.announcement-english')!.value,
        card.querySelector<HTMLTextAreaElement>('.announcement-chinese')!.value,
      ]),
    ).toEqual(WEEKLY_DATA.map((announcement) => [announcement.english, announcement.chinese]));
    expect(document.getElementById('addAnnouncement')!.textContent).toBe('+ Add announcement / 添加通知');
  });

  it("sends none when nothing changed, so the print reads Weekly Data's", () => {
    const { print } = openDialog();
    expect(print()).not.toHaveProperty('announcements');
  });

  it('sends the changes for this print, with a side changed alone to be translated again', () => {
    const { cards, type, print, document } = openDialog();
    // The English changed, so its old Chinese translation goes.
    type(cards()[0], 'english', 'Fellowship lunch at noon.');
    // One added, in Chinese only, for the server to translate.
    document.getElementById('addAnnouncement')!.click();
    type(cards()[1], 'chinese', '查經班改到週三。');
    expect(print().announcements).toEqual([
      { english: 'Fellowship lunch at noon.', chinese: '' },
      { english: '', chinese: '查經班改到週三。' },
    ]);
  });

  it("sends Weekly Data's untouched, both sides as the app shows them, beside one added", () => {
    const { cards, type, print, document } = openDialog();
    document.getElementById('addAnnouncement')!.click();
    type(cards()[1], 'english', 'Choir practice at 2 pm.');
    expect(print().announcements).toEqual([WEEKLY_DATA[0], { english: 'Choir practice at 2 pm.', chinese: '' }]);
  });

  it('keeps both sides when both changed, and leaves out a removed or emptied one', () => {
    const { cards, type, print, document } = openDialog();
    document.getElementById('addAnnouncement')!.click();
    type(cards()[1], 'english', 'Potluck.');
    type(cards()[1], 'chinese', '聚餐。');
    cards()[0].querySelector<HTMLButtonElement>('.announcement-remove')!.click();
    document.getElementById('addAnnouncement')!.click();
    expect(cards()).toHaveLength(2);
    expect(cards()[1].querySelector('strong')!.textContent).toBe('Announcement 2 / 通知 2');
    expect(print().announcements).toEqual([{ english: 'Potluck.', chinese: '聚餐。' }]);
  });

  it('starts empty, with only the Add button, when Weekly Data has none', () => {
    const { cards } = openDialog([]);
    expect(cards()).toEqual([]);
  });
});
