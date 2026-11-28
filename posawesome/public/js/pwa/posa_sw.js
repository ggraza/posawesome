/* POS G2Virtu service worker (PWA).
 *
 * Served by posawesome.posawesome.api.pwa.service_worker with the header
 * "Service-Worker-Allowed: /" (scope "/"), only when a POS Profile has
 * "Install as App and Start Offline (PWA)" ticked. It is not part of any bundle.
 *
 * What it does:
 *  - the POS pages (/desk/rmsapp, /desk/waiterapp, /desk/price_kiosk and their /app/
 *    forms): the server first; when it cannot be reached (no network, timeout,
 *    502 / 503 / 504) the copy of the page kept from the last online start is used.
 *  - build files (/assets/.../dist/...<hash>...): kept and served from the device
 *    (their names change with every bench build).
 *  - other /assets/ files, pictures from /files/: the server first, the kept copy offline.
 *  - the desk's page script and Page definition (getpage / getdoctype): the server
 *    first, the kept copy offline (Frappe clears its own copy every 2 days).
 * Everything else (saving sales, logins, all other server calls) is never touched.
 */
const VERSION = "__VERSION__";
const PAGES = ["rmsapp", "waiterapp", "price_kiosk"];
const SHELL = "posa-pwa-shell";
const ASSETS = "posa-pwa-assets";
const API = "posa-pwa-api";
const KEEP = [SHELL, ASSETS, API];
// (translations come with the page itself on v16: frappe.boot.__messages)
const API_GET = ["frappe.desk.form.load.getdoctype"];
const NAV_TIMEOUT = 7000;
const FETCH_TIMEOUT = 10000;
const MAX_ASSETS = 800;
const HASHED = /\/dist\/.*\.[A-Za-z0-9]{8,}\.(js|css|map|woff2?|ttf|svg|png)$/;

const offlineStarts = new Map(); // clientId -> time, pages started from the kept copy
let switchedOff = false; // the PWA was switched off: stop keeping anything until we are gone

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
	event.waitUntil(
		(async () => {
			for (const k of await caches.keys()) {
				if (k.startsWith("posa-pwa-") && !KEEP.includes(k)) await caches.delete(k);
			}
			await self.clients.claim();
		})()
	);
});

// /desk/rmsapp and, on v16, /desk/<workspace>/rmsapp (e.g. /desk/pos-g2virtu/rmsapp)
function posPage(url) {
	const m = url.pathname.match(/^\/(desk|app)\/(?:([^/?#]+)\/)?(rmsapp|waiterapp|price_kiosk)(\/.*)?$/);
	if (!m || !PAGES.includes(m[3])) return null;
	return { prefix: m[1], workspace: m[2] || "", page: m[3], rest: m[4] || "" };
}

function withTimeout(promise, ms) {
	return new Promise((resolve, reject) => {
		const t = setTimeout(() => reject(new Error("timeout")), ms);
		promise.then(
			(v) => {
				clearTimeout(t);
				resolve(v);
			},
			(e) => {
				clearTimeout(t);
				reject(e);
			}
		);
	});
}

// jQuery adds "_=<time>" to GET calls (cache: false); the kept copy must not depend on it
function apiKey(url) {
	const u = new URL(url, self.location.origin);
	u.searchParams.delete("_");
	u.searchParams.sort();
	return u.pathname + "?" + u.searchParams.toString();
}

const serverDown = (res) => res.status === 502 || res.status === 503 || res.status === 504;
const isHtml = (res) => (res.headers.get("content-type") || "").includes("text/html");

let puts = 0;
async function put(cacheName, key, res) {
	if (switchedOff) return;
	const c = await caches.open(cacheName);
	await c.put(key, res);
	if (cacheName === ASSETS && ++puts % 25 === 0) {
		const keys = await c.keys(); // oldest first
		for (const k of keys.slice(0, Math.max(0, keys.length - MAX_ASSETS))) await c.delete(k);
	}
}

function offlinePage() {
	const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>POS G2Virtu - offline</title></head><body style="font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#f8fafc;color:#0f172a">
<div style="max-width:420px;text-align:center;padding:24px"><h2>The server cannot be reached</h2>
<p>This POS screen has not been opened on this device while online yet, so there is no copy to start from.
Connect once, open the POS, and it will start offline after that.</p>
<button onclick="location.reload()" style="padding:10px 20px;font-size:16px">Try Again</button></div></body></html>`;
	return new Response(html, { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } });
}

async function navigate(event, p) {
	const key = "/desk/" + p.page;
	let res;
	try {
		res = await withTimeout(fetch(event.request), NAV_TIMEOUT);
		if (serverDown(res)) throw new Error("server " + res.status);
		if (res.status === 200 && res.type === "basic" && !res.redirected && isHtml(res)) {
			await put(SHELL, key, res.clone());
		}
		return res;
	} catch (e) {
		if (p.prefix === "app") return Response.redirect("/desk/" + (p.workspace ? p.workspace + "/" : "") + p.page + p.rest, 302);
		const hit = await (await caches.open(SHELL)).match(key);
		if (hit) {
			if (event.resultingClientId) offlineStarts.set(event.resultingClientId, Date.now());
			return hit;
		}
		return res || offlinePage();
	}
}

async function cacheFirst(req) {
	const c = await caches.open(ASSETS);
	const hit = await c.match(req);
	if (hit) return hit;
	const res = await fetch(req);
	if (res.ok && res.type === "basic") await put(ASSETS, req, res.clone());
	return res;
}

async function networkFirst(req, cacheName, key) {
	let res;
	try {
		res = await withTimeout(fetch(req), FETCH_TIMEOUT);
		if (serverDown(res)) throw new Error("server " + res.status);
		if (res.ok && res.type === "basic") await put(cacheName, key || req, res.clone());
		return res;
	} catch (e) {
		const hit = await (await caches.open(cacheName)).match(key || req);
		if (hit) return hit;
		return res || Response.error();
	}
}

// POST getpage of a POS page: kept under a made-up GET address
async function getpage(event) {
	let name = null;
	try {
		const body = await event.request.clone().text();
		const type = event.request.headers.get("content-type") || "";
		name = type.includes("json") ? JSON.parse(body || "{}").name : new URLSearchParams(body).get("name");
	} catch (e) {
		name = null;
	}
	if (!PAGES.includes(name)) return fetch(event.request);
	return networkFirst(event.request, API, "/__posa_pwa/getpage/" + name);
}

self.addEventListener("fetch", (event) => {
	if (switchedOff) return;
	const req = event.request;
	const url = new URL(req.url);
	if (url.origin !== self.location.origin) return;

	if (req.method === "POST") {
		if (url.pathname === "/api/method/frappe.desk.desk_page.getpage") event.respondWith(getpage(event));
		return;
	}
	if (req.method !== "GET" || req.headers.has("range")) return;

	if (req.mode === "navigate") {
		const p = posPage(url);
		if (p) event.respondWith(navigate(event, p));
		return;
	}
	if (url.pathname.startsWith("/assets/")) {
		event.respondWith(HASHED.test(url.pathname) ? cacheFirst(req) : networkFirst(req, ASSETS));
		return;
	}
	if (url.pathname.startsWith("/files/") && req.destination === "image") {
		event.respondWith(networkFirst(req, ASSETS));
		return;
	}
	if (url.pathname.startsWith("/api/method/")) {
		const method = url.pathname.slice("/api/method/".length);
		if (API_GET.includes(method)) event.respondWith(networkFirst(req, API, apiKey(url.href)));
	}
});

// The page that registered us sends what it loaded before we were in control,
// so the first online start is enough to start offline next time.
async function warm(data) {
	const jobs = [];
	if (data.shell) {
		const p = posPage(new URL(data.shell, self.location.origin));
		if (p) {
			jobs.push(
				fetch("/desk/" + p.page, { credentials: "same-origin" })
					.then((res) => {
						if (res.status === 200 && !res.redirected && isHtml(res)) return put(SHELL, "/desk/" + p.page, res);
					})
					.catch(() => null)
			);
		}
	}
	const assets = await caches.open(ASSETS);
	for (const u of data.urls || []) {
		let url;
		try {
			url = new URL(u, self.location.origin);
		} catch (e) {
			continue;
		}
		if (url.origin !== self.location.origin) continue;
		if (url.pathname.startsWith("/assets/")) {
			jobs.push(
				assets.match(url.href).then((hit) =>
					hit
						? null
						: fetch(url.href, { credentials: "same-origin" })
								.then((res) => res.ok && put(ASSETS, url.href, res))
								.catch(() => null)
				)
			);
		} else if (url.pathname.startsWith("/api/method/") && API_GET.includes(url.pathname.slice(12))) {
			jobs.push(
				fetch(url.href, { credentials: "same-origin" })
					.then((res) => res.ok && put(API, apiKey(url.href), res))
					.catch(() => null)
			);
		}
	}
	await Promise.all(jobs);
}

self.addEventListener("message", (event) => {
	const data = event.data || {};
	const source = event.source;
	if (data.type === "status") {
		const t = source && offlineStarts.get(source.id);
		source &&
			source.postMessage({ type: "posa-pwa-status", version: VERSION, offlineStart: !!t && Date.now() - t < 600000 });
	} else if (data.type === "warm") {
		event.waitUntil(warm(data));
	} else if (data.type === "off") {
		switchedOff = true;
		event.waitUntil(
			caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith("posa-pwa-")).map((k) => caches.delete(k))))
		);
	} else if (data.type === "clear") {
		event.waitUntil(
			caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith("posa-pwa-")).map((k) => caches.delete(k))))
		);
	}
});
