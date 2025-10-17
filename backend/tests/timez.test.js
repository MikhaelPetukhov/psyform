const { getTzLabel, formatRangeInTz } = require('../utils/timez');

describe('utils/timez', () => {
  test('getTzLabel includes IANA and UTC offset', () => {
    const label = getTzLabel('Asia/Bangkok');
    expect(label).toContain('Asia/Bangkok');
    expect(label).toMatch(/UTC\+7\b/);
  });

  test('getTzLabel falls back to IANA on invalid zone', () => {
    const label = getTzLabel('Bad/Zone');
    expect(label).toBe(' (Bad/Zone)');
  });

  test('formatRangeInTz returns date and time range', () => {
    const tz = 'Europe/Moscow';
    const s = '2025-03-05T10:00:00.000Z';
    const e = '2025-03-05T11:00:00.000Z';
    const { dateStr, timeStr, tzLabel } = formatRangeInTz(s, e, tz);
    expect(dateStr).toMatch(/\d{2}\.\d{2}\.\d{4}/);
    // 10:00Z -> 13:00 MSK
    expect(timeStr).toMatch(/13:00-14:00/);
    expect(tzLabel).toContain('Europe/Moscow');
  });
});
