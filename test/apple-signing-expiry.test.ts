import { X509Certificate } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const {
  WARNING_DAYS,
  buildAppleSigningAlert,
  checkExpiry,
  compareWithBuild,
  readProfileDates,
} = require('../scripts/check-apple-signing-expiry.cjs');

const NOW = new Date('2026-09-29T12:00:00Z');
const inDays = (days: number) => new Date(NOW.getTime() + days * 86400000).toISOString();
const dates = (certificate: number, profile: number, membership: number | null) => ({
  distributionCertificate: inDays(certificate),
  provisioningProfile: inDays(profile),
  developerMembership: membership === null ? null : inDays(membership),
});

// A throwaway self-signed certificate, standing in for an Apple Distribution one.
const TEST_CERTIFICATE =
  'MIICIDCCAYmgAwIBAgIUZU7fnP7oM5f5qRxJ0RZXccOvzz0wDQYJKoZIhvcNAQELBQAwIjEgMB4G' +
  'A1UEAwwXVGVzdCBBcHBsZSBEaXN0cmlidXRpb24wHhcNMjYwOTI5MDMzMzQ1WhcNMzYwOTI2MDMz' +
  'MzQ1WjAiMSAwHgYDVQQDDBdUZXN0IEFwcGxlIERpc3RyaWJ1dGlvbjCBnzANBgkqhkiG9w0BAQEF' +
  'AAOBjQAwgYkCgYEA9aXHyBsaVPfPWuPAXiYUR9He1kQPOmMVLWVNIMVOKoySdkmOQGFWVEtvO/LM' +
  'Hs1dXD5cvWBXokJe97+ylYWvK8lay4jWjkfkgERJ/dhjBF75/w4KuhlXRTjQTXyzrI67rNofMvoB' +
  'ix5Hi1kmKWQEHU9dYvxDsm9KZw4M6WTv/dECAwEAAaNTMFEwHQYDVR0OBBYEFEmG3JqORJzbPweQ' +
  'm+GriMkOyDkvMB8GA1UdIwQYMBaAFEmG3JqORJzbPweQm+GriMkOyDkvMA8GA1UdEwEB/wQFMAMB' +
  'Af8wDQYJKoZIhvcNAQELBQADgYEAHVf7scR/xIBIrUSbw3k0SKaoeaAgnNb2nrgueezjhMi9hSDV' +
  'JnGYGAvncSJAKPgbFhUYvqtZRpUcoqWCZFFDGt3ry1F9YdItYL3q9IP5TWzrKlZLXzgeKcgYhmaS' +
  'IzGveR2SQur6FpiHgNCH12UEBSctgetnVpopSzq887lGg5c=';
const profileWith = (expiration: string, certificates: string[]) =>
  Buffer.concat([
    Buffer.from([0x30, 0x82, 0x01, 0x00]), // The signature wrapper around the plist.
    Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<plist version="1.0"><dict>
<key>ExpirationDate</key>
<date>${expiration}</date>
<key>DeveloperCertificates</key>
<array>${certificates.map((data) => `<data>${data}</data>`).join('')}</array>
</dict></plist>`),
    Buffer.from([0x00, 0xa0, 0x82]),
  ]);

describe('Apple signing expiry', () => {
  it('needs nothing while every date is more than 60 days away', () => {
    const result = checkExpiry(dates(200, 200, 150), NOW);
    expect(result.needsAttention).toBe(false);
    expect(result.items.map((item: { status: string }) => item.status)).toEqual(['ok', 'ok', 'ok']);
  });

  it('warns from 60 days before a date, and after it passes', () => {
    const result = checkExpiry(dates(WARNING_DAYS, WARNING_DAYS + 1, -2), NOW);
    expect(result.needsAttention).toBe(true);
    expect(result.items.map((item: { status: string; daysLeft: number }) => [item.status, item.daysLeft])).toEqual([
      ['soon', 60],
      ['ok', 61],
      ['expired', -2],
    ]);
  });

  it('asks for a date that is missing or unreadable', () => {
    const result = checkExpiry({ ...dates(200, 200, null), provisioningProfile: 'next year' }, NOW);
    expect(result.needsAttention).toBe(true);
    expect(result.items.map((item: { status: string }) => item.status)).toEqual(['ok', 'missing', 'missing']);
  });

  it('writes an alert with the dates and the renewal steps', () => {
    const alert = buildAppleSigningAlert(checkExpiry(dates(30, 30, 200), NOW), 'https://example.test/run');
    expect(alert.title).toBe('[monitor] Apple signing needs renewal');
    expect(alert.body).toContain('**Apple Distribution certificate:** expires on October 29, 2026, in 30 days.');
    expect(alert.body).toContain('docs/operations/app-store-setup.md#yearly-apple-renewals');
    expect(alert.body).toContain('IOS_DISTRIBUTION_CERTIFICATE_BASE64');
    expect(alert.body).toContain('.github/apple-signing-expiry.json');
    expect(alert.body).toContain('Run: https://example.test/run');
  });

  it('still alerts when the report is missing', () => {
    expect(buildAppleSigningAlert(null, 'https://example.test/run').body).toContain(
      'exited before producing a readable report',
    );
  });
});

describe('dates inside a built IPA', () => {
  const certificateExpiry = new Date(
    new X509Certificate(Buffer.from(TEST_CERTIFICATE, 'base64')).validTo,
  ).toISOString();

  it("reads the profile's expiry and its certificate's", () => {
    expect(readProfileDates(profileWith('2027-09-28T02:27:37Z', [TEST_CERTIFICATE]))).toEqual({
      provisioningProfile: '2027-09-28T02:27:37.000Z',
      distributionCertificate: certificateExpiry,
    });
  });

  it('refuses a file that is not a provisioning profile', () => {
    expect(() => readProfileDates(Buffer.from('not a profile'))).toThrow('not a provisioning profile');
    expect(() => readProfileDates(profileWith('2027-09-28T02:27:37Z', []))).toThrow('lists no certificate');
  });

  it('flags recorded dates that differ from the build by more than a day', () => {
    const actual = { distributionCertificate: '2027-09-28T02:27:37.000Z', provisioningProfile: '2027-09-28T02:27:37.000Z' };
    expect(compareWithBuild({ ...actual, provisioningProfile: '2027-09-28T12:00:00Z' }, actual)).toEqual([]);
    expect(compareWithBuild({ distributionCertificate: '2026-09-28T02:27:37Z', provisioningProfile: null }, actual)).toEqual([
      { key: 'distributionCertificate', label: 'Apple Distribution certificate', recorded: '2026-09-28T02:27:37Z', actual: actual.distributionCertificate },
      { key: 'provisioningProfile', label: 'App Store provisioning profile', recorded: null, actual: actual.provisioningProfile },
    ]);
  });
});

describe('the recorded dates', () => {
  const recorded = JSON.parse(readFileSync(resolve(process.cwd(), '.github/apple-signing-expiry.json'), 'utf8'));

  it('has exactly the three dates, each a valid date or not yet recorded', () => {
    expect(Object.keys(recorded).sort()).toEqual(['developerMembership', 'distributionCertificate', 'provisioningProfile']);
    for (const value of Object.values(recorded)) {
      expect(value === null || !Number.isNaN(Date.parse(value as string))).toBe(true);
    }
  });

  it('always records the certificate and profile, which every signed build checks', () => {
    expect(Date.parse(recorded.distributionCertificate)).not.toBeNaN();
    expect(Date.parse(recorded.provisioningProfile)).not.toBeNaN();
  });
});
