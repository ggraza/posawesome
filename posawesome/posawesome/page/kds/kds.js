frappe.pages['kds'].on_page_load = function (wrapper) {
	const page = frappe.ui.make_app_page({
		parent: wrapper,
		title: 'Kitchen Display System',
		single_column: true
	});

	// Inject custom CSS
	const style = document.createElement('style');
	style.innerHTML = `
#kds-navbar {
	display: flex;
	align-items: center;
	justify-content: space-between;
	flex-wrap: wrap;
	gap: 1rem;
	padding: 0.75rem 1rem;
	background: #1f2937;
	color: white;
	position: sticky;
	top: 0;
	z-index: 1000;
}

.kds-brand {
	display: flex;
	align-items: center;
	gap: 10px;
	cursor: pointer;
	user-select: none;
	font-weight: 600;
}

#kds-logo {
	height: 40px;
	width: auto;
	max-width: 180px;
	object-fit: contain;
}
		#kds-navbar {
			display: flex;
			align-items: center;
			flex-wrap: wrap;
			gap: 1rem;
			padding: 0.75rem 1rem;
			background: #1f2937;
			color: white;
			border-radius: 8px;
			margin: 0.5rem 1rem 0 1rem;
		}
		#kds-navbar label {
			font-weight: 600;
			margin-right: 0.3rem;
		}
		#kds-navbar select, #kds-navbar input {
			padding: 4px 6px;
			border-radius: 6px;
			border: none;
			min-width: 150px;
		}
		#search-ticket {
			min-width: 220px;
		}
		#kds-board {
			display: grid;
			grid-template-columns: repeat(3, 1fr);
			gap: .25rem;
			padding: 1rem;
			min-height: 100vh;
			background: #f9fafb;
		}
		.kds-column {
			background: #ffffff;
			border-radius: 12px;
			box-shadow: 0 4px 8px rgba(0,0,0,0.05);
			padding: 1rem;
			overflow-y: auto;
			min-height: 90vh;
		}
		.kds-column h2 {
			text-align: center;
			text-transform: uppercase;
			font-weight: 700;
			color: #374151;
			margin-bottom: 0.75rem;
			border-bottom: 2px solid #e5e7eb;
			padding-bottom: 0.5rem;
		}
		.ticket-card {
			border-radius: 12px;
			box-shadow: 0 2px 6px rgba(0,0,0,0.08);
			padding: 1rem;
			margin-bottom: 1rem;
			transition: transform 0.2s ease-in-out;
		}
		.ticket-card:hover { transform: scale(1.02); }
		.ticket-new { background: #ffdfdf; }
		.ticket-preparing { background: #fff4ce; }
		.ticket-ready { background: #d4edda; }
		.ticket-header {
			display: flex;
			justify-content: space-between;
			align-items: center;
			border: 2px solid #9ca3af;
			border-radius: 10px;
			padding: 6px 10px;
			margin-bottom: 0.5rem;
		}
		.ticket-header h3 {
			font-weight: 700;
			font-size: 1.1rem;
			margin: 0;
		}
		.ticket-timer {
			font-weight: bold;
			font-family: monospace;
			background-color: #fff3cd;
			border: 2px solid #ffeeba;
			border-radius: 8px;
			padding: 2px 8px;
			color: #856404;
		}
		.ticket-details p { margin: 2px 0; }
		.ticket-items-table {
			width: 100%;
			border-collapse: collapse;
			margin-top: 8px;
			background: #fff;
		}
		.ticket-items-table th, .ticket-items-table td {
			border: 1px solid #e5e7eb;
			padding: 6px 8px;
			text-align: left;
			font-size: 0.9rem;
		}
		.ticket-items-table th {
			background: #f3f4f6;
			font-weight: 600;
			text-transform: uppercase;
			color: #374151;
		}
		.ticket-actions {
			display: flex;
			justify-content: space-between;
			align-items: center;
			border: 2px solid #9ca3af;
			border-radius: 10px;
			padding: 6px 10px;
			margin-top: 0.5rem;
			background-color: #f8f9fa;
		}
		.ticket-actions .btn {
			flex: 1;
			margin: 0 3px;
			padding: 6px 0;
			border-radius: 8px;
			border: none;
			cursor: pointer;
			font-size: 0.9rem;
			font-weight: 600;
			transition: transform 0.1s ease-in-out;
		}
		.ticket-actions .btn:hover { transform: scale(1.05); }
		.btn-warning { background: #ffc107; }
		.btn-success { background: #28a745; color: white; }
		.btn-secondary { background: #6c757d; color: white; }
	`;
	document.head.appendChild(style);

	// Add Navbar and Board
	$(wrapper).html(`
		<div id="kds-navbar" class="navbar navbar-expand sticky-top">
<div class="kds-brand" id="kds-home-link">
    <img id="kds-logo" src="" alt="Logo">
    <span>KDS</span>
</div>
			<div>
				<label>Company:</label>
				<select id="filter-company"></select>
			</div>
			<div>
				<label>Kitchen Unit:</label>
				<select id="filter-unit"></select>
			</div>
			<div>
				<label>Status:</label>
				<select id="filter-status">
					<option value="">All</option>
					<option value="New">New</option>
					<option value="Preparing">Preparing</option>
					<option value="Ready">Ready</option>
				</select>
			</div>
			<div>
				<label>Search:</label>
				<input type="text" id="search-ticket" placeholder="Search Ticket or Invoice..." />
			</div>
			<button id="filter-refresh" class="btn btn-success">Refresh</button>
			<button id="kds-recall" class="btn btn-secondary">${__("Recall")}</button>
			<button id="kds-86" class="btn btn-secondary">86</button>
		</div>

		<div id="kds-board">
			<div id="col-new" class="kds-column">
				<h2>New</h2>
				<div id="new-tickets"></div>
			</div>
			<div id="col-preparing" class="kds-column">
				<h2>Preparing</h2>
				<div id="preparing-tickets"></div>
			</div>
			<div id="col-ready" class="kds-column">
				<h2>Ready</h2>
				<div id="ready-tickets"></div>
			</div>
		</div>
	`);
loadKDSLogo();
	loadCompanies();
	loadUnits();
	loadKitchenTickets();

	frappe.realtime.on("kds_refresh", loadKitchenTickets);
	frappe.realtime.on("new_kitchen_ticket", loadKitchenTickets);

	$('#filter-refresh').on('click', () => loadKitchenTickets());
	$('#kds-recall').on('click', showRecall);
	$('#kds-86').on('click', show86);
	frappe.realtime.on("posa_86_changed", loadKitchenTickets);
	$('#filter-company, #filter-unit, #filter-status').on('change', () => loadKitchenTickets());
	$('#search-ticket').on('input', filterTicketsBySearch);
};

// Load filter data
function loadCompanies() {
	frappe.call({
		method: "frappe.client.get_list",
		args: { doctype: "Company", fields: ["name"] },
		callback: function (r) {
			const select = $('#filter-company');
			select.html('<option value="">All</option>');
			(r.message || []).forEach(c => select.append(`<option value="${c.name}">${c.name}</option>`));
		}
	});
}

function loadUnits() {
	frappe.call({
		method: "frappe.client.get_list",
		args: { doctype: "Kitchen Production Unit", fields: ["name"] },
		callback: function (r) {
			const select = $('#filter-unit');
			select.html('<option value="">All</option>');
			(r.message || []).forEach(u => select.append(`<option value="${u.name}">${u.name}</option>`));
		}
	});
}

// Fetch and render tickets
let allTickets = []; // cache for search filter

function loadKitchenTickets() {
	const company = $('#filter-company').val();
	const unit = $('#filter-unit').val();
	const status = $('#filter-status').val();

	frappe.call({
		method: "posawesome.posawesome.page.kds.kds.get_kitchen_tickets",
		args: { company, unit, status },
		callback: function (r) {
			allTickets = r.message || [];
			renderTickets(allTickets);
		}
	});
}

// Render Tickets
function renderTickets(tickets) {
	$("#new-tickets, #preparing-tickets, #ready-tickets").empty();
	kdsTimers.forEach(clearInterval);
	kdsTimers = [];

	tickets.forEach(t => {
		let actions = '';
		const isVoid = t.ticket_type === "Void";
		if (isVoid) {
			// the kitchen confirms it has seen the void; the ticket then leaves the screen
			actions = `<button class="btn btn-danger served">${__("Void Seen")}</button>`;
		} else if (t.status === "New") {
			actions = `
				<button class="btn btn-warning preparing">Preparing</button>
				<button class="btn btn-success ready">Ready</button>
				<button class="btn btn-secondary served">Served</button>`;
		} else if (t.status === "Preparing") {
			actions = `
				<button class="btn btn-success ready">Ready</button>
				<button class="btn btn-secondary served">Served</button>`;
		} else if (t.status === "Ready") {
			actions = `<button class="btn btn-secondary served">Served</button>`;
		}

		const esc = (v) => frappe.utils.escape_html(v == null ? "" : String(v));
		const fd = t.fd || {};
		const bump = !!fd.item_bump && !isVoid;
		// fine dining: rows grouped by course, with seat and modifiers
		const fdRows = (items) => {
			let html = "";
			let course = null;
			const withCourse = items.some((i) => i.posa_course);
			// courses in the order they first appear on the ticket (the order's course order)
			const order = [];
			items.forEach((i) => {
				if (!order.includes(i.posa_course || "")) order.push(i.posa_course || "");
			});
			items
				.slice()
				.sort((a, b) => (withCourse ? order.indexOf(a.posa_course || "") - order.indexOf(b.posa_course || "") : 0))
				.forEach((i) => {
					if (withCourse && (i.posa_course || "") !== course) {
						course = i.posa_course || "";
						html += `<tr class="kds-course-row"><td colspan="3">${esc(course || __("No course"))}</td></tr>`;
					}
					const done = i.item_status === "Ready" || i.item_status === "Served";
					html += `
							<tr class="${bump ? "kds-bump" : ""}${done ? " kds-item-done" : ""}" data-row="${esc(i.name || "")}">
								<td>${done ? "&#10003; " : ""}${i.posa_seat ? `<span class="kds-seat">S${esc(i.posa_seat)}</span> ` : ""}${esc(i.item_name)}${
									i.posa_modifiers ? `<div class="kds-mods">${esc(i.posa_modifiers)}</div>` : ""
								}${i.posa_allergen_alert ? `<div class="kds-allergy-item">&#9888; ${__("ALLERGY")}: ${esc(i.posa_allergen_alert)}</div>` : ""}</td>
								<td><b>${isVoid ? "-" : "x"}${esc(i.qty)}</b></td>
								<td>${esc(i.posa_notes)}${fd.eighty_six && i.item_code && !isVoid ? ` <button class="btn btn-xs kds-86-btn" data-item="${esc(i.item_code)}" title="${__("Mark unavailable (86)")}">86</button>` : ""}</td>
							</tr>`;
				});
			return html;
		};

		const card = $(`
			<div class="ticket-card ticket-${t.status.toLowerCase()}${isVoid ? " ticket-void" : ""}" data-ticket-name="${t.name}">
				<div class="ticket-header">
					<h3>${isVoid ? `<span class="kds-void-tag">${__("VOID")}</span> ` : ""}${esc(t.kitchen_production_unit || "Unknown Unit")}</h3>
					<span class="ticket-timer" id="timer-${t.name.replace(/\W/g, '')}">--:--</span>
				</div>
				${t.allergy_note ? `<div class="kds-allergy">&#9888; ${__("ALLERGY")}: ${esc(t.allergy_note)}</div>` : ""}
				<div class="ticket-details">
					${t.service_table ? `<p class="kds-table"><b>${__("Table")}:</b> ${esc(t.service_table)}${t.covers ? ` &middot; ${esc(t.covers)} ${__("guests")}` : ""}</p>` : ""}
					<p><b>Ticket:</b> ${t.name}</p>
					<p><b>Invoice:</b> ${t.sales_invoice}</p>
					<p><b>Status:</b> <span class="text-blue-700">${isVoid ? __("VOID - stop or remove these items") : t.status}</span></p>
					<p><b>Created:</b> ${frappe.datetime.str_to_user(t.creation)}</p>
				</div>

				<table class="ticket-items-table">
					<thead>
						<tr><th>Item</th><th>Qty</th><th>Notes</th></tr>
					</thead>
					<tbody>
						${fdRows(t.items || [])}
					</tbody>
				</table>

				<div class="ticket-actions">${actions}</div>
			</div>
		`);

		if (isVoid) $("#new-tickets").prepend(card);
		else if (t.status === "New") $("#new-tickets").append(card);
		else if (t.status === "Preparing") $("#preparing-tickets").append(card);
		else if (t.status === "Ready") $("#ready-tickets").append(card);

		startTimer(`timer-${t.name.replace(/\W/g, '')}`, t.creation, isVoid ? 0 : fd.prep_minutes ? t.target_minutes || fd.prep_minutes : 0, card);

		if (bump) {
			card.find("tr.kds-bump").on("click", function (e) {
				if ($(e.target).closest(".kds-86-btn").length) return;
				const row = $(this).data("row");
				if (!row) return;
				frappe.call({
					method: "posawesome.posawesome.api.fine_dining_kitchen.bump_item",
					args: { ticket: t.name, row },
					callback: () => loadKitchenTickets(),
				});
			});
		}
		card.find(".kds-86-btn").on("click", function (e) {
			e.stopPropagation();
			const item = $(this).data("item");
			frappe.confirm(__("Mark {0} as not available today (86)?", [item]), () =>
				frappe.call({
					method: "posawesome.posawesome.api.fine_dining_kitchen.set_86",
					args: { item_code: item, unavailable: 1, pos_profile: t.pos_profile },
					callback: () => frappe.show_alert({ message: __("{0} is 86", [item]), indicator: "red" }),
				})
			);
		});

		card.find('.preparing').on('click', () => updateStatus(t.name, 'Preparing'));
		card.find('.ready').on('click', () => updateStatus(t.name, 'Ready'));
		card.find('.served').on('click', () => updateStatus(t.name, 'Served'));
	});
}

// Search filter (client-side)
function filterTicketsBySearch() {
	const query = $('#search-ticket').val().toLowerCase();
	const filtered = allTickets.filter(t =>
		t.name.toLowerCase().includes(query) ||
		(t.sales_invoice && t.sales_invoice.toLowerCase().includes(query))
	);
	renderTickets(filtered);
}

// Timer Function. With a target (fine dining Kitchen Target Minutes) the card
// turns amber at 75% of it and red past it.
let kdsTimers = [];
function startTimer(id, created_at, target, card) {
	const el = document.getElementById(id);
	if (!el) return;
	const start = new Date(created_at).getTime();
	const tick = () => {
		const diff = Date.now() - start;
		const mins = Math.floor(diff / 60000);
		const secs = Math.floor((diff % 60000) / 1000);
		el.textContent = `${mins}m ${secs.toString().padStart(2, '0')}s`;
		if (target && card) {
			const late = diff >= target * 60000;
			const soon = !late && diff >= target * 0.75 * 60000;
			card.toggleClass("kds-late", late).toggleClass("kds-soon", soon);
		}
	};
	tick();
	kdsTimers.push(setInterval(tick, 1000));
}

// Recall a finished ticket (fine dining)
function showRecall() {
	frappe.call({
		method: "posawesome.posawesome.api.fine_dining_kitchen.recent_done",
		args: { unit: $('#filter-unit').val() || null },
		callback: (r) => {
			const rows = r.message || [];
			const d = new frappe.ui.Dialog({ title: __("Recall a ticket"), fields: [{ fieldtype: "HTML", fieldname: "list" }] });
			const html = rows.length
				? rows.map((t) => `<div class="d-flex justify-content-between align-items-center border-bottom py-2">
					<span><b>${frappe.utils.escape_html(t.name)}</b> &middot; ${frappe.utils.escape_html(t.service_table || t.sales_invoice || "")} &middot; ${frappe.utils.escape_html(t.status)}</span>
					<button class="btn btn-sm btn-warning kds-recall-one" data-name="${frappe.utils.escape_html(t.name)}">${__("Recall")}</button></div>`).join("")
				: `<div class="text-muted">${__("No finished tickets")}</div>`;
			d.fields_dict.list.$wrapper.html(html);
			d.fields_dict.list.$wrapper.find(".kds-recall-one").on("click", function () {
				frappe.call({
					method: "posawesome.posawesome.api.fine_dining_kitchen.recall",
					args: { ticket: $(this).data("name") },
					callback: () => { d.hide(); loadKitchenTickets(); },
				});
			});
			d.show();
		},
	});
}

// The 86 list: dishes not available today (fine dining)
function show86() {
	frappe.call({
		method: "posawesome.posawesome.api.fine_dining_kitchen.get_86",
		callback: (r) => {
			const rows = r.message || [];
			const d = new frappe.ui.Dialog({ title: __("86 - not available today"), fields: [{ fieldtype: "HTML", fieldname: "list" }] });
			const html = rows.length
				? rows.map((i) => `<div class="d-flex justify-content-between align-items-center border-bottom py-2">
					<span>${frappe.utils.escape_html(i.item_name || i.item_code)}</span>
					<button class="btn btn-sm btn-success kds-86-off" data-item="${frappe.utils.escape_html(i.item_code)}">${__("Back On")}</button></div>`).join("")
				: `<div class="text-muted">${__("Everything is available.")}</div>`;
			d.fields_dict.list.$wrapper.html(html);
			d.fields_dict.list.$wrapper.find(".kds-86-off").on("click", function () {
				frappe.call({
					method: "posawesome.posawesome.api.fine_dining_kitchen.set_86",
					args: { item_code: $(this).data("item"), unavailable: 0 },
					callback: () => { d.hide(); },
				});
			});
			d.show();
		},
	});
}

// Update Status
function updateStatus(ticket_name, new_status) {
	frappe.call({
		method: "posawesome.posawesome.page.kds.kds.update_ticket_status",
		args: { ticket_name, new_status },
		callback: function (r) {
			if (r.message && r.message.success) {
				frappe.show_alert(`Ticket ${ticket_name} marked as ${new_status}`);
				loadKitchenTickets();
			}
		}
	});
}

// Navbar hide
function toggleNavbar() {
	const navbar = document.querySelector('.navbar');
	if (!navbar) return;

	const route = frappe.get_route();

	if (route && route[0] === 'kds') {
		navbar.style.setProperty('display', 'none', 'important');
	} else {
		navbar.style.removeProperty('display');
	}
}


// Run initially
toggleNavbar();

// Handle route changes
window.addEventListener('hashchange', toggleNavbar);

// Standard Logo
function loadKDSLogo() {
	frappe.call({
		method: "frappe.client.get",
		args: {
			doctype: "Navbar Settings",
			name: "Navbar Settings"
		},
		callback: function(r) {
			if (!r.message) return;

			const settings = r.message;

			if (settings.app_logo) {
				$('#kds-logo').attr('src', settings.app_logo);
			}

			if (settings.logo_width) {
				$('#kds-logo').css({
					width: settings.logo_width + 'px'
				});
			}
		}
	});
}

// Logo click -> Home
$(document).on('click', '#kds-home-link', function () {
	const navbar = document.querySelector('.navbar');
	if (navbar) {
		navbar.style.removeProperty('display');
	}

	frappe.set_route('/app');
});