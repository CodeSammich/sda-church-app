// An in-memory expo-file-system for the native tests, with files kept by path
// in `mockFiles`, which test/setup.ts clears before each test. It covers what
// services/CacheStore.ts uses: the cache directory, its folders, and their
// files, plus what features/sabbath-school/LessonDownloads.ts uses to download
// and open lesson PDFs, which tests set with jest.spyOn. test/bundled-bible.test.ts
// mocks the module its own way.
export const mockFiles = new Map<string, string>();

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
  create() {}
  list() {
    return [...mockFiles.keys()]
      .filter((path) => path.startsWith(`${this.uri}/`) && !path.slice(this.uri.length + 1).includes('/'))
      .map((path) => new File(path));
  }
}

export const fileSystemMock = { Directory, File, Paths: { cache: new Directory('cache') } };
