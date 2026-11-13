import { decimal, divide, multiply, nonnegative, rational } from './decimal.mjs';

const units = {
  count: ['count', 1], byte: ['bytes', 1], KiB: ['bytes', 1024], MiB: ['bytes', 1048576],
  GiB: ['bytes', 1073741824], GB: ['bytes', 1000000000],
  millisecond: ['time', '0.001'], second: ['time', 1],
  'vCPU-second': ['cpu-time', 1], 'GiB-second': ['memory-time', 1],
  'GiB-month': ['memory-month', 1], 'GB-month': ['memory-month', '0.931322574615478515625'],
  'job-day': ['job-time', 1],
};
const provenances = new Set(['observed', 'derived', 'assumed', 'external', 'not-applicable', 'unknown']);

export function quantity(value, unit, metadata) {
  if (!Object.hasOwn(units, unit)) throw new Error('Unsupported unit: ' + unit);
  if (metadata?.provenance && !provenances.has(metadata.provenance)) throw new Error('Invalid quantity provenance');
  const provenance = value === null ? 'unknown' : metadata?.provenance;
  if (!provenances.has(provenance) || !metadata?.source?.trim()) throw new Error('Quantity provenance and source required');
  if (provenance === 'unknown' && value !== null) throw new Error('An unknown quantity has no numeric value');
  if (provenance === 'observed' && !metadata.environment?.trim()) throw new Error('Observed environment required');
  let exact = value === null ? null : nonnegative(value);
  if (exact && metadata.exact) {
    const { numerator, denominator } = metadata.exact;
    if (!/^\d{1,512}$/.test(numerator) || !/^[1-9]\d{0,511}$/.test(denominator)) throw new Error('Invalid exact quantity');
    const restored = rational({ n: BigInt(numerator), d: BigInt(denominator) });
    if (decimal(restored) !== decimal(exact)) throw new Error('Exact quantity differs from displayed value');
    exact = restored;
  }
  const normalized = exact === null ? null : decimal(exact);
  if (provenance === 'not-applicable' && normalized !== '0') throw new Error('An exclusion must have zero quantity');
  return Object.freeze({ ...globalThis.structuredClone(metadata), provenance, unit, value: normalized,
    exact: exact === null ? null : { numerator: exact.n.toString(), denominator: exact.d.toString() } });
}
export function quantityValue(input) {
  const valid = quantity(input.value, input.unit, input);
  if (valid.value === null) throw new Error('Unknown quantity has no numeric value');
  return rational({ n: BigInt(valid.exact.numerator), d: BigInt(valid.exact.denominator) });
}
export function convertQuantity(input, target) {
  const validated = quantity(input.value, input.unit, input);
  if (!units[target] || units[input.unit][0] !== units[target][0]) throw new Error('Incompatible quantity units');
  if (input.unit === target) return validated;
  const value = input.value === null ? null : divide(multiply(quantityValue(validated), units[input.unit][1]), units[target][1]);
  return quantity(value, target, { provenance: value === null ? 'unknown' : 'derived',
    source: 'Explicit unit conversion', inputs: [validated] });
}
