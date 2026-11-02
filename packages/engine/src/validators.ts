// Contrôles de clé utilisés pour limiter les faux positifs (docs/DOCUMENTATION.md, annexe B.1).

export function ibanValid(raw: string): boolean {
  const s = raw.replace(/\s/g, '').toUpperCase();
  if (s.length < 15 || s.length > 34 || !/^[A-Z]{2}\d{2}[A-Z0-9]+$/.test(s)) return false;
  const t = s.slice(4) + s.slice(0, 4);
  let rem = 0;
  for (const c of t) {
    const v = /\d/.test(c) ? c : String(c.charCodeAt(0) - 55);
    for (const d of v) rem = (rem * 10 + Number(d)) % 97;
  }
  return rem === 1;
}

export function luhnValid(digits: string): boolean {
  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = Number(digits[i]);
    if (double) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    double = !double;
  }
  return digits.length > 0 && sum % 10 === 0;
}

/** Numéro de sécurité sociale : 13 chiffres + clé de 2 chiffres (97 - (13 premiers mod 97)). */
export function nirValid(raw: string): boolean {
  const s = raw.replace(/\s/g, '').toUpperCase();
  if (!/^[12]\d{4}(?:\d{2}|2A|2B)\d{6}\d{2}$/.test(s)) return false;
  const body = s.slice(0, 13).replace('2A', '19').replace('2B', '18');
  const n = BigInt(body);
  const key = 97n - (n % 97n);
  return Number(key) === Number(s.slice(13));
}
