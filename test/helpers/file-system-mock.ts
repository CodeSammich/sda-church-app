// An in-memory expo-file-system for the native tests, with files kept by path
// in `mockFiles`, which test/setup.ts clears before each test. It covers what
// services/CacheStore.ts uses: the cache directory, its folders, and their
// files, plus what services/FileDownloads.ts uses to download files, which
// tests set with jest.spyOn, what features/sabbath-school/LessonDownloads.ts
// uses to open lesson PDFs, and the documents directory's nested folders that
// services/BibleAudioDownloads.ts keeps audio in. A file's size is its text's
// length. test/bundled-bible.test.ts mocks the module its own way.
export const mockFiles = new Map<string, string>();

/** What Paths.availableDiskSpace says. */
export const mockDisk = { availableBytes: 64_000_000_000 };

const pathOf = (parts: unknown[]) =>
  parts.map((part) => (typeof part === 'string' ? part : (part as { uri: string }).uri)).join('/');

class File {
  uri: string;
  constructor(...parts: unknown[]) {
    this.uri = pathOf(parts);
  }
  get exists() {
    return mockFiles.has(this.uri);
  }
  get name() {
    return this.uri.split('/').pop() ?? '';
  }
  get size() {
    return mockFiles.get(this.uri)?.length ?? 0;
  }
  async text() {
    if (!mockFiles.has(this.uri)) throw new Error(`No file ${this.uri}`);
    return mockFiles.get(this.uri) as string;
  }
  async write(text: string) {
    mockFiles.set(this.uri, text);
  }
  delete() {
    mockFiles.delete(this.uri);
  }
  rename(newName: string) {
    const renamed = [...this.uri.split('/').slice(0, -1), newName].join('/');
    mockFiles.set(renamed, mockFiles.get(this.uri) as string);
    mockFiles.delete(this.uri);
    this.uri = renamed;
  }
  async canPreview() {
    return this.exists;
  }
  async preview() {}
  static async downloadFileAsync(url: string, destination: File): Promise<File> {
    throw new Error(`No download mocked for ${url} to ${destination.uri}`);
  }
}

class Directory {
  uri: string;
  constructor(...parts: unknown[]) {
    this.uri = pathOf(parts);
  }
  get exists() {
    return [...mockFiles.keys()].some((path) => path.startsWith(`${this.uri}/`));
  }
  get name() {
    return this.uri.split('/').pop() ?? '';
  }
  create() {}
  delete() {
    for (const path of [...mockFiles.keys()]) if (path.startsWith(`${this.uri}/`)) mockFiles.delete(path);
  }
  /** Its files, and the folders that hold files further down. */
  list() {
    const names = new Set<string>();
    const entries: (File | Directory)[] = [];
    for (const path of mockFiles.keys()) {
      if (!path.startsWith(`${this.uri}/`)) continue;
      const [name, ...rest] = path.slice(this.uri.length + 1).split('/');
      if (names.has(name)) continue;
      names.add(name);
      entries.push(rest.length ? new Directory(this.uri, name) : new File(path));
    }
    return entries;
  }
}

export const fileSystemMock = {
  Directory,
  File,
  Paths: {
    cache: new Directory('cache'),
    document: new Directory('document'),
    get availableDiskSpace() {
      return mockDisk.availableBytes;
    },
  },
};
