frappe.pages['kds'].on_page_load = function (wrapper) {
	const page = frappe.ui.make_app_page({
		parent: wrapper,
		title: 'Kitchen Display System',
		single_column: true
	});

	// Inject custom CSS
	const style = document.createElement('style');
	style.innerHTML = `
		#kds-board {
			display: grid;
			grid-template-columns: repeat(3, 1fr);
			gap: 1rem;
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
		.ticket-details b { color: #111827; }
		.ticket-items {
			border-top: 1px solid #e5e7eb;
			margin-top: 0.5rem;
			padding-top: 0.5rem;
		}
		.ticket-items li {
			display: flex;
			justify-content: space-between;
			margin-bottom: 4px;
		}
		.btn {
			padding: 4px 8px;
			border-radius: 6px;
			border: none;
			cursor: pointer;
			font-size: 0.9rem;
			font-weight: 500;
		}
		.btn-warning { background: #ffc107; }
		.btn-success { background: #28a745; color: white; }
		.btn-secondary { background: #6c757d; color: white; }
		.flex { display: flex; }
		.gap-2 { gap: 0.5rem; }
		.mt-3 { margin-top: 0.75rem; }
	`;
	document.head.appendChild(style);

	// Add page structure
	$(wrapper).html(`
		<div id="kds-board">
			<div id="col-new" class="kds-column">
				<h2>New</h2>
				<div class="ticket-list" id="new-tickets"></div>
			</div>
			<div id="col-preparing" class="kds-column">
				<h2>Preparing</h2>
				<div class="ticket-list" id="preparing-tickets"></div>
			</div>
			<div id="col-ready" class="kds-column">
				<h2>Ready</h2>
				<div class="ticket-list" id="ready-tickets"></div>
			</div>
		</div>
	`);

	loadKitchenTickets();
	frappe.realtime.on("kds_refresh", loadKitchenTickets);
};

// Fetch tickets and render in columns
function loadKitchenTickets() {
	frappe.call({
		method: "posawesome.posawesome.page.kds.kds.get_kitchen_tickets",
		callback: function (r) {
			if (!r.message) return;
			const tickets = r.message;
			$("#new-tickets, #preparing-tickets, #ready-tickets").empty();

			tickets.forEach(t => {
				const card = $(`
					<div class="ticket-card ticket-${t.status.toLowerCase()}" data-ticket-name="${t.name}">
						<div class="ticket-header">
							<h3>${t.kitchen_production_unit || "Unknown Unit"}</h3>
							<span class="ticket-timer" id="timer-${t.name.replace(/\W/g, '')}">--:--</span>
						</div>
						<div class="ticket-details">
							<p><b>Ticket:</b> ${t.name}</p>
							<p><b>Invoice:</b> ${t.sales_invoice}</p>
							<p><b>Status:</b> <span class="text-blue-700">${t.status}</span></p>
							<p><b>Created:</b> ${frappe.datetime.str_to_user(t.creation)}</p>
						</div>
						<ul class="ticket-items">
							${(t.items || []).map(i => `
								<li>
									<span>${i.item_name}</span>
									<span class="font-bold">x${i.qty}</span>
								</li>
								${i.posa_notes ? `<p class="text-sm text-gray-600 ml-2">?? ${i.posa_notes}</p>` : ''}
							`).join('')}
						</ul>
						<div class="mt-3 flex gap-2">
							${t.status === "New" ? `<button class="btn btn-warning preparing">Preparing</button>` : ""}
							${t.status !== "Ready" ? `<button class="btn btn-success ready">Ready</button>` : ""}
							<button class="btn btn-secondary served">Served</button>
						</div>
					</div>
				`);

				// Append card
				if (t.status === "New") $("#new-tickets").append(card);
				else if (t.status === "Preparing") $("#preparing-tickets").append(card);
				else if (t.status === "Ready") $("#ready-tickets").append(card);

				// Initialize timer
				startTimer(`timer-${t.name.replace(/\W/g, '')}`, t.creation);

				// Button actions
				card.find('.preparing').on('click', () => updateStatus(t.name, 'Preparing'));
				card.find('.ready').on('click', () => updateStatus(t.name, 'Ready'));
				card.find('.served').on('click', () => updateStatus(t.name, 'Served'));
			});
		}
	});
}

// Timer Function
function startTimer(id, created_at) {
	const timerEl = document.getElementById(id);
	if (!timerEl) return;
	const createdTime = new Date(created_at).getTime();

	function updateTimer() {
		const diff = Date.now() - createdTime;
		const mins = Math.floor(diff / 60000);
		const secs = Math.floor((diff % 60000) / 1000);
		timerEl.textContent = `${mins}m ${secs < 10 ? '0' : ''}${secs}s`;
	}
	updateTimer();
	setInterval(updateTimer, 1000);
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
