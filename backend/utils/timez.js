// Unified timezone formatting helpers for Telegram messages and other server uses
// IANA TZ + UTC offset label, and time ranges

function getTzLabel(tz) {
  if (!tz) return '';
  try {
    const parts = new Intl.DateTimeFormat('ru-RU', { timeZone: tz, timeZoneName: 'short' }).formatToParts(new Date());
    const short = parts.find((p) => p.type === 'timeZoneName')?.value || '';
    const off = short ? short.replace('GMT', 'UTC') : '';
    return ` (${tz}${off ? ', ' + off : ''})`;
  } catch (_) {
    return ` (${tz})`;
  }
}

function formatRangeInTz(startISO, endISO, tz) {
  const s = new Date(startISO);
  const e = new Date(endISO);
  const dateStr = s.toLocaleDateString('ru-RU', {
    timeZone: tz,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  const startStr = s.toLocaleTimeString('ru-RU', { timeZone: tz, hour: '2-digit', minute: '2-digit' });
  const endStr = e.toLocaleTimeString('ru-RU', { timeZone: tz, hour: '2-digit', minute: '2-digit' });
  const tzLabel = getTzLabel(tz);
  return { dateStr, timeStr: `${startStr}-${endStr}`, tzLabel };
}

module.exports = { getTzLabel, formatRangeInTz };
