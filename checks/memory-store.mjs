export function memoryStore() {
  const records = new Map();
  let version = 0;
  return {
    records,
    async read(key) { return records.has(key) ? structuredClone(records.get(key)) : null; },
    async create(key, value) {
      if (records.has(key)) return false;
      records.set(key, { value: structuredClone(value), etag: String(++version) });
      return true;
    },
    async replace(key, value, etag) {
      if (records.get(key)?.etag !== etag) return false;
      records.set(key, { value: structuredClone(value), etag: String(++version) });
      return true;
    },
    async remove(key, etag) {
      if (records.get(key)?.etag !== etag) throw new Error('Conflict');
      records.delete(key);
    },
  };
}
