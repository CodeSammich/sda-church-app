import { readFile, stat } from 'node:fs/promises';
import { basename, resolve } from 'node:path';

const APK_MIME_TYPE = 'application/vnd.android.package-archive';
const DRIVE_UPLOAD_URL =
  'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,size,webViewLink';

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
  return response.access_token;
};

export const buildDriveMetadata = (fileName, folderId = '') => ({
  name: fileName,
  mimeType: APK_MIME_TYPE,
  ...(folderId ? { parents: [folderId] } : {}),
});

export const uploadFileToGoogleDrive = async ({
  accessToken,
  fileBytes,
  fileName,
  folderId,
}) => {
  const boundary = `sda-church-app-${Date.now().toString(36)}`;
  const metadata = JSON.stringify(buildDriveMetadata(fileName, folderId));
  const prefix = Buffer.from(
    `--${boundary}\r\n` +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      `${metadata}\r\n` +
      `--${boundary}\r\n` +
      `Content-Type: ${APK_MIME_TYPE}\r\n\r\n`,
  );
  const suffix = Buffer.from(`\r\n--${boundary}--\r\n`);

  return requestJson(DRIVE_UPLOAD_URL, {
    method: 'POST',
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
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID || '';
  const credentials = parseClaspCredentials(process.env.CLASPRC_JSON);
  const accessToken = await getAccessToken(credentials);
  const result = await uploadFileToGoogleDrive({
    accessToken,
    fileBytes: await readFile(filePath),
    fileName,
    folderId,
  });
  const url =
    result.webViewLink ||
    `https://drive.google.com/file/d/${result.id}/view?usp=drivesdk`;

  console.log(`Uploaded ${result.name} (${result.size || fileStats.size} bytes): ${url}`);
};

if (process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
