// IndexedDB layout of the offline POS.
//
//  posa_catalog_<site>_<profile>   (one per POS Profile: price list / warehouse differ)
//     meta       key -> value         sync cursors, last sync times, bootstrap
//     items      item_code            slim item rows incl. barcodes, UOMs, item taxes
//     prices     name                 Item Price rows (index: item_code)
//     stock      item_code            Bin of the profile warehouse
//     customers  name                 customers (+ offline created ones)
//
//  posa_queue_<site>               (shared: never lose an invoice when switching profile)
//     invoices   offline_id           invoices taken offline (indexes: status, created_on, shift)
//     log        ++id                 sync log for support

import { IDB } from "./idb";

const CATALOG_VERSION = 1;
const QUEUE_VERSION = 1;

function slug(value) {
	return String(value || "default")
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "_")
		.slice(0, 60);
}

export function siteName() {
	return (window.frappe && frappe.boot && (frappe.boot.sitename || frappe.boot.site_name)) || location.host;
}

const catalogs = new Map();
let queueDb = null;

export function catalogDb(profileName) {
	const name = `posa_catalog_${slug(siteName())}_${slug(profileName)}`;
	if (!catalogs.has(name)) {
		catalogs.set(
			name,
			new IDB(name, CATALOG_VERSION, (db) => {
				if (!db.objectStoreNames.contains("meta")) db.createObjectStore("meta");
				if (!db.objectStoreNames.contains("items")) db.createObjectStore("items", { keyPath: "item_code" });
				if (!db.objectStoreNames.contains("prices")) {
					const s = db.createObjectStore("prices", { keyPath: "name" });
					s.createIndex("item_code", "item_code");
				}
				if (!db.objectStoreNames.contains("stock")) db.createObjectStore("stock", { keyPath: "item_code" });
				if (!db.objectStoreNames.contains("customers")) db.createObjectStore("customers", { keyPath: "name" });
			})
		);
	}
	return catalogs.get(name);
}

export function queueDatabase() {
	if (!queueDb) {
		queueDb = new IDB(`posa_queue_${slug(siteName())}`, QUEUE_VERSION, (db) => {
			if (!db.objectStoreNames.contains("invoices")) {
				const s = db.createObjectStore("invoices", { keyPath: "offline_id" });
				s.createIndex("status", "status");
				s.createIndex("created_on", "created_on");
				s.createIndex("pos_opening_shift", "pos_opening_shift");
			}
			if (!db.objectStoreNames.contains("log")) db.createObjectStore("log", { autoIncrement: true });
		});
	}
	return queueDb;
}
