// Phone formatting utilities for Russian numbers
// Display format example: +7 977 288-14-99

const ALLOWED_INPUT_RE = /[^\d\s()+-]/g;

export function allowPhoneChars(value = '') {
  return (value || '').replace(ALLOWED_INPUT_RE, '');
}

function digitsOnly(value = '') {
  return (value || '').replace(/\D/g, '');
}

function parseRuDigits(digits) {
  if (!digits) return { isRu: false, ruDigits: '' };
  if (digits.startsWith('8')) {
    return { isRu: true, ruDigits: digits.slice(1, 11) }; // 10 digits after 8
  }
  if (digits.startsWith('7')) {
    return { isRu: true, ruDigits: digits.slice(1, 11) }; // 10 digits after 7
  }
  if (digits.startsWith('9')) {
    return { isRu: true, ruDigits: digits.slice(0, 10) }; // 10 digits total
  }
  return { isRu: false, ruDigits: '' };
}

function formatRuDisplayFromDigits(ruDigits) {
  // ruDigits: up to 10 digits
  const p1 = ruDigits.slice(0, 3); // 3
  const p2 = ruDigits.slice(3, 6); // 3
  const p3 = ruDigits.slice(6, 8); // 2
  const p4 = ruDigits.slice(8, 10); // 2
  let out = '+7';
  if (p1) out += ' ' + p1;
  if (p2) out += ' ' + p2;
  if (p3) out += '-' + p3;
  if (p4) out += '-' + p4;
  return out;
}

export function formatPhoneOnBlur(input) {
  const cleaned = allowPhoneChars(input);
  const d = digitsOnly(cleaned);
  const { isRu, ruDigits } = parseRuDigits(d);
  if (!isRu) return cleaned.trim();
  return formatRuDisplayFromDigits(ruDigits);
}

export function normalizePhoneForSubmit(input) {
  const cleaned = allowPhoneChars(input);
  const d = digitsOnly(cleaned);
  const { isRu, ruDigits } = parseRuDigits(d);
  if (isRu && ruDigits.length === 10) {
    return `+7${ruDigits}`; // E.164 for RU
  }
  // For non-RU or incomplete RU, pass cleaned as-is (remove spaces/dashes/paren)
  // If it starts with +, keep the +
  return cleaned.startsWith('+') ? `+${digitsOnly(cleaned)}` : digitsOnly(cleaned);
}

export function looksLikeRuPhone(input) {
  const d = digitsOnly(input);
  if (!d) return false;
  return d.startsWith('7') || d.startsWith('8') || d.startsWith('9');
}

export function isValidRuPhone(input) {
  const cleaned = allowPhoneChars(input);
  const d = digitsOnly(cleaned);
  const { isRu, ruDigits } = parseRuDigits(d);
  return isRu && ruDigits.length === 10;
}
