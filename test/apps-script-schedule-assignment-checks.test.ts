import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createContext, runInContext } from 'node:vm';

const SOURCES = [
  'BulletinApi.gs',
  'BulletinScheduleMaintenance.gs',
  'ScheduleAssignmentChecks.gs',
  'PrintedBulletin.gs',
];

const HEADERS = [
  'Date', 'Quarter', 'Special Remark', 'Tithe Purpose', 'Pastor Travel',
  'Queens Sermon', 'Translation', 'Chinese Teacher', 'English Teacher', 'Youth Teacher',
  'Kids Teacher', 'Chair/Pastoral Prayer', 'Special Music', 'Offering Prayer', 'Pianist',
  'SS Chair', 'SS Opening Prayer', 'SS Closing Prayer', 'Flower Offering', 'Brooklyn Sermon',
  'Chair/Pastoral Prayer', 'Offering Prayer', 'Technician', 'Encouragement', 'Sabbath School',
];
const QUEENS_SERMON = 6;
const TRANSLATION = 7;
const PIANIST = 15;
const BROOKLYN_SERMON = 20;
const CONFLICT = '#ea9999';

type Grid = string[][];

const createSheet = (name: string, values: Grid) => {
  const backgrounds: (string | null)[][] = values.map((row) => row.map(() => '#ffffff'));
  const notes: string[][] = values.map((row) => row.map(() => ''));
  const makeRange = (row: number, column: number, rows = 1, columns = 1) => {
    const slice = <T,>(grid: T[][]) =>
      Array.from({ length: rows }, (_, r) =>
        Array.from({ length: columns }, (_, c) => grid[row - 1 + r]?.[column - 1 + c] ?? ('' as T)),
      );
    return {
      getRow: () => row,
      getColumn: () => column,
      getSheet: () => sheet,
      getDisplayValues: () => slice(values),
      getValues: () => slice(values),
      getDisplayValue: () => values[row - 1][column - 1],
      getBackgrounds: () => slice(backgrounds),
      setBackgrounds: (next: (string | null)[][]) =>
        next.forEach((line, r) =>
          line.forEach((color, c) => {
            backgrounds[row - 1 + r][column - 1 + c] = color ?? '#ffffff';
          }),
        ),
      getNotes: () => slice(notes),
      setNotes: (next: string[][]) =>
        next.forEach((line, r) =>
          line.forEach((note, c) => {
            notes[row - 1 + r][column - 1 + c] = note;
          }),
        ),
      setValue: (value: string) => {
        values[row - 1][column - 1] = value;
      },
      clearContent: () => {
        values[row - 1][column - 1] = '';
      },
      getCell: (r: number, c: number) => makeRange(row + r - 1, column + c - 1),
    };
  };
  const sheet = {
    getName: () => name,
    getLastRow: () => values.length,
    getRange: makeRange,
    getDataRange: () => makeRange(1, 1, values.length, values[0].length),
    appendRow: (row: string[]) => values.push(row),
    backgrounds,
    notes,
    values,
  };
  return sheet;
};

const scheduleRow = (date: string, people: Record<number, string>) => {
  const row = HEADERS.map(() => '');
  row[0] = date;
  Object.entries(people).forEach(([column, value]) => {
    row[Number(column) - 1] = value;
  });
  return row;
};

const setup = (
  scheduleRows: string[][],
  dictionary: string[][] = [
    ['John Chen', '陳約翰'],
    ['Mary Lin', ''],
    ['David Wong', '王大衛'],
  ],
  extraContext: Record<string, unknown> = {},
) => {
  const schedule = createSheet('Sabbath Calendar', [HEADERS, ...scheduleRows]);
  const names = createSheet('Name Dictionary', [['English Name', 'Chinese Name'], ...dictionary]);
  const alerts: string[] = [];
  const properties: Record<string, string> = {};
  const context = createContext({
    Logger: { log: () => undefined },
    SpreadsheetApp: {
      getActiveSpreadsheet: () => ({
        getSheetByName: (sheetName: string) =>
          ({ 'Sabbath Calendar': schedule, 'Name Dictionary': names })[sheetName] ?? null,
        toast: (message: string) => alerts.push(message),
      }),
      getUi: () => ({
        alert: (_title: string, message: string) => alerts.push(message),
        ButtonSet: { OK: 'OK' },
      }),
    },
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (key: string) => properties[key] ?? null,
        setProperty: (key: string, value: string) => {
          properties[key] = value;
        },
      }),
    },
    ...extraContext,
  });
  runInContext(
    SOURCES.map((file) =>
      readFileSync(join(process.cwd(), 'google-apps-script', file), 'utf8'),
    ).join('\n'),
    context,
  );
  const edit = (row: number, column: number, value: string) => {
    schedule.values[row - 1][column - 1] = value;
    (context as { onEdit: (e: unknown) => void }).onEdit({
      range: schedule.getRange(row, column),
    });
  };
  return { context, schedule, names, alerts, properties, edit };
};

describe('Sabbath Calendar conflict highlighting', () => {
  it('highlights one person scheduled at Queens and Brooklyn on the same Sabbath', () => {
    const { schedule, edit } = setup([
      scheduleRow('2026-10-03', { [QUEENS_SERMON]: 'John Chen', [PIANIST]: 'Mary Lin' }),
    ]);

    edit(2, BROOKLYN_SERMON, 'john  chen');

    expect(schedule.backgrounds[1][QUEENS_SERMON - 1]).toBe(CONFLICT);
    expect(schedule.backgrounds[1][BROOKLYN_SERMON - 1]).toBe(CONFLICT);
    expect(schedule.backgrounds[1][PIANIST - 1]).toBe('#ffffff');
  });

  it('matches individual names inside multi-person cells', () => {
    const { schedule, edit } = setup([
      scheduleRow('2026-10-03', { [TRANSLATION]: 'Mary Lin / David Wong' }),
    ]);

    edit(2, PIANIST, 'David Wong');

    expect(schedule.backgrounds[1][TRANSLATION - 1]).toBe(CONFLICT);
    expect(schedule.backgrounds[1][PIANIST - 1]).toBe(CONFLICT);
  });

  it('ignores placeholders, the header row, metadata columns, and other Sabbaths', () => {
    const { schedule, edit } = setup([
      scheduleRow('2026-10-03', { 3: 'John Chen', [QUEENS_SERMON]: 'John Chen', [PIANIST]: 'TBD' }),
      scheduleRow('2026-10-10', { [BROOKLYN_SERMON]: 'John Chen', [TRANSLATION]: 'TBD' }),
    ]);

    edit(3, PIANIST, 'tbd');

    expect(schedule.backgrounds.flat()).not.toContain(CONFLICT);
  });

  it('clears its highlight once the conflict is fixed, leaving other colors alone', () => {
    const { schedule, edit } = setup([
      scheduleRow('2026-10-03', { [QUEENS_SERMON]: 'John Chen', [BROOKLYN_SERMON]: 'John Chen' }),
    ]);
    schedule.backgrounds[1][0] = '#d9ead3';
    edit(2, PIANIST, 'Mary Lin');
    expect(schedule.backgrounds[1][QUEENS_SERMON - 1]).toBe(CONFLICT);

    edit(2, BROOKLYN_SERMON, 'David Wong');

    expect(schedule.backgrounds[1][QUEENS_SERMON - 1]).toBe('#ffffff');
    expect(schedule.backgrounds[1][BROOKLYN_SERMON - 1]).toBe('#ffffff');
    expect(schedule.backgrounds[1][0]).toBe('#d9ead3');
  });

  it('rescans every row, clearing highlights copied into appended quarter rows', () => {
    const { context, schedule } = setup([
      scheduleRow('2026-10-03', { [QUEENS_SERMON]: 'John Chen', [BROOKLYN_SERMON]: 'John Chen' }),
      scheduleRow('2026-12-26', {}),
      scheduleRow('2027-01-02', {}),
    ]);
    schedule.backgrounds[3][QUEENS_SERMON - 1] = CONFLICT;

    const count = runInContext('refreshScheduleRosterChecksSafely_()', context);

    expect(count).toBe(2);
    expect(schedule.backgrounds[1][QUEENS_SERMON - 1]).toBe(CONFLICT);
    expect(schedule.backgrounds[3][QUEENS_SERMON - 1]).toBe('#ffffff');
  });

  it('treats a pinyin spelling as the dictionary person it resolves to', () => {
    const { schedule, edit } = setup(
      [scheduleRow('2026-10-03', { [QUEENS_SERMON]: 'David Wong' })],
      [['David Wong', '王大衛']],
      {
        pinyinPro: {
          pinyin: (value: string) => (value === '王大衛' ? ['wang', 'da', 'wei'] : []),
        },
      },
    );

    edit(2, BROOKLYN_SERMON, 'Wang Dawei');

    expect(schedule.backgrounds[1][QUEENS_SERMON - 1]).toBe(CONFLICT);
    expect(schedule.backgrounds[1][BROOKLYN_SERMON - 1]).toBe(CONFLICT);
  });
});

describe('Sabbath Calendar conflict notes', () => {
  it('notes the other roles a conflicting person holds, naming repeated headers by location', () => {
    const { schedule, edit } = setup([
      scheduleRow('2026-10-03', { [QUEENS_SERMON]: 'John Chen', [PIANIST]: 'John Chen' }),
    ]);

    edit(2, 21, 'John Chen');

    expect(schedule.notes[1][QUEENS_SERMON - 1]).toBe(
      'Duplicate / 重複: Pianist, Brooklyn Chair/Pastoral Prayer',
    );
  });

  it('rewrites notes left in the earlier "Roster check" wording', () => {
    const { schedule, edit } = setup([scheduleRow('2026-10-03', { [QUEENS_SERMON]: 'Mary Lin' })]);
    schedule.notes[1][QUEENS_SERMON - 1] = 'Roster check / 名單檢查\n• Also scheduled this Sabbath as: Pianist.';

    edit(2, PIANIST, 'Mary Lin');

    expect(schedule.notes[1][QUEENS_SERMON - 1]).toBe('Duplicate / 重複: Pianist');
  });

  it('keeps a planner\'s own note while still coloring the cell', () => {
    const { schedule, edit } = setup([scheduleRow('2026-10-03', { [QUEENS_SERMON]: 'Mary Lin' })]);
    schedule.notes[1][PIANIST - 1] = 'Confirmed by phone';

    edit(2, PIANIST, 'Mary Lin');

    expect(schedule.notes[1][PIANIST - 1]).toBe('Confirmed by phone');
    expect(schedule.backgrounds[1][PIANIST - 1]).toBe(CONFLICT);
    expect(schedule.notes[1][QUEENS_SERMON - 1]).toContain('Pianist');
  });

  it('never colors a name just because it is missing from the Name Dictionary', () => {
    const { schedule, edit } = setup([scheduleRow('2026-10-03', {})]);

    edit(2, PIANIST, 'Jonh Chen');

    expect(schedule.backgrounds[1][PIANIST - 1]).toBe('#ffffff');
    expect(schedule.notes[1][PIANIST - 1]).toBe('');
  });
});

describe('Sabbath Calendar unknown-name warnings', () => {
  it('warns about a name missing from the Name Dictionary and suggests close spellings', () => {
    const { alerts, edit } = setup([scheduleRow('2026-10-03', {})]);

    edit(2, PIANIST, 'Jonh Chen');

    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toContain('"Jonh Chen" (Pianist, 2026-10-03)');
    expect(alerts[0]).toContain('did you mean / 您是否指: John Chen?');
  });

  it('suggests full names when only a first name is typed', () => {
    const { context } = setup([]);

    expect(
      runInContext('suggestScheduleNames_("Mary", loadScheduleNameLookup_())', context),
    ).toEqual(['Mary Lin']);
  });

  it('stays quiet for dictionary names, placeholders, and metadata columns', () => {
    const { alerts, edit } = setup([scheduleRow('2026-10-03', {})]);

    edit(2, PIANIST, 'john chen');
    edit(2, TRANSLATION, 'Choir');
    edit(2, 3, 'Communion Sabbath');

    expect(alerts).toEqual([]);
  });

  it('leaves the warning to the installable dialog trigger once it is installed', () => {
    const { alerts, properties, edit } = setup([scheduleRow('2026-10-03', {})]);
    properties.SCHEDULE_NAME_CHECK_TRIGGER = 'installed';

    edit(2, PIANIST, 'Jonh Chen');

    expect(alerts).toEqual([]);
  });

  it('adds a name to the dictionary and replaces a misspelling from the dialog', () => {
    const { context, names, schedule } = setup([
      scheduleRow('2026-10-03', { [TRANSLATION]: 'Mary Lin / Jonh Chen' }),
    ]);

    runInContext(
      `addScheduleNameToDictionary({ english: ' Grace  Ho ', chinese: '何恩典' });
       addScheduleNameToDictionary({ english: 'grace ho', chinese: '' });
       replaceScheduleNameFromDialog({ row: 2, column: ${TRANSLATION}, from: 'Jonh Chen', to: 'John Chen' });`,
      context,
    );

    expect(names.values.slice(-1)).toEqual([['Grace Ho', '何恩典']]);
    expect(names.values).toHaveLength(5);
    expect(schedule.values[1][TRANSLATION - 1]).toBe('Mary Lin / John Chen');
    expect(() =>
      runInContext(
        `replaceScheduleNameFromDialog({ row: 1, column: ${TRANSLATION}, from: 'Date', to: 'x' })`,
        context,
      ),
    ).toThrow('not a roster name cell');
  });
});

describe('unknown-name dialog trigger installation', () => {
  const setupTrigger = (email: string, installed = false) => {
    const created: string[] = [];
    const triggers: { getHandlerFunction: () => string }[] = [];
    const scriptApp = {
      getProjectTriggers: () => triggers,
      newTrigger: (handler: string) => ({
        forSpreadsheet: () => ({
          onEdit: () => ({
            create: () => {
              created.push(handler);
              triggers.push({ getHandlerFunction: () => handler });
            },
          }),
        }),
      }),
    };
    const session = {
      getActiveUser: () => ({ getEmail: () => email }),
      getEffectiveUser: () => ({ getEmail: () => email }),
    };
    const result = setup([], undefined, { ScriptApp: scriptApp, Session: session });
    result.properties.PHYSICAL_BULLETIN_ADMIN_EMAILS = 'admin@example.org';
    if (installed) {
      result.properties.SCHEDULE_NAME_CHECK_TRIGGER = 'installed';
    }
    return { ...result, created };
  };

  it('installs once for a bulletin admin', () => {
    const { context, created, properties } = setupTrigger('admin@example.org');

    expect(runInContext('ensureScheduleNameCheckTrigger_()', context)).toBe(true);
    expect(runInContext('ensureScheduleNameCheckTrigger_()', context)).toBe(false);

    expect(created).toEqual(['onScheduleNameCheckEdit']);
    expect(properties.SCHEDULE_NAME_CHECK_TRIGGER).toBe('installed');
  });

  it('does not install for other editors or when already installed', () => {
    const editor = setupTrigger('editor@example.org');
    const secondAdmin = setupTrigger('admin@example.org', true);

    expect(runInContext('ensureScheduleNameCheckTrigger_()', editor.context)).toBe(false);
    expect(runInContext('ensureScheduleNameCheckTrigger_()', secondAdmin.context)).toBe(false);

    expect(editor.created).toEqual([]);
    expect(secondAdmin.created).toEqual([]);
  });
});

describe('Sabbath Calendar English-only input', () => {
  it('clears typed Chinese and explains why in a popup', () => {
    const { schedule, alerts, edit } = setup([scheduleRow('2026-10-03', {})]);

    edit(2, PIANIST, '陳約翰');

    expect(schedule.values[1][PIANIST - 1]).toBe('');
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toContain('Chinese characters are not allowed');
  });

  it('installs the validation rule without help text so it never covers selected cells', () => {
    const calls: [string, unknown][] = [];
    const builder: Record<string, (...args: unknown[]) => unknown> = {};
    ['requireFormulaSatisfied', 'setAllowInvalid', 'setHelpText'].forEach((name) => {
      builder[name] = (value: unknown) => {
        calls.push([name, value]);
        return builder;
      };
    });
    builder.build = () => 'rule';
    const { context } = setup([], undefined, {});
    (context as { SpreadsheetApp: Record<string, unknown> }).SpreadsheetApp.newDataValidation = () => builder;
    let applied: unknown;
    const sheet = {
      getMaxRows: () => 100,
      getRange: () => ({
        setDataValidation: (rule: unknown) => {
          applied = rule;
        },
        getA1Notation: () => 'A2:Y100',
      }),
    };
    (context as { testSheet: unknown }).testSheet = sheet;

    runInContext('applySabbathCalendarEnglishValidation_(testSheet)', context);

    expect(applied).toBe('rule');
    expect(calls).toContainEqual(['setAllowInvalid', true]);
    expect(calls.map(([name]) => name)).not.toContain('setHelpText');
  });
});

