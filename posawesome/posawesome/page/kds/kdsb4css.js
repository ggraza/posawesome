frappe.pages['kds'].on_page_load = function (wrapper) {
	new KitchenDisplay(wrapper);
};

class KitchenDisplay {
	constructor(wrapper) {
		this.page = frappe.ui.make_app_page({
			parent: wrapper,
			title: 'Kitchen Display System',
			single_column: true
		});

		this.container = $('<div id="kds-board" class="grid grid-cols-3 gap-4 p-4"></div>').appendTo(this.page.body);

		frappe.realtime.on('kds_refresh', () => {
			this.refresh();
		});

		this.make_filters();
		this.refresh();
	}

	// -----------------------------------------------------
	// Filters
	// -----------------------------------------------------
	make_filters() {
		let me = this;
		async function update() { await me.refresh(); }

		this.page.add_field({
			label: 'Company',
			fieldtype: 'Link',
			fieldname: 'company',
			options: 'Company',
			change: update
		});

		this.page.add_field({
			label: 'Kitchen Unit',
			fieldtype: 'Link',
			fieldname: 'kitchen_production_unit',
			options: 'Kitchen Production Unit',
			change: update
		});

		this.page.add_field({
			label: 'Status',
			fieldtype: 'Select',
			fieldname: 'status',
			options: ['', 'New', 'Preparing', 'Ready', 'Served'],
			change: update
		});

		this.page.add_field({
			label: 'Search Ticket',
			fieldtype: 'Data',
			fieldname: 'search',
			placeholder: 'Enter Kitchen Ticket #...',
			change: update
		});

		this.page.add_field({
			label: 'From Date',
			fieldtype: 'Date',
			fieldname: 'from_date',
			default: frappe.datetime.get_today(),
			change: update
		});

		this.page.add_field({
			label: 'To Date',
			fieldtype: 'Date',
			fieldname: 'to_date',
			default: frappe.datetime.get_today(),
			change: update
		});
	}

	// -----------------------------------------------------
	// Refresh Ticket Board
	// -----------------------------------------------------
	async refresh() {
		let filters = {
			company: this.page.fields_dict['company'].value,
			unit: this.page.fields_dict['kitchen_production_unit'].value,
			status: this.page.fields_dict['status'].value,
			from_date: this.page.fields_dict['from_date'].value,
			to_date: this.page.fields_dict['to_date'].value,
			search: this.page.fields_dict['search'].value
		};

		let res = await frappe.call({
			method: "posawesome.posawesome.page.kds.kds.get_kitchen_tickets",
			args: filters
		});

		this.render_tickets(res.message);
	}

	// -----------------------------------------------------
	// Render KDS Cards
	// -----------------------------------------------------
	render_tickets(tickets) {
		this.container.empty();

		if (!tickets || tickets.length === 0) {
			this.container.html('<div class="text-center text-gray-500 mt-10 text-lg">No tickets found.</div>');
			return;
		}

		tickets.forEach(t => {
			let color =
				t.status === "New" ? "#ffdfdf" :
				t.status === "Preparing" ? "#fff4ce" :
				t.status === "Ready" ? "#d4edda" :
				"#f0f0f0";

			let items_html = '';
			if (t.items && t.items.length > 0) {
				items_html = `
					<ul class="mt-2 border-t pt-2">
						${t.items.map(i => `
							<li class="flex justify-between mb-1">
								<span>${i.item_name}</span>
								<span class="font-bold">x${i.qty}</span>
							</li>
							${i.posa_notes ? `<p class="text-sm text-gray-600 ml-2">?? ${i.posa_notes}</p>` : ''}
						`).join('')}
					</ul>
				`;
			}

			let card = $(`
				<div class="rounded-xl shadow p-4 transition transform hover:scale-[1.02]" 
					style="background:${color}" data-ticket-name="${t.name}">
					<div class="flex justify-between items-center mb-2 border border-gray-400 rounded-lg p-2">
						<h3 class="font-bold text-lg">${t.kitchen_production_unit || 'Unknown Unit'}</h3>
						<span class="font-bold text-sm font-mono bg-yellow-200 text-gray-800 border border-yellow-400 rounded px-2 py-1" id="timer-${t.name.replace(/\W/g, '')}">
							--:--
						</span>
					</div>
					<p><b>Ticket:</b> ${t.name}</p>
					<p><b>Invoice:</b> ${t.sales_invoice || 'N/A'}</p>
					<p><b>Status:</b> <span class="text-blue-700">${t.status}</span></p>
					<p><b>Created:</b> ${frappe.datetime.str_to_user(t.creation)}</p>
					${items_html}
					<div class="mt-3 flex gap-2">
						${t.status !== "Preparing" ? `<button class="btn btn-sm btn-warning preparing">Preparing</button>` : ""}
						${t.status !== "Ready" ? `<button class="btn btn-sm btn-success ready">Ready</button>` : ""}
						${t.status !== "Served" ? `<button class="btn btn-sm btn-secondary served">Served</button>` : ""}
					</div>
				</div>
			`);

			card.find(".preparing").click(() => this.update_status(t.name, "Preparing"));
			card.find(".ready").click(() => this.update_status(t.name, "Ready"));
			card.find(".served").click(() => this.update_status(t.name, "Served"));

			this.container.append(card);
			// Start live timer for this ticket
			this.start_timer(t);
		});
	}

// -----------------------------------------------------
// Timer logic
// -----------------------------------------------------
start_timer(ticket) {
	let creation = frappe.datetime.str_to_obj(ticket.creation);
	let timer_id = `timer-${ticket.name.replace(/\W/g, '')}`;
	let timer_el = document.getElementById(timer_id);
	if (!timer_el) return;

	function updateTimer() {
		let now = new Date();
		let diff = Math.floor((now - creation) / 1000);
		let minutes = Math.floor(diff / 60);
		let seconds = diff % 60;
		timer_el.textContent = `${minutes}m ${seconds < 10 ? '0' : ''}${seconds}s`;
	}

	updateTimer();
	setInterval(updateTimer, 1000);
}

	update_status(ticket, status) {
		frappe.call({
			method: "posawesome.posawesome.page.kds.kds.update_ticket_status",
			args: { ticket_name: ticket, new_status: status },
			callback: (r) => {
				if (r.message && r.message.success) {
					frappe.show_alert(`Ticket ${ticket} marked as ${status}`);
					if (status === "Served") {
						$(`[data-ticket-name='${ticket}']`).fadeOut(400, function () {
							$(this).remove();
						});
					} else {
						this.refresh();
					}
				}
			}
		});
	}
}

frappe.realtime.on("new_kitchen_ticket", (data) => {
	addNewTicketToDisplay(data);
});

function addNewTicketToDisplay(data) {
	const container = document.querySelector("#kds-board");
	if (!container) return;
	const ticketHTML = `
		<div class="rounded-xl shadow p-4 bg-white mb-4">
			<h4>${data.unit}</h4>
			<p><b>Invoice:</b> ${data.ticket}</p>
			<p>Status: New</p>
		</div>
	`;
	container.insertAdjacentHTML("afterbegin", ticketHTML);
}
