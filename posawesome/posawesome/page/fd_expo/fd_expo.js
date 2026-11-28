// Fine dining Expo (pass) screen: each open table's courses, what is held,
// cooking, ready and served. The pass sends a course when it is complete.
frappe.pages["fd_expo"].on_page_load = function (wrapper) {
	const page = frappe.ui.make_app_page({ parent: wrapper, title: __("Expo (Pass)"), single_column: true });
	const KEY = "posa_expo_profile";
	const esc = (v) => frappe.utils.escape_html(v == null ? "" : String(v));
	let profile = null;
	try {
		profile = localStorage.getItem(KEY);
	} catch (e) {
		profile = null;
	}

	const field = page.add_field({
		fieldname: "pos_profile",
		label: __("POS Profile"),
		fieldtype: "Link",
		options: "POS Profile",
		default: profile,
		change() {
			profile = field.get_value();
			try {
				localStorage.setItem(KEY, profile || "");
			} catch (e) {
				/* private mode */
			}
			load();
		},
	});
	page.set_primary_action(__("Refresh"), () => load(), "refresh");

	const $body = $(`<div class="fd-expo"><div class="fd-expo-empty text-muted p-4"></div><div class="fd-expo-grid"></div></div>`).appendTo(page.body);
	$(`<style>
		.fd-expo-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 12px; padding: 12px; }
		.fd-expo-card { background: #fff; border-radius: 10px; box-shadow: 0 2px 6px rgba(0,0,0,.12); overflow: hidden; }
		.fd-expo-head { background: #263238; color: #fff; padding: 8px 12px; display: flex; justify-content: space-between; align-items: center; }
		.fd-expo-head b { font-size: 20px; }
		.fd-expo-allergy { background: #c62828; color: #fff; font-weight: 800; padding: 4px 12px; }
		.fd-expo-course { margin: 8px; border-radius: 8px; border: 2px solid #cfd8dc; }
		.fd-expo-course.c-Ready { border-color: #43a047; background: #f1f8e9; }
		.fd-expo-course.c-Cooking { border-color: #fb8c00; }
		.fd-expo-course.c-Held { border-color: #90a4ae; background: #eceff1; opacity: .8; }
		.fd-expo-course.c-Served { opacity: .45; }
		.fd-expo-ch { display: flex; justify-content: space-between; align-items: center; padding: 4px 8px; font-weight: 700; text-transform: uppercase; }
		.fd-expo-item { padding: 2px 10px; font-size: 13px; display: flex; justify-content: space-between; }
		.fd-expo-item .s-Ready { color: #2e7d32; font-weight: 700; }
		.fd-expo-item .s-Cooking { color: #ef6c00; }
		.fd-expo-item .s-Held { color: #607d8b; }
		.fd-expo-item .s-Served { color: #9e9e9e; }
		.fd-expo-seat { background: #0097a7; color: #fff; border-radius: 4px; padding: 0 4px; font-size: 11px; margin-right: 4px; }
	</style>`).appendTo(page.body);

	function minutes(since, now) {
		const ms = new Date(String(now).replace(" ", "T")) - new Date(String(since).replace(" ", "T"));
		return Math.max(0, Math.round(ms / 60000));
	}

	function render(data) {
		const orders = (data && data.orders) || [];
		$body.find(".fd-expo-empty").text(orders.length ? "" : __("No open tables with kitchen orders."));
		const html = orders
			.map((o) => {
				const courses = o.courses
					.map((c) => {
						const items = c.items
							.map((i) => `<div class="fd-expo-item"><span>${i.seat ? `<span class="fd-expo-seat">S${esc(i.seat)}</span>` : ""}${esc(i.qty)} x ${esc(i.item_name)}${i.modifiers ? ` <i class="text-muted">(${esc(i.modifiers)})</i>` : ""}</span><span class="s-${esc(i.state)}">${esc(__(i.state))}</span></div>`)
							.join("");
						const btn =
							c.state === "Ready" || c.state === "Cooking"
								? `<button class="btn btn-xs ${c.state === "Ready" ? "btn-success" : "btn-default"} fd-expo-serve" data-invoice="${esc(o.name)}" data-course="${esc(c.course)}">${__("Serve")}</button>`
								: "";
						return `<div class="fd-expo-course c-${esc(c.state)}"><div class="fd-expo-ch"><span>${esc(c.course || __("No course"))} &middot; ${esc(__(c.state))}</span>${btn}</div>${items}</div>`;
					})
					.join("");
				return `<div class="fd-expo-card">
					<div class="fd-expo-head"><b>${esc(o.table)}</b><span>${o.covers ? esc(o.covers) + " " + __("guests") + " &middot; " : ""}${esc(o.waiter)} &middot; ${minutes(o.since, data.now)}'</span></div>
					${o.allergies ? `<div class="fd-expo-allergy">&#9888; ${__("ALLERGY")}: ${esc(o.allergies)}</div>` : ""}
					${courses}</div>`;
			})
			.join("");
		$body.find(".fd-expo-grid").html(html);
	}

	let busy = false;
	function load() {
		if (!profile) {
			$body.find(".fd-expo-empty").text(__("Choose the POS Profile."));
			$body.find(".fd-expo-grid").empty();
			return;
		}
		if (busy) return;
		busy = true;
		frappe.call({
			method: "posawesome.posawesome.api.fine_dining_kitchen.get_expo",
			args: { pos_profile: profile },
			callback: (r) => render(r.message),
			always: () => (busy = false),
		});
	}

	$body.on("click", ".fd-expo-serve", function () {
		const invoice = $(this).data("invoice");
		const course = $(this).data("course") || "";
		const go = () =>
			frappe.call({
				method: "posawesome.posawesome.api.fine_dining_kitchen.serve_course",
				args: { pos_profile: profile, invoice, course },
				callback: () => load(),
			});
		if ($(this).hasClass("btn-success")) go();
		else frappe.confirm(__("{0} is still cooking. Serve it anyway?", [course || __("This course")]), go);
	});

	["posa_expo_refresh", "kds_refresh", "new_kitchen_ticket"].forEach((ev) => frappe.realtime.on(ev, () => load()));
	setInterval(() => document.visibilityState === "visible" && load(), 15000);
	load();
};
