import { readFileSync } from 'node:fs';
import codes from '../scripts/bulletin-qr-codes.json';

// The printed bulletin finds its QR images in Google Drive by file name, and the
// QR workflow regenerates and uploads them from scripts/bulletin-qr-codes.json.
describe('printed bulletin QR codes', () => {
  const workflow = readFileSync('.github/workflows/generate-physical-bulletin-qr.yml', 'utf8');
  const uploadHelper = readFileSync('scripts/upload-google-drive.mjs', 'utf8');
  const bulletin = readFileSync('google-apps-script/PrintedBulletin.gs', 'utf8');

  it('points each code at an HTTPS destination', () => {
    expect(codes).toEqual({
      'queens_adventist_giving_qr_code_368x368.jpg': 'https://adventistgiving.org/donate/AN48CO',
      'brooklyn_adventist_giving_qr_code_368x368.jpg': 'https://adventistgiving.org/donate/AN48CO',
      // The download page sends phones to their app store (issue #237).
      'mobile_app_qr_code_368x368.jpg': 'https://app.nyccsda.org/download',
    });
    for (const url of Object.values(codes)) expect(new URL(url).protocol).toBe('https:');
  });

  it("prints the church's own address for the app, not the GitHub Pages one", () => {
    // Printed codes last for years; app.nyccsda.org can move hosts without
    // reprinting, while the GitHub Pages address it redirects to can't.
    const appUrl = new URL(codes['mobile_app_qr_code_368x368.jpg']);
    expect(appUrl.host).toBe('app.nyccsda.org');
    expect(Object.values(codes).join()).not.toContain('github.io');
  });

  it('uses file names the bulletin looks for and the Drive upload allows', () => {
    const start = uploadHelper.indexOf('ALLOWED_BULLETIN_FILE_NAMES');
    const allowed = uploadHelper.slice(start, uploadHelper.indexOf(']);', start));
    for (const file of Object.keys(codes)) expect(allowed).toContain(`'${file}'`);
    // PrintedBulletin.gs builds the giving names from the bulletin's location.
    expect(bulletin).toContain("return 'mobile_app_qr_code_368x368.jpg';");
    expect(bulletin).toContain("return normalizedLocation + '_adventist_giving_qr_code_368x368.jpg';");
  });

  it('regenerates the codes when they change on main, and uploads only after approval', () => {
    expect(workflow).toMatch(
      /on:\n  push:\n    branches: \[main\]\n    paths:\n      - scripts\/bulletin-qr-codes\.json\n      - scripts\/generate-qr\.mjs\n      - \.github\/workflows\/generate-physical-bulletin-qr\.yml\n  workflow_dispatch: \{\}/,
    );
    // Destinations come only from the reviewed file, not from run inputs.
    expect(workflow).toContain('require("./scripts/bulletin-qr-codes.json")');
    expect(workflow).not.toMatch(/inputs\.|https:\/\/adventistgiving/);

    const upload = workflow.slice(workflow.indexOf('  upload-to-drive:'));
    expect(upload).toContain('environment: production');
    expect(upload).toMatch(/ref: main\n\s+path: trusted-source/);
    expect(upload).toContain('node trusted-source/scripts/upload-google-drive.mjs');
  });
});
