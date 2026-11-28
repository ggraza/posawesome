// POS G2Virtu PWA: register / remove the service worker, add the app manifest on
// the POS pages, keep the files the POS needs, and say when the connection is back
// after an offline start. Loaded on every desk page (posawesome_desk.bundle.js), so
// it does nothing unless frappe.boot.posa_pwa is set (POS Profile > Offline and
// Devices > Install as App and Start Offline).

const SW_URL = "/api/method/posawesome.posawesome.api.pwa.service_worker";
const MANIFEST_URL = "/api/method/posawesome.posawesome.api.pwa.manifest";
const POS_PAGES = ["rmsapp", "waiterapp", "price_kiosk"];
const USER_KEY = "posa_pwa_user";

// /desk/rmsapp, and on v16 also /desk/<workspace>/rmsapp (e.g. /desk/pos-g2virtu/rmsapp)
const POS_PATH = /^\/(?:desk|app)\/(?:[^/?#]+\/)?(rmsapp|waiterapp|price_kiosk)(?:\/|$)/;
function posPage() {
	const m = window.location.pathname.match(POS_PATH);
	return m && POS_PAGES.includes(m[1]) ? m[1] : null;
}

function ours(reg) {
	const w = reg.active || reg.waiting || reg.installing;
	return !!(w && w.scriptURL.includes("posawesome.api.pwa.service_worker"));
}

async function removeAll() {
	try {
		for (const reg of await navigator.serviceWorker.getRegistrations()) {
			if (!ours(reg)) continue;
			for (const w of [reg.active, reg.waiting, reg.installing]) if (w) w.postMessage({ type: "off" });
			await reg.unregister();
		}
		const clear = async () => {
			if (!window.caches) return;
			for (const k of await caches.keys()) if (k.startsWith("posa-pwa-")) await caches.delete(k);
		};
		await clear();
		setTimeout(clear, 3000); // a reply still on its way when we switched off
	} catch (e) {
		/* nothing to remove */
	}
}

function setManifest() {
	const page = posPage();
	let link = document.querySelector("link[rel=manifest][data-posa]");
	if (!page) {
		if (link) link.remove();
		return;
	}
	if (!link) {
		link = document.createElement("link");
		link.rel = "manifest";
		link.setAttribute("data-posa", "1");
		document.head.appendChild(link);
		const meta = document.createElement("meta");
		meta.name = "theme-color";
		meta.content = "#0F766E";
		document.head.appendChild(meta);
		const apple = document.createElement("link");
		apple.rel = "apple-touch-icon";
		apple.href = "/assets/posawesome/images/pwa/apple-touch-icon.png";
		document.head.appendChild(apple);
	}
	// the app starts on the address it was installed from (with its workspace on v16)
	const path = window.location.pathname.replace(/^\/app\//, "/desk/").split("?")[0];
	const href = MANIFEST_URL + "?start=" + page + "&path=" + encodeURIComponent(path.replace(new RegExp("(/" + page + ").*$"), "$1"));
	if (link.getAttribute("href") !== href) link.setAttribute("href", href);
}

function sendToWorker(msg) {
	const sw = navigator.serviceWorker.controller;
	if (sw) {
		sw.postMessage(msg);
		return Promise.resolve(true);
	}
	return navigator.serviceWorker.ready.then((reg) => {
		if (reg.active) reg.active.postMessage(msg);
		return true;
	});
}

// what this page loaded before the worker was in control (first online start)
function warm() {
	const page = posPage();
	if (!page) return;
	const urls = (performance.getEntriesByType("resource") || [])
		.map((e) => e.name)
		.filter((u) => {
			try {
				const url = new URL(u);
				return url.origin === location.origin && (url.pathname.startsWith("/assets/") || url.pathname.startsWith("/api/method/"));
			} catch (e) {
				return false;
			}
		});
	sendToWorker({ type: "warm", shell: "/desk/" + page, urls }).catch(() => null);
}

// ---------------------------------------------------------------- back online after an offline start
let offlineStart = false;

function showBanner() {
	if (document.getElementById("posa-pwa-back")) return;
	const bar = document.createElement("div");
	bar.id = "posa-pwa-back";
	bar.setAttribute("role", "status");
	bar.style.cssText =
		"position:fixed;left:50%;bottom:16px;transform:translateX(-50%);z-index:20000;background:#0F766E;color:#fff;" +
		"padding:10px 14px;border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,.25);font:14px/1.4 sans-serif;display:flex;gap:12px;align-items:center";
	const text = document.createElement("span");
	text.textContent = __("Connection is back. Reload when the cart is empty to refresh the session.");
	const reload = document.createElement("button");
	reload.textContent = __("Reload");
	reload.style.cssText = "background:#fff;color:#0F766E;border:0;border-radius:6px;padding:6px 12px;font-weight:700;cursor:pointer";
	reload.onclick = () => window.location.reload();
	const later = document.createElement("button");
	later.textContent = "✕";
	later.setAttribute("aria-label", __("Close"));
	later.style.cssText = "background:transparent;color:#fff;border:0;font-size:16px;cursor:pointer";
	later.onclick = () => bar.remove();
	bar.append(text, reload, later);
	document.body.appendChild(bar);
}

async function serverReachable() {
	try {
		const r = await fetch("/api/method/frappe.ping", { cache: "no-store", credentials: "same-origin" });
		return r.ok;
	} catch (e) {
		return false;
	}
}

function watchConnection() {
	navigator.serviceWorker.addEventListener("message", (event) => {
		const d = event.data || {};
		if (d.type === "posa-pwa-status" && d.offlineStart) {
			offlineStart = true;
			window.posa_pwa_offline_start = true;
		}
	});
	sendToWorker({ type: "status" }).catch(() => null);
	const check = async () => {
		if (offlineStart && (await serverReachable())) {
			offlineStart = false;
			showBanner();
		}
	};
	window.addEventListener("online", check);
	setInterval(check, 30000);
}

// ---------------------------------------------------------------- start
async function setup() {
	if (!("serviceWorker" in navigator) || !window.isSecureContext) return;
	const boot = window.frappe && window.frappe.boot;
	if (!boot || !boot.user) return;
	if (!boot.posa_pwa) {
		await removeAll();
		return;
	}
	// another user on this device: forget the previous user's kept pages
	const user = boot.user.name || frappe.session?.user;
	try {
		if (localStorage.getItem(USER_KEY) && localStorage.getItem(USER_KEY) !== user) {
			if (window.caches) {
				for (const k of await caches.keys()) if (k.startsWith("posa-pwa-")) await caches.delete(k);
			}
		}
		localStorage.setItem(USER_KEY, user);
	} catch (e) {
		/* private mode */
	}
	try {
		await navigator.serviceWorker.register(SW_URL, { scope: "/" });
	} catch (e) {
		console.warn("POS G2Virtu PWA: service worker not registered", e);
		return;
	}
	setManifest();
	watchConnection();
	const later = () => {
		setManifest();
		if (posPage()) {
			setTimeout(warm, 8000);
			setTimeout(warm, 45000);
		}
	};
	later();
	if (frappe.router && frappe.router.on) frappe.router.on("change", later);
}

if (document.readyState === "complete") setup();
else window.addEventListener("load", () => setup());

export { posPage, setup };
