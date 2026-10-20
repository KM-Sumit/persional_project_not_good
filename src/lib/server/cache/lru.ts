/** Tiny LRU: Map keeps insertion order, so re-inserting on read moves a key to the "newest" end. */
export class LRU<V> {
	#map = new Map<string, { v: V; exp: number }>();
	constructor(readonly max: number) {}

	get(key: string): V | undefined {
		const e = this.#map.get(key);
		if (!e) return undefined;
		this.#map.delete(key);
		if (e.exp <= Date.now()) return undefined;
		this.#map.set(key, e);
		return e.v;
	}

	set(key: string, v: V, ttlMs: number) {
		this.#map.delete(key);
		this.#map.set(key, { v, exp: Date.now() + ttlMs });
		if (this.#map.size > this.max) this.#map.delete(this.#map.keys().next().value!);
	}

	delete(key: string) {
		this.#map.delete(key);
	}
}
