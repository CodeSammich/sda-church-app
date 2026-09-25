import { readFile, stat } from 'node:fs/promises';
import { basename, extname, resolve } from 'node:path';

const MIME_TYPES = {
  '.aab': 'application/octet-stream',
  '.apk': 'application/vnd.android.package-archive',
  '.ipa': 'application/octet-stream',
  '.jpg': 'image/jpeg',
};

// Uploads replace same-named files in shared folders, so only app binaries
// and these exact QR code images may be written. Anything else is refused
// before any credentials are used.
const ALLOWED_BINARY_EXTENSIONS = new Set(['.aab', '.apk', '.ipa']);
const ALLOWED_QR_CODE_FILE_NAMES = new Set([
  'brooklyn_adventist_giving_qr_code_368x368.jpg',
  'brooklyn_zelle_qr_code_368x368.jpg',
  'mobile_app_qr_368x368.jpg',
  'queens_adventist_giving_qr_code_368x368.jpg',
  'queens_zelle_qr_code_368x368.jpg',
]);

export const isUploadAllowed = (fileName) =>
  basename(fileName) === fileName &&
  (ALLOWED_BINARY_EXTENSIONS.has(extname(fileName).toLowerCase()) ||
    ALLOWED_QR_CODE_FILE_NAMES.has(fileName));

export const assertUploadAllowed = (fileName) => {
  if (!isUploadAllowed(fileName)) {
    throw new Error(
      `Refusing to upload ${fileName}: only .aab, .apk, and .ipa files or these QR codes are allowed: ` +
        [...ALLOWED_QR_CODE_FILE_NAMES].join(', '),
    );
  }
};
// supportsAllDrives is required for any file or folder in a shared drive;
// without it Google Drive answers 404 even when the account has access.
const DRIVE_FILES_URL = 'https://www.googleapis.com/drive/v3/files';
const DRIVE_UPLOAD_URL = 'https://www.googleapis.com/upload/drive/v3/files';
const DRIVE_UPLOAD_QUERY =
  'uploadType=multipart&supportsAllDrives=true&fields=id,name,size,webViewLink';
const DRIVE_FILE_SCOPE = 'https://www.googleapis.com/auth/drive.file';

const requestJson = async (url, options = {}) => {
  const response = await fetch(url, options);
  const responseText = await response.text();
  let responseBody;

  try {
    responseBody = responseText ? JSON.parse(responseText) : null;
  } catch {
    responseBody = responseText;
  }

  if (!response.ok) {
    const detail =
      typeof responseBody === 'string'
        ? responseBody
        : JSON.stringify(responseBody);
    throw new Error(`Google Drive request failed (${response.status}): ${detail.slice(0, 500)}`);
  }

  return responseBody;
};

export const parseClaspCredentials = (value) => {
  if (!value) throw new Error('CLASPRC_JSON is required.');

  let claspConfig;
  try {
    claspConfig = JSON.parse(value);
  } catch {
    throw new Error('CLASPRC_JSON is not valid JSON.');
  }

  const credentials = claspConfig?.tokens?.default;
  if (
    !credentials?.client_id ||
    !credentials?.client_secret ||
    !credentials?.refresh_token
  ) {
    throw new Error(
      'CLASPRC_JSON must contain tokens.default.client_id, client_secret, and refresh_token.',
    );
  }

  return credentials;
};

const getAccessToken = async (credentials) => {
  const body = new URLSearchParams({
    client_id: credentials.client_id,
    client_secret: credentials.client_secret,
    refresh_token: credentials.refresh_token,
    grant_type: 'refresh_token',
  });
  const response = await requestJson('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  });

  if (!response?.access_token) {
    throw new Error('Google OAuth did not return an access token.');
  }
  return { accessToken: response.access_token, scopes: (response.scope || '').split(' ') };
};

// Drive query strings quote values with single quotes and escape with backslashes.
export const escapeDriveQueryValue = (value) =>
  value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");

export const findFilesByName = async ({ accessToken, fileName, folderId }) => {
  const params = new URLSearchParams({
    q: `name = '${escapeDriveQueryValue(fileName)}' and '${escapeDriveQueryValue(folderId)}' in parents and trashed = false`,
    fields: 'files(id,name,modifiedTime)',
    orderBy: 'modifiedTime desc',
    supportsAllDrives: 'true',
    includeItemsFromAllDrives: 'true',
  });
  const response = await requestJson(`${DRIVE_FILES_URL}?${params}`, {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  return response?.files || [];
};

export const getMimeTypeForFileName = (fileName) =>
  MIME_TYPES[extname(fileName).toLowerCase()] || 'application/octet-stream';

export const buildDriveMetadata = (
  fileName,
  folderId = '',
  mimeType = getMimeTypeForFileName(fileName),
) => ({
  name: fileName,
  mimeType,
  ...(folderId ? { parents: [folderId] } : {}),
});

// Creates the file, or replaces the contents of existingFileId in place so the
// file keeps its name, ID, and sharing link. Drive rejects parents on update.
export const uploadFileToGoogleDrive = async ({
  accessToken,
  fileBytes,
  fileName,
  folderId,
  existingFileId = '',
  mimeType = getMimeTypeForFileName(fileName),
}) => {
  assertUploadAllowed(fileName);
  const boundary = `sda-church-app-${Date.now().toString(36)}`;
  const metadata = JSON.stringify(
    buildDriveMetadata(fileName, existingFileId ? '' : folderId, mimeType),
  );
  const prefix = Buffer.from(
    `--${boundary}\r\n` +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      `${metadata}\r\n` +
      `--${boundary}\r\n` +
      `Content-Type: ${mimeType}\r\n\r\n`,
  );
  const suffix = Buffer.from(`\r\n--${boundary}--\r\n`);

  const url = existingFileId
    ? `${DRIVE_UPLOAD_URL}/${encodeURIComponent(existingFileId)}?${DRIVE_UPLOAD_QUERY}`
    : `${DRIVE_UPLOAD_URL}?${DRIVE_UPLOAD_QUERY}`;

  return requestJson(url, {
    method: existingFileId ? 'PATCH' : 'POST',
    headers: {
      authorization: `Bearer ${accessToken}`,
      'content-type': `multipart/related; boundary=${boundary}`,
      'content-length': String(prefix.length + fileBytes.length + suffix.length),
    },
    body: Buffer.concat([prefix, fileBytes, suffix]),
  });
};

const main = async () => {
  const inputPath = process.argv[2];
  if (!inputPath) throw new Error('Usage: node scripts/upload-google-drive.mjs <file>');

  const filePath = resolve(inputPath);
  const fileStats = await stat(filePath);
  if (!fileStats.isFile()) throw new Error(`Not a file: ${filePath}`);

  const fileName = process.env.GOOGLE_DRIVE_FILE_NAME || basename(filePath);
  assertUploadAllowed(fileName);
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID || '';
  const mimeType = getMimeTypeForFileName(fileName);
  const credentials = parseClaspCredentials(process.env.CLASPRC_JSON);
  const { accessToken, scopes } = await getAccessToken(credentials);
  const driveScopes = scopes.filter((scope) => scope.includes('/auth/drive'));
  console.log(`Google Drive scopes: ${driveScopes.join(' ') || '<none>'}`);
  if (driveScopes.length === 1 && driveScopes[0] === DRIVE_FILE_SCOPE) {
    console.warn(
      'This login only has drive.file access: it can only see files and folders it created itself. ' +
        'Folders or same-named files made by hand will be reported as not found.',
    );
  }

  const existingFiles = folderId
    ? await findFilesByName({ accessToken, fileName, folderId })
    : [];
  if (existingFiles.length > 1) {
    console.warn(
      `Found ${existingFiles.length} files named ${fileName}; replacing the most recently modified one.`,
    );
  }
  const existingFileId = existingFiles[0]?.id || '';

  const result = await uploadFileToGoogleDrive({
    accessToken,
    fileBytes: await readFile(filePath),
    fileName,
    folderId,
    existingFileId,
    mimeType,
  });
  const url =
    result.webViewLink ||
    `https://drive.google.com/file/d/${result.id}/view?usp=drivesdk`;

  console.log(
    `${existingFileId ? 'Replaced' : 'Uploaded'} ${result.name} (${result.size || fileStats.size} bytes): ${url}`,
  );
};

if (process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
