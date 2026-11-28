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
			to_date: this.page.fields_dict['to_date'].value
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

			let card = $(`
				<div class="rounded-xl shadow p-4 transition transform hover:scale-[1.02]" style="background:${color}" data-ticket-name="${t.name}">
					<h3 class="font-bold text-lg mb-2">${t.kitchen_production_unit || 'Unknown Unit'}</h3>
					<p><b>Invoice:</b> ${t.sales_invoice || 'N/A'}</p>
					<p><b>Status:</b> <span class="text-blue-700">${t.status}</span></p>
					<p><b>Time:</b> ${frappe.datetime.str_to_user(t.creation)}</p>
					<div class="mt-2 flex gap-2">
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
		});
	}

	// -----------------------------------------------------
	// Update Status
	// -----------------------------------------------------
	// -----------------------------------------------------
	// Update Status
	// -----------------------------------------------------
	update_status(ticket, status) {
	    frappe.call({
	        method: "posawesome.posawesome.page.kds.kds.update_ticket_status",
	        args: {
	            ticket_name: ticket,
	            new_status: status
	        },
	        callback: (r) => {
	            if (r.message && r.message.success) {
	                frappe.show_alert(`Ticket ${ticket} marked as ${status}`);
	
	                // If the status is "Served", hide/remove the card from the screen
	                if (status === "Served") {
	                    $(`[data-ticket-name='${ticket}']`).fadeOut(400, function() {
	                        $(this).remove();
	                    });
	                } else {
	                    // Otherwise refresh the list (optional)
	                    this.refresh();
	                }
	            }
	        }
	    });
	}
}

// -----------------------------------------------------
// Real-time handler
// -----------------------------------------------------
frappe.realtime.on("new_kitchen_ticket", (data) => {
	addNewTicketToDisplay(data);

	if (data.sound) {
		const audio = new Audio(data.sound);
		audio.play().catch((err) => {
			console.warn("Unable to play sound:", err);
		});
	}
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
