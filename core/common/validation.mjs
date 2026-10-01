export class DomainError extends Error {
  constructor(message) {
    super(message);
    this.name = "DomainError";
  }
}
export function text(value, field) {
  if (typeof value !== "string" || !value.trim())
    throw new DomainError(`${field}: required non-empty string`);
  return value.trim();
}
export function currency(value) {
  const code = text(value, "currency").toUpperCase();
  if (!/^[A-Z]{3}$/.test(code))
    throw new DomainError("currency: expected three-letter code");
  return code;
}
export function number(value, field, minimum = 0) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < minimum)
    throw new DomainError(`${field}: expected finite number >= ${minimum}`);
  return value;
}
export function timestamp(value) {
  if (!(
    typeof value === "number" ||
    (typeof value === "string" &&
      /^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value))
  ))
    throw new DomainError(
      "timestamp: expected epoch milliseconds or ISO timestamp with timezone",
    );
  const date = new Date(value);
  if (!Number.isFinite(date.getTime()))
    throw new DomainError("timestamp: invalid date");
  return date.toISOString();
}
