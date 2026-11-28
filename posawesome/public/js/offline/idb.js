// Minimal promise wrapper around IndexedDB (no dependency).
// Designed for bulk writes of tens of thousands of rows: every bulk operation runs
// in a single readwrite transaction.

export function promisify(request) {
	return new Promise((resolve, reject) => {
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error);
	});
}

function txDone(tx) {
	return new Promise((resolve, reject) => {
		tx.oncomplete = () => resolve();
		tx.onabort = () => reject(tx.error || new Error("IndexedDB transaction aborted"));
		tx.onerror = () => reject(tx.error);
	});
}

export class IDB {
	constructor(name, version, upgrade) {
		this.name = name;
		this.version = version;
		this.upgrade = upgrade;
		this._db = null;
		this._opening = null;
	}

	open() {
		if (this._db) return Promise.resolve(this._db);
		if (this._opening) return this._opening;
		if (!("indexedDB" in window)) {
			return Promise.reject(new Error("IndexedDB is not available in this browser"));
		}
		this._opening = new Promise((resolve, reject) => {
			const req = indexedDB.open(this.name, this.version);
			req.onupgradeneeded = (event) => this.upgrade(req.result, event.oldVersion, req.transaction);
			req.onsuccess = () => {
				this._db = req.result;
				// another tab upgraded the schema: close so it can proceed
				this._db.onversionchange = () => {
					this._db.close();
					this._db = null;
				};
				resolve(this._db);
			};
			req.onerror = () => reject(req.error);
			req.onblocked = () => console.warn(`[posawesome] IndexedDB ${this.name} upgrade blocked by another tab`);
		}).finally(() => {
			this._opening = null;
		});
		return this._opening;
	}

	async get(store, key) {
		const db = await this.open();
		return promisify(db.transaction(store).objectStore(store).get(key));
	}

	async getAll(store, query, count) {
		const db = await this.open();
		return promisify(db.transaction(store).objectStore(store).getAll(query, count));
	}

	async getAllFromIndex(store, index, query, count) {
		const db = await this.open();
		return promisify(db.transaction(store).objectStore(store).index(index).getAll(query, count));
	}

	async count(store, query) {
		const db = await this.open();
		return promisify(db.transaction(store).objectStore(store).count(query));
	}

	async countFromIndex(store, index, query) {
		const db = await this.open();
		return promisify(db.transaction(store).objectStore(store).index(index).count(query));
	}

	async put(store, value, key) {
		const db = await this.open();
		const tx = db.transaction(store, "readwrite");
		tx.objectStore(store).put(value, key);
		return txDone(tx);
	}

	async delete(store, key) {
		const db = await this.open();
		const tx = db.transaction(store, "readwrite");
		tx.objectStore(store).delete(key);
		return txDone(tx);
	}

	async clear(store) {
		const db = await this.open();
		const tx = db.transaction(store, "readwrite");
		tx.objectStore(store).clear();
		return txDone(tx);
	}

	/** rows to put and keys to delete, in one transaction */
	async bulk(store, puts = [], deletes = []) {
		if (!puts.length && !deletes.length) return;
		const db = await this.open();
		const tx = db.transaction(store, "readwrite");
		const os = tx.objectStore(store);
		for (const key of deletes) os.delete(key);
		for (const row of puts) os.put(row);
		return txDone(tx);
	}

	/** Iterate a store with a cursor without loading everything at once. */
	async each(store, fn, { index, query, direction } = {}) {
		const db = await this.open();
		return new Promise((resolve, reject) => {
			const os = db.transaction(store).objectStore(store);
			const source = index ? os.index(index) : os;
			const req = source.openCursor(query, direction);
			req.onsuccess = () => {
				const cursor = req.result;
				if (!cursor) return resolve();
				if (fn(cursor.value, cursor.primaryKey) === false) return resolve();
				cursor.continue();
			};
			req.onerror = () => reject(req.error);
		});
	}

	async estimate() {
		try {
			if (navigator.storage && navigator.storage.estimate) return await navigator.storage.estimate();
		} catch (e) {
			/* ignore */
		}
		return null;
	}

	close() {
		if (this._db) this._db.close();
		this._db = null;
	}
}

/** Ask the browser not to evict our data under storage pressure. */
export async function requestPersistentStorage() {
	try {
		if (navigator.storage && navigator.storage.persist) {
			const already = await navigator.storage.persisted();
			if (already) return true;
			return await navigator.storage.persist();
		}
	} catch (e) {
		/* ignore */
	}
	return false;
}
