import { number, DomainError } from "./validation.mjs";
// Operate on decimal representations of finite Numbers. No cents rounding.
// The public result remains a Number; this is not an arbitrary-precision ledger.
function decimal(value) {
  number(value, "operand", -Number.MAX_VALUE);
  const [mantissa, exponent = "0"] = String(value).split("e");
  const scale = (mantissa.split(".")[1]?.length || 0) - Number(exponent);
  return [BigInt(mantissa.replace(".", "")), scale];
}
function result(integer, scale) {
  const value = Number(`${integer}e${-scale}`);
  if (!Number.isFinite(value)) throw new DomainError("calculation overflow");
  if (integer !== 0n && value === 0)
    throw new DomainError("calculation underflow");
  return value;
}
export function sum(values) {
  const parts = values.map(decimal);
  const scale = Math.max(0, ...parts.map(([, s]) => s));
  return result(
    parts.reduce((n, [v, s]) => n + v * 10n ** BigInt(scale - s), 0n),
    scale,
  );
}
export function subtract(a, b) {
  number(b, "operand", -Number.MAX_VALUE);
  return sum([a, -b]);
}
export function multiply(a, b) {
  const [x, xs] = decimal(a),
    [y, ys] = decimal(b);
  return result(x * y, xs + ys);
}
export function percentage(part, whole) {
  number(part, "part", -Number.MAX_VALUE);
  number(whole, "whole");
  if (whole === 0) return null;
  return number((part / whole) * 100, "percentage", -Number.MAX_VALUE);
}
