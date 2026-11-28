{% include "posawesome/posawesome/page/pos_guide/guide_content.js" %}

// POS G2Virtu Guide: the user guide inside the desk (no Wiki app needed),
// laid out like the ERPNext documentation: a folding sidebar, the article,
// "On this page" on the right, search with Ctrl+K.
// /desk/pos_guide            home
// /desk/pos_guide/<article>  one article
frappe.pages["pos_guide"].on_page_load = function (wrapper) {
	const page = frappe.ui.make_app_page({ parent: wrapper, title: __("POS G2Virtu Guide"), single_column: true });
	const esc = (v) => frappe.utils.escape_html(v == null ? "" : String(v));
	// **bold**, `code`
	const md = (s) =>
		esc(__(s))
			.replace(/\*\*(.+?)\*\*/g, "<b>$1</b>")
			.replace(/`([^`]+)`/g, "<code>$1</code>");
	const ROLES = POSA_GUIDE_ROLES;
	const SECTIONS = POSA_GUIDE_SECTIONS;
	const ARTICLES = POSA_GUIDE;
	const byId = {};
	ARTICLES.forEach((a) => (byId[a.id] = a));
	const ROLE_KEY = "posa_guide_role";
	let role = "";
	try {
		role = localStorage.getItem(ROLE_KEY) || "";
	} catch (e) {
		role = "";
	}
	const openSections = new Set();
	let current = null;

	const ICON = {
		chevron: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg>',
		search: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
		copy: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>',
		print: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M6 9V3h12v6"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M7 14h10v7H7z"/></svg>',
	};

	page.add_menu_item(__("Guide Home"), () => go(null));
	page.add_menu_item(__("Print"), () => window.print());

	const $root = $(`<div class="pgd">
		<div class="pgd-top">
			<div class="pgd-search-wrap">
				<span class="pgd-search-ico">${ICON.search}</span>
				<input class="pgd-search" type="search" autocomplete="off" placeholder="${esc(__("Search documentation"))}" aria-label="${esc(__("Search documentation"))}" role="combobox" aria-expanded="false" aria-controls="pgd-results">
				<kbd class="pgd-kbd">Ctrl K</kbd>
				<div class="pgd-results" id="pgd-results" role="listbox" hidden></div>
			</div>
		</div>
		<div class="pgd-grid">
			<aside class="pgd-side">
				<label class="pgd-role"><span>${esc(__("Show for"))}</span><select class="form-control input-sm pgd-role-select"></select></label>
				<nav class="pgd-nav" aria-label="${esc(__("Guide contents"))}"></nav>
			</aside>
			<main class="pgd-main" tabindex="-1"></main>
			<aside class="pgd-toc" aria-label="${esc(__("On this page"))}"></aside>
		</div>
	</div>`).appendTo(page.body);
	$(`<style>
	.pgd{--pgd-muted:var(--text-muted);--pgd-line:var(--border-color);--pgd-hover:var(--fg-hover-color);font-size:15px}
	.pgd-top{display:flex;justify-content:center;padding:6px 0 14px;border-bottom:1px solid var(--pgd-line);margin-bottom:18px}
	.pgd-search-wrap{position:relative;width:min(540px,100%)}
	.pgd-search{width:100%;height:40px;border-radius:10px;border:1px solid transparent;background:var(--control-bg, var(--pgd-hover));padding:0 70px 0 38px;font-size:15px;color:var(--text-color);outline:none}
	.pgd-search:focus{border-color:var(--primary);background:var(--bg-color)}
	.pgd-search-ico{position:absolute;left:12px;top:12px;color:var(--pgd-muted)}
	.pgd-kbd{position:absolute;right:10px;top:10px;font-size:11.5px;color:var(--pgd-muted);background:transparent;border:0;font-family:inherit}
	.pgd-results{position:absolute;z-index:20;left:0;right:0;top:46px;background:var(--bg-color);border:1px solid var(--pgd-line);border-radius:10px;box-shadow:0 12px 32px rgba(0,0,0,.14);max-height:60vh;overflow:auto;padding:6px}
	.pgd-results a{display:block;padding:8px 10px;border-radius:8px;color:var(--text-color)}
	.pgd-results a:hover,.pgd-results a.on{background:var(--pgd-hover);text-decoration:none}
	.pgd-results small{display:block;color:var(--pgd-muted)}
	.pgd-results .pgd-none{padding:10px;color:var(--pgd-muted)}
	.pgd-grid{display:grid;grid-template-columns:280px minmax(0,1fr) 230px;gap:40px;align-items:start}
	.pgd-side{position:sticky;top:64px;max-height:calc(100vh - 80px);overflow:auto;padding:0 8px 24px 0;border-right:1px solid var(--pgd-line)}
	.pgd-role{display:flex;align-items:center;gap:8px;margin:0 6px 14px 6px;font-size:13px;color:var(--pgd-muted);font-weight:400}
	.pgd-role select{flex:1}
	.pgd-sec{margin:2px 0}
	.pgd-sec-btn{display:flex;align-items:center;gap:6px;width:100%;border:0;background:none;padding:7px 6px;font-size:15px;font-weight:500;color:var(--text-color);text-align:left;border-radius:8px;cursor:pointer}
	.pgd-sec-btn:hover{background:var(--pgd-hover)}
	.pgd-sec-btn svg{transition:transform .15s;color:var(--pgd-muted);flex:0 0 auto}
	.pgd-sec.open>.pgd-sec-btn svg{transform:rotate(90deg)}
	.pgd-sec-items{display:none;margin:2px 0 8px 14px;padding-left:10px;border-left:1px solid var(--pgd-line)}
	.pgd-sec.open>.pgd-sec-items{display:block}
	.pgd-sec-items a{display:block;padding:6px 10px;border-radius:8px;color:var(--text-color);font-size:14.5px;line-height:1.35;opacity:.86}
	.pgd-sec-items a:hover{background:var(--pgd-hover);text-decoration:none;opacity:1}
	.pgd-sec-items a.on{background:var(--pgd-hover);opacity:1;font-weight:500}
	.pgd-main{min-width:0;max-width:900px;outline:none;padding-bottom:60px}
	.pgd-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}
	.pgd-crumb{font-size:15px;color:var(--text-color);opacity:.85;margin:6px 0 4px}
	.pgd-crumb a{color:inherit}
	.pgd-actions{display:flex;gap:4px}
	.pgd-actions button{border:0;background:none;color:var(--pgd-muted);padding:6px;border-radius:8px;cursor:pointer}
	.pgd-actions button:hover{background:var(--pgd-hover);color:var(--text-color)}
	.pgd-main h1{font-size:30px;font-weight:600;margin:6px 0 14px;letter-spacing:-.01em}
	.pgd-who{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 16px}
	.pgd-pill{font-size:12.5px;border-radius:999px;padding:2px 10px;background:var(--pgd-hover);color:var(--text-color)}
	.pgd-rule{border:0;border-top:1px solid var(--pgd-line);margin:0 0 22px}
	.pgd-main h2{font-size:21px;font-weight:600;margin:30px 0 10px;scroll-margin-top:80px}
	.pgd-main p,.pgd-main li{font-size:16px;line-height:1.85;color:var(--text-color)}
	.pgd-main ul,.pgd-main ol{padding-left:24px;margin:6px 0}
	.pgd-main li{margin:4px 0}
	.pgd-main code{font-size:13.5px;padding:1px 5px;border-radius:5px;background:var(--pgd-hover)}
	.pgd-note{border-left:3px solid var(--primary);background:var(--pgd-hover);border-radius:0 10px 10px 0;padding:10px 16px;margin:10px 0}
	.pgd-q{font-weight:600;margin-top:14px;font-size:16px}
	.pgd-a{margin:2px 0 8px;font-size:16px;line-height:1.8}
	.pgd-links{display:flex;flex-wrap:wrap;gap:10px}
	.pgd-links a{border:1px solid var(--pgd-line);border-radius:10px;padding:7px 14px;font-size:14.5px;color:var(--text-color)}
	.pgd-links a:hover{border-color:var(--primary);text-decoration:none}
	.pgd-nextprev{display:flex;justify-content:space-between;gap:16px;margin-top:40px;border-top:1px solid var(--pgd-line);padding-top:18px}
	.pgd-nextprev a{max-width:48%;color:var(--text-color);font-size:15px}
	.pgd-nextprev small{display:block;color:var(--pgd-muted);font-size:12.5px}
	.pgd-cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:14px;margin:10px 0}
	.pgd-card{border:1px solid var(--pgd-line);border-radius:12px;padding:14px 16px;cursor:pointer;background:var(--card-bg, var(--bg-color))}
	.pgd-card:hover,.pgd-card:focus{border-color:var(--primary);outline:none}
	.pgd-card b{display:block;font-size:15.5px;margin:4px 0}
	.pgd-card span{font-size:13.5px;color:var(--pgd-muted)}
	.pgd-card .pgd-ico{font-size:22px}
	.pgd-toc{position:sticky;top:64px;font-size:14.5px}
	.pgd-toc h6{font-size:15px;font-weight:500;margin:0 0 10px;color:var(--text-color);text-transform:none;letter-spacing:0}
	.pgd-toc a{display:block;padding:6px 0 6px 14px;border-left:1px solid var(--pgd-line);color:var(--pgd-muted)}
	.pgd-toc a:hover{color:var(--text-color);text-decoration:none}
	.pgd-toc a.on{border-left:2px solid var(--text-color);color:var(--text-color);padding-left:13px}
	.pgd-empty{color:var(--pgd-muted);padding:10px 0}
	@media (max-width:1250px){.pgd-grid{grid-template-columns:260px minmax(0,1fr)}.pgd-toc{display:none}}
	@media (max-width:900px){.pgd-grid{grid-template-columns:1fr;gap:16px}.pgd-side{position:static;max-height:none;border-right:0;border-bottom:1px solid var(--pgd-line);padding-bottom:10px}}
	@media print{.pgd-top,.pgd-side,.pgd-toc,.pgd-actions,.pgd-nextprev,.pgd-links,.page-head,.navbar{display:none!important}.pgd-grid{display:block}.pgd-main{max-width:none}}
	</style>`).appendTo(page.body);

	const $nav = $root.find(".pgd-nav");
	const $main = $root.find(".pgd-main");
	const $toc = $root.find(".pgd-toc");
	const $search = $root.find(".pgd-search");
	const $results = $root.find(".pgd-results");

	const visible = (a) => !role || (a.roles || []).includes(role);
	const sectionOf = (a) => SECTIONS.find((s) => s.id === a.s) || { title: "", icon: "" };
	const plain = (a) =>
		[a.t, a.lead].concat(a.where || [], a.setup || [], a.use || [], a.tips || [], (a.handle || []).flat()).join(" ");

	// ---------------------------------------------------------------- sidebar
	function renderRoles() {
		const opts = [`<option value="">${esc(__("Everyone"))}</option>`].concat(
			ROLES.map((r) => `<option value="${r.id}" ${role === r.id ? "selected" : ""}>${esc(__(r.label))}</option>`)
		);
		$root.find(".pgd-role-select").html(opts.join("")).val(role);
	}

	function renderNav() {
		const html = SECTIONS.map((s) => {
			const items = ARTICLES.filter((a) => a.s === s.id && visible(a));
			if (!items.length) return "";
			const open = openSections.has(s.id);
			return `<div class="pgd-sec ${open ? "open" : ""}" data-sec="${s.id}">
				<button type="button" class="pgd-sec-btn" aria-expanded="${open}">${ICON.chevron}<span>${esc(__(s.title))}</span></button>
				<div class="pgd-sec-items">${items
					.map((a) => `<a href="/desk/pos_guide/${a.id}" data-id="${a.id}" class="${current === a.id ? "on" : ""}" ${current === a.id ? 'aria-current="page"' : ""}>${esc(__(a.t))}</a>`)
					.join("")}</div></div>`;
		}).join("");
		$nav.html(html || `<div class="pgd-empty">${esc(__("No articles for this role."))}</div>`);
	}

	// ---------------------------------------------------------------- views
	function list(items, ordered) {
		if (!items || !items.length) return "";
		const tag = ordered ? "ol" : "ul";
		return `<${tag}>${items.map((x) => `<li>${md(x)}</li>`).join("")}</${tag}>`;
	}

	function routeHref(r) {
		if (r[0] === "List") return "/desk/" + frappe.router.slug(r[1]);
		if (r[0] === "Form") return "/desk/" + frappe.router.slug(r[1]) + "/" + encodeURIComponent(r[2] || r[1]);
		if (r[0] === "query-report") return "/desk/query-report/" + encodeURIComponent(r[1]);
		return "/desk/" + r.join("/");
	}

	function head(crumb) {
		return `<div class="pgd-head"><div class="pgd-crumb">${crumb}</div>
			<div class="pgd-actions">
				<button type="button" class="pgd-copy" title="${esc(__("Copy link"))}" aria-label="${esc(__("Copy link"))}">${ICON.copy}</button>
				<button type="button" class="pgd-print" title="${esc(__("Print"))}" aria-label="${esc(__("Print"))}">${ICON.print}</button>
			</div></div>`;
	}

	function renderToc(items) {
		$toc.html(items.length ? `<h6>${esc(__("On this page"))}</h6>` + items.map((h) => `<a href="#${h[0]}" data-to="${h[0]}">${esc(h[1])}</a>`).join("") : "");
		spy();
	}

	function renderHome() {
		const roleInfo = ROLES.find((r) => r.id === role);
		const toc = [["pgd-what", __("What is this guide")], ["pgd-start", __("Start here")], ["pgd-sections", __("Sections")]];
		let html = head(esc(__("Introduction"))) +
			`<h1>${esc(__("POS G2Virtu Guide"))}</h1><hr class="pgd-rule">
			<h2 id="pgd-what">${esc(__("What is this guide"))}</h2>
			<p>${esc(__("How to set up and use every part of POS G2Virtu: what each feature is for, where to find it, how to use it day to day, and what to do when something goes wrong."))}</p>
			<p>${esc(__("Choose who you are under Show for (left) to see only your articles, or search with Ctrl K."))}</p>
			<h2 id="pgd-start">${esc(__("Start here"))}${roleInfo ? " · " + esc(__(roleInfo.label)) : ""}</h2>`;
		if (roleInfo) {
			html += `<p>${esc(__(roleInfo.text))}</p><ol>${ARTICLES.filter(visible)
				.map((a) => `<li><a href="/desk/pos_guide/${a.id}" data-id="${a.id}">${esc(__(a.t))}</a></li>`)
				.join("")}</ol>`;
		} else {
			html += `<div class="pgd-cards">${ROLES.map(
				(r) => `<div class="pgd-card" data-role="${r.id}" role="button" tabindex="0"><span class="pgd-ico">${r.icon}</span><b>${esc(__(r.label))}</b><span>${esc(__(r.text))}</span></div>`
			).join("")}</div>`;
		}
		html += `<h2 id="pgd-sections">${esc(__("Sections"))}</h2><div class="pgd-cards">${SECTIONS.map((s) => {
			const items = ARTICLES.filter((a) => a.s === s.id && visible(a));
			if (!items.length) return "";
			return `<div class="pgd-card" data-id="${items[0].id}" role="link" tabindex="0"><span class="pgd-ico">${s.icon}</span><b>${esc(__(s.title))}</b><span>${esc(__(s.text))}</span><div class="small text-muted mt-1">${esc(items.length === 1 ? __("1 article") : __("{0} articles", [items.length]))}</div></div>`;
		}).join("")}</div>`;
		$main.html(html);
		renderToc(toc);
	}

	function renderArticle(a) {
		const pool = visible(a) ? ARTICLES.filter(visible) : ARTICLES;
		const i = pool.findIndex((x) => x.id === a.id);
		const prev = pool[i - 1];
		const next = pool[i + 1];
		const s = sectionOf(a);
		const who = (a.roles || []).map((r) => ROLES.find((x) => x.id === r)).filter(Boolean);
		const toc = [["pgd-purpose", __("What it is for")]];
		let html = head(`<a href="/desk/pos_guide" data-home="1">${esc(__("Guide"))}</a> / ${esc(__(s.title))}`) +
			`<h1>${esc(__(a.t))}</h1>
			<div class="pgd-who" aria-label="${esc(__("Who uses this"))}">${who.map((r) => `<span class="pgd-pill">${r.icon} ${esc(__(r.label))}</span>`).join("")}</div>
			<hr class="pgd-rule">
			<h2 id="pgd-purpose">${esc(__("What it is for"))}</h2><p>${md(a.lead)}</p>`;
		const part = (id, title, body) => {
			toc.push([id, title]);
			html += `<h2 id="${id}">${esc(title)}</h2>${body}`;
		};
		if (a.where && a.where.length) part("pgd-where", __("Where to find it"), `<div class="pgd-note">${list(a.where)}</div>`);
		if (a.setup && a.setup.length) part("pgd-setup", __("Set up"), list(a.setup, true));
		if (a.use && a.use.length) part("pgd-use", __("How to use it"), list(a.use));
		if (a.handle && a.handle.length)
			part("pgd-problems", __("When something goes wrong"), a.handle.map((h) => `<div class="pgd-q">${md(h[0])}</div><div class="pgd-a">${md(h[1])}</div>`).join(""));
		if (a.tips && a.tips.length) part("pgd-tips", __("Tips"), list(a.tips));
		if (a.links && a.links.length)
			part("pgd-open", __("Open"), `<div class="pgd-links">${a.links.map((l, k) => `<a href="${esc(routeHref(l[1]))}" data-link="${k}">${esc(__(l[0]))}</a>`).join("")}</div>`);
		html += `<div class="pgd-nextprev">${
			prev ? `<a href="/desk/pos_guide/${prev.id}" data-id="${prev.id}"><small>${esc(__("Previous"))}</small>← ${esc(__(prev.t))}</a>` : "<span></span>"
		}${next ? `<a href="/desk/pos_guide/${next.id}" data-id="${next.id}" class="text-right"><small>${esc(__("Next"))}</small>${esc(__(next.t))} →</a>` : ""}</div>`;
		$main.html(html);
		$main.find("[data-link]").on("click", (e) => {
			e.preventDefault();
			frappe.set_route(...a.links[Number($(e.currentTarget).attr("data-link"))][1]);
		});
		renderToc(toc);
	}

	// "On this page": the heading the reader is at
	let spyLockUntil = 0;
	function spy() {
		const $links = $toc.find("a");
		if (!$links.length || Date.now() < spyLockUntil) return;
		let at = $links.first().attr("data-to");
		const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
		$links.each((_, el) => {
			const h = document.getElementById(el.getAttribute("data-to"));
			if (!h) return;
			const top = h.getBoundingClientRect().top;
			// at the end of the page the last headings never reach the top: take the last one on screen
			if (top < 140 || (atBottom && top < window.innerHeight)) at = el.getAttribute("data-to");
		});
		$links.removeClass("on").filter(`[data-to="${at}"]`).addClass("on");
	}

	function show() {
		const id = (frappe.get_route() || [])[1];
		const a = id && byId[id];
		current = a ? a.id : null;
		if (a) openSections.add(a.s);
		else if (!openSections.size) openSections.add(SECTIONS[0].id);
		renderRoles();
		renderNav();
		if (a) renderArticle(a);
		else renderHome();
		const on = $nav.find("a.on")[0];
		if (on && on.scrollIntoView) on.scrollIntoView({ block: "nearest" });
		window.scrollTo(0, 0);
	}

	function go(id) {
		closeResults();
		if (id) frappe.set_route("pos_guide", id);
		else frappe.set_route("pos_guide");
		setTimeout(show, 0); // same route: draw again
	}

	// ---------------------------------------------------------------- search (Ctrl K)
	let hits = [];
	let hitIndex = 0;
	function closeResults() {
		$results.attr("hidden", true);
		$search.attr("aria-expanded", "false");
	}
	function search(q) {
		const words = q.toLowerCase().split(/\s+/).filter(Boolean);
		if (!words.length) return closeResults();
		hits = ARTICLES.filter((a) => {
			const text = (plain(a) + " " + __(plain(a))).toLowerCase();
			return words.every((w) => text.includes(w));
		});
		hitIndex = 0;
		$results
			.html(
				hits.length
					? hits
							.map(
								(a, k) =>
									`<a href="/desk/pos_guide/${a.id}" data-id="${a.id}" role="option" class="${k === 0 ? "on" : ""}">${esc(__(a.t))}<small>${esc(__(sectionOf(a).title))}</small></a>`
							)
							.join("")
					: `<div class="pgd-none">${esc(__("Nothing matches. Try other words."))}</div>`
			)
			.removeAttr("hidden");
		$search.attr("aria-expanded", "true");
	}
	$search.on("input", (e) => search(String(e.target.value || "").trim()));
	$search.on("keydown", (e) => {
		if (e.key === "Escape") {
			closeResults();
			$search.blur();
		} else if ((e.key === "ArrowDown" || e.key === "ArrowUp") && hits.length) {
			e.preventDefault();
			hitIndex = (hitIndex + (e.key === "ArrowDown" ? 1 : hits.length - 1)) % hits.length;
			$results.find("a").removeClass("on").eq(hitIndex).addClass("on")[0].scrollIntoView({ block: "nearest" });
		} else if (e.key === "Enter" && hits.length) {
			e.preventDefault();
			$search.val("");
			go(hits[hitIndex].id);
		}
	});
	$(document).on("keydown.pgd", (e) => {
		if ((e.ctrlKey || e.metaKey) && (e.key === "k" || e.key === "K") && (frappe.get_route() || [])[0] === "pos_guide") {
			e.preventDefault();
			$search.trigger("focus").select();
		}
	});
	$(document).on("click.pgd", (e) => {
		if (!$(e.target).closest(".pgd-search-wrap").length) closeResults();
	});

	// ---------------------------------------------------------------- events
	$root.on("click", "a[data-id], .pgd-card[data-id]", (e) => {
		e.preventDefault();
		$search.val("");
		go($(e.currentTarget).attr("data-id"));
	});
	$root.on("click", "a[data-home]", (e) => {
		e.preventDefault();
		go(null);
	});
	$root.on("click", ".pgd-sec-btn", (e) => {
		const id = $(e.currentTarget).closest(".pgd-sec").attr("data-sec");
		if (openSections.has(id)) openSections.delete(id);
		else openSections.add(id);
		renderNav();
	});
	function setRole(r) {
		role = r || "";
		try {
			localStorage.setItem(ROLE_KEY, role);
		} catch (err) {
			/* private mode */
		}
		show();
	}
	$root.on("change", ".pgd-role-select", (e) => setRole(e.target.value));
	$root.on("click", ".pgd-card[data-role]", (e) => setRole($(e.currentTarget).attr("data-role")));
	$root.on("keydown", ".pgd-card", (e) => {
		if (e.key === "Enter" || e.key === " ") {
			e.preventDefault();
			$(e.currentTarget).trigger("click");
		}
	});
	$root.on("click", ".pgd-toc a", (e) => {
		e.preventDefault();
		const to = $(e.currentTarget).attr("data-to");
		const h = document.getElementById(to);
		if (!h) return;
		spyLockUntil = Date.now() + 900; // keep the clicked one marked while the page scrolls
		$toc.find("a").removeClass("on").filter(`[data-to="${to}"]`).addClass("on");
		h.scrollIntoView({ behavior: "smooth", block: "start" });
	});
	$root.on("click", ".pgd-print", () => window.print());
	$root.on("click", ".pgd-copy", () => {
		const url = window.location.origin + "/desk/pos_guide" + (current ? "/" + current : "");
		if (frappe.utils.copy_to_clipboard) frappe.utils.copy_to_clipboard(url, __("Link copied"));
		else if (navigator.clipboard) navigator.clipboard.writeText(url);
	});
	$(window).on("scroll.pgd", () => {
		if ((frappe.get_route() || [])[0] === "pos_guide") spy();
	});

	wrapper.posa_guide_show = show;
	// back / forward between articles stays on this page: draw the new one
	if (frappe.router && frappe.router.on) {
		frappe.router.on("change", () => {
			if ((frappe.get_route() || [])[0] === "pos_guide") show();
		});
	}
	show();
};

frappe.pages["pos_guide"].on_page_show = function (wrapper) {
	if (wrapper.posa_guide_show) wrapper.posa_guide_show();
};
