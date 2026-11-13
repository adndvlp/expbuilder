// Exact rational arithmetic. Formatting happens only at the report boundary.
const gcd = (a, b) => { while (b) [a, b] = [b, a % b]; return a < 0n ? -a : a; };
const ratio = (n, d = 1n) => {
  if (!d) throw new Error('Division by zero');
  if (d < 0n) { n = -n; d = -d; }
  const divisor = gcd(n, d);
  return { n: n / divisor, d: d / divisor };
};
export function rational(value) {
  if (value && typeof value.n === 'bigint' && typeof value.d === 'bigint') return ratio(value.n, value.d);
  if (typeof value === 'number' && (!Number.isFinite(value) || (Number.isInteger(value) && !Number.isSafeInteger(value)))) {
    throw new Error('Invalid or imprecise numeric quantity');
  }
  if (typeof value !== 'number' && typeof value !== 'string') throw new Error('Numeric quantity required');
  const match = /^([+-]?)(\d+)(?:\.(\d+))?(?:e([+-]?\d+))?$/i.exec(String(value));
  if (!match || match[2].length + (match[3]?.length || 0) > 256) throw new Error('Invalid decimal quantity');
  const exponent = Number(match[4] || 0) - (match[3]?.length || 0);
  if (Math.abs(exponent) > 256) throw new Error('Decimal exponent out of range');
  const integer = BigInt(match[2] + (match[3] || '')) * (match[1] === '-' ? -1n : 1n);
  return exponent >= 0 ? ratio(integer * 10n ** BigInt(exponent)) : ratio(integer, 10n ** BigInt(-exponent));
}
export const add = (a, b) => { a = rational(a); b = rational(b); return ratio(a.n * b.d + b.n * a.d, a.d * b.d); };
export const subtract = (a, b) => { b = rational(b); return add(a, ratio(-b.n, b.d)); };
export const multiply = (a, b) => { a = rational(a); b = rational(b); return ratio(a.n * b.n, a.d * b.d); };
export const divide = (a, b) => { a = rational(a); b = rational(b); return ratio(a.n * b.d, a.d * b.n); };
export const compare = (a, b) => { const difference = subtract(a, b).n; return difference < 0n ? -1 : difference > 0n ? 1 : 0; };
export function nonnegative(value, name = 'quantity', positive = false) {
  const result = rational(value);
  if (result.n < 0n || (positive && result.n === 0n)) throw new Error('Invalid ' + name);
  return result;
}
export function ceilMultiple(value, increment) {
  const step = nonnegative(increment, 'rounding increment', true);
  const divided = divide(nonnegative(value), step);
  return multiply(ratio((divided.n + divided.d - 1n) / divided.d), step);
}
export function decimal(value) {
  const { n, d } = rational(value), absolute = n < 0n ? -n : n;
  let places = 24, scale = 10n ** 24n;
  // Keep very small nonzero costs visible instead of rendering them as free.
  while (absolute && absolute * scale / d === 0n) { places += 24; scale *= 10n ** 24n; }
  const scaled = (absolute * scale * 2n + d) / (2n * d);
  const digits = scaled.toString().padStart(places + 1, '0');
  const fraction = digits.slice(-places).replace(/0+$/, '');
  return (n < 0n ? '-' : '') + digits.slice(0, -places) + (fraction ? '.' + fraction : '');
}
