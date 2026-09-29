const {
  providerName,
  releaseNotesFromCommitSubject,
  signInWithGitHub,
  uploadToInternalTesting,
} = require('../scripts/upload-google-play.cjs');

const APP = 'https://androidpublisher.googleapis.com/androidpublisher/v3/applications/org.nyccsda.app';
const UPLOAD =
  'https://androidpublisher.googleapis.com/upload/androidpublisher/v3/applications/org.nyccsda.app';

type Reply = { status?: number; body?: unknown };
type Call = { method: string; url: string; headers: Record<string, string>; body: unknown };

// A fake Google API: `replies` maps "METHOD url" to replies, used in order.
const fakeGoogle = (replies: Record<string, Reply[]>) => {
  const calls: Call[] = [];
  const fetchImpl = jest.fn(async (url: string, init: { method: string; headers: Record<string, string>; body: unknown }) => {
    const key = `${init.method} ${url}`;
    calls.push({ method: init.method, url, headers: init.headers, body: init.body });
    const reply = replies[key]?.shift() ?? { status: 200, body: {} };
    const status = reply.status ?? 200;
    return {
      ok: status < 400,
      status,
      statusText: 'status',
      text: async () => JSON.stringify(reply.body ?? {}),
    };
  });
  return { calls, fetchImpl };
};

const happyReplies = (): Record<string, Reply[]> => ({
  [`POST ${APP}/edits`]: [{ body: { id: 'edit-1' } }],
  [`POST ${UPLOAD}/edits/edit-1/bundles?uploadType=media`]: [{ body: { versionCode: 40000 } }],
});

const upload = (fetchImpl: unknown, log = jest.fn(), releaseNotes = '') =>
  uploadToInternalTesting({
    accessToken: 'access-token',
    packageName: 'org.nyccsda.app',
    versionName: '0.40.0',
    bundle: Buffer.from('aab bytes'),
    releaseNotes,
    fetchImpl,
    log,
  });

const trackBody = (call: Call) => JSON.parse(call.body as string);

describe('Google Play upload', () => {
  it('uploads, releases to internal testing, and commits', async () => {
    const { calls, fetchImpl } = fakeGoogle(happyReplies());

    await expect(upload(fetchImpl)).resolves.toEqual({ status: 'completed', versionCode: 40000 });

    expect(calls.map((call) => `${call.method} ${call.url}`)).toEqual([
      `POST ${APP}/edits`,
      `POST ${UPLOAD}/edits/edit-1/bundles?uploadType=media`,
      `PUT ${APP}/edits/edit-1/tracks/internal`,
      `POST ${APP}/edits/edit-1:commit`,
    ]);

    // Every call uses the access token; the bundle goes up as raw bytes.
    for (const call of calls) {
      expect(call.headers.authorization).toBe('Bearer access-token');
    }
    expect(calls[1].headers['content-type']).toBe('application/octet-stream');
    expect(calls[1].body).toEqual(Buffer.from('aab bytes'));
    expect(trackBody(calls[2])).toEqual({
      track: 'internal',
      releases: [{ name: '0.40.0 (40000)', versionCodes: ['40000'], status: 'completed' }],
    });
  });

  it("adds release notes in the store listing's default language", async () => {
    const replies = happyReplies();
    replies[`GET ${APP}/edits/edit-1/details`] = [{ body: { defaultLanguage: 'zh-TW' } }];
    replies[`POST ${APP}/edits/edit-1:commit`] = [
      { status: 400, body: { error: { message: 'Only releases with status draft may be created on draft app.' } } },
    ];
    const { calls, fetchImpl } = fakeGoogle(replies);

    await upload(fetchImpl, jest.fn(), 'Leaner CI and Dependabot updates');

    expect(calls.map((call) => `${call.method} ${call.url}`)).toContain(`GET ${APP}/edits/edit-1/details`);
    // Both the first try and the draft retry carry the notes.
    const trackUpdates = calls.filter((call) => call.method === 'PUT').map(trackBody);
    expect(trackUpdates).toHaveLength(2);
    for (const body of trackUpdates) {
      expect(body.releases[0].releaseNotes).toEqual([
        { language: 'zh-TW', text: 'Leaner CI and Dependabot updates' },
      ]);
    }
  });

  it("saves a draft release while Play still treats the app as a draft", async () => {
    const replies = happyReplies();
    replies[`POST ${APP}/edits/edit-1:commit`] = [
      { status: 400, body: { error: { message: 'Only releases with status draft may be created on draft app.' } } },
    ];
    const { calls, fetchImpl } = fakeGoogle(replies);

    await expect(upload(fetchImpl)).resolves.toEqual({ status: 'draft', versionCode: 40000 });

    const trackUpdates = calls.filter((call) => call.method === 'PUT');
    expect(trackUpdates.map((call) => trackBody(call).releases[0].status)).toEqual([
      'completed',
      'draft',
    ]);
    expect(calls.at(-1)!.url).toBe(`${APP}/edits/edit-1:commit`);
  });

  it('commits without sending for review when Play requires that by hand', async () => {
    const replies = happyReplies();
    replies[`POST ${APP}/edits/edit-1:commit`] = [
      { status: 400, body: { error: { message: 'Changes cannot be sent for review automatically. Please set the query parameter changesNotSentForReview to true.' } } },
    ];
    const { calls, fetchImpl } = fakeGoogle(replies);

    await expect(upload(fetchImpl)).resolves.toEqual({ status: 'not-sent-for-review', versionCode: 40000 });
    expect(calls.at(-1)!.url).toBe(`${APP}/edits/edit-1:commit?changesNotSentForReview=true`);
  });

  it('succeeds without changes when Play already has this versionCode', async () => {
    const replies = happyReplies();
    replies[`POST ${UPLOAD}/edits/edit-1/bundles?uploadType=media`] = [
      { status: 403, body: { error: { message: 'Version code 40000 has already been used.' } } },
    ];
    const { calls, fetchImpl } = fakeGoogle(replies);
    const log = jest.fn();

    await expect(upload(fetchImpl, log)).resolves.toEqual({ status: 'already-uploaded' });
    expect(calls.at(-1)).toMatchObject({ method: 'DELETE', url: `${APP}/edits/edit-1` });
    expect(calls.some((call) => call.method === 'PUT')).toBe(false);
    expect(log).toHaveBeenCalledWith(expect.stringContaining('already has this versionCode'));
  });

  it("discards the edit and reports Google's message when a step fails", async () => {
    const replies = happyReplies();
    replies[`PUT ${APP}/edits/edit-1/tracks/internal`] = [
      { status: 403, body: { error: { message: 'The caller does not have permission' } } },
    ];
    const { calls, fetchImpl } = fakeGoogle(replies);

    const error = await upload(fetchImpl).catch((caught: Error) => caught);
    expect(error.message).toBe('The caller does not have permission');
    expect(error.message).not.toContain('access-token');
    expect(calls.at(-1)).toMatchObject({ method: 'DELETE', url: `${APP}/edits/edit-1` });
  });
});

describe('keyless sign-in', () => {
  const PROVIDER = 'projects/123456/locations/global/workloadIdentityPools/github/providers/sda-church-app';
  const ACCOUNT = 'play-upload@sda-church-app-play.iam.gserviceaccount.com';
  const ID_TOKEN_URL = 'https://token.actions.example/request?api-version=2.0';
  const STS = 'https://sts.googleapis.com/v1/token';
  const GENERATE = `https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${encodeURIComponent(ACCOUNT)}:generateAccessToken`;
  const idTokenCall = `GET ${ID_TOKEN_URL}&audience=${encodeURIComponent(`https://iam.googleapis.com/${PROVIDER}`)}`;

  const signInReplies = (): Record<string, Reply[]> => ({
    [idTokenCall]: [{ body: { value: 'github-oidc-token' } }],
    [`POST ${STS}`]: [{ body: { access_token: 'federated-token' } }],
    [`POST ${GENERATE}`]: [{ body: { accessToken: 'service-account-token' } }],
  });

  const signIn = (fetchImpl: unknown, overrides = {}) =>
    signInWithGitHub({
      provider: PROVIDER,
      serviceAccount: ACCOUNT,
      idTokenUrl: ID_TOKEN_URL,
      idTokenRequestToken: 'github-request-token',
      fetchImpl,
      ...overrides,
    });

  it('trades a GitHub identity token for a short-lived service account token', async () => {
    const { calls, fetchImpl } = fakeGoogle(signInReplies());

    await expect(signIn(fetchImpl)).resolves.toBe('service-account-token');

    expect(calls.map((call) => `${call.method} ${call.url}`)).toEqual([
      idTokenCall,
      `POST ${STS}`,
      `POST ${GENERATE}`,
    ]);
    // GitHub's token is requested for the church's provider.
    expect(calls[0].headers.authorization).toBe('Bearer github-request-token');
    // Google checks that token against the provider...
    expect(JSON.parse(calls[1].body as string)).toEqual({
      grantType: 'urn:ietf:params:oauth:grant-type:token-exchange',
      audience: `//iam.googleapis.com/${PROVIDER}`,
      scope: 'https://www.googleapis.com/auth/cloud-platform',
      requestedTokenType: 'urn:ietf:params:oauth:token-type:access_token',
      subjectTokenType: 'urn:ietf:params:oauth:token-type:jwt',
      subjectToken: 'github-oidc-token',
    });
    // ...and the result may only get a Play token for the service account.
    expect(calls[2].headers.authorization).toBe('Bearer federated-token');
    expect(JSON.parse(calls[2].body as string)).toEqual({
      scope: ['https://www.googleapis.com/auth/androidpublisher'],
      lifetime: '3600s',
    });
  });

  it("accepts the provider as the audience URL Google's console shows", async () => {
    expect(providerName(`https://iam.googleapis.com/${PROVIDER}`)).toBe(PROVIDER);
    expect(providerName(`//iam.googleapis.com/${PROVIDER}`)).toBe(PROVIDER);
    const { fetchImpl } = fakeGoogle(signInReplies());
    await expect(
      signIn(fetchImpl, { provider: ` https://iam.googleapis.com/${PROVIDER} ` }),
    ).resolves.toBe('service-account-token');
  });

  it("says which step Google refused, with Google's reason", async () => {
    const replies = signInReplies();
    replies[`POST ${STS}`] = [
      { status: 403, body: { error_description: 'The given credential is rejected by the attribute condition.' } },
    ];
    const { calls, fetchImpl } = fakeGoogle(replies);

    await expect(signIn(fetchImpl)).rejects.toThrow(
      "Keyless sign-in failed at Google's token exchange: The given credential is rejected by the attribute condition.",
    );
    expect(calls).toHaveLength(2);
  });

  it('explains missing or malformed settings before calling anyone', async () => {
    const { fetchImpl } = fakeGoogle({});
    await expect(signIn(fetchImpl, { provider: 'sda-church-app' })).rejects.toThrow(
      'GOOGLE_PLAY_WORKLOAD_IDENTITY_PROVIDER must look like',
    );
    await expect(signIn(fetchImpl, { serviceAccount: 'someone@gmail.com' })).rejects.toThrow(
      'GOOGLE_PLAY_SERVICE_ACCOUNT must be the service account email',
    );
    await expect(signIn(fetchImpl, { idTokenRequestToken: '' })).rejects.toThrow('id-token: write');
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe('release notes from the release commit', () => {
  it.each([
    ['Release/0.40.0: Leaner CI and Dependabot updates (#291)', 'Leaner CI and Dependabot updates'],
    ['Release/0.38.x: Isolate Communion and Brooklyn bulletin layouts (#246)', 'Isolate Communion and Brooklyn bulletin layouts'],
    // Older titles had no colon, a doubled PR number, or extra spaces.
    ['Release/0.36.0 Fix Bible audio continuation (#217)', 'Fix Bible audio continuation'],
    ['Release/0.37.0: Prepare for review  and add builds (#218) (#220)', 'Prepare for review and add builds'],
    ['A commit made without a release PR', 'A commit made without a release PR'],
  ])('turns %p into %p', (subject, notes) => {
    expect(releaseNotesFromCommitSubject(subject)).toBe(notes);
  });

  it('gives no notes when the title has nothing after the version', () => {
    expect(releaseNotesFromCommitSubject('Release/0.35.0 (#212)')).toBe('');
    expect(releaseNotesFromCommitSubject(undefined)).toBe('');
  });

  it("keeps within Play's 500-character limit", () => {
    const notes = releaseNotesFromCommitSubject(`Release/1.0.0: ${'a'.repeat(600)} (#1)`);
    expect(notes).toHaveLength(500);
    expect(notes.endsWith('…')).toBe(true);
  });
});
