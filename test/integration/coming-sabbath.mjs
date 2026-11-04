// The coming Sabbath in New York, as YYYY-MM-DD. The bulletin API answers
// only for Sabbaths near today, so its checks can't use a fixed date.
export const comingSabbath = (now = new Date()) => {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(now);
  const date = new Date(`${today}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + ((6 - date.getUTCDay() + 7) % 7));
  return date.toISOString().slice(0, 10);
};
