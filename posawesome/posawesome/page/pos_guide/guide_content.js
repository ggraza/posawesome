// POS G2Virtu Guide: the content. Plain data, included into pos_guide.js.
// Markup in texts: **bold**, `code`, and > for a menu path (e.g. "POS Profile > Supermarket").
// Each article: id, s (section), t (title), roles, lead (purpose), where, setup, use, handle [[problem, what to do]], tips, links [[label, route]].
// Roles: owner, manager, cashier, captain, kitchen, store.

var POSA_GUIDE_ROLES = [
	{ id: "owner", label: "Owner / Admin", icon: "🏢", text: "Sets the system up, decides the rules, reads the reports." },
	{ id: "manager", label: "Store Manager", icon: "🧑‍💼", text: "Runs the store day to day: shifts, approvals, offers, cash, stock." },
	{ id: "cashier", label: "Cashier", icon: "🧾", text: "Sells at the till: scans, takes payment, prints, closes the shift." },
	{ id: "captain", label: "Captain / Waiter", icon: "🍽️", text: "Takes orders at the table and sends them to the kitchen." },
	{ id: "kitchen", label: "Kitchen", icon: "👨‍🍳", text: "Cooks from the kitchen display and marks orders ready." },
	{ id: "store", label: "Store Staff", icon: "📦", text: "Counts stock, receives goods, prints shelf labels." },
];

var POSA_GUIDE_SECTIONS = [
	{ id: "start", title: "Getting Started", icon: "🚀", text: "What POS G2Virtu is, who does what, the first setup and the daily flow." },
	{ id: "selling", title: "Selling at the Till", icon: "🛒", text: "Shifts, scanning, customers, payments, drafts, returns, printing." },
	{ id: "offline", title: "Offline and Devices", icon: "📶", text: "Selling without internet, the installable app, printers, scales, displays, price checker." },
	{ id: "promotions", title: "Offers and Promotions", icon: "🏷️", text: "POS offers, coupons, referral codes, deals, reduced labels." },
	{ id: "restaurant", title: "Restaurant and Fine Dining", icon: "🍽️", text: "Order types, tables, kitchen, waiter app, floor plan, bills, guests." },
	{ id: "supermarket", title: "Supermarket", icon: "🏬", text: "Cash control, fast checkout, payments, shelf labels, store work, management." },
	{ id: "tax", title: "Tax and FBR", icon: "🧾", text: "FBR invoices and tax on the receipt." },
	{ id: "admin", title: "Administration and Help", icon: "🛠️", text: "POS Profile map, permissions, updates, troubleshooting." },
];

var POSA_GUIDE = [
	// ============================================================ GETTING STARTED
	{
		id: "overview", s: "start", t: "What is POS G2Virtu", roles: ["owner", "manager", "cashier", "captain", "kitchen", "store"],
		lead: "POS G2Virtu is the point of sale of ERP for shops, supermarkets and restaurants. Every sale becomes a Sales Invoice in ERP, so stock, accounts and reports are always up to date.",
		where: ["Desk > **POS G2Virtu** (apps screen or sidebar)."],
		use: [
			"**RMS Terminal** (`/desk/rmsapp`): the till for retail, supermarket and restaurant counters.",
			"**Captain** (`/desk/waiterapp`): the waiter / captain app for tablets and phones.",
			"**Kitchen Display** (`/desk/kds`): orders for each kitchen station.",
			"**Live Order Status** (`/desk/los`): the screen for customers waiting for their order.",
			"**Price Checker** (`/desk/price_kiosk`): a scan-your-price screen for customers.",
			"Desk pages for managers: Till Monitor, Manager Dashboard, Shelf Labels, Stock Count and Receiving, Expo, and the reports.",
		],
		tips: ["Almost every feature is switched on or off in the **POS Profile**. A feature that is off changes nothing.", "Use the search box above to find any feature by name."],
		links: [["RMS Terminal", ["rmsapp"]], ["POS Profile list", ["List", "POS Profile"]]],
	},
	{
		id: "roles", s: "start", t: "Who does what (roles)", roles: ["owner", "manager"],
		lead: "Give each person only what they need. The POS reads the user's ERP roles and the users listed on the POS Profile.",
		use: [
			"**Owner / System Manager**: everything, including POS Profiles, certificates and setup.",
			"**Store Manager (Sales Manager)**: offers, deals, approvals, closing shifts, Till Monitor, dashboard and reports. Give them a **POS Manager PIN** if approvals are on.",
			"**Cashier (Sales User)**: add the user to the POS Profile table **Applicable for Users**.",
			"**Captain / Waiter**: add the user to **Applicable for Captain** on the POS Profile.",
			"**Kitchen**: only needs to open the Kitchen Display.",
			"**Store staff (Stock User)**: Stock Count and Receiving, Shelf Labels.",
			"**Price Checker** role: a kiosk user that can only see the price checker.",
		],
		handle: [
			["A cashier does not see the POS Profile.", "Add the user under POS Profile > Applicable for Users and reload the POS."],
			["A cashier can change prices or give discounts.", "Untick the rate / discount options on the POS Profile (POS Selling tab), or switch on manager approval (Supermarket > Cash Control)."],
		],
		links: [["User list", ["List", "User"]], ["POS Profile list", ["List", "POS Profile"]]],
	},
	{
		id: "first-setup", s: "start", t: "First-time setup checklist", roles: ["owner"],
		lead: "Do these once for each store or till group, in this order.",
		setup: [
			"**Company, warehouse, price list**: make sure the store warehouse and the selling price list exist, with Item Prices.",
			"**Modes of payment**: Cash and the cards / wallets you take, each with its account for the company.",
			"**POS Settings > Invoice Type = Sales Invoice.**",
			"**POS Profile**: company, warehouse, customer (walk-in), price list, payment methods, print format, users (Applicable for Users).",
			"**Offline and Devices tab**: tick **Enable Offline Mode** if the internet is not reliable; set the scale barcode prefixes if you sell weighed items.",
			"**Printing and FBR tab**: choose the receipt print format; set up QZ Tray for silent printing if wanted; FBR settings if you report to FBR.",
			"Switch on the extra features you need (Restaurant, Fine Dining, Supermarket tabs). Each one is off until ticked.",
			"Open **RMS Terminal** with a cashier user, open a shift, make a test sale and a return, close the shift.",
		],
		tips: ["Make one POS Profile per branch or till group with its own warehouse.", "Test new settings on one till before a busy day."],
		links: [["New POS Profile", ["Form", "POS Profile", "new"]], ["POS Settings", ["Form", "POS Settings"]], ["Mode of Payment", ["List", "Mode of Payment"]]],
	},
	{
		id: "daily-flow", s: "start", t: "The daily flow", roles: ["manager", "cashier"],
		lead: "A normal day at the till, from opening to closing.",
		use: [
			"**Open the shift**: RMS Terminal asks for the opening cash (float) of each payment mode.",
			"**Sell**: scan or search items, choose the customer if needed, press Pay, take the money, Submit (and print).",
			"**During the day**: hold carts, resume drafts, returns, cash pickups (supermarket) as needed.",
			"**Close the shift**: menu > Close Shift, count the cash and other payments, submit the POS Closing Shift.",
			"**Manager**: checks the closing (over / short), the Till Monitor and the dashboard, and the offline invoices list if any failed.",
		],
		handle: [["The close is refused because of offline invoices.", "Some sales made offline are still waiting to upload. Get the till online, wait for the upload (navbar chip), then close."]],
		links: [["POS Opening Shift", ["List", "POS Opening Shift"]], ["POS Closing Shift", ["List", "POS Closing Shift"]]],
	},

	// ============================================================ SELLING
	{
		id: "open-shift", s: "selling", t: "Opening a shift", roles: ["cashier", "manager"],
		lead: "Every sale belongs to a shift. The shift records who sold, on which POS Profile, and the cash at the start.",
		where: ["RMS Terminal opens the **Opening Shift** dialog by itself when the user has no open shift."],
		use: ["Choose the company and POS Profile.", "Enter the opening amount of each payment mode (usually only cash).", "Submit. The till is ready."],
		handle: [
			["The POS Profile is not in the list.", "The user is not in Applicable for Users of that profile."],
			["The internet is down when the till starts.", "With Enable Offline Mode the till uses the shift kept from the last online start and keeps selling."],
		],
		links: [["POS Opening Shift", ["List", "POS Opening Shift"]]],
	},
	{
		id: "sell", s: "selling", t: "Selling: scanning and searching", roles: ["cashier"],
		lead: "Add items by scanner, by typing, or by clicking the item cards.",
		use: [
			"**Scan** a barcode: the item is added (scanning again adds one more).",
			"**Search**: type words of the name, code or barcode in any order (\"sh palm hair\" finds Palmolive Anti-Hair Shampoo). Enter adds the item when only one matches.",
			"**Scale labels** (weighed items with a printed barcode): the weight or price in the barcode sets the quantity.",
			"**Quantity / UOM / rate**: click the line to change them (only what the POS Profile allows).",
			"The line just added or changed is highlighted, so you see which line a scan hit.",
		],
		handle: [
			["A barcode is not found.", "Add it to the Item (Barcodes table). With offline mode the till learns it at the next sync (seconds when online)."],
			["A scale label gives the wrong weight.", "Check POS Profile > Offline and Devices > Weighing Scale Barcodes: prefixes, item and value positions, decimals."],
		],
		tips: ["Supermarket tills can use quick keys, qty x scan (`12*`) and GS1 barcodes: see Supermarket > Fast Checkout."],
		links: [["Item list", ["List", "Item"]]],
	},
	{
		id: "customers", s: "selling", t: "Customers and loyalty", roles: ["cashier", "manager"],
		lead: "Choose a customer for credit sales, loyalty points, delivery, referral codes or e-receipts. Walk-in sales use the profile's default customer.",
		use: [
			"Search the customer by name, mobile or ID in the customer box; **New** to add one (offline too, when the profile allows it).",
			"The customer's discount, loyalty points and balance show when the profile has those options on.",
			"**Referral codes**: enter the code given by a friend to give the new customer their discount.",
		],
		handle: [["Customers cannot be edited.", "Editing a customer needs the connection; new customers can be added offline if Allow New Customer Offline is ticked."]],
		links: [["Customer list", ["List", "Customer"]], ["Referral Code", ["List", "Referral Code"]]],
	},
	{
		id: "payments", s: "selling", t: "Taking payment", roles: ["cashier"],
		lead: "Press **Pay**, enter the amounts in one or more payment modes, then Submit or Submit & Print.",
		use: [
			"Cash: type what the customer gives; the change is shown (and on the pole display).",
			"Split payments: put amounts in several modes.",
			"Credit sale (if allowed): leave part unpaid for a named customer.",
			"Supermarket extras (gift cards, Raast QR, card approval code, e-receipt) appear at Submit when switched on.",
		],
		handle: [
			["Submit fails with a server error.", "Read the message (stock, price, permission). If the server cannot be reached and offline mode is on, the sale is kept on the till and uploaded later."],
			["The connection dropped during Submit.", "Do not sell it again. The sale has a sale id, so the server makes one invoice only, even if it is retried."],
		],
	},
	{
		id: "drafts", s: "selling", t: "Hold, resume and drafts", roles: ["cashier", "captain"],
		lead: "Park a cart and serve the next customer, then come back to it.",
		use: ["**Hold** saves the cart as a draft (offline too).", "**Resume** lists the drafts of the shift; pick one to continue.", "Offers and discounts stay as they were when the draft is resumed."],
		handle: [["A draft appears twice.", "It should not: each sale has one id. Report it with both invoice numbers."]],
	},
	{
		id: "returns", s: "selling", t: "Returns", roles: ["cashier", "manager"],
		lead: "Refund items of an earlier sale. A return is a credit note against the original invoice.",
		use: ["Menu > **Return**, search the invoice, choose the items and quantities, refund in a payment mode.", "Return Without Invoice (if allowed on the profile) for items without a receipt."],
		handle: [
			["The return needs a manager.", "Supermarket > Cash Control > Returns needs approval: a manager enters the PIN or scans the card."],
			["Gift card sales cannot be returned.", "Block the gift card instead (POS Gift Card)."],
		],
	},
	{
		id: "exchange", s: "selling", t: "Item exchange and replacement", roles: ["cashier", "manager"],
		lead: "Swap items of an earlier sale in one step: the return and the new sale are made together and the difference is paid or refunded.",
		where: ["POS Profile > **Returns and Exchange** tab: Enable Item Exchange / Replacement, additional payment, refund, manager approval."],
		use: ["Return dialog > **Exchange / Replace Items**.", "Choose the invoice and the items going back, add the new items (scan works in the dialog).", "Check the settlement (to pay / to refund) and submit."],
		handle: [["An exchange must be undone.", "Open the POS Item Exchange record and use **Cancel Exchange** with a reason. Do not cancel the invoices one by one."]],
		links: [["POS Item Exchange", ["List", "POS Item Exchange"]]],
	},
	{
		id: "printing", s: "selling", t: "Receipts and printing", roles: ["cashier", "owner"],
		lead: "Receipts print with the POS Profile's print format, through the browser or silently through QZ Tray.",
		where: ["POS Profile > **Printing and FBR** tab."],
		use: ["**Submit & Print** prints at once; **Print Last Invoice** reprints.", "Menu > **QZ Tray Printer** chooses the printer of this computer and makes a test print."],
		handle: [
			["The browser print window opens every time.", "Set up QZ Tray (Offline and Devices > QZ Tray) and tick Use QZ Tray for Silent Print."],
			["The printer is out of paper.", "The till asks whether to print with the browser instead, so a sale is never printed twice."],
		],
		links: [["Print Format list", ["List", "Print Format"]]],
	},
	{
		id: "close-shift", s: "selling", t: "Closing a shift", roles: ["cashier", "manager"],
		lead: "At the end of the shift the cashier counts the money and the system compares it with the sales.",
		use: ["Menu > **Close Shift**.", "Count the cash (denominations if set) and the other modes.", "Submit the POS Closing Shift; print it with the closing print format (Z Report for supermarkets)."],
		handle: [
			["Expected amounts are hidden.", "That is Blind Close or Hide Expected Amount on the profile: the manager sees the difference on the closing."],
			["Offline invoices are waiting.", "The shift cannot be closed until they are uploaded."],
		],
		links: [["POS Closing Shift", ["List", "POS Closing Shift"]]],
	},

	// ============================================================ OFFLINE AND DEVICES
	{
		id: "offline-mode", s: "offline", t: "Selling offline", roles: ["owner", "manager", "cashier"],
		lead: "The till keeps the item catalogue (30,000+ items with barcodes and prices), customers and offers in the browser, so it can keep selling when the internet or the server is down.",
		where: ["POS Profile > **Offline and Devices** > Enable Offline Mode."],
		use: [
			"The first start downloads the catalogue (about 10 seconds for 30,000 items); after that only changes are fetched, live within seconds.",
			"When the server cannot be reached the sale is kept on the till with an offline id and a receipt is printed.",
			"When the connection returns, offline invoices upload by themselves, once each.",
			"The navbar chip shows invoices waiting / failed; failed ones can be retried or exported.",
		],
		handle: [
			["An offline invoice failed.", "Open the chip, read the error (stock, price, closed shift), fix it in ERP, then Retry. Back office sees them in POS Offline Invoice."],
			["The till shows old prices.", "Check the till is online; prices update within seconds. Reload if the chip shows sync errors."],
		],
		tips: ["Keep the POS tab open. To start the till without the server, switch on the PWA (next article)."],
		links: [["POS Offline Invoice", ["List", "POS Offline Invoice"]]],
	},
	{
		id: "pwa", s: "offline", t: "Install as an app and start offline (PWA)", roles: ["owner", "manager", "cashier", "captain"],
		lead: "Install the POS on a PC or tablet like an app, and open it even when the server is down.",
		where: ["POS Profile > **Offline and Devices** > Install as App and Start Offline (PWA). Needs https."],
		setup: ["Tick it and save.", "On each till, open the POS once while online (reload once more after a minute).", "Chrome / Edge: **Install** in the address bar or menu. iPad: Share > Add to Home Screen."],
		use: ["The app opens full screen. If the server is down it starts from the copy kept on the device and sells offline.", "When the server is back the till says **Connection is back**: reload when the cart is empty."],
		handle: [
			["\"The server cannot be reached\" page instead of the POS.", "This device never opened the POS online since the PWA was switched on. Connect once and open it."],
			["Turn it off.", "Untick it; each device removes it at its next start."],
		],
	},
	{
		id: "qz-tray", s: "offline", t: "QZ Tray: silent receipt printing and cash drawer", roles: ["owner"],
		lead: "QZ Tray is a small program on the till PC that lets the POS print to the receipt printer without the print window, and open the cash drawer.",
		setup: [
			"Install QZ Tray on the till PC (qz.io).",
			"POS Profile > Printing and FBR: tick **Use QZ Tray for Silent Print**; optionally **Raw Receipt Printing** (fast text receipts) and the width (42 for 80 mm, 32 for 58 mm).",
			"As System Manager: POS menu > QZ Tray Printer > **Set up Certificate**, download it and add it in QZ Tray (Site Manager), then restart QZ Tray.",
			"Choose the printer on each till (menu > QZ Tray Printer) and make a Test Print.",
		],
		handle: [["QZ Tray keeps asking Allow.", "The certificate is not imported, or the server was down (tick Remember this decision)."], ["Nothing prints.", "Is QZ Tray running? The till falls back to the browser print."]],
	},
	{
		id: "pole-display", s: "offline", t: "Customer pole display (VFD)", roles: ["owner", "cashier"],
		lead: "Shows the item, total, paid and change to the customer on a USB / serial pole display.",
		where: ["POS Profile > Offline and Devices > **Enable Customer Display (VFD)**: command set, baud rate, characters per line, idle lines."],
		use: ["Click the **Display** chip in the navbar the first time to choose the port; later it reconnects by itself.", "Chrome or Edge on https."],
		handle: [["The display shows garbage.", "Try another command set or baud rate in the POS Profile."]],
	},
	{
		id: "price-checker", s: "offline", t: "Price checker and kiosk screens", roles: ["owner", "manager"],
		lead: "A customer screen where shoppers scan a product and see its price, MRP, saving and offers. It can also show slides, videos and a ticker.",
		where: ["Page **Price Checker** (`/desk/price_kiosk`), with a user that has the Price Checker role. Screens are designed in **POS Kiosk Display**."],
		setup: ["Make a user with only the Price Checker role.", "Open the price checker on the kiosk PC; hold the store name 2 seconds for settings (POS Profile, screen name).", "Optional: make a POS Kiosk Display (layout, slides, ticker, timing, theme) for its POS Profile."],
		handle: [["Videos do not play offline.", "Kept media need https; keep videos MP4 / WebM under about 100 MB."]],
		links: [["Price Checker", ["price_kiosk"]], ["POS Kiosk Display", ["List", "POS Kiosk Display"]], ["POS Kiosk Device", ["List", "POS Kiosk Device"]]],
	},

	// ============================================================ PROMOTIONS
	{
		id: "pos-offers", s: "promotions", t: "POS Offers", roles: ["manager", "owner"],
		lead: "Automatic discounts and free items applied by the till: by item, item group, brand or bill total.",
		where: ["Desk > POS G2Virtu > Promotions > **POS Offer**."],
		setup: [
			"Choose **Apply On** (Item Code, Item Group, Brand or Transaction) and add the items / groups / brands to the lists.",
			"Choose what it gives: Give Product (free item), Item Price (discount on the line) or Grand Total.",
			"Set the minimum quantity / amount, the dates, and the POS Profile (or all).",
			"**Repeat For Every Min Quantity**: buy 10 get 1, buy 20 get 2 and so on (Max Free Quantity to cap it).",
			"**Show Item Details** lists every item with TP, MRP, sale rate, valuation and the margin after the discount.",
		],
		use: ["Offers apply by themselves while the cashier scans; the offers panel shows what applied.", "Open tills get a new or changed offer within seconds."],
		handle: [["An offer does not apply.", "Check dates, POS Profile, company, minimum quantity, and (supermarket) its daily hours / days."], ["Two offers on the same line.", "An offer is never stacked on a line that already has one."]],
		links: [["POS Offer list", ["List", "POS Offer"]]],
	},
	{
		id: "coupons", s: "promotions", t: "Coupons and referral codes", roles: ["manager", "cashier"],
		lead: "Coupons are codes for a campaign or a customer; referral codes reward customers who bring friends.",
		use: ["Make a **POS Coupon** (linked to a POS Offer) with validity and usage limit.", "The cashier types or scans the code in the coupons panel.", "**Referral Code**: each customer's code gives the new customer a discount and the referrer a coupon."],
		links: [["POS Coupon", ["List", "POS Coupon"]], ["Referral Code", ["List", "Referral Code"]]],
	},
	{
		id: "deals", s: "promotions", t: "Mix and match and multi-buy deals (supermarket)", roles: ["manager"],
		lead: "\"Any 3 juices for Rs 999\" or \"3 soaps for Rs 500\": the till prices the lines by itself.",
		where: ["POS Profile > Supermarket > Promotions: **Mix and Match Deals** / **Multi-Buy Deals**. Deals: **POS Deal**."],
		setup: ["Make a POS Deal: type, quantity, deal price, repeat, items / groups / brands, dates, hours, days, POS Profiles."],
		use: ["The deal applies when the cart has enough items; the saving is shared over the lines.", "Lines with a POS Offer, a manual discount or a reduced label are left out: existing offers always win."],
		handle: [["The deal is not cheaper.", "A deal is used only when it lowers the price."]],
		links: [["POS Deal", ["List", "POS Deal"]]],
	},
	{
		id: "markdowns", s: "promotions", t: "Reduced-price labels (markdowns)", roles: ["manager", "store", "cashier"],
		lead: "Sell near-expiry or damaged items at a reduced price with their own barcode label.",
		where: ["POS Profile > Supermarket > Promotions > **Reduced-Price Labels**. Documents: **POS Markdown**."],
		setup: ["Make a POS Markdown: item, reduced price, number of labels, sell until. Submit.", "Print with the **Markdown Labels** print format and stick them on the items."],
		use: ["Scanning a label sells that one item at the reduced price; the same label cannot be sold twice."],
		links: [["POS Markdown", ["List", "POS Markdown"]]],
	},
	{
		id: "you-saved", s: "promotions", t: "Time and day offers, \"You saved\" on the receipt", roles: ["manager"],
		lead: "Run offers only at certain hours or days, and show customers how much they saved.",
		where: ["POS Profile > Supermarket > Promotions: **Time and Day Offers**, **You Saved on the Receipt**."],
		use: ["POS Offer > Daily From / Daily To / Days (e.g. Fri,Sat; 22:00 to 02:00 runs past midnight).", "Receipts list the savings (offers, deals, reduced items, discounts, below MRP). Print format **POS Receipt Savings** for HTML receipts."],
	},

	// ============================================================ RESTAURANT
	{
		id: "restaurant-setup", s: "restaurant", t: "Restaurant setup: order types, zones, tables, kitchen", roles: ["owner", "manager"],
		lead: "Set up how orders flow from the counter or the waiter to the kitchen.",
		where: ["POS Profile > **Restaurant and KDS** tab."],
		setup: [
			"**Order types** (dine in, take away, delivery) and **Service zones / Service tables**.",
			"**Kitchen Production Units / Stations**: which item groups go to which kitchen screen or printer.",
			"**KOT**: tick Allow KOT; choose whether a KOT is made on each save.",
			"**Captains**: add waiter users to Applicable for Captain.",
		],
		links: [["Service Table", ["List", "Service Table"]], ["Kitchen Production Unit", ["List", "Kitchen Production Unit"]], ["Order Type", ["List", "Order Type"]]],
	},
	{
		id: "waiter-app", s: "restaurant", t: "Captain / waiter app", roles: ["captain"],
		lead: "Waiters take orders at the table on a phone or tablet; the order goes straight to the kitchen.",
		where: ["Page **Captain** (`/desk/waiterapp`)."],
		use: ["Choose the table and guests, add items (options and notes), **Make KOT** to send.", "Add more items later: only the new items go to the kitchen.", "With **Waiter App Works Offline** (Fine Dining) the order is kept on the tablet when Wi-Fi drops and sent when it returns."],
		handle: [["An item cannot be added.", "It may be 86'd (sold out today) or need a required option."]],
		links: [["Captain", ["waiterapp"]]],
	},
	{
		id: "kds", s: "restaurant", t: "Kitchen display and Live Order Status", roles: ["kitchen", "manager"],
		lead: "The kitchen sees every order for its station, with timers; customers see when their order is ready.",
		where: ["Pages **Kitchen Display** (`/desk/kds`) and **Live Order Status** (`/desk/los`)."],
		use: ["Tickets arrive by themselves; tap to start, mark ready.", "Fine Dining adds: finish single items, recall, target minutes (amber / red), VOID tickets in red, allergy banners, course headings."],
		links: [["Kitchen Display", ["kds"]], ["Live Order Status", ["los"]], ["Kitchen Ticket", ["List", "Kitchen Ticket"]]],
	},
	{
		id: "fine-dining", s: "restaurant", t: "Fine dining: guests, seats, options, courses", roles: ["manager", "captain", "cashier"],
		lead: "Full-service features, each with its own checkbox.",
		where: ["POS Profile > Restaurant and KDS > **Fine Dining** (Enable Fine Dining, then each feature)."],
		use: [
			"**Guests (covers)** asked after choosing a table; **Seat numbers** on items.",
			"**Item options** from POS Modifier Group (required choices, paid add-ons).",
			"**Courses** (POS Course): held courses stay back until **Fire Mains**.",
			"**Void / Comp with reason**: taking off a sent item needs a reason (and a manager if set); a VOID ticket goes to the kitchen.",
			"**Pre-Bill**: prints the Guest Check (not a tax invoice).",
		],
		handle: [["Saving refuses because of a removed item.", "The item was already sent to the kitchen: give the void reason (and manager approval)."]],
		links: [["POS Modifier Group", ["List", "POS Modifier Group"]], ["POS Course", ["List", "POS Course"]], ["POS Void Reason", ["List", "POS Void Reason"]]],
	},
	{
		id: "floor-bill", s: "restaurant", t: "Floor plan, moving tables, split bill, service charge, tips", roles: ["captain", "cashier", "manager"],
		lead: "See every table live, move guests, and split or adjust the bill.",
		where: ["POS Profile > **Fine Dining: Floor and Bill**."],
		use: [
			"**Floor**: tables coloured by status; tap a table to open, move, merge or hand over its order.",
			"**Split**: by seat, by item or equal shares.",
			"**Service charge** (% of net, from N guests) and **Tip** rows with their own accounts.",
			"Tables need cleaning after payment (if ticked) until marked available.",
		],
		links: [["POS Fine Dining Staff Report", ["query-report", "POS Fine Dining Staff Report"]]],
	},
	{
		id: "kitchen-expo", s: "restaurant", t: "Expo screen, 86 list and allergens", roles: ["kitchen", "manager", "captain"],
		lead: "Control the pass, sold-out dishes and allergies.",
		where: ["POS Profile > **Fine Dining: Kitchen**. Page **Expo (Pass)** (`/desk/fd_expo`)."],
		use: ["**Expo**: a card per table with its courses (held, cooking, ready); **Serve** a course.", "**86**: mark a dish unavailable today; no till can add it.", "**Allergens**: record guests' allergies; matching items are flagged on the order and the kitchen ticket."],
		links: [["Expo", ["fd_expo"]], ["POS Allergen", ["List", "POS Allergen"]]],
	},
	{
		id: "guests", s: "restaurant", t: "Reservations, guest profiles, feedback", roles: ["manager", "captain"],
		lead: "Bookings and a waitlist, guests you remember, and feedback by QR code.",
		where: ["POS Profile > **Fine Dining: Guests**."],
		use: ["**Floor > Bookings**: today's bookings and the waitlist; Seat, Arrived, No Show.", "**Guest profile** on the Customer: VIP, preferences, allergies, birthday; shown when the guest is chosen.", "**Feedback**: the guest check prints a QR to a short form; answers are in POS Guest Feedback."],
		links: [["POS Reservation", ["List", "POS Reservation"]], ["POS Guest Feedback", ["List", "POS Guest Feedback"]], ["POS Fine Dining Analytics", ["query-report", "POS Fine Dining Analytics"]]],
	},

	// ============================================================ SUPERMARKET
	{
		id: "sm-switch", s: "supermarket", t: "Supermarket features: how to switch them on", roles: ["owner", "manager"],
		lead: "All supermarket features live on the POS Profile tab **Supermarket**. Nothing changes until **Enable Supermarket Features** is ticked; then each feature has its own checkbox.",
		where: ["POS Profile > **Supermarket** tab: Cash Control, Till Speed, Promotions, Payments and Customers, Shelf-Edge Labels, Store, Management."],
		tips: ["Switch on one group at a time, test on one till, then the rest.", "Reload the POS on the tills after changing the profile."],
		links: [["POS Profile list", ["List", "POS Profile"]]],
	},
	{
		id: "sm-approval", s: "supermarket", t: "Manager approval (PIN / card)", roles: ["manager", "cashier", "owner"],
		lead: "Sensitive actions need a manager: price changes, big discounts, voids, No Sale, reprints, returns, cash out.",
		where: ["POS Profile > Supermarket > **Cash Control**: Manager Approval, which actions, discount limit, managers table, when the till is offline."],
		setup: ["List the managers on the profile.", "Each manager makes a **POS Manager PIN** (4-8 digits, optional card number). PINs are stored as hashes, never sent to the tills."],
		use: ["When an action needs approval, the PIN window opens: the manager types the PIN or scans the card.", "5 wrong tries lock the cashier for 5 minutes.", "Every approval and refusal is in **POS Approval Log**."],
		handle: [
			["The internet is down and an approval is needed.", "Not Allowed (default): the action waits for the connection. Allow and Log: it goes ahead and is logged as Offline for review."],
			["A manager forgot the PIN.", "Open their POS Manager PIN and set a new one."],
		],
		links: [["POS Manager PIN", ["List", "POS Manager PIN"]], ["POS Approval Log", ["List", "POS Approval Log"]]],
	},
	{
		id: "sm-cash", s: "supermarket", t: "Voids, cash drawer, cash pickups, X / Z reports, training", roles: ["manager", "cashier"],
		lead: "Keep the drawer under control during the shift.",
		where: ["POS Profile > Supermarket > **Cash Control**."],
		use: [
			"**Void with reason**: removing items or cancelling the cart asks a reason (POS Void Reason); kept in POS Void Log.",
			"**Cash drawer**: opens on cash sales through QZ Tray; menu > **No Sale** opens it with a reason (POS Drawer Log).",
			"**Cash Pickup / Cash In / Cash Out** (menu): counted in the expected cash; optional Journal Entries; Drawer Cash Limit reminds the cashier.",
			"**X Report** (menu): the shift so far. **Z Report**: the closing print format.",
			"**Blind Close**: the cashier does not see the expected cash.",
			"**Training mode**: practice sales that are never submitted (trainees always train).",
		],
		links: [["POS Void Log", ["List", "POS Void Log"]], ["POS Cash Movement", ["List", "POS Cash Movement"]], ["POS Drawer Log", ["List", "POS Drawer Log"]]],
	},
	{
		id: "sm-speed", s: "supermarket", t: "Fast checkout: quick keys, scale, qty x scan, GS1, hotkeys", roles: ["cashier", "manager"],
		lead: "Fewer keystrokes per customer.",
		where: ["POS Profile > Supermarket > **Till Speed**."],
		use: [
			"**Quick keys** (POS Quick Key Page): the Quick Keys chip opens pages of big buttons for fruit, vegetables, bakery.",
			"**Weighed items** (UOMs like Kg) ask the weight; **Read Weight From Scale** reads it from a USB scale (Scale chip).",
			"**Qty x Scan**: type `12*` then scan, or `3*CODE`.",
			"**GS1 barcodes**: weight, price, batch and expiry from the barcode; expired products refused.",
			"**Hotkeys**: your own keys (F1-F12, Ctrl / Alt) for Pay, Hold, Void Last Item, No Sale, X Report and more.",
		],
		links: [["POS Quick Key Page", ["List", "POS Quick Key Page"]]],
	},
	{
		id: "sm-payments", s: "supermarket", t: "Gift cards, store credit, Raast QR, card approval, e-receipts, age check", roles: ["manager", "cashier"],
		lead: "More ways to pay, and customer extras.",
		where: ["POS Profile > Supermarket > **Payments and Customers**."],
		use: [
			"**Gift cards**: menu > Gift Card to sell / top up / check balance; pay with the gift card mode (needs the connection).",
			"**Store credit**: refund a return onto a gift card.",
			"**Wallet / Raast QR**: the QR shows with the bill amount; the cashier presses Paid (and types the transaction ID).",
			"**Card approval code**: asked from the card slip (or from a card machine bridge).",
			"**E-receipt**: sent by WhatsApp (WhatsBridge) or SMS to customers who want it or a number asked at payment.",
			"**Age check**: items with Minimum Age to Buy ask the cashier once per sale.",
		],
		links: [["POS Gift Card", ["List", "POS Gift Card"]]],
	},
	{
		id: "sm-labels", s: "supermarket", t: "Shelf-edge labels", roles: ["store", "manager"],
		lead: "Keep the shelf price the same as the till price: price changes and offers line up labels to print.",
		where: ["POS Profile > Supermarket > **Shelf-Edge Labels**. Page **Shelf Labels** (`/desk/shelf_labels`)."],
		setup: ["Tick it and save the profile (4 standard templates are made).", "Choose the template, the label printer (QZ Tray name) and when labels queue (price changes, offers, minimum change)."],
		use: ["Open Shelf Labels: tick the labels, **Print** (A4 sheets through the browser / QZ, or Zebra / TSC raw through QZ Tray).", "Scan a barcode on the page to add a label; Item and Item Price have **Print Shelf Label**.", "Report **Shelf Label Check** lists wrong or missing labels."],
		handle: [["Labels print the wrong size.", "Edit the template (width, height, columns, rows) or make your own in POS Shelf Label Template."]],
		links: [["Shelf Labels", ["shelf_labels"]], ["POS Shelf Label Template", ["List", "POS Shelf Label Template"]], ["Shelf Label Check", ["query-report", "Shelf Label Check"]]],
	},
	{
		id: "sm-store", s: "supermarket", t: "Stock count, goods receiving, stock requests, low stock", roles: ["store", "manager", "cashier"],
		lead: "Store work on a phone or handheld, linked to the same stock as the tills.",
		where: ["POS Profile > Supermarket > **Store**. Page **Stock Count and Receiving** (`/desk/sm_store`)."],
		use: [
			"**Stock count**: scan and count (works offline); **Make Stock Reconciliation** makes a draft for the manager.",
			"**Goods receiving**: choose the Purchase Order, scan what came; short and extra items are shown; **Make Purchase Receipt** makes a draft.",
			"**Request Stock** (till menu): a Material Request to this warehouse.",
			"**Low Stock** (till menu): items at or below their re-order level.",
		],
		handle: [["A draft must be checked.", "Stock Reconciliation and Purchase Receipt are drafts: a manager reviews and submits them."]],
		links: [["Stock Count and Receiving", ["sm_store"]], ["Stock Reconciliation", ["List", "Stock Reconciliation"]], ["Purchase Receipt", ["List", "Purchase Receipt"]]],
	},
	{
		id: "sm-manage", s: "supermarket", t: "Till Monitor, Manager Dashboard and reports", roles: ["manager", "owner"],
		lead: "See every till live, today's sales, and where money leaks.",
		where: ["POS Profile > Supermarket > **Management**."],
		use: [
			"**Till Monitor**: every till as Live, Offline (invoices waiting) or Not Reporting; cashier, shift, sales, failed uploads. Rename tills in POS Till Status.",
			"**Manager Dashboard**: sales, basket, items per basket, returns, discounts, voids, sales per hour, cashiers, top items.",
			"**POS Loss Prevention**: voids, No Sales, overrides, refused approvals and returns per cashier or shift, with what to look at.",
			"**POS Offer Effectiveness**: sales, discount and margin of each offer / deal / reduced label, against the days before.",
			"**POS Fast and Slow Movers**: per item sold, per day, days of stock left, last sold; fast / slow / dead.",
		],
		links: [["Till Monitor", ["sm_till_monitor"]], ["Manager Dashboard", ["sm_dashboard"]], ["POS Loss Prevention", ["query-report", "POS Loss Prevention"]], ["POS Offer Effectiveness", ["query-report", "POS Offer Effectiveness"]], ["POS Fast and Slow Movers", ["query-report", "POS Fast and Slow Movers"]]],
	},

	// ============================================================ TAX
	{
		id: "fbr", s: "tax", t: "FBR invoices", roles: ["owner", "manager"],
		lead: "Invoices are sent to FBR when they are printed, and the FBR number is printed on the receipt.",
		where: ["POS Profile > **Printing and FBR**: Allow FBR on Submit, POS ID, NTN, STRN, token."],
		use: [
			"Submit & Print sends first, then prints with the number.",
			"Submit without printing does not send; a reprint sends only if there is no number yet (never twice).",
			"Offline sales that were printed are sent after they upload.",
		],
		handle: [["An invoice has no FBR number.", "It was not printed, or FBR was unreachable: reprint it to send it."]],
	},

	// ============================================================ ADMIN
	{
		id: "profile-map", s: "admin", t: "POS Profile: where each setting is", roles: ["owner", "manager"],
		lead: "The POS Profile has tabs in the order you set a till up.",
		use: [
			"**Details / Accounting / POS Configurations / More Info**: ERP basics, accounts, users, print format.",
			"**POS Selling**: cart, rates and discounts, payments and credit.",
			"**Returns and Exchange**: returns, item exchange.",
			"**Customers and Orders**: customers, sales orders, delivery charges.",
			"**Screen and Search**: layout, search, performance.",
			"**Shift and Cash**: shift, denominations, cash mode.",
			"**Printing and FBR**: print formats, QZ Tray, FBR.",
			"**Restaurant and KDS**: KOT, order types, zones, captains, buffet, fine dining.",
			"**Offline and Devices**: offline mode, PWA, scale barcodes, pole display.",
			"**Supermarket**: all supermarket features.",
			"**Help**: the short guide of the profile.",
		],
		links: [["POS Profile list", ["List", "POS Profile"]]],
	},
	{
		id: "updates", s: "admin", t: "Updating the app", roles: ["owner"],
		lead: "How to install a new version safely.",
		setup: [
			"Back up first: `bench --site <site> backup --with-files`.",
			"Replace the app folder with the new one (do not unzip on top of the old folder).",
			"`bench --site <site> migrate`, `bench build --app posawesome`, `bench restart`.",
			"Reload the POS on every till (Ctrl+Shift+R).",
		],
		tips: ["Try every update on a staging copy of the site first."],
	},
	{
		id: "troubleshooting", s: "admin", t: "Troubleshooting", roles: ["owner", "manager", "cashier"],
		lead: "Common problems and what to do.",
		handle: [
			["The POS G2Virtu workspace shows shortcuts but no cards.", "Run `bench --site <site> execute posawesome.posawesome.workspace_links.check`; then `bench --site <site> migrate` removes broken links."],
			["The till is slow to start.", "The first start downloads the catalogue; later starts use the kept copy. Keep Enable Offline Mode on."],
			["Sales are missing in ERP.", "Check the navbar chip and POS Offline Invoice for invoices waiting or failed."],
			["A change in the POS Profile does not show on the till.", "Reload the POS page on the till."],
			["An error message with a long traceback.", "Copy it (the error report of the desk) and send it to your support with the time and the till."],
		],
		links: [["POS Offline Invoice", ["List", "POS Offline Invoice"]], ["Error Log", ["List", "Error Log"]]],
	},
];
