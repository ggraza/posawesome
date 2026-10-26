frappe.pages['los'].on_page_load = function(wrapper) {
	var page = frappe.ui.make_app_page({
		parent: wrapper,
		title: 'Live Order Status',
		single_column: true
	});
	// Inject custom CSS
	const style = document.createElement('style');
	style.innerHTML = `
		#los-navbar {
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
		#los-navbar {
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
		#los-navbar label {
			font-weight: 600;
			margin-right: 0.3rem;
		}
		#los-navbar select, #los-navbar input {
			padding: 4px 6px;
			border-radius: 6px;
			border: none;
			min-width: 150px;
		}
		#search-ticket {
			min-width: 220px;
		}
		#los-board {
			display: grid;
			grid-template-columns: 25% 25% 25% 25%;
			gap: 12px;
			padding: 15px;
			background: #f9fafb;
			min-height: 100vh;
		}

		.los-column {
			background: #ffffff;
			border-radius: 12px;
			box-shadow: 0 4px 8px rgba(0,0,0,0.05);
			padding: 1rem;
			overflow-y: auto;
			min-height: 90vh;
		}
		.los-column h2 {
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
		<div id="los-navbar" class="navbar navbar-expand sticky-top">
			<div class="kds-brand" id="kds-home-link">
				<img id="kds-logo" src="" alt="Logo">
				<span>LOS</span>
			</div>
			<div>
				<label>Company:</label>
				<select id="filter-company"></select>
			</div>
			<div>
				<label>Service Zone:</label>
				<select id="filter-zone"></select>
			</div>
			<div>
				<label>Status:</label>
				<select id="filter-status">
					<option value="">All</option>
					<option value="New">New</option>
					<option value="Preparing">Preparing</option>
					<option value="Ready">Ready</option>
					<option value="Served">Served</option>
				</select>
			</div>
			<div>
				<label>Search:</label>
				<input type="text" id="search-ticket" placeholder="Search Ticket or Invoice..." />
			</div>
			<div>
				<label>Served:</label>
				<select id="served-duration">
					<option value="1">1 Min</option>
					<option value="3">3 Min</option>
					<option value="5" selected>5 Min</option>
					<option value="10">10 Min</option>
					<option value="15">15 Min</option>
				</select>
			</div>
			<button id="filter-refresh" class="btn btn-success">Refresh</button>
		</div>

		<div id="los-board">
			<div id="col-new" class="los-column">
				<h2>New</h2>
				<div id="new-tickets"></div>
			</div>
			<div id="col-preparing" class="los-column">
				<h2>Preparing</h2>
				<div id="preparing-tickets"></div>
			</div>
			<div id="col-ready" class="los-column">
				<h2>Ready</h2>
				<div id="ready-tickets"></div>
			</div>
			<div id="col-served" class="los-column">
				<h2>SERVED</h2>
				<div id="served-tickets"></div>
			</div>
		</div>
	`);
	loadLOSLogo();
	loadCompanies();
	loadServiceZones();
	loadOrders();


frappe.realtime.on("new_queue_ticket", function(data) {
    loadOrders();
});

frappe.realtime.on("queue_status_update", function(data) {
    loadOrders();
});

	$('#filter-refresh').on('click', () => loadOrders());
	$('#filter-company, #filter-zone, #filter-status').on('change', () => loadOrders());
	$('#search-ticket').on('input', filterTicketsBySearch);
	$('#served-duration').on('change', loadOrders);
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

function loadServiceZones() {
	frappe.call({
		method: "frappe.client.get_list",
		args: { doctype: "Service Zone", fields: ["name"] },
		callback: function (r) {
			const select = $('#filter-zone');
			select.html('<option value="">All</option>');
			(r.message || []).forEach(u => select.append(`<option value="${u.name}">${u.name}</option>`));
		}
	});
}

// Fetch and render tickets
let allTickets = []; // cache for search filter

function loadOrders() {
	const company = $('#filter-company').val();
	const service_zone = $('#filter-zone').val();
	const status = $('#filter-status').val();

	frappe.call({
		method: "posawesome.posawesome.page.los.los.get_live_order_status",
		args: { company, service_zone, status, served_duration: $('#served-duration').val() },
		callback: function (r) {
			allTickets = r.message || [];
			renderTickets(allTickets);
		}
	});
}

// Render Tickets
function renderTickets(tickets) {
	$("#new-tickets, #preparing-tickets, #ready-tickets, #served-tickets").empty();

	tickets.forEach(t => {
		let actions = '';
		if (t.status === "New") {
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

		const card = $(`
			<div class="ticket-card ticket-${t.status.toLowerCase()}" data-ticket-name="${t.name}">
				<div class="ticket-header">
					<h3>${t.service_zone || "Unknown Zone"}</h3>
					<span class="ticket-timer" id="timer-${t.name.replace(/\W/g, '')}">--:--</span>
				</div>
				<div class="ticket-details">
					<p><b>Token:</b>
					<span style="
						font-size:32px;
						font-weight:bold;
						color:#dc2626;
						padding:4px 12px;
						border-radius:8px;
						background:#fff;
						border:2px solid #dc2626;
						">${getDisplayNumber(t.name)}</span>
					</p>
<div class="ticket-details">
    <div style="
        text-align:center;
        margin-bottom:10px;
    ">
        <div style="
            font-size:48px;
            font-weight:800;
            color:#dc2626;
            line-height:1;
        ">
            ${getDisplayNumber(t.name)}
        </div>

        <div style="
            font-size:18px;
            font-weight:600;
            margin-top:5px;
        ">
            ${t.status}
        </div>
    </div>

    <p><b>Invoice:</b> ${t.sales_invoice}</p>
    <p><b>Created:</b> ${frappe.datetime.str_to_user(t.creation)}</p>
</div>
					<p><b>Ticket:</b> ${t.name}</p>
					<p><b>Invoice:</b> ${t.sales_invoice}</p>
					<p><b>Status:</b> <span class="text-blue-700">${t.status}</span></p>
					<p><b>Created:</b> ${frappe.datetime.str_to_user(t.creation)}</p>
				</div>
				<div class="ticket-actions">${actions}</div>
			</div>
		`);

		if (t.status === "New") $("#new-tickets").append(card);
		else if (t.status === "Preparing") $("#preparing-tickets").append(card);
		else if (t.status === "Ready") $("#ready-tickets").append(card);
		else if (t.status === "Served") $("#served-tickets").append(card);

		startTimer(`timer-${t.name.replace(/\W/g, '')}`, t.creation);

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

// Timer Function
function startTimer(id, created_at) {
	const el = document.getElementById(id);
	if (!el) return;
	const start = new Date(created_at).getTime();
	setInterval(() => {
		const diff = Date.now() - start;
		const mins = Math.floor(diff / 60000);
		const secs = Math.floor((diff % 60000) / 1000);
		el.textContent = `${mins}m ${secs.toString().padStart(2, '0')}s`;
	}, 1000);
}

// Update Status
function updateStatus(ticket_name, new_status) {
	frappe.call({
		method: "posawesome.posawesome.page.los.los.update_ticket_status",
		args: { ticket_name, new_status },
		callback: function (r) {
			if (r.message && r.message.success) {
				frappe.show_alert(`Ticket ${ticket_name} marked as ${new_status}`);
				loadOrders();
			}
		}
	});
}

function getDisplayNumber(ticketName) {

    if (!ticketName)
        return '';

    const parts = ticketName.split('-');

    if (parts.length < 2)
        return ticketName;

    return parseInt(parts[1], 10);
}

// Navbar hide
function toggleNavbar() {
	const navbar = document.querySelector('.navbar');
	if (!navbar) return;

	const route = frappe.get_route();

	if (route && route[0] === 'los') {
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
function loadLOSLogo() {
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