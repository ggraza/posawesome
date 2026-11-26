// Customer price checker (desk page /app/price_kiosk).
//
// A full-screen kiosk: the customer scans a product and sees its price, the
// MRP, how much they save and any running offer. Lookups come from the
// offline catalogue (IndexedDB, offline/catalog.js) of the chosen POS
// Profile, so the screen keeps working when the server or internet is down.
// It stays current through the realtime "catalogue changed" event and a sync
// every few minutes. Products and prices only: a "Price Checker" user does not
// download customers (see posawesome/price_checker.py).
//
// Settings (POS Profile, full screen, exit) open with a 2-second press on
// the store name, so customers do not wander off the screen.

import { catalog } from "./catalog";
import { syncCatalog } from "./sync";
import { offerMatchesItem, offerTargets } from "./offer_targets";
import { KioskSignage, localDate } from "./kiosk_signage";
import { network, serverCall, startConnectivityMonitor, onConnectivityChange } from "./network";

const CSS = `
.pk-root { position: fixed; inset: 0; z-index: 1040; overflow: hidden; color: var(--pk-text, #f5f7ff); display: flex; flex-direction: column;
  font-family: 'Segoe UI', Roboto, Arial, sans-serif;
  background: radial-gradient(1200px 700px at 15% 10%, #24357a 0%, transparent 60%),
              radial-gradient(900px 600px at 90% 90%, #0e6b5c 0%, transparent 55%), #0b1020; }
.pk-top { flex: none; display: flex; align-items: center; justify-content: space-between; padding: 18px 32px; gap: 16px; }
.pk-brand { display: flex; align-items: center; gap: 16px; min-width: 0; }
.pk-logo { height: 54px; max-width: 220px; object-fit: contain; border-radius: 8px; }
.pk-store { font-size: 26px; font-weight: 700; letter-spacing: .3px; user-select: none; cursor: default; }
.pk-store small { display: block; font-size: 14px; font-weight: 400; opacity: .7; }
.pk-topright { display: flex; align-items: center; gap: 16px; font-size: 18px; flex: none; }
.pk-clock { font-variant-numeric: tabular-nums; opacity: .85; }
.pk-net { padding: 6px 14px; border-radius: 999px; font-size: 14px; font-weight: 600; background: rgba(46, 204, 113, .18); color: #7dffb0; }
.pk-net.off { background: rgba(255, 170, 0, .18); color: #ffd27a; }
.pk-body { flex: 1; min-height: 0; display: flex; gap: 22px; padding: 4px 32px 0; }
.pk-centre { position: relative; flex: 1; min-width: 0; min-height: 0; display: flex; }
.pk-stage { position: relative; flex: 1; min-width: 0; display: flex; align-items: center; justify-content: center; }
.pk-left, .pk-right { display: none; flex-direction: column; min-height: 0; min-width: 0; }
.pk-has-left .pk-left { display: flex; flex: 0 0 var(--pk-left-w, 19%); }
.pk-has-right .pk-right { display: flex; flex: 0 0 var(--pk-right-w, 25%); }
.pk-media { position: absolute; inset: 0 0 8px; border-radius: 26px; overflow: hidden; display: none; background: rgba(0,0,0,.25); }
.pk-attract .pk-media { display: block; }
.pk-attract .pk-stage { display: none; }
.pk-hint { position: absolute; left: 50%; bottom: 30px; transform: translateX(-50%); display: none; align-items: center; gap: 14px; white-space: nowrap;
  padding: 12px 26px; border-radius: 999px; background: rgba(0,0,0,.62); color: #ffffff; font-size: 24px; font-weight: 700; z-index: 3; animation: pk-pulse 2.4s ease-in-out infinite; }
.pk-attract .pk-hint:not(:empty) { display: flex; }
.pk-hint .bc { width: 34px; height: 22px; background: repeating-linear-gradient(90deg, #fff 0 3px, transparent 3px 5px, #fff 5px 6px, transparent 6px 9px); border-radius: 3px; }
.pk-player { overflow: hidden; }
.pk-left.pk-player, .pk-right.pk-player { position: relative; }
.pk-slide { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; }
.pk-slide-in { animation: pk-fade-in .7s ease; }
.pk-fill { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; background: #000; }
.pk-dim { filter: brightness(.45); }
.pk-cap { position: absolute; left: 0; right: 0; bottom: 0; padding: 70px 36px 90px; background: linear-gradient(transparent, rgba(0,0,0,.72)); }
.pk-cap .t { font-size: 44px; font-weight: 800; color: var(--pk-heading, #ffffff); line-height: 1.1; }
.pk-cap .s { font-size: 24px; margin-top: 8px; opacity: .9; }
.pk-textslide { position: relative; text-align: center; padding: 40px 60px; }
.pk-textslide .t { font-size: 64px; font-weight: 900; color: var(--pk-heading, #ffffff); line-height: 1.1; }
.pk-textslide .s { font-size: 30px; margin-top: 18px; opacity: .9; }
.pk-itemslide { display: grid; grid-template-columns: minmax(0, 42%) 1fr; gap: 40px; align-items: center; padding: 40px 50px; width: 100%; }
.pk-itemslide .im { aspect-ratio: 1; background: #fff; border-radius: 26px; display: flex; align-items: center; justify-content: center; overflow: hidden; }
.pk-itemslide .im img { max-width: 100%; max-height: 100%; object-fit: contain; }
.pk-itemslide .im .ph { font-size: 120px; font-weight: 800; color: #24357a; }
.pk-itemslide .nm { font-size: 46px; font-weight: 800; color: var(--pk-heading, #ffffff); line-height: 1.1; }
.pk-itemslide .pr { font-size: 84px; font-weight: 900; color: var(--pk-price, #6dffb4); line-height: 1.05; margin-top: 14px; }
.pk-itemslide .pr small { font-size: 24px; font-weight: 600; opacity: .8; }
.pk-itemslide .mrp { font-size: 28px; opacity: .8; } .pk-itemslide .mrp s { text-decoration-color: var(--pk-offer, #ff3b5c); }
.pk-itemslide .sv { display: inline-block; margin-top: 14px; background: var(--pk-accent, #ffb703); color: #1b1200; font-weight: 800; font-size: 26px; padding: 8px 18px; border-radius: 14px; }
.pk-itemslide .sub { font-size: 22px; margin-top: 14px; opacity: .85; }
.pk-chip { display: inline-block; padding: 6px 16px; border-radius: 999px; background: var(--pk-accent, #ffb703); color: #1b1200; font-weight: 800; font-size: 18px; margin-bottom: 14px; }
.pk-offerslide { text-align: center; padding: 50px 60px; max-width: 92%; font-size: 34px; }
.pk-offerslide .tag { display: inline-block; font-size: 22px; font-weight: 900; letter-spacing: 2px; text-transform: uppercase; padding: 8px 22px; border-radius: 999px;
  background: var(--pk-offer, #ff3b5c); color: #ffffff; margin-bottom: 22px; }
.pk-offerslide .body b { display: block; font-size: 60px; font-weight: 900; color: var(--pk-heading, #ffffff); line-height: 1.1; margin-bottom: 10px; }
.pk-offerslide .sub { font-size: 26px; margin-top: 16px; opacity: .9; } .pk-offerslide .until { font-size: 22px; margin-top: 18px; color: var(--pk-accent, #ffb703); font-weight: 700; }
.pk-side-title { flex: none; font-size: 22px; font-weight: 800; color: var(--pk-heading, #ffffff); margin: 4px 2px 12px; }
.pk-side-list { flex: 1; min-height: 0; overflow: hidden; display: flex; flex-direction: column; gap: 12px; }
.pk-side-card { flex: none; background: rgba(255,255,255,.07); border: 1px solid rgba(255,255,255,.13); border-radius: 18px; padding: 14px 16px; font-size: 18px;
  transition: opacity .45s, transform .45s; }
.pk-side-card b { color: var(--pk-heading, #ffffff); }
.pk-side-card.hot { background: color-mix(in srgb, var(--pk-offer, #ff3b5c) 24%, transparent); border-color: color-mix(in srgb, var(--pk-offer, #ff3b5c) 60%, transparent); }
.pk-side-card.item .nm { font-size: 18px; font-weight: 700; color: var(--pk-heading, #ffffff); }
.pk-side-card.item .pr { font-size: 26px; font-weight: 900; color: var(--pk-price, #6dffb4); margin-top: 4px; }
.pk-side-card.item .pr s { font-size: 17px; color: var(--pk-text, #fff); opacity: .6; font-weight: 400; }
.pk-side-card.item .nt { font-size: 14px; color: var(--pk-accent, #ffb703); font-weight: 700; margin-top: 4px; }
.pk-side-card.pk-out { opacity: 0; transform: translateY(-14px); }
.pk-side-empty { opacity: .55; font-size: 17px; }
.pk-right.pk-player, .pk-left.pk-player { border-radius: 22px; margin-bottom: 8px; }
.pk-ticker { flex: none; display: none; height: 58px; align-items: center; overflow: hidden; background: var(--pk-ticker-bg, #ffb703); color: var(--pk-ticker-text, #1b1200);
  font-size: 26px; font-weight: 800; white-space: nowrap; }
.pk-has-ticker .pk-ticker { display: flex; }
.pk-ticker-track { display: flex; width: max-content; animation: pk-ticker linear infinite; }
.pk-ticker .run { display: flex; align-items: center; }
.pk-ticker .ln { padding: 0 26px; } .pk-ticker .sep { opacity: .7; }
.pk-no-top .pk-top { display: none; }
.pk-no-top .pk-body { padding-top: 18px; }
.pk-no-clock .pk-clock { display: none; }
.pk-no-search .pk-bottom { position: absolute; left: 0; bottom: 0; height: 1px; padding: 0; opacity: 0; overflow: hidden; pointer-events: none; }
.pk-signage .pk-bottom { padding: 12px 32px; }
.pk-signage .pk-input { font-size: 20px; padding: 12px 20px; }
.pk-portrait .pk-body { flex-direction: column; padding: 4px 24px 0; gap: 16px; }
.pk-portrait .pk-left { display: none !important; }
.pk-portrait.pk-has-right .pk-right { flex: 0 0 24%; }
.pk-portrait .pk-right .pk-side-list { flex-direction: row; flex-wrap: wrap; align-content: flex-start; }
.pk-portrait .pk-right .pk-side-card { flex: 0 0 calc(50% - 6px); align-self: flex-start; }
.pk-portrait .pk-card { grid-template-columns: 1fr; }
.pk-portrait .pk-img { width: 100%; height: 300px; }
.pk-portrait .pk-itemslide { grid-template-columns: 1fr; text-align: center; }
.pk-idle { text-align: center; animation: pk-fade .4s ease; }
.pk-scanner { width: 340px; height: 210px; margin: 0 auto 34px; position: relative; border-radius: 22px;
  background: rgba(255,255,255,.05); border: 2px solid rgba(255,255,255,.12); box-shadow: 0 20px 60px rgba(0,0,0,.35); overflow: hidden; }
.pk-bars { position: absolute; inset: 34px 40px; background: repeating-linear-gradient(90deg, #fff 0 4px, transparent 4px 7px, #fff 7px 9px, transparent 9px 14px, #fff 14px 20px, transparent 20px 23px); opacity: .85; border-radius: 4px; }
.pk-laser { position: absolute; left: 18px; right: 18px; height: 3px; top: 20px; background: #ff3b5c; box-shadow: 0 0 18px 4px rgba(255, 59, 92, .7); animation: pk-scan 2.2s ease-in-out infinite; }
.pk-idle h1 { font-size: 46px; font-weight: 800; margin: 0 0 10px; color: var(--pk-heading, #ffffff); }
.pk-idle .ur { font-size: 30px; opacity: .85; direction: rtl; font-family: 'Noto Nastaliq Urdu', 'Jameel Noori Nastaleeq', serif; }
.pk-idle p { font-size: 20px; opacity: .65; margin-top: 18px; }
.pk-card { width: min(1100px, 100%); display: grid; grid-template-columns: 300px 1fr; gap: 40px; align-items: center;
  background: rgba(255,255,255,.07); border: 1px solid rgba(255,255,255,.14); border-radius: 32px; padding: 40px 48px;
  box-shadow: 0 30px 80px rgba(0,0,0,.45); backdrop-filter: blur(10px); animation: pk-pop .35s cubic-bezier(.2,1.3,.4,1); position: relative; overflow: hidden; }
.pk-img { width: 300px; height: 300px; border-radius: 24px; background: #fff; display: flex; align-items: center; justify-content: center; overflow: hidden; }
.pk-img img { max-width: 100%; max-height: 100%; object-fit: contain; }
.pk-img .ph { font-size: 96px; font-weight: 800; color: #24357a; }
.pk-group { display: inline-block; padding: 5px 14px; border-radius: 999px; background: rgba(255,255,255,.12); font-size: 15px; margin-bottom: 12px; }
.pk-name { font-size: 40px; font-weight: 800; line-height: 1.15; margin: 0 0 6px; color: var(--pk-heading, #ffffff); }
.pk-code { font-size: 17px; opacity: .65; margin-bottom: 22px; letter-spacing: .5px; }
.pk-price-row { display: flex; align-items: flex-end; gap: 26px; flex-wrap: wrap; }
.pk-price { font-size: 92px; font-weight: 900; line-height: 1; color: var(--pk-price, #6dffb4); text-shadow: 0 6px 30px rgba(109,255,180,.25); }
.pk-price small { font-size: 26px; font-weight: 600; color: #c9ffe3; margin-left: 6px; }
.pk-mrp { font-size: 30px; opacity: .75; padding-bottom: 10px; }
.pk-mrp s { text-decoration-thickness: 3px; text-decoration-color: #ff5d73; }
.pk-save { margin-top: 18px; display: inline-flex; align-items: center; gap: 10px; background: var(--pk-accent, #ffb703);
  color: #1b1200; font-weight: 800; font-size: 24px; padding: 10px 20px; border-radius: 14px; }
.pk-weight { margin-top: 16px; font-size: 22px; background: rgba(255,255,255,.08); border-radius: 14px; padding: 12px 18px; display: inline-block; }
.pk-weight b { color: #6dffb4; font-size: 30px; }
.pk-uoms { margin-top: 18px; display: flex; gap: 12px; flex-wrap: wrap; }
.pk-uoms span { background: rgba(255,255,255,.1); border-radius: 12px; padding: 8px 14px; font-size: 18px; }
.pk-offer { margin-top: 18px; padding: 14px 18px; border-radius: 16px; background: color-mix(in srgb, var(--pk-offer, #ff3b5c) 22%, transparent);
  border: 1px solid color-mix(in srgb, var(--pk-offer, #ff3b5c) 55%, transparent); font-size: 20px; }
.pk-offer b { color: #ff9fb0; }
.pk-timer { position: absolute; left: 0; bottom: 0; height: 5px; background: linear-gradient(90deg, #6dffb4, #4cc9f0); animation: pk-timer linear forwards; }
.pk-miss { text-align: center; background: rgba(255, 93, 115, .12); border: 1px solid rgba(255,93,115,.45); border-radius: 32px; padding: 50px 70px; animation: pk-shake .45s; }
.pk-miss h2 { font-size: 44px; font-weight: 800; margin: 10px 0; }
.pk-miss p { font-size: 22px; opacity: .8; }
.pk-list { width: min(1100px, 100%); display: grid; grid-template-columns: repeat(auto-fill, minmax(330px, 1fr)); gap: 16px; animation: pk-fade .3s; }
.pk-list button { all: unset; cursor: pointer; background: rgba(255,255,255,.07); border: 1px solid rgba(255,255,255,.14); border-radius: 18px; padding: 18px 22px; }
.pk-list button:hover, .pk-list button:focus { background: rgba(255,255,255,.14); }
.pk-list .nm { font-size: 20px; font-weight: 700; } .pk-list .pr { font-size: 26px; font-weight: 800; color: #6dffb4; margin-top: 6px; }
.pk-bottom { flex: none; padding: 22px 32px; display: flex; gap: 16px; align-items: center; }
.pk-input { flex: 1; font-size: 24px; padding: 16px 22px; border-radius: 18px; border: 2px solid rgba(255,255,255,.18); background: rgba(0,0,0,.25); color: #fff; outline: none; }
.pk-input:focus { border-color: #4cc9f0; }
.pk-input::placeholder { color: rgba(255,255,255,.45); }
.pk-meta { font-size: 14px; opacity: .55; white-space: nowrap; }
.pk-settings { position: absolute; top: 80px; right: 32px; width: 380px; background: #151b33; border: 1px solid rgba(255,255,255,.15); border-radius: 20px; padding: 22px; z-index: 5; box-shadow: 0 20px 60px rgba(0,0,0,.5); }
.pk-settings h3 { margin: 0 0 14px; font-size: 20px; }
.pk-settings label { display: block; font-size: 14px; opacity: .7; margin: 10px 0 6px; }
.pk-settings select, .pk-settings .btn2 { width: 100%; font-size: 16px; padding: 10px 12px; border-radius: 12px; border: 1px solid rgba(255,255,255,.2); background: #0b1020; color: #fff; }
.pk-settings .btn2 { cursor: pointer; margin-top: 10px; text-align: center; background: #24357a; }
.pk-settings .btn2.alt { background: transparent; }
.pk-setup { text-align: center; } .pk-setup h1 { font-size: 34px; } .pk-setup select { font-size: 20px; padding: 12px; border-radius: 12px; min-width: 360px; }
.pk-setup .btn2 { display: inline-block; margin-top: 16px; padding: 12px 30px; font-size: 20px; border-radius: 12px; background: #4cc9f0; color: #06121f; font-weight: 700; cursor: pointer; }
.pk-progress { width: 420px; height: 10px; border-radius: 10px; background: rgba(255,255,255,.12); overflow: hidden; margin: 22px auto 0; }
.pk-progress div { height: 100%; width: 40%; background: #4cc9f0; animation: pk-indet 1.2s ease-in-out infinite; }
@keyframes pk-scan { 0%,100% { top: 10%; } 50% { top: 88%; } }
@keyframes pk-fade { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
@keyframes pk-pop { from { opacity: 0; transform: scale(.94); } to { opacity: 1; transform: none; } }
@keyframes pk-shake { 0%,100% { transform: none; } 25% { transform: translateX(-10px); } 75% { transform: translateX(10px); } }
@keyframes pk-timer { from { width: 100%; } to { width: 0; } }
@keyframes pk-indet { 0% { margin-left: -40%; } 100% { margin-left: 100%; } }
@keyframes pk-fade-in { from { opacity: 0; } to { opacity: 1; } }
@keyframes pk-pulse { 0%,100% { box-shadow: 0 0 0 0 rgba(255,255,255,.35); } 50% { box-shadow: 0 0 0 12px rgba(255,255,255,0); } }
@keyframes pk-ticker { from { transform: translateX(0); } to { transform: translateX(-50%); } }
@media (max-width: 900px) {
  .pk-card { grid-template-columns: 1fr; padding: 26px; gap: 20px; } .pk-img { width: 100%; height: 200px; }
  .pk-price { font-size: 64px; } .pk-name { font-size: 28px; } .pk-idle h1 { font-size: 32px; } .pk-scanner { width: 260px; height: 160px; }
}
@media (max-width: 600px) {
  .pk-top { padding: 12px 16px; gap: 8px; } .pk-store { font-size: 18px; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; } .pk-store small { display: none; } .pk-topright { gap: 8px; font-size: 14px; }
  .pk-body { padding: 0 16px; } .pk-stage { overflow-y: auto; align-items: flex-start; }
  .pk-has-left .pk-left, .pk-has-right .pk-right { display: none; } .pk-ticker { height: 40px; font-size: 18px; }
  .pk-card { padding: 18px; gap: 14px; border-radius: 22px; } .pk-img { height: 150px; border-radius: 16px; } .pk-img .ph { font-size: 64px; }
  .pk-name { font-size: 22px; } .pk-code { margin-bottom: 12px; font-size: 14px; }
  .pk-price-row { gap: 12px; } .pk-price { font-size: 46px; } .pk-price small { font-size: 18px; } .pk-mrp { font-size: 20px; padding-bottom: 4px; }
  .pk-save { font-size: 18px; padding: 8px 14px; } .pk-offer { font-size: 16px; }
  .pk-idle { margin: auto; } .pk-idle h1 { font-size: 24px; } .pk-idle .ur { font-size: 20px; } .pk-idle p { font-size: 15px; }
  .pk-scanner { width: 220px; height: 130px; margin-bottom: 20px; }
  .pk-bottom { padding: 12px 16px; } .pk-input { font-size: 16px; padding: 12px 14px; min-width: 0; } .pk-meta { display: none; }
  .pk-settings { left: 16px; right: 16px; width: auto; top: 64px; } .pk-setup select { min-width: 0; width: 100%; } .pk-progress { width: 100%; }
}
`;

const STORE_KEY = "posa_price_kiosk_profile";
const RESULT_SECONDS = 20;
const SYNC_MINUTES = 5;
const KIOSK_ROLE = "Price Checker";
const FULL_ROLES = ["Administrator", "System Manager", "Sales User", "Sales Manager", "Accounts User", "Accounts Manager", "Stock User", "Stock Manager"];

// A user whose only job is this screen (role "Price Checker" and no POS or
// desk role): the desk always routes back here and settings offer log out.
export function kioskOnly() {
	const roles = (window.frappe && (frappe.user_roles || (frappe.boot && frappe.boot.user && frappe.boot.user.roles))) || [];
	return roles.includes(KIOSK_ROLE) && !roles.some((r) => FULL_ROLES.includes(r));
}

const esc = (s) =>
	String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const n = (v) => Number(v) || 0;

function money(v, currency) {
	const sym =
		(typeof get_currency_symbol === "function" && currency && get_currency_symbol(currency)) ||
		(currency === "PKR" ? "Rs" : currency || "");
	const abs = Math.abs(n(v));
	const s = Number.isInteger(Math.round(abs * 100) / 100) ? String(Math.round(abs)) : abs.toFixed(2);
	const [i, d] = s.split(".");
	return `${sym ? sym + " " : ""}${n(v) < 0 ? "-" : ""}${i.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}${d ? "." + d : ""}`;
}

function readStored() {
	try {
		return JSON.parse(localStorage.getItem(STORE_KEY) || "null");
	} catch (e) {
		return null;
	}
}

function store(value) {
	try {
		localStorage.setItem(STORE_KEY, JSON.stringify(value));
	} catch (e) {
		/* private window: the setting lasts for this visit */
	}
}

export class PriceKiosk {
	constructor(wrapper) {
		this.wrapper = wrapper;
		this.timer = null;
		this.profile = null;
		this.offers = [];
		this.mode = "";
		this.render();
		this.signage = new KioskSignage(this);
		this.boot();
	}

	// ----- setup ---------------------------------------------------------

	render() {
		if (!document.getElementById("pk-style")) {
			const st = document.createElement("style");
			st.id = "pk-style";
			st.textContent = CSS;
			document.head.appendChild(st);
		}
		this.root = document.createElement("div");
		this.root.className = "pk-root";
		this.root.innerHTML = `
      <div class="pk-top">
        <div class="pk-brand"><img class="pk-logo" alt="" style="display:none">
          <div class="pk-store" title="${esc(__("Hold for 2 seconds for settings"))}">${esc(__("Price Checker"))}<small></small></div></div>
        <div class="pk-topright"><span class="pk-net">${esc(__("Online"))}</span><span class="pk-clock"></span></div>
      </div>
      <div class="pk-body">
        <aside class="pk-left"></aside>
        <div class="pk-centre"><div class="pk-media"></div><div class="pk-stage"></div><div class="pk-hint"></div></div>
        <aside class="pk-right"></aside>
      </div>
      <div class="pk-bottom">
        <input class="pk-input" autocomplete="off" placeholder="${esc(__("Scan a barcode, or type a product name"))}">
        <span class="pk-meta"></span>
      </div>
      <div class="pk-ticker"></div>`;
		const host = this.wrapper.querySelector ? this.wrapper.querySelector(".layout-main-section") : null;
		(host || this.wrapper).appendChild(this.root);
		this.$ = (sel) => this.root.querySelector(sel);
		this.stage = this.$(".pk-stage");
		this.input = this.$(".pk-input");

		// Scanners type fast and end with Enter; keep the box focused.
		this.input.addEventListener("keydown", (e) => {
			if (e.key === "Enter") {
				e.preventDefault();
				const v = this.input.value.trim();
				this.input.value = "";
				if (v) this.lookup(v);
			} else if (e.key === "Escape") {
				this.input.value = "";
				this.showIdle();
			}
		});
		this.input.addEventListener("input", () => {
			clearTimeout(this.typing);
			const v = this.input.value.trim();
			if (v.length >= 3 && !/^\d+$/.test(v)) this.typing = setTimeout(() => this.search(v), 350);
		});
		document.addEventListener("keydown", (e) => {
			if (!this.root.isConnected || this.root.offsetParent === null) return;
			if (e.target.tagName !== "INPUT" && e.target.tagName !== "SELECT" && !e.ctrlKey && !e.altKey) this.input.focus();
		});
		this.root.addEventListener("click", (e) => {
			if (!e.target.closest("select, button, input, .pk-settings")) this.input.focus();
		});
		const interacted = () => (this.userInteracted = true);
		["pointerdown", "keydown", "touchstart"].forEach((ev) => this.root.addEventListener(ev, interacted, { once: true, passive: true }));

		// Long press on the store name opens settings.
		const storeEl = this.$(".pk-store");
		const start = () => (this.press = setTimeout(() => this.openSettings(), 2000));
		const stop = () => clearTimeout(this.press);
		storeEl.addEventListener("mousedown", start);
		storeEl.addEventListener("touchstart", start, { passive: true });
		["mouseup", "mouseleave", "touchend"].forEach((ev) => storeEl.addEventListener(ev, stop));

		const tick = () => {
			const now = new Date();
			const date = now.toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" });
			const time = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
			this.$(".pk-clock").textContent = this.root.classList.contains("pk-signage") ? `${date} · ${time}` : time;
		};
		this.tickClock = tick;
		tick();
		setInterval(tick, 15000);

		startConnectivityMonitor();
		const net = () => {
			const el = this.$(".pk-net");
			const down = !network.isOnline;
			el.classList.toggle("off", down);
			el.textContent = down ? __("Offline") : __("Online");
		};
		net();
		onConnectivityChange((online) => {
			net();
			if (online) {
				this.sync();
				if (this.signage) this.signage.refresh();
			}
		});
	}

	boot() {
		const saved = readStored();
		if (!saved || !saved.name) return this.showSetup();
		this.start(saved.name);
	}

	// Load the catalogue kept on this screen, then bring it up to date.
	async start(name) {
		this.profileName = name;
		this.showLoading();
		try {
			await catalog.open(name);
			if (!catalog.loaded) await catalog.load(name);
		} catch (e) {
			console.error(e);
		}
		this.applyBootstrap();
		const ready = !!catalog.getMeta("last_full_sync");
		if (ready) this.showIdle();
		if (!this.timerSync) {
			this.timerSync = setInterval(() => this.sync(), SYNC_MINUTES * 60000);
			// live updates: ERPNext announces changed items / prices / offers
			if (frappe.realtime && frappe.realtime.on) {
				frappe.realtime.on("posa_catalog_changed", () => {
					clearTimeout(this.liveTimer);
					this.liveTimer = setTimeout(() => this.sync(), 3000);
				});
			}
		}
		// what is shown around the price (POS Kiosk Display); kept for offline
		this.signage.start(name);
		// first visit: wait for the download; later the cache is used at once
		if (ready) this.sync();
		else await this.sync();
		if (!catalog.getMeta("last_full_sync")) this.showMessage(__("The product list could not be downloaded"), __("Connect to the server once; after that this screen also works offline."));
		else if (!ready) this.showIdle();
	}

	applyBootstrap() {
		const boot = catalog.getMeta("bootstrap") || {};
		if (boot.pos_profile) {
			this.profile = boot.pos_profile;
			catalog.setProfile(boot.pos_profile);
		}
		this.offers = boot.offers || [];
		const company = boot.company || {};
		const title = company.company_name || company.name || (this.profile && this.profile.company) || __("Price Checker");
		this.$(".pk-store").firstChild.textContent = title;
		this.$(".pk-store small").textContent = __("Scan & check the price");
		this.$(".pk-meta").textContent = catalog.byCode.size ? __("{0} products", [catalog.byCode.size.toLocaleString()]) : "";
		if (this.signage && this.signage.display) this.signage.topBar();
		if (this.signage) this.signage.apply(false); // offers / prices changed: sidebars follow
	}

	async sync() {
		if (!this.profileName || !network.isOnline) return;
		if (this.syncing) return this.syncing;
		this.syncing = (async () => {
			try {
				let profile = this.profile;
				if (!profile || !profile.selling_price_list) {
					profile = await serverCall("frappe.client.get", { doctype: "POS Profile", name: this.profileName });
				}
				await syncCatalog(profile, { includeStock: false, includeCustomers: false });
				this.applyBootstrap();
			} catch (e) {
				console.warn("[price checker] sync failed", e);
			}
		})().finally(() => (this.syncing = null));
		return this.syncing;
	}

	// ----- lookup ----------------------------------------------------------

	lookup(code) {
		code = String(code).trim();
		const hit = catalog.lookupCode(code);
		if (hit) return this.showItem(hit.item, { uom: hit.uom, code, qty: hit.match === "scale" ? hit.qty : null, amount: hit.amount });
		const found = catalog.search(code, { limit: 2 });
		if (found.length === 1) return this.showItem(found[0], {});
		if (found.length > 1) return this.search(code);
		return this.showMiss(code);
	}

	search(text) {
		const found = catalog.search(text, { limit: 9 });
		if (!found.length) return;
		this.stage.innerHTML = `<div class="pk-list">${found
			.map((it, i) => {
				const p = this.priceFor(it);
				return `<button data-i="${i}"><div class="nm">${esc(it.item_name)}</div><div class="pr">${esc(money(p.rate, p.currency))}</div></button>`;
			})
			.join("")}</div>`;
		this.setMode("list");
		this.stage.querySelectorAll("button").forEach((b) =>
			b.addEventListener("click", () => {
				this.input.value = "";
				this.showItem(found[Number(b.dataset.i)], {});
			})
		);
		this.autoIdle();
	}

	priceFor(item, uom) {
		const p = this.profile || {};
		const want = uom || item.stock_uom;
		const sell = catalog.getPrice(item.item_code, { priceList: p.selling_price_list, uom: want, currency: p.currency });
		const mrp = p.posa_mrp_price_list ? catalog.getPrice(item.item_code, { priceList: p.posa_mrp_price_list, uom: want }) : null;
		const others = Object.values(catalog.uomPrices(item.item_code, p.selling_price_list) || {})
			.filter((o) => o.uom !== want && o.uom !== "None")
			.map((o) => ({ uom: o.uom, rate: n(o.price_list_rate) }));
		return {
			rate: sell ? n(sell.price_list_rate) : 0,
			mrp: mrp ? n(mrp.price_list_rate) : 0,
			uom: want,
			currency: (sell && sell.currency) || p.currency,
			others,
		};
	}

	offersFor(item, limit = 2) {
		// an offer can list several item codes, groups or brands
		return this.offersToday()
			.filter((o) => offerMatchesItem(o, item))
			.slice(0, limit);
	}

	// ----- for the kiosk display (kiosk_signage.js) ------------------------

	/** Running offers today (local date of the screen), loyalty points left out. */
	offersToday() {
		const today = localDate();
		return (this.offers || []).filter(
			(o) =>
				o &&
				!Number(o.disable) &&
				o.offer !== "Loyalty Point" &&
				!(o.valid_from && String(o.valid_from).slice(0, 10) > today) &&
				!(o.valid_upto && String(o.valid_upto).slice(0, 10) < today)
		);
	}

	offersVersion() {
		return localDate() + ":" + (this.offers || []).map((o) => o.name + (o.modified || "")).join(",") + ":" + catalog.version;
	}

	offerByName(name) {
		return (this.offers || []).find((o) => o.name === name) || null;
	}

	itemFor(code) {
		return code ? catalog.getItem(code) : null;
	}

	/** Items named by running Item Code offers (the default "Featured" list). */
	offerItems(limit = 8) {
		const out = [];
		const seen = new Set();
		for (const o of this.offersToday()) {
			if (o.apply_on !== "Item Code") continue;
			for (const code of offerTargets(o)) {
				if (seen.has(code)) continue;
				seen.add(code);
				const it = catalog.getItem(code);
				if (it && this.priceFor(it).rate) out.push(it);
				if (out.length >= limit) return out;
			}
		}
		return out;
	}

	/** Other priced items of the scanned item's group, by name. */
	sameGroupItems(item, limit = 8) {
		if (!item || !item.item_group) return [];
		const out = [];
		for (const it of catalog.byCode.values()) {
			if (it.item_group !== item.item_group || it.item_code === item.item_code || it.has_variants) continue;
			out.push(it);
			if (out.length >= limit * 4) break;
		}
		return out
			.filter((it) => this.priceFor(it).rate)
			.sort((a, b) => String(a.item_name).localeCompare(String(b.item_name)))
			.slice(0, limit);
	}

	money(v, currency) {
		return money(v, currency);
	}

	formatDate(d) {
		try {
			return frappe.datetime && frappe.datetime.str_to_user ? frappe.datetime.str_to_user(d) : d;
		} catch (e) {
			return d;
		}
	}

	setMode(mode) {
		this.mode = mode;
		const attract = mode === "idle" && this.signage && this.signage.hasCentreMedia();
		this.root.classList.toggle("pk-attract", !!attract);
		if (this.signage) {
			if (attract) this.signage.resumeCentre();
			else this.signage.pauseCentre();
		}
		return attract;
	}

	seconds(key, fallback) {
		const v = this.signage ? Number(this.signage.setting(key)) : 0;
		return v > 0 ? v : fallback;
	}

	onDisplayChange() {
		if (this.tickClock) this.tickClock();
		if (this.mode === "idle") this.showIdle();
	}


	offerText(o) {
		let what = "";
		if (o.discount_type === "Discount Percentage" && n(o.discount_percentage)) what = __("{0}% off", [n(o.discount_percentage)]);
		else if (o.discount_type === "Discount Amount" && n(o.discount_amount)) what = __("{0} off", [money(o.discount_amount)]);
		else if (o.discount_type === "Rate" && n(o.rate)) what = __("Special price {0}", [money(o.rate)]);
		else if (o.give_item || o.replace_item) what = __("Free item");
		let min = n(o.min_qty) > 1 ? " " + __("on buying {0} or more", [n(o.min_qty)]) : "";
		if (o.offer === "Give Product" && n(o.is_recursive) && n(o.min_qty) > 0) {
			const g = n(o.given_qty) || 1, m = n(o.min_qty);
			what = __("Buy {0} get {1} free, buy {2} get {3} ...", [m, g, m * 2, g * 2]);
			min = "";
		}
		return `<b>${esc(o.title || o.name)}</b>${what ? " &middot; " + esc(what + min) : ""}${
			o.description ? `<div style="font-size:16px;opacity:.8;margin-top:4px">${esc(String(o.description).replace(/<[^>]+>/g, ""))}</div>` : ""
		}`;
	}

	// ----- screens ---------------------------------------------------------

	showItem(item, { uom, qty, amount, code }) {
		const p = this.priceFor(item, uom);
		const save = p.mrp > p.rate ? p.mrp - p.rate : 0;
		const pct = save && p.mrp ? Math.round((save / p.mrp) * 100) : 0;
		const initials = (item.item_name || item.item_code).trim().slice(0, 1).toUpperCase();
		const barcode = code || ((item.item_barcode || [])[0] || {}).barcode || item.item_code;
		const offers = this.offersFor(item);
		// scale label: weight printed (qty) or amount printed (qty = amount / rate)
		let weight = qty ? n(qty) : null;
		if (!weight && amount && p.rate) weight = n(amount) / p.rate;
		const img = item.image
			? `<img src="${esc(item.image)}" alt="" onerror="this.parentNode.innerHTML='<div class=&quot;ph&quot;>${esc(initials)}</div>'">`
			: `<div class="ph">${esc(initials)}</div>`;
		this.stage.innerHTML = `
      <div class="pk-card">
        <div class="pk-img">${img}</div>
        <div>
          ${item.item_group ? `<span class="pk-group">${esc(item.item_group)}</span>` : ""}
          <h2 class="pk-name">${esc(item.item_name || item.item_code)}</h2>
          <div class="pk-code">${esc(barcode)}</div>
          ${
				p.rate
					? `
          <div class="pk-price-row">
            <div class="pk-price">${esc(money(p.rate, p.currency))}<small>/ ${esc(p.uom || "")}</small></div>
            ${
				p.mrp > p.rate
					? `<div class="pk-mrp">${esc(__("MRP"))} <s>${esc(money(p.mrp, p.currency))}</s></div>`
					: p.mrp
					? `<div class="pk-mrp">${esc(__("MRP"))} ${esc(money(p.mrp, p.currency))}</div>`
					: ""
			}
          </div>`
					: `<div class="pk-mrp">${esc(__("Price not set. Please ask at the counter."))}</div>`
			}
          ${
				weight
					? `<div class="pk-weight">${esc(__("Weight"))} ${weight.toFixed(3)} ${esc(p.uom || "Kg")} &nbsp;&rarr;&nbsp; <b>${esc(
							money(amount || weight * p.rate, p.currency)
					  )}</b></div>`
					: ""
			}
          ${save ? `<div><span class="pk-save">${esc(__("You save {0}", [money(save, p.currency)]))}${pct ? ` (${pct}%)` : ""}</span></div>` : ""}
          ${
				p.others.length
					? `<div class="pk-uoms">${p.others.map((o) => `<span>${esc(o.uom)}: <b>${esc(money(o.rate, p.currency))}</b></span>`).join("")}</div>`
					: ""
			}
          ${offers.map((o) => `<div class="pk-offer">&#127873; ${this.offerText(o)}</div>`).join("")}
        </div>
        <div class="pk-timer" style="animation-duration:${this.seconds("result_seconds", RESULT_SECONDS)}s"></div>
      </div>`;
		this.setMode("item");
		if (this.signage) this.signage.onScan(item);
		this.beep(true);
		this.autoIdle(this.seconds("result_seconds", RESULT_SECONDS));
	}

	showMiss(code) {
		this.stage.innerHTML = `
      <div class="pk-miss">
        <div style="font-size:64px">&#128269;</div>
        <h2>${esc(__("Product not found"))}</h2>
        <p>${esc(code)}</p>
        <p>${esc(__("Please ask a staff member for help."))}</p>
      </div>`;
		this.setMode("miss");
		this.beep(false);
		this.autoIdle(this.seconds("not_found_seconds", 8));
	}

	showIdle() {
		clearTimeout(this.timer);
		if (this.signage) this.signage.onIdle();
		// a kiosk display with centre slides: the attract loop plays
		if (this.setMode("idle")) {
			this.stage.innerHTML = "";
			this.input.focus();
			return;
		}
		const text = (key) => (this.signage ? this.signage.setting(key) : "") || "";
		const title = text("idle_title") || "Scan a product to see its price";
		const second = text("idle_subtitle");
		const hint = text("idle_hint");
		this.stage.innerHTML = `
      <div class="pk-idle">
        <div class="pk-scanner"><div class="pk-bars"></div><div class="pk-laser"></div></div>
        <h1>${esc(__(title))}</h1>
        ${second ? `<div class="ur">${esc(second)}</div>` : ""}
        ${hint ? `<p>${esc(__(hint))}</p>` : ""}
      </div>`;
		this.input.focus();
	}

	showLoading() {
		this.setMode("loading");
		this.stage.innerHTML = `
      <div class="pk-idle">
        <h1>${esc(__("Getting prices ready..."))}</h1>
        <p>${esc(__("The product list is downloaded once; after that this screen also works offline."))}</p>
        <div class="pk-progress"><div></div></div>
      </div>`;
	}

	showMessage(title, text) {
		this.setMode("message");
		this.stage.innerHTML = `<div class="pk-idle"><h1>${esc(title)}</h1><p>${esc(text || "")}</p></div>`;
	}

	async showSetup() {
		this.setMode("setup");
		this.stage.innerHTML = `
      <div class="pk-setup">
        <h1>${esc(__("Set up the price checker"))}</h1>
        <p style="opacity:.7;font-size:18px">${esc(__("Choose the POS Profile whose prices this screen shows."))}</p>
        <select class="pk-prof"><option>${esc(__("Loading..."))}</option></select><br>
        <span class="btn2">${esc(__("Start"))}</span>
      </div>`;
		const sel = this.stage.querySelector(".pk-prof");
		const names = await this.profileNames();
		sel.innerHTML =
			names.map((nm) => `<option>${esc(nm)}</option>`).join("") || `<option value="">${esc(__("No POS Profile (server needed)"))}</option>`;
		this.stage.querySelector(".btn2").addEventListener("click", () => {
			if (!sel.value) return;
			store({ name: sel.value });
			this.start(sel.value);
		});
	}

	async profileNames() {
		if (!network.isOnline) return [];
		try {
			const rows = await serverCall("frappe.client.get_list", {
				doctype: "POS Profile",
				filters: { disabled: 0 },
				fields: ["name"],
				limit_page_length: 100,
			});
			return (rows || []).map((x) => x.name);
		} catch (e) {
			return [];
		}
	}

	async openSettings() {
		if (this.$(".pk-settings")) return;
		const box = document.createElement("div");
		box.className = "pk-settings";
		const names = await this.profileNames();
		const cur = this.profileName || "";
		if (cur && !names.includes(cur)) names.unshift(cur);
		box.innerHTML = `
      <h3>${esc(__("Price checker settings"))}</h3>
      <label>${esc(__("POS Profile"))}</label>
      <select>${names.map((nm) => `<option ${nm === cur ? "selected" : ""}>${esc(nm)}</option>`).join("")}</select>
      ${this.displayInfoHtml()}
      <div class="btn2 save">${esc(__("Save"))}</div>
      <div class="btn2 alt full">${esc(__("Full screen on / off"))}</div>
      <div class="btn2 alt sync">${esc(__("Update prices now"))}</div>
      ${kioskOnly() ? `<div class="btn2 alt logout">${esc(__("Log out"))}</div>` : `<div class="btn2 alt exit">${esc(__("Exit to desk"))}</div>`}
      <div class="btn2 alt close">${esc(__("Close"))}</div>`;
		this.root.appendChild(box);
		const close = () => box.remove();
		box.querySelector(".close").onclick = close;
		box.querySelector(".save").onclick = () => {
			const nm = box.querySelector("select").value;
			close();
			if (nm && nm !== cur) {
				store({ name: nm });
				this.profile = null;
				this.start(nm);
			}
		};
		box.querySelector(".full").onclick = () => {
			if (document.fullscreenElement) document.exitFullscreen();
			else if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen();
		};
		box.querySelector(".sync").onclick = async () => {
			close();
			await this.sync();
			if (this.signage) await this.signage.refresh();
			this.showIdle();
		};
		const devName = box.querySelector(".pk-devname");
		if (devName)
			devName.addEventListener("change", () => {
				if (this.signage) this.signage.renameDevice(devName.value);
			});
		const logout = box.querySelector(".logout");
		if (logout) logout.onclick = () => frappe.app.logout();
		const exit = box.querySelector(".exit");
		if (exit)
			exit.onclick = () => {
				close();
				if (document.fullscreenElement) document.exitFullscreen();
				frappe.set_route("");
			};
	}

	displayInfoHtml() {
		if (!this.signage) return "";
		const i = this.signage.info();
		const mb = (i.media.bytes / 1048576).toFixed(1);
		return `
      <label>${esc(__("Display"))}</label>
      <div style="font-size:15px">${esc(i.display || __("None (standard screen)"))}${
			i.displays > 1 ? ` <span style="opacity:.6">(${esc(__("{0} scheduled", [i.displays]))})</span>` : ""
		}</div>
      <div style="font-size:13px;opacity:.6;margin-top:4px">${
			i.mediaSupported ? esc(__("{0} images / videos kept on this screen ({1} MB)", [i.media.count, mb])) : esc(__("Media are not kept offline (needs https)"))
		}</div>
      <label>${esc(__("Screen name"))}</label>
      <input class="pk-devname" style="width:100%;font-size:16px;padding:10px 12px;border-radius:12px;border:1px solid rgba(255,255,255,.2);background:#0b1020;color:#fff" value="${esc(
			i.device
		)}" placeholder="${esc(__("e.g. Entrance, Aisle 4"))}">
      <div style="font-size:12px;opacity:.5;margin-top:4px">${esc(__("Device"))} ${esc(String(i.deviceId).slice(0, 8))}</div>`;
	}

	// Back on the page after visiting another desk page.
	show() {
		if (this.profileName && catalog.profileName !== this.profileName) this.start(this.profileName);
		if (this.input) this.input.focus();
	}

	autoIdle(seconds = RESULT_SECONDS) {
		clearTimeout(this.timer);
		this.timer = setTimeout(() => this.showIdle(), seconds * 1000);
		this.input.focus();
	}

	beep(ok) {
		try {
			const ctx = this.audio || (this.audio = new (window.AudioContext || window.webkitAudioContext)());
			const o = ctx.createOscillator();
			const g = ctx.createGain();
			o.frequency.value = ok ? 1200 : 300;
			g.gain.value = 0.08;
			o.connect(g);
			g.connect(ctx.destination);
			o.start();
			o.stop(ctx.currentTime + (ok ? 0.08 : 0.25));
		} catch (e) {
			// no sound
		}
	}
}

frappe.provide("frappe");
frappe.PosaPriceKiosk = PriceKiosk;

// Keep a price-checker-only user on this screen.
function lockToKiosk() {
	if (!kioskOnly() || !frappe.get_route) return;
	const route = frappe.get_route() || [];
	if (route[0] !== "price_kiosk") frappe.set_route("price_kiosk");
}
if (window.frappe && frappe.router && frappe.router.on) frappe.router.on("change", lockToKiosk);
