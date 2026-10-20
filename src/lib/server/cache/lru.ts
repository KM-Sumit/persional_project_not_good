export class LRU<V> {
	#map = new Map<string, { v: V; exp: number }>();

	constructor(readonly max: number) {}

	get(key: string) {
		const entry = this.#map.get(key);
		if (!entry) return undefined;
		this.#map.delete(key);
		if (entry.exp <= Date.now()) return undefined;
		this.#map.set(key, entry);
		return entry.v;
	}

	set(key: string, value: V, ttlMs: number) {
		this.#map.delete(key);
		this.#map.set(key, { v: value, exp: Date.now() + ttlMs });
		if (this.#map.size > this.max) this.#map.delete(this.#map.keys().next().value!);
	}

	delete(key: string) {
		this.#map.delete(key);
	}
}
