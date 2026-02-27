const KEY = 'ASCENSAO_OS_STATE_V1';

export class LocalPersistence {
  constructor(storage = globalThis.localStorage) {
    this.storage = storage;
  }

  load() {
    if (!this.storage) return null;
    const raw = this.storage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  }

  save(state) {
    if (!this.storage) return;
    this.storage.setItem(KEY, JSON.stringify(state));
  }
}

export class MemoryStorage {
  constructor() {
    this.map = new Map();
  }
  getItem(key) { return this.map.get(key) ?? null; }
  setItem(key, value) { this.map.set(key, value); }
}
