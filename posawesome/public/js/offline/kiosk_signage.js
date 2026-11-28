// Kiosk display (signage) around the customer price checker.
//
// Configured in the desk with POS Kiosk Display (doctype): top bar, ticker,
// centre slideshow / video while idle, left sidebar (featured items or
// slides), right sidebar (running offers or slides), colours and timings,
// for some POS Profiles or all, between dates. Every slide and ticker line can
// have its own dates, daily hours and days.
//
// The screen keeps the last answer of api/kiosk_display.get_kiosk_display and
// decides itself, every few seconds, which display and which slides are valid
// now (highest priority first), so the schedule keeps running offline. Images
// and videos are kept in the browser's Cache Storage (needs https) and played
// from there when the server or internet is down. Changes made in the desk
// arrive within seconds (realtime event posa_kiosk_display_changed); the
// screen also checks every few minutes. Every 5 minutes the screen reports
// itself (POS Kiosk Device), so managers see which screens are alive.
//
// A scan always wins: the price card takes the centre, the video pauses, the
// sidebars show the item's offers and items of its group, and after the
// display's "Show Price For" seconds the attract loop comes back.

import { network, serverCall } from "./network";

const API = "posawesome.posawesome.api.kiosk_display.";
const EVENT = "posa_kiosk_display_changed";
const CONFIG_KEY = "posa_kiosk_display::";
const DEVICE_KEY = "posa_kiosk_device";
const MEDIA_CACHE = "posa-kiosk-media-v1";
const SCHEDULE_SECONDS = 20;
const HEARTBEAT_MINUTES = 5;
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export const DEFAULTS = {
	show_top_bar: 1,
	tagline: "Scan & check the price",
	show_clock: 1,
	show_ticker: 0,
	show_search_box: 1,
	show_centre_media: 1,
	show_scan_hint: 1,
	idle_title: "Scan a product to see its price",
	idle_subtitle: "قیمت جاننے کے لیے پروڈکٹ اسکین کریں",
	idle_hint: "Hold the barcode in front of the scanner",
	show_left_sidebar: 0,
	left_sidebar_content: "Featured Items",
	left_sidebar_width: 19,
	left_min_screen_width: 1600,
	show_right_sidebar: 0,
	right_sidebar_content: "Offers",
	right_sidebar_width: 25,
	after_scan_sidebars: 1,
	slide_seconds: 8,
	result_seconds: 20,
	not_found_seconds: 8,
	offer_rotate_seconds: 6,
	ticker_speed: 90,
	refresh_minutes: 10,
	play_video_sound: 0,
	max_video_seconds: 0,
	text_color: "#ffffff",
	heading_color: "#ffffff",
	price_color: "#6dffb4",
	accent_color: "#ffb703",
	offer_color: "#ff3b5c",
	ticker_background: "#ffb703",
	ticker_text_color: "#1b1200",
	font_scale: 100,
	ticker_separator: "•",
	cache_media: 1,
	max_cache_mb: 1024,
};

const esc = (s) =>
	String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const num = (v, d = 0) => (v === null || v === undefined || v === "" || isNaN(Number(v)) ? d : Number(v));
const tr = (s, a) => (typeof __ === "function" ? __(s, a) : s);

// ----------------------------------------------------------------- schedule

const pad = (x) => String(x).padStart(2, "0");
export function localDate(now = new Date()) {
	return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}
export function localTime(now = new Date()) {
	return `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
}
const hms = (t) => (t ? (String(t).length === 5 ? String(t) + ":00" : String(t).slice(0, 8).padStart(8, "0")) : "");

/** Is a display / slide / ticker line valid at `now` (local time of the screen)? */
export function activeNow(row, now = new Date()) {
	if (!row) return false;
	const d = localDate(now);
	if (row.valid_from && String(row.valid_from).slice(0, 10) > d) return false;
	if (row.valid_upto && String(row.valid_upto).slice(0, 10) < d) return false;
	const from = hms(row.from_time);
	const to = hms(row.to_time);
	const t = localTime(now);
	// which day the running window belongs to: the part of a 22:00-02:00
	// window after midnight belongs to the day it started
	let day = now.getDay();
	if (from || to) {
		if (from && to && from > to) {
			if (t >= from) day = now.getDay();
			else if (t < to) day = (now.getDay() + 6) % 7;
			else return false;
		} else if (from && to) {
			if (t < from || t >= to) return false;
		} else if (from && t < from) return false;
		else if (to && t >= to) return false;
	}
	if (row.weekdays) {
		const days = String(row.weekdays)
			.split(/[\s,;/]+/)
			.filter(Boolean)
			.map((w) => w.slice(0, 3).toLowerCase());
		if (days.length && !days.includes(DAYS[day].toLowerCase())) return false;
	}
	return true;
}

/** The display to run now: valid, highest priority, most recently changed. */
export function pickDisplay(displays, now = new Date()) {
	const valid = (displays || []).filter((d) => activeNow(d, now));
	valid.sort((a, b) => num(b.priority) - num(a.priority) || String(b.modified || "").localeCompare(String(a.modified || "")));
	return valid[0] || null;
}

/** Slides of one area valid now; "Landscape Only" / "Portrait Only" slides follow the screen. */
export function zoneSlides(display, zone, now = new Date(), portrait = false) {
	return ((display && display.slides) || []).filter(
		(s) =>
			(s.zone || "Centre") === zone &&
			activeNow(s, now) &&
			!(s.show_on === "Landscape Only" && portrait) &&
			!(s.show_on === "Portrait Only" && !portrait)
	);
}

export function activeTicker(display, now = new Date()) {
	return ((display && display.ticker) || []).filter((t) => activeNow(t, now) && String(t.text || "").trim());
}

const signature = (rows) => (rows || []).map((r) => r.name || r.idx).join("|");

// ----------------------------------------------------------------- media store

/** Images and videos of the displays, kept in Cache Storage for offline play. */
export class MediaStore {
	constructor() {
		this.supported = typeof window !== "undefined" && "caches" in window && window.isSecureContext !== false;
		this.objectUrls = new Map();
		this.stats = { count: 0, bytes: 0 };
		this.busy = null;
	}

	abs(url) {
		try {
			return new URL(url, window.location.origin).href;
		} catch (e) {
			return url;
		}
	}

	/** Keep exactly the wanted files (within maxBytes); fetch missing ones while online. */
	async sync(media, { maxBytes = 1024 * 1048576, enabled = true } = {}) {
		if (!this.supported) return this.stats;
		if (this.busy) return this.busy;
		this.busy = (async () => {
			const cache = await caches.open(MEDIA_CACHE);
			const wanted = new Map();
			if (enabled) for (const m of media || []) if (m && m.url) wanted.set(this.abs(m.url), m);
			// drop what no display uses any more
			for (const req of await cache.keys()) {
				if (!wanted.has(req.url)) {
					await cache.delete(req);
					this.revoke(req.url);
				}
			}
			let bytes = 0;
			let count = 0;
			for (const req of await cache.keys()) {
				const res = await cache.match(req);
				const len = Number(res && res.headers.get("content-length")) || 0;
				bytes += len || ((wanted.get(req.url) || {}).size || 0);
				count++;
			}
			// images first (small, needed by most slides), then videos
			const todo = [...wanted.entries()].sort((a, b) => (a[1].kind === "video") - (b[1].kind === "video"));
			for (const [url, m] of todo) {
				if (!network.isOnline) break;
				if (await cache.match(url)) continue;
				if (m.size && bytes + m.size > maxBytes) continue; // over the limit: played from the server
				try {
					const sameOrigin = url.startsWith(window.location.origin);
					const res = await fetch(url, { credentials: sameOrigin ? "same-origin" : "omit", mode: sameOrigin ? "same-origin" : "cors" });
					if (!res.ok || res.type === "opaque") continue;
					const blob = await res.blob();
					if (bytes + blob.size > maxBytes) continue;
					await cache.put(
						url,
						new Response(blob, { headers: { "Content-Type": blob.type || res.headers.get("Content-Type") || "", "Content-Length": String(blob.size) } })
					);
					bytes += blob.size;
					count++;
				} catch (e) {
					// cross-origin without CORS, network error: played from the link
				}
			}
			this.stats = { count, bytes };
			return this.stats;
		})().finally(() => (this.busy = null));
		return this.busy;
	}

	/** A URL to show: the kept copy when there is one, else the original. */
	async url(url) {
		if (!url) return "";
		const key = this.abs(url);
		if (this.objectUrls.has(key)) return this.objectUrls.get(key);
		if (this.supported) {
			try {
				const cache = await caches.open(MEDIA_CACHE);
				const res = await cache.match(key);
				if (res) {
					const objectUrl = URL.createObjectURL(await res.blob());
					this.objectUrls.set(key, objectUrl);
					return objectUrl;
				}
			} catch (e) {
				// fall back to the network copy
			}
		}
		return url;
	}

	revoke(key) {
		const u = this.objectUrls.get(key);
		if (u) URL.revokeObjectURL(u);
		this.objectUrls.delete(key);
	}
}

// ----------------------------------------------------------------- slide player

/** Plays slides of one area in a loop: image, video, item (live price), offer, text. */
export class SlidePlayer {
	constructor(el, slides, ctx) {
		this.el = el;
		this.slides = slides;
		this.ctx = ctx; // { host, display, media, zone }
		this.index = -1;
		this.timer = null;
		this.paused = true;
		this.token = 0;
		el.innerHTML = "";
		el.classList.add("pk-player");
	}

	start() {
		this.paused = false;
		if (!this.slides.length) return;
		this.next();
	}

	pause() {
		this.paused = true;
		clearTimeout(this.timer);
		const v = this.el.querySelector("video");
		if (v) v.pause();
	}

	resume() {
		if (!this.paused) return;
		this.paused = false;
		const v = this.el.querySelector("video");
		if (v && !v.ended) {
			v.play().catch(() => this.next());
			this.armVideoCap(v);
		} else this.next();
	}

	destroy() {
		this.pause();
		this.token++;
		this.el.innerHTML = "";
	}

	seconds(slide) {
		const d = this.ctx.display;
		return Math.max(2, num(slide.duration) || num(d.slide_seconds, DEFAULTS.slide_seconds));
	}

	async next() {
		clearTimeout(this.timer);
		if (this.paused || !this.slides.length) return;
		const token = ++this.token;
		// skip slides that cannot be shown here (item not in this price list, offer gone)
		for (let tries = 0; tries < this.slides.length; tries++) {
			this.index = (this.index + 1) % this.slides.length;
			const slide = this.slides[this.index];
			const html = await this.render(slide);
			if (token !== this.token || this.paused) return;
			if (!html) continue;
			this.show(html, slide);
			return;
		}
		// nothing showable: try again later (prices may arrive with the next sync)
		this.timer = setTimeout(() => this.next(), 30000);
	}

	show(html, slide) {
		const layer = document.createElement("div");
		layer.className = "pk-slide pk-slide-in";
		layer.innerHTML = html;
		this.el.appendChild(layer);
		// old layers fade out underneath
		const old = [...this.el.children].filter((c) => c !== layer);
		setTimeout(() => old.forEach((o) => o.remove()), 700);
		const video = layer.querySelector("video");
		if (video) return this.playVideo(video, slide);
		this.timer = setTimeout(() => this.next(), this.seconds(slide) * 1000);
	}

	playVideo(video, slide) {
		const d = this.ctx.display;
		const single = this.slides.length === 1;
		const sound = num(d.play_video_sound) && this.ctx.host.userInteracted;
		video.muted = !sound;
		video.loop = single && !num(slide.duration);
		video.addEventListener("ended", () => this.next());
		video.addEventListener("error", () => (this.timer = setTimeout(() => this.next(), 500)));
		const play = video.play();
		if (play && play.catch)
			play.catch(() => {
				// autoplay with sound refused: play muted
				video.muted = true;
				video.play().catch(() => (this.timer = setTimeout(() => this.next(), 1000)));
			});
		this.armVideoCap(video, slide);
	}

	armVideoCap(video, slide = this.slides[this.index]) {
		clearTimeout(this.timer);
		const d = this.ctx.display;
		const cap = num(slide && slide.duration) || num(d.max_video_seconds);
		if (cap && !(this.slides.length === 1)) this.timer = setTimeout(() => this.next(), cap * 1000);
	}

	async render(s) {
		const { host, media } = this.ctx;
		const caption =
			s.title || s.subtitle
				? `<div class="pk-cap">${s.title ? `<div class="t">${esc(s.title)}</div>` : ""}${s.subtitle ? `<div class="s">${esc(s.subtitle)}</div>` : ""}</div>`
				: "";
		const fit = s.fit === "Contain" ? "contain" : "cover";
		switch (s.slide_type) {
			case "Image": {
				if (!s.image) return "";
				return `<img class="pk-fill" style="object-fit:${fit}" src="${esc(await media.url(s.image))}" alt="">${caption}`;
			}
			case "Video": {
				const src = s.video || s.video_url;
				if (!src) return "";
				return `<video class="pk-fill" style="object-fit:${fit}" src="${esc(await media.url(src))}" playsinline preload="auto"></video>${caption}`;
			}
			case "Text": {
				const bg = s.image ? `<img class="pk-fill pk-dim" src="${esc(await media.url(s.image))}" alt="">` : "";
				return `${bg}<div class="pk-textslide"><div class="t">${esc(s.title || "")}</div>${s.subtitle ? `<div class="s">${esc(s.subtitle)}</div>` : ""}</div>`;
			}
			case "Item": {
				const item = host.itemFor(s.item_code) || null;
				if (!item) return "";
				const p = host.priceFor(item);
				if (!p.rate) return "";
				const imgUrl = item.image || (s.item && s.item.image);
				const img = imgUrl ? `<img src="${esc(await media.url(imgUrl))}" alt="">` : `<div class="ph">${esc((item.item_name || item.item_code).slice(0, 1))}</div>`;
				const save = p.mrp > p.rate ? p.mrp - p.rate : 0;
				return `<div class="pk-itemslide">
					<div class="im">${img}</div>
					<div class="tx">
						${s.title ? `<div class="pk-chip">${esc(s.title)}</div>` : ""}
						<div class="nm">${esc(item.item_name || item.item_code)}</div>
						<div class="pr">${esc(host.money(p.rate, p.currency))}<small> / ${esc(p.uom || "")}</small></div>
						${p.mrp > p.rate ? `<div class="mrp">${esc(tr("MRP"))} <s>${esc(host.money(p.mrp, p.currency))}</s></div>` : ""}
						${save ? `<div class="sv">${esc(tr("You save {0}", [host.money(save, p.currency)]))}</div>` : ""}
						${s.subtitle ? `<div class="sub">${esc(s.subtitle)}</div>` : ""}
					</div></div>`;
			}
			case "POS Offer": {
				const o = host.offerByName(s.pos_offer) || s.offer;
				if (!o || num(o.disable) || !activeNow({ valid_from: o.valid_from, valid_upto: o.valid_upto })) return "";
				const until = o.valid_upto ? `<div class="until">${esc(tr("Till {0}", [host.formatDate(o.valid_upto)]))}</div>` : "";
				return `<div class="pk-offerslide"><div class="tag">${esc(tr("Offer"))}</div><div class="body">${host.offerText(o)}</div>${s.subtitle ? `<div class="sub">${esc(s.subtitle)}</div>` : ""}${until}</div>`;
			}
		}
		return "";
	}
}

// ----------------------------------------------------------------- the signage

export class KioskSignage {
	/**
	 * host: the price kiosk. Uses host.root, host.$(), priceFor(), offerText(),
	 * money(), itemFor(), offerByName(), offersToday(), sameGroupItems(),
	 * formatDate().
	 */
	constructor(host) {
		this.host = host;
		this.media = new MediaStore();
		this.config = null;
		this.display = null;
		this.players = {};
		this.sig = {};
		this.scanned = null;
	}

	get d() {
		return Object.assign({}, DEFAULTS, this.display || {});
	}

	setting(key) {
		const v = this.display ? this.display[key] : undefined;
		return v === undefined || v === null || v === "" ? DEFAULTS[key] : v;
	}

	// ----- life cycle ------------------------------------------------------

	async start(profileName) {
		this.profileName = profileName;
		this.config = readJson(CONFIG_KEY + profileName);
		this.apply(true);
		if (!this.scheduleTimer) {
			this.scheduleTimer = setInterval(() => this.apply(false), SCHEDULE_SECONDS * 1000);
			window.addEventListener("resize", () => {
				clearTimeout(this.resizeTimer);
				this.resizeTimer = setTimeout(() => this.apply(true), 300);
			});
			if (window.frappe && frappe.realtime && frappe.realtime.on) {
				frappe.realtime.on(EVENT, (msg) => {
					const mine =
						!msg ||
						msg.all ||
						(msg.profiles || []).includes(this.profileName) ||
						((this.config && this.config.displays) || []).some((d) => d.name === msg.display);
					if (!mine) return;
					clearTimeout(this.liveTimer);
					this.liveTimer = setTimeout(() => this.refresh(), 1500);
				});
			}
			this.heartbeatTimer = setInterval(() => this.heartbeat(), HEARTBEAT_MINUTES * 60000);
		}
		await this.refresh();
		this.heartbeat();
	}

	/** Fetch the displays of this POS Profile (online) and keep them. */
	async refresh() {
		if (!this.profileName || !network.isOnline) return;
		try {
			const res = await serverCall(API + "get_kiosk_display", { pos_profile: this.profileName });
			if (!res) return;
			const changed = !this.config || this.config.version !== res.version;
			this.config = res;
			writeJson(CONFIG_KEY + this.profileName, res);
			if (changed) this.apply(true);
			this.syncMedia();
		} catch (e) {
			console.warn("[kiosk display] refresh failed", e);
		} finally {
			clearTimeout(this.refreshTimer);
			this.refreshTimer = setTimeout(() => this.refresh(), Math.max(1, num(this.setting("refresh_minutes"), 10)) * 60000);
		}
	}

	async syncMedia() {
		const all = [];
		const seen = new Set();
		for (const d of (this.config && this.config.displays) || []) {
			if (!num(d.cache_media, 1)) continue;
			for (const m of d.media || []) if (!seen.has(m.url)) seen.add(m.url), all.push(m);
		}
		const maxMb = Math.max(...((this.config && this.config.displays) || []).map((d) => num(d.max_cache_mb, 1024)), 50);
		await this.media.sync(all, { maxBytes: maxMb * 1048576, enabled: all.length > 0 });
		// a slide shown from the server before it was kept: use the kept copy next time
	}

	/** Re-decide what runs now; rebuild only what changed (force: everything). */
	apply(force) {
		const now = new Date();
		const display = pickDisplay((this.config && this.config.displays) || [], now);
		const switched = (display && display.name + display.modified) !== (this.display && this.display.name + this.display.modified);
		if (switched || force) {
			this.display = display;
			this.sig = {};
			this.layout();
			this.theme();
			this.topBar();
			if (this.host.onDisplayChange) this.host.onDisplayChange(display);
		}
		this.ticker(now);
		this.centre(now);
		this.sidebar("left", now);
		this.sidebar("right", now);
	}

	// ----- layout and theme ------------------------------------------------

	portrait() {
		const o = this.setting("orientation");
		if (o === "Portrait") return true;
		if (o === "Landscape") return false;
		return window.innerHeight > window.innerWidth * 1.05;
	}

	layout() {
		const r = this.host.root;
		const on = !!this.display;
		const portrait = on && this.portrait();
		this.isPortrait = portrait;
		const scale = Math.min(2, Math.max(0.6, num(this.setting("font_scale"), 100) / 100));
		const wideEnough = window.innerWidth / scale >= num(this.setting("left_min_screen_width"), 0);
		r.classList.toggle("pk-signage", on);
		r.classList.toggle("pk-portrait", portrait);
		r.classList.toggle("pk-no-top", on && !num(this.setting("show_top_bar")));
		r.classList.toggle("pk-no-search", on && !num(this.setting("show_search_box")));
		r.classList.toggle("pk-has-left", on && !portrait && wideEnough && !!num(this.setting("show_left_sidebar")));
		r.classList.toggle("pk-has-right", on && !!num(this.setting("show_right_sidebar")));
		r.style.setProperty("--pk-left-w", num(this.setting("left_sidebar_width"), 19) + "%");
		r.style.setProperty("--pk-right-w", num(this.setting("right_sidebar_width"), 25) + "%");
	}

	theme() {
		const r = this.host.root;
		const set = (name, key) => r.style.setProperty(name, this.setting(key) || DEFAULTS[key]);
		set("--pk-text", "text_color");
		set("--pk-heading", "heading_color");
		set("--pk-price", "price_color");
		set("--pk-accent", "accent_color");
		set("--pk-offer", "offer_color");
		set("--pk-ticker-bg", "ticker_background");
		set("--pk-ticker-text", "ticker_text_color");
		const scale = Math.min(2, Math.max(0.6, num(this.setting("font_scale"), 100) / 100));
		r.style.zoom = this.display && scale !== 1 ? String(scale) : "";
		const bgColor = this.display && this.display.background_color;
		const bgImage = this.display && this.display.background_image;
		r.style.background = bgColor ? bgColor : "";
		if (bgImage) {
			this.media.url(bgImage).then((u) => {
				if (this.display && this.display.background_image === bgImage)
					r.style.background = `linear-gradient(rgba(0,0,0,.45), rgba(0,0,0,.45)), url("${u}") center / cover no-repeat, ${bgColor || "#0b1020"}`;
			});
		}
	}

	topBar() {
		const h = this.host;
		const logo = h.$(".pk-logo");
		const url = this.display && num(this.setting("show_top_bar")) ? this.display.logo : "";
		if (url) {
			this.media.url(url).then((u) => {
				logo.src = u;
				logo.style.display = "";
			});
		} else {
			logo.removeAttribute("src");
			logo.style.display = "none";
		}
		const small = h.$(".pk-store small");
		if (small) small.textContent = tr(this.setting("tagline") || DEFAULTS.tagline);
		h.root.classList.toggle("pk-no-clock", !!this.display && !num(this.setting("show_clock")));
	}

	// ----- ticker ----------------------------------------------------------

	ticker(now) {
		const el = this.host.$(".pk-ticker");
		const lines = this.display && num(this.setting("show_ticker")) ? activeTicker(this.display, now) : [];
		const sig = (this.display ? this.display.name : "") + signature(lines);
		this.host.root.classList.toggle("pk-has-ticker", lines.length > 0);
		if (sig === this.sig.ticker) return;
		this.sig.ticker = sig;
		if (!lines.length) return void (el.innerHTML = "");
		const sep = `<span class="sep">${esc(this.setting("ticker_separator") || "•")}</span>`;
		const run = lines.map((l) => `<span class="ln">${esc(String(l.text).replace(/\s+/g, " "))}</span>`).join(sep) + sep;
		el.innerHTML = `<div class="pk-ticker-track"><div class="run">${run}</div><div class="run" aria-hidden="true">${run}</div></div>`;
		requestAnimationFrame(() => {
			const track = el.querySelector(".pk-ticker-track");
			const width = track ? track.firstElementChild.scrollWidth : 0;
			const speed = Math.max(20, num(this.setting("ticker_speed"), 90));
			if (track) track.style.animationDuration = Math.max(8, width / speed) + "s";
		});
	}

	// ----- centre ----------------------------------------------------------

	hasCentreMedia() {
		return !!(this.players.centre && this.players.centre.slides.length);
	}

	centre(now) {
		const el = this.host.$(".pk-media");
		const slides = this.display && num(this.setting("show_centre_media")) ? zoneSlides(this.display, "Centre", now, this.isPortrait) : [];
		const sig = (this.display ? this.display.name + this.display.modified : "") + signature(slides);
		if (sig === this.sig.centre) return;
		this.sig.centre = sig;
		const wasAttract = this.host.root.classList.contains("pk-attract");
		if (this.players.centre) this.players.centre.destroy();
		this.players.centre = new SlidePlayer(el, slides, { host: this.host, display: this.d, media: this.media, zone: "Centre" });
		const hint = this.host.$(".pk-hint");
		hint.innerHTML = slides.length && num(this.setting("show_scan_hint"))
			? `<span class="bc"></span>${esc(tr(this.setting("idle_title")))}`
			: "";
		hint.style.display = hint.innerHTML ? "" : "none";
		if (this.host.mode === "idle") this.host.showIdle(); // switch between scanner animation and slides
		else if (wasAttract && slides.length) this.players.centre.start();
	}

	resumeCentre() {
		const p = this.players.centre;
		if (!p || !p.slides.length) return;
		if (p.index < 0) p.start();
		else p.resume();
	}

	pauseCentre() {
		if (this.players.centre) this.players.centre.pause();
	}

	// ----- sidebars --------------------------------------------------------

	sidebar(side, now) {
		const el = this.host.$(side === "left" ? ".pk-left" : ".pk-right");
		const on = this.host.root.classList.contains(side === "left" ? "pk-has-left" : "pk-has-right");
		const content = on ? this.setting(side === "left" ? "left_sidebar_content" : "right_sidebar_content") : "";
		const zone = side === "left" ? "Left Sidebar" : "Right Sidebar";
		const slides = on ? zoneSlides(this.display, zone, now, this.isPortrait) : [];
		const following = this.scanned && num(this.setting("after_scan_sidebars"));
		const base = [side, content, this.display && this.display.name + this.display.modified, signature(slides)].join("/");
		const sig = following ? base + "/scan:" + this.scanned.item_code : base + "/" + this.host.offersVersion();
		if (sig === this.sig[side]) return;
		this.sig[side] = sig;
		this.stopRotate(side);
		if (this.players[side]) this.players[side].destroy(), (this.players[side] = null);
		if (!on) return void (el.innerHTML = "");

		if (following) return this.renderList(el, side, side === "right" ? this.offerCards(this.scanned) : this.groupCards(this.scanned));
		if (content === "Slides") {
			const player = new SlidePlayer(el, slides, { host: this.host, display: this.d, media: this.media, zone });
			this.players[side] = player;
			return player.start();
		}
		if (side === "right") return this.renderList(el, side, this.offerCards(null));
		return this.renderList(el, side, this.featuredCards(slides));
	}

	renderList(el, side, { title, cards }) {
		el.classList.remove("pk-player");
		el.innerHTML = `<div class="pk-side-title">${esc(title)}</div><div class="pk-side-list">${cards.join("") || `<div class="pk-side-empty">${esc(tr("Nothing right now"))}</div>`}</div>`;
		this.startRotate(side, el.querySelector(".pk-side-list"));
	}

	offerCards(item) {
		const h = this.host;
		const all = h.offersToday();
		let cards;
		let title = tr("Today's offers");
		if (item) {
			const mine = h.offersFor(item, 10);
			const names = new Set(mine.map((o) => o.name));
			cards = mine.map((o) => `<div class="pk-side-card hot">${h.offerText(o)}</div>`);
			cards = cards.concat(all.filter((o) => !names.has(o.name)).map((o) => `<div class="pk-side-card">${h.offerText(o)}</div>`));
			if (mine.length) title = tr("Offers on this item");
		} else cards = all.map((o) => `<div class="pk-side-card">${h.offerText(o)}</div>`);
		return { title, cards };
	}

	itemCard(it, note) {
		const p = this.host.priceFor(it);
		if (!p.rate) return "";
		return `<div class="pk-side-card item"><div class="nm">${esc(it.item_name || it.item_code)}</div><div class="pr">${esc(this.host.money(p.rate, p.currency))}${
			p.mrp > p.rate ? ` <s>${esc(this.host.money(p.mrp, p.currency))}</s>` : ""
		}</div>${note ? `<div class="nt">${esc(note)}</div>` : ""}</div>`;
	}

	featuredCards(slides) {
		const h = this.host;
		let items = slides.filter((s) => s.slide_type === "Item").map((s) => [h.itemFor(s.item_code), s.title]);
		if (!items.length) items = h.offerItems(8).map((it) => [it, ""]);
		const cards = items.filter(([it]) => it).map(([it, note]) => this.itemCard(it, note)).filter(Boolean);
		return { title: tr("Featured"), cards };
	}

	groupCards(item) {
		const list = this.host.sameGroupItems(item, 8);
		return { title: item.item_group ? tr("More in {0}", [item.item_group]) : tr("You may also like"), cards: list.map((it) => this.itemCard(it)).filter(Boolean) };
	}

	startRotate(side, list) {
		if (!list) return;
		const seconds = Math.max(2, num(this.setting("offer_rotate_seconds"), 6));
		this.rotate = this.rotate || {};
		this.rotate[side] = setInterval(() => {
			if (list.scrollHeight <= list.clientHeight + 4 && list.scrollWidth <= list.clientWidth + 4) return;
			const first = list.firstElementChild;
			if (!first) return;
			first.classList.add("pk-out");
			setTimeout(() => {
				first.classList.remove("pk-out");
				list.appendChild(first);
			}, 450);
		}, seconds * 1000);
	}

	stopRotate(side) {
		if (this.rotate && this.rotate[side]) clearInterval(this.rotate[side]);
	}

	// ----- scan / idle -----------------------------------------------------

	onScan(item) {
		this.pauseCentre();
		this.scanned = item || null;
		const now = new Date();
		this.sidebar("left", now);
		this.sidebar("right", now);
	}

	onIdle() {
		if (!this.scanned) return;
		this.scanned = null;
		const now = new Date();
		this.sidebar("left", now);
		this.sidebar("right", now);
	}

	// ----- device report ---------------------------------------------------

	device() {
		let dev = readJson(DEVICE_KEY);
		if (!dev || !dev.id) {
			const id =
				(window.crypto && crypto.randomUUID && crypto.randomUUID()) ||
				"k" + Date.now().toString(36) + Math.random().toString(36).slice(2, 12);
			dev = { id, name: "", rename: "" };
			writeJson(DEVICE_KEY, dev);
		}
		return dev;
	}

	renameDevice(name) {
		const dev = this.device();
		const want = String(name || "").trim();
		if (!want || (want === dev.name && !dev.rename)) return Promise.resolve();
		dev.rename = want;
		writeJson(DEVICE_KEY, dev);
		return this.heartbeat(true);
	}

	async heartbeat() {
		if (!this.profileName || !network.isOnline) return;
		const dev = this.device();
		try {
			const res = await serverCall(API + "heartbeat", {
				device_id: dev.id,
				pos_profile: this.profileName,
				kiosk_display: this.display ? this.display.name : null,
				display_version: this.config ? this.config.version : null,
				screen: `${window.screen.width}x${window.screen.height}`,
				network: network.isOnline ? "Online" : "Offline",
				media_cached: this.media.stats.count,
				media_bytes: this.media.stats.bytes,
				device_name: dev.rename || null,
			});
			if (res && res.device_name) {
				// a rename typed while this report was on its way stays pending
				const latest = this.device();
				latest.name = res.device_name;
				if (latest.rename === (dev.rename || "") || latest.rename === res.device_name) latest.rename = "";
				writeJson(DEVICE_KEY, latest);
			}
		} catch (e) {
			// next time
		}
	}

	info() {
		const dev = this.device();
		return {
			display: this.display ? this.display.display_name || this.display.name : "",
			displays: ((this.config && this.config.displays) || []).length,
			device: dev.name || dev.rename || "",
			deviceId: dev.id,
			media: this.media.stats,
			mediaSupported: this.media.supported,
		};
	}
}

function readJson(key) {
	try {
		return JSON.parse(localStorage.getItem(key) || "null");
	} catch (e) {
		return null;
	}
}

function writeJson(key, value) {
	try {
		localStorage.setItem(key, JSON.stringify(value));
	} catch (e) {
		// storage full / private window: kept for this visit only
	}
}
