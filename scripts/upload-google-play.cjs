// Uploads the signed AAB to Google Play's internal testing track, where the
// church's testers get it automatically. Nothing reaches the public until a
// maintainer promotes the release in Play Console.
//
// It signs in without a key (Workload Identity Federation): GitHub vouches for
// the job, and Google returns a token for the church's service account that
// expires within an hour. It uses only Node's built-ins, so the job runs no npm
// packages. Setup is in
// docs/operations/native-builds.md#setting-up-the-google-play-service-account.
//
//   node scripts/upload-google-play.cjs app.aab
//
// It runs in GitHub Actions with `id-token: write` and these environment
// variables: GOOGLE_PLAY_WORKLOAD_IDENTITY_PROVIDER, GOOGLE_PLAY_SERVICE_ACCOUNT,
// and RELEASE_COMMIT_SUBJECT for the release notes.

const fs = require('node:fs');
const path = require('node:path');

const API = 'https://androidpublisher.googleapis.com/androidpublisher/v3/applications';
const UPLOAD_API =
  'https://androidpublisher.googleapis.com/upload/androidpublisher/v3/applications';
const SCOPE = 'https://www.googleapis.com/auth/androidpublisher';
const TRACK = 'internal';
const STS_URL = 'https://sts.googleapis.com/v1/token';
const IAM_CREDENTIALS_API = 'https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts';
const PROVIDER_PATTERN =
  /^projects\/\d+\/locations\/global\/workloadIdentityPools\/[a-z0-9-]+\/providers\/[a-z0-9-]+$/;
const SERVICE_ACCOUNT_PATTERN = /^[a-z0-9-]+@[a-z0-9-]+\.iam\.gserviceaccount\.com$/;

// Play refuses a versionCode it has seen before, for example on a rerun.
const ALREADY_UPLOADED = /already been used/i;
// Until the app's first release is rolled out in Play Console, Play accepts
// only draft releases.
const DRAFT_APP = /only releases with status draft may be created on draft app/i;
// Some apps need changes sent for review by hand in Play Console.
const REVIEW_BY_HAND = /changesNotSentForReview/;
// Play's limit for one language's release notes.
const MAX_RELEASE_NOTES = 500;

class PlayApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// The "What's new" text testers see: the release PR's title. On main, it's the
// subject of the squash-merge commit, such as
// "Release/0.40.0: Leaner CI and Dependabot updates (#291)", so drop the
// "Release/x.y.z:" prefix and the "(#291)" suffix.
const releaseNotesFromCommitSubject = (subject) => {
  const text = String(subject || '')
    .replace(/^\s*Release\/\d+\.\d+\.(?:\d+|x)\s*:?/i, '')
    .replace(/(?:\s*\(#\d+\))+\s*$/, '')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > MAX_RELEASE_NOTES ? `${text.slice(0, MAX_RELEASE_NOTES - 1)}…` : text;
};

const request = async (fetchImpl, url, { method = 'GET', token, body, contentType } = {}) => {
  const headers = {};
  if (token) headers.authorization = `Bearer ${token}`;
  if (contentType) headers['content-type'] = contentType;
  const response = await fetchImpl(url, { method, headers, body });
  const text = await response.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = {};
  }
  if (!response.ok) {
    const message =
      data.error?.message || data.error_description || text.slice(0, 500) || response.statusText;
    throw new PlayApiError(response.status, message);
  }
  return data;
};

const json = (value) => ({ body: JSON.stringify(value), contentType: 'application/json' });

// Google's console shows the provider as an audience URL; accept that too.
const providerName = (value) =>
  String(value || '').trim().replace(/^(?:https:)?\/\/iam\.googleapis\.com\//, '');

const step = async (name, work) => {
  try {
    return await work();
  } catch (error) {
    throw new Error(`Keyless sign-in failed at ${name}: ${error.message}`);
  }
};

// Keyless sign-in (Workload Identity Federation). GitHub signs a token saying
// which repository, branch, and environment this job runs in. Google checks it
// against the church's provider, whose condition accepts only the store-upload
// environment on main, and trades it for a short-lived token for the service
// account. No key exists to store or leak.
const signInWithGitHub = async ({
  provider,
  serviceAccount,
  idTokenUrl,
  idTokenRequestToken,
  fetchImpl = fetch,
}) => {
  const name = providerName(provider);
  if (!PROVIDER_PATTERN.test(name)) {
    throw new Error(
      'GOOGLE_PLAY_WORKLOAD_IDENTITY_PROVIDER must look like projects/<number>/locations/global/workloadIdentityPools/<pool>/providers/<provider>.',
    );
  }
  if (!SERVICE_ACCOUNT_PATTERN.test(serviceAccount || '')) {
    throw new Error(
      'GOOGLE_PLAY_SERVICE_ACCOUNT must be the service account email, such as play-upload@<project>.iam.gserviceaccount.com.',
    );
  }
  if (!idTokenUrl || !idTokenRequestToken) {
    throw new Error("GitHub offered no identity token; the job needs 'permissions: id-token: write'.");
  }

  const gitHubToken = await step('the GitHub identity token', async () => {
    const url = new URL(idTokenUrl);
    url.searchParams.set('audience', `https://iam.googleapis.com/${name}`);
    const { value } = await request(fetchImpl, url.toString(), { token: idTokenRequestToken });
    if (!value) throw new Error('GitHub returned no token.');
    return value;
  });

  const federatedToken = await step("Google's token exchange", async () => {
    const { access_token: token } = await request(fetchImpl, STS_URL, {
      method: 'POST',
      ...json({
        grantType: 'urn:ietf:params:oauth:grant-type:token-exchange',
        audience: `//iam.googleapis.com/${name}`,
        scope: 'https://www.googleapis.com/auth/cloud-platform',
        requestedTokenType: 'urn:ietf:params:oauth:token-type:access_token',
        subjectTokenType: 'urn:ietf:params:oauth:token-type:jwt',
        subjectToken: gitHubToken,
      }),
    });
    if (!token) throw new Error('Google returned no token.');
    return token;
  });

  return step('the service account token', async () => {
    const { accessToken } = await request(
      fetchImpl,
      `${IAM_CREDENTIALS_API}/${encodeURIComponent(serviceAccount)}:generateAccessToken`,
      { method: 'POST', token: federatedToken, ...json({ scope: [SCOPE], lifetime: '3600s' }) },
    );
    if (!accessToken) throw new Error('Google returned no token.');
    return accessToken;
  });
};

const uploadToInternalTesting = async ({
  accessToken: token,
  packageName,
  versionName,
  bundle,
  releaseNotes = '',
  fetchImpl = fetch,
  log = console.log,
}) => {
  // Every change happens inside an "edit", which takes effect only on commit.
  const app = `${API}/${encodeURIComponent(packageName)}`;
  const edit = await request(fetchImpl, `${app}/edits`, { method: 'POST', token, ...json({}) });
  const editUrl = `${app}/edits/${encodeURIComponent(edit.id)}`;
  const deleteEdit = () =>
    request(fetchImpl, editUrl, { method: 'DELETE', token }).catch(() => {});

  try {
    let versionCode;
    try {
      ({ versionCode } = await request(
        fetchImpl,
        `${UPLOAD_API}/${encodeURIComponent(packageName)}/edits/${encodeURIComponent(edit.id)}/bundles?uploadType=media`,
        { method: 'POST', token, body: bundle, contentType: 'application/octet-stream' },
      ));
    } catch (error) {
      if (!ALREADY_UPLOADED.test(error.message)) throw error;
      log(`Google Play already has this versionCode: ${error.message}`);
      await deleteEdit();
      return { status: 'already-uploaded' };
    }

    // Release notes need a language; use the store listing's default one.
    let notes;
    if (releaseNotes) {
      const { defaultLanguage } = await request(fetchImpl, `${editUrl}/details`, { token });
      notes = [{ language: defaultLanguage, text: releaseNotes }];
    }

    const release = async (status, commitQuery = '') => {
      await request(fetchImpl, `${editUrl}/tracks/${TRACK}`, {
        method: 'PUT',
        token,
        ...json({
          track: TRACK,
          releases: [
            {
              name: `${versionName} (${versionCode})`,
              versionCodes: [String(versionCode)],
              status,
              ...(notes && { releaseNotes: notes }),
            },
          ],
        }),
      });
      await request(fetchImpl, `${editUrl}:commit${commitQuery}`, { method: 'POST', token });
    };

    let status = 'completed';
    try {
      await release(status);
    } catch (error) {
      if (DRAFT_APP.test(error.message)) {
        status = 'draft';
        await release(status);
      } else if (REVIEW_BY_HAND.test(error.message)) {
        status = 'not-sent-for-review';
        await release('completed', '?changesNotSentForReview=true');
      } else {
        throw error;
      }
    }
    return { status, versionCode };
  } catch (error) {
    await deleteEdit();
    throw error;
  }
};

const SUMMARIES = {
  completed: (name) =>
    `Uploaded ${name} to Google Play internal testing. Testers get it once Google finishes processing.`,
  draft: (name) =>
    `Uploaded ${name} to internal testing as a draft, because Play accepts only drafts until the app's first release is rolled out. Roll it out in Play Console → Test and release → Internal testing.`,
  'not-sent-for-review': (name) =>
    `Uploaded ${name} to internal testing. Play needs these changes sent for review by hand: Play Console → Publishing overview.`,
  'already-uploaded': (name) =>
    `Google Play already has ${name}, so there was nothing new to upload.`,
};

const main = async () => {
  const bundlePath = process.argv[2];
  if (!bundlePath) throw new Error('Usage: node scripts/upload-google-play.cjs <app.aab>');
  const appJson = JSON.parse(
    fs.readFileSync(path.resolve(__dirname, '..', 'app.json'), 'utf8'),
  );
  const versionName = appJson.expo.version;
  const releaseNotes = releaseNotesFromCommitSubject(process.env.RELEASE_COMMIT_SUBJECT);
  const accessToken = await signInWithGitHub({
    provider: process.env.GOOGLE_PLAY_WORKLOAD_IDENTITY_PROVIDER,
    serviceAccount: process.env.GOOGLE_PLAY_SERVICE_ACCOUNT,
    idTokenUrl: process.env.ACTIONS_ID_TOKEN_REQUEST_URL,
    idTokenRequestToken: process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN,
  });
  const result = await uploadToInternalTesting({
    accessToken,
    packageName: appJson.expo.android.package,
    versionName,
    bundle: fs.readFileSync(bundlePath),
    releaseNotes,
  });
  const name = result.versionCode ? `${versionName} (${result.versionCode})` : versionName;
  let summary = SUMMARIES[result.status](name);
  if (releaseNotes && result.status !== 'already-uploaded') {
    summary += ` What's new: "${releaseNotes}"`;
  }
  console.log(summary);
  if (process.env.GITHUB_STEP_SUMMARY) {
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${summary}\n`);
  }
  if (result.status === 'draft' || result.status === 'not-sent-for-review') {
    console.log(`::warning title=Finish in Play Console::${summary}`);
  }
};

module.exports = {
  providerName,
  releaseNotesFromCommitSubject,
  signInWithGitHub,
  uploadToInternalTesting,
};

if (require.main === module) {
  main().catch((error) => {
    console.error(`::error title=Google Play upload failed::${error.message}`);
    process.exit(1);
  });
}
