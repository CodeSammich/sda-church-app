import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const {
  EXCLUDED,
  getDataExtractionRules,
  getFullBackupContent,
  setBackupRules,
} = require('../plugins/withAndroidBackupRules');

// What the phone's own backup keeps (#524; docs/feature_designs/on_device_storage.md):
// the settings and saved verses in AsyncStorage, which members can't get back
// otherwise, but not copies the app can download again, which go in the cache
// directory instead, or, for Bible audio downloaded to listen offline (#556),
// in the documents directory, marked to stay out of the backup.
const app = JSON.parse(readFileSync(join(process.cwd(), 'app.json'), 'utf8')).expo;

describe('device backups', () => {
  it('include AsyncStorage on iPhone, which it otherwise leaves out', () => {
    expect(app.ios.infoPlist.RCTAsyncStorageExcludeFromBackup).toBe(false);
  });

  it("keep Android's Auto Backup on, set explicitly as Google recommends", () => {
    expect(app.android.allowBackup).toBe(true);
  });

  it('leave out the copies the app can download again, which go through services/CacheStore.ts', () => {
    const source = (file: string) => readFileSync(join(process.cwd(), file), 'utf8');
    expect(source('services/CacheStore.ts')).toContain('new Directory(Paths.cache, folder)');
    for (const file of ['services/BulletinService.ts', 'app/(tabs)/index.tsx', 'features/sabbath-school/LessonDownloads.ts', 'services/VerseOfTheDayWidget.android.ts']) {
      expect([file, source(file).includes("from '@/services/CacheStore'"), /\bAsyncStorage\b/.test(source(file))]).toEqual([file, true, false]);
    }
  });

  it('leave out downloaded Bible audio, what is still downloading, and the widget’s verses on Android, and nothing else', () => {
    expect(app.plugins).toContain('./plugins/withAndroidBackupRules');
    // The second and third are #611's: where Android's DownloadManager writes a
    // chapter until the app moves it into bible-audio, and the list of chapters
    // under way.
    expect(EXCLUDED).toEqual([
      { domain: 'file', path: 'bible-audio' },
      { domain: 'external', path: 'bible-audio-partial' },
      { domain: 'sharedpref', path: 'bible-audio-downloads.xml' },
      { domain: 'sharedpref', path: 'expo.modules.widgets.xml' },
      { domain: 'sharedpref', path: 'verse_widget_theme.xml' },
    ]);
    for (const exclude of [
      '<exclude domain="file" path="bible-audio"/>',
      '<exclude domain="external" path="bible-audio-partial"/>',
      '<exclude domain="sharedpref" path="bible-audio-downloads.xml"/>',
      '<exclude domain="sharedpref" path="expo.modules.widgets.xml"/>',
      '<exclude domain="sharedpref" path="verse_widget_theme.xml"/>',
    ]) {
      // Android 11 and lower, and both of Android 12's sections.
      expect(getFullBackupContent().split(exclude)).toHaveLength(2);
      expect(getDataExtractionRules().split(exclude)).toHaveLength(3);
    }
    expect(getDataExtractionRules()).toMatch(/<cloud-backup>(\s*<exclude[^>]*>)+\s*<\/cloud-backup>/);
    expect(getDataExtractionRules()).toMatch(/<device-transfer>(\s*<exclude[^>]*>)+\s*<\/device-transfer>/);
    // An <include> would stop everything else being backed up, AsyncStorage included.
    expect(`${getFullBackupContent()}${getDataExtractionRules()}`).not.toContain('<include');
  });

  it('point the Android manifest at those rules, and not replace rules another plugin set', () => {
    const manifest = () => ({ manifest: { application: [{ $: { 'android:name': '.MainApplication', 'android:allowBackup': 'true' } }] } });
    expect(setBackupRules(manifest()).manifest.application[0].$).toMatchObject({
      'android:allowBackup': 'true',
      'android:fullBackupContent': '@xml/backup_rules',
      'android:dataExtractionRules': '@xml/data_extraction_rules',
    });
    const other = manifest();
    other.manifest.application[0].$ = { ...other.manifest.application[0].$, 'android:fullBackupContent': '@xml/secure_store_backup_rules' } as never;
    expect(() => setBackupRules(other)).toThrow('Merge its rules');
  });

  it('keep downloaded Bible audio where the phone keeps it, marked on iPhone to stay out of the backup', () => {
    const source = (file: string) => readFileSync(join(process.cwd(), file), 'utf8');
    const downloads = source('services/BibleAudioDownloads.ts');
    expect(downloads).toContain("new Directory(Paths.document, FOLDER)");
    expect(downloads).toContain("const FOLDER = 'bible-audio'");
    expect(downloads).not.toMatch(/Paths\.cache|AsyncStorage/);
    expect(downloads).toContain("if (Platform.OS === 'ios' && !excludeFromBackup(root.uri))");
    expect(source('modules/backup-exclusion/ios/BackupExclusionModule.swift')).toContain('values.isExcludedFromBackup = true');
    // The phone's downloader (#611): the iPhone marks each chapter as it lands,
    // and Android writes them where the rules above leave out.
    expect(source('modules/bible-audio-downloads/ios/BibleAudioDownloadSessions.swift')).toContain('values.isExcludedFromBackup = true');
    const store = source('modules/bible-audio-downloads/android/src/main/java/org/nyccsda/bibleaudiodownloads/BibleAudioDownloadStore.kt');
    expect(store).toContain('private const val PARTIAL_FOLDER = "bible-audio-partial"');
    expect(store).toContain('private const val PREFERENCES = "bible-audio-downloads"');
    expect(store).toContain('private const val AUDIO_FOLDER = "bible-audio"');
    expect(store).toContain('setDestinationInExternalFilesDir(context, null, "$PARTIAL_FOLDER/');
    expect(JSON.parse(source('modules/backup-exclusion/expo-module.config.json'))).toEqual({
      platforms: ['apple'],
      apple: { modules: ['BackupExclusionModule'] },
    });
  });
});
