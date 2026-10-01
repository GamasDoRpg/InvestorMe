export class MemoryCache {
  #entries = new Map();
  constructor({ now = Date.now, maxEntries = 256 } = {}) {
    if (!Number.isInteger(maxEntries) || maxEntries < 1)
      throw new TypeError("Invalid cache capacity");
    this.now = now;
    this.maxEntries = maxEntries;
  }
  get(key) {
    const entry = this.#entries.get(key);
    if (!entry) return undefined;
    if (entry.expires <= this.now()) {
      this.#entries.delete(key);
      return undefined;
    }
    return entry.value;
  }
  set(key, value, ttl) {
    if (!Number.isFinite(ttl) || ttl < 0) throw new TypeError("Invalid TTL");
    this.#entries.delete(key);
    for (const [id, entry] of this.#entries)
      if (entry.expires <= this.now()) this.#entries.delete(id);
    if (this.#entries.size >= this.maxEntries)
      this.#entries.delete(this.#entries.keys().next().value);
    this.#entries.set(key, { value, expires: this.now() + ttl });
  }
  clear() {
    this.#entries.clear();
  }
}
