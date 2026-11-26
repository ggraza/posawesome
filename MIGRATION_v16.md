# POS Awesome (G2Virtu fork): v14 to Frappe / ERPNext v16 migration notes

App version 16.0.0. Built and checked against Frappe 16.53 / ERPNext 16.52.1, Python 3.14, Vue 3.5, and Vuetify 3.13.

## 1. Install / upgrade

```bash
# on the v16 bench
cd ~/frappe-bench
bench get-app /path/to/posawesome          # or replace apps/posawesome with this folder
bench setup requirements                   # installs pyqrcode + pypng and the npm deps (vue 3, vuetify 3, @mdi/font)
bench --site <site> migrate                # creates POS Offline Invoice, new custom fields, indexes
bench build --app posawesome
bench restart
```

Back up first: `bench --site <site> backup --with-files`.

After migrating:

* **POS Settings → Invoice Type must be "Sales Invoice".** The app creates Sales Invoices, as it did on v14.
* For each POS Profile, open the **"POS Offline & Scale"** tab:
  * **Enable Offline Mode**: turn on for the terminals that should keep selling without the server. A profile that had the v14 checkbox **Enable Offline Invoices** (`posa_enable_offline_invoices`) ticked keeps working offline without changes.
  * **Scale Barcode Prefixes**: comma-separated, for example `21,22`. Also set the item/value positions for your scale labels. The defaults are EAN-13 with a 7-digit item part (looked up as an Item Barcode or Item Code) and a 5-digit weight with 3 decimals, which is the v14 behaviour.
* The POS opens at `/app/rmsapp` (retail) and `/app/waiterapp` (waiter/captain).
  * The old pages `posapp`, `retailapp`, `rmsapp2`, `mobileapp`, `price_checker` and `pricechecker` now forward to `rmsapp`. Their Vue 2 sources were never in the repository, only in a prebuilt v14 bundle that cannot run on v16.
* **POS Offers:** migrate copies each offer's single Item / Item Group / Brand into the new lists (see section 2), so existing offers keep working unchanged.

### Custom fields (fixtures)

`fixtures/custom_field.json` holds **244 custom fields**, and `hooks.py` filters on exactly these names. They were taken from the live site's Customize Form (POS Profile, Sales Invoice) and its full Custom Field export (`Custom_Field_all.csv`), plus the new v16 offline, scale and pole display fields.

* **POS Profile / Sales Invoice:** all child tables (`applicable_for_captain`, `pos_service_zone`, `pos_order_type`, `custom_denominations`, `custom_role_permissions`, `posa_offers`, `posa_coupons`) and the KOT, KDS, FBR, buffet and service-zone settings.
  * The field order comes from the Customize Form export. The raw `insert_after` values in the CSV are out of date for these two forms.
* **Added from the CSV:** 24 fields the fixtures lacked, 20 of which are still shipped (the other 4 are listed under "Not shipped"):
  * Sales Invoice Item:
    * the sales-person commission fields (`posa_sales_person`, `posa_allocated_percentage`, `posa_commission_rate`, `posa_incentives`), which `overrides/sales_invoice.py` uses
    * `reduce_value`, `maximum_retail_price`, `return`, `issue`, `issue_2`, `custom_rfid_no`
  * UOM Conversion Detail: `standard_selling`/`buying` and `default_selling`/`buying`, used by the item-price sync events
  * Customer: `short_name`, `custom_customer_id`, `custom_erp_code`. Sales Invoice fetches `short_name` and `custom_erp_code` from Customer, so these were needed.
  * Also `Sales Order-short_name`, `Work Order-item_group` and `POS Closing Shift-custom_cell_number`.
* **Pole display fields use the v14 names** (`posa_enable_vfd`, `posa_vfd_command_set`, `posa_vfd_baud_rate`, `posa_vfd_columns`, `posa_vfd_line_1`, `posa_vfd_line_2`), so a v14 site that already has them keeps its settings and gets no second set. Migrate moves the values of the first v16 build's names (`posa_vfd_protocol`, `posa_vfd_welcome_line1/2`, `posa_vfd_thank_you`) into these and deletes those fields.
* **Checked automatically:**
  * no name clashes with v16 standard fields
  * every Link/Table target exists
  * every `insert_after` anchor exists
  * every `fetch_from` points to an existing field
* **Not shipped:** these belong to another app on your site, or point to fields that exist nowhere in frappe, erpnext or posawesome, so a fresh site would fail or break on save. They remain on your upgraded database.
  * `Sales Invoice`: `cash_deposit` (Table of *Cash Deposit*) and `total_deposit`, `remaining`, `balance`, `battery`, `mobileshop_type`, `pad`, `from`, `to`. They are not in the site's Custom Field list and fetch from a `mobile_shop` link field that Sales Invoice does not have.
  * `Item-short_name` fetches `item_group.short_name`, a field Item Group does not have.
  * `Sales Invoice Item-urdu_name` fetches `item_code.urdu_name`.
  * `Sales Invoice Item-custom_pctcode` and `min_sales_order_qty` fetch from `item.*`, but Sales Invoice Item has no `item` field.
  * `Sales Invoice-posa_client_request_id` from the v14 no-duplicate patch: v16 solves the same problem with the sale id (`posa_offline_id`, see "One invoice per sale"). The field stays on an upgraded database and is ignored.
* The CSV was saved through a spreadsheet, which turned the default of `Sales Invoice-custom_cell_number` into `9.23008E+11`. The original `923008278899` is kept.
* `posa_scale_barcode_start` changes from Int to Data, so several prefixes can be entered (`21,22`), and it moves to the "POS Offline & Scale" tab. Existing values are kept.
* Fields referenced in code but defined on no site: `print_format_for_online`, `custom_payment_entry_print_format`, `custom_purchase_receipt_print_format`. The code falls back to the profile's print format.

## 2. What changed

### Backend (Python)
* Packaging moved from `setup.py` to `pyproject.toml` (flit), with `requires-python >=3.14`, frappe/erpnext `>=16,<17`, and `required_apps = ["erpnext"]`.
* v16 API changes:
  * Serial and Batch Bundle: invoice rows now set `use_serial_batch_fields`.
  * The removed `set_batch_nos` / `get_batch_no` were reimplemented.
  * `get_party_bank_account` moved.
  * `get_existing_payment_request_amount(ref_doc)` has a new signature.
  * The query engine no longer accepts string SQL functions; sums are now done in Python.
  * Single doctypes are read with `get_single_value`.
* Broken hook targets fixed: the Stock Entry cancel hook and `after_migrate`. The old `install_assets` reference was removed.
* SQL injection in `get_customer_addresses` fixed.
* `qrcode` replaced by `pyqrcode`.
* Python files that were not valid UTF-8 were re-encoded.
* POS Closing Shift refuses to close while that shift still has offline invoices waiting to upload or failing.

### Frontend (Vue 2 → Vue 3, Vuetify 2 → 3)
* One lazy bundle, `posawesome.bundle.js`, is loaded only by the POS pages. The desk gets the small `posawesome_desk.bundle.js`.
* The event bus (`$on/$emit` on the root, removed in Vue 3) is replaced by `shared/event_bus.js`, with the same API.
* Every component was migrated. Vuetify 3 props, slots, data-table headers and `click:row` signatures, async `v-form.validate()`, date pickers (`PosDatePicker` keeps the `YYYY-MM-DD` string model) and `v-model` on custom components were all converted.
* The POS no longer wipes the desk DOM. It mounts full screen and restores the desk when you navigate away.
* lodash removed.

### POS Offers (ported from the v14 patches)

| Area | How it works |
| --- | --- |
| Several targets per offer | **Apply On** Item Code / Item Group / Brand now takes a list: tables **Offer Items** (POS Offer Item), **Offer Item Groups** (POS Offer Item Group) and **Offer Brands** (POS Offer Brand). The old single field is kept equal to the first row, so reports and older code still work. Migrate (`pos_offer.copy_single_targets`) fills the lists from the single fields of existing offers. `get_offers` and the offline bootstrap send the lists; the cart, the offers panel and the price checker match an item against any row (`offline/offer_targets.js`). A Give Product offer on several items gives the item that triggered it. |
| Discount Category | Select: Seasonal, Quantity Base, Stock Clearance, Happy Hours. For information and reporting. |
| Item details (for the offer creator) | Section **Offer Items** with three price lists: **Buying Price List** (Current TP), **MRP Price List** and **Sale Price List** (defaults: the profile's buying list, `posa_mrp_price_list`, selling list). Each Offer Items row shows Barcode, UOM, Packing (conversion factor), Current TP, MRP, Sale Rate, Valuation Rate, GP Rate, GP %, Disc Amt, Disc Price, After Disc. GP Amount and After Disc. GP %. Valuation is the average Bin valuation rate (the offer's warehouse if set) times the UOM factor; GP % is on the TP; the discount follows the offer (Item Price / Grand Total; Percentage, Amount or Rate). Rows refresh when an item, UOM or price list changes, and on save. |
| Item Group / Brand offers | Button **Show Item Details** opens a popup with the same columns for every sales item of the chosen groups or brands (up to 1,000 rows), with a search box and Sr numbers. Also works for Item Code offers. |
| Resume with offers | A held or saved invoice that is resumed keeps each row's offer: the discount is not applied twice, and adding qty to an offer row keeps the offer price. `stock_qty`, `item_group` and `brand` are kept on the rows (offline drafts fall back to the catalogue). An offer is never stacked on a row that already has one; removing an offer restores the original price with the right precision. |
| Repeat free product | **Repeat For Every Min Quantity** (Give Product): one offer gives buy 10 get 1, buy 20 get 2, buy 30 get 3 ... Free qty = Given Quantity × full multiples of Min Quantity, optionally capped by **Max Free Quantity**. The free row follows the cart as qty changes (also after resume, offline and in the waiter app). Not combined with Replace Same Item / Replace Cheapest Item (refused on save); Min Quantity required. The price checker and kiosk show "Buy 10 get 1 free, buy 20 get 2 ...". |
| Cart row highlight | The row just added or changed is tinted (yellow, dark theme supported) with a short flash, so the cashier sees which line a scan hit. |

### Offline mode (new)

| Area | How it works |
| --- | --- |
| Catalogue | Items, barcodes, UOMs, item taxes, Item Prices (selling list, MRP list, customer price lists, validity dates), Bin stock, customers, offers, coupons, delivery charges and tax templates are stored in **IndexedDB** per site and profile. The first download is paged with keyset (`modified,name`) pagination. After that, a delta sync runs every N minutes (profile setting), plus deletions from the Deleted Document log. |
| Live updates | When one of these is created, updated, renamed or deleted in ERPNext, every open POS gets a realtime event and runs a delta sync about 2 s later: **Customer, POS Offer, POS Coupon, Referral Code, RFID Card, Item** (barcodes, UOMs, `max_discount`, item taxes), **Item Group, Item Price, Price List** (`selling_price_list`, `posa_mrp_price_list`), **POS Profile, Delivery Charges, Sales Taxes and Charges Template, Item Tax Template**. Hooks are in `hooks.py`; the code is in `api/offline_events.py`. New offers appear in the open invoice straight away. If the profile's item groups or customer groups change, those tables are downloaded again and out-of-scope rows are removed. Bulk changes are coalesced: one queued job per burst, and at most one terminal sync every 10 s. Events missed while a terminal is offline are caught up on reconnect, and the periodic sync remains the fallback. Needs the bench's socket.io (`bench start` / supervisor `node-socketio`) and a worker on the `short` queue. Stock (Bin) still follows the periodic sync. |
| Item lookup | Barcode, scale barcode, item code and ranked name search run against an in-memory index. The terminal uses it only after one **complete** download; until then it uses the server endpoints as on v14. |
| Scale items | Weight barcodes set the qty; price barcodes set qty = amount / rate. Price and UOM come from the cached Item Prices. |
| Offers | POS Offers (with their item / group / brand lists) come from the cached bootstrap, so automatic offers also apply offline. |
| Totals | `offline/taxes.js` reproduces ERPNext `taxes_and_totals`: inclusive and exclusive taxes, On Net Total / Actual / Previous Row, item tax templates, additional discount and rounding. The offline receipt therefore matches the invoice ERPNext creates. |
| Queue | When the server cannot be reached (no network, timeout, 502/503/504), the sale is stored in IndexedDB with an `offline_id` and an 80 mm receipt is printed locally. Stock sold offline is subtracted from the local available qty. |
| Upload | Uploads go in batches to `posawesome.posawesome.api.offline.upload_offline_invoices`. They are **idempotent**: `offline_id` is unique on Sales Invoice (`posa_offline_id`) and on the new **POS Offline Invoice** doctype. Large batches go to the `long` queue, and a scheduler job retries every hour. |
| Errors | Failed invoices stay in the queue with the server error. The cashier can retry, export as JSON, or discard them (status chip in the navbar). Back office can retry from the POS Offline Invoice list. |
| One invoice per sale | Every cart gets a **sale id** (`Sales Invoice.posa_offline_id`, unique) the first time it is saved. The draft, the online submit, a browser retry after a lost answer, the background submit job and the offline copy all carry that id, plus the draft name. The server always finds the one invoice of the sale: a draft is turned into the sale, and an already submitted sale is reported back instead of being posted again (`posapp.resolve_sale_draft`, `posapp.submit_invoice`, `offline._sale_draft`). The online submit is idempotent: a retry returns `already_submitted`. The background submit job re-checks under a row lock. Fixes the SI2611-03328 / SI2611-03331 case: a resumed draft paid while the connection dropped became two invoices. This covers everything the v14 no-duplicate patch (`posa_client_request_id`, `HOLD-` ids) does; drafts made on v14 are matched by their draft name. |
| Drafts offline | Whenever the shift's drafts are listed or saved online, the complete documents (every item row with `item_code`, uom, rate, batch...) are kept on the terminal. **Resume** and **Hold** still list them when the server is down. **Hold Sale** works offline: the cart is kept on the terminal and saved as a server draft when the connection is back. A resumed server draft that is held again is saved back into the same draft. A draft paid offline becomes that sale on upload. Drafts that were held or sold on the terminal are not listed twice. |

### Price checker, search and pole display (new)

| Area | How it works |
| --- | --- |
| Price Checker screen | `/app/price_kiosk`: a full-screen kiosk where the customer scans a product and sees its price, MRP, savings, scale-label weight and amount, other UOM prices and running offers (including multi-item / multi-group / multi-brand offers). It reads the offline catalogue of the chosen POS Profile, so it keeps working when the server is down, and updates live. Settings open with a 2-second press on the store name. The old pages `price_checker` / `pricechecker` forward here. |
| Price Checker role | Created on migrate (`posawesome/price_checker.py`). It has read-only access to POS Profile, Company, Item, Item Group, Item Price and POS Offer, and its home page is the kiosk. A user with only this role is kept on the kiosk (Log out in its settings) and never downloads customers, coupons, referral codes or RFID cards. |
| Word search | Words of the item code, name or barcode, in any order and as part of a word; punctuation counts as a space. "sh palm hair" finds "180ML PALMOLIVE ... ANTI- HAIR ... SHAMPU". Matches that start the name come first, then matches where every word starts a word. This applies both to the offline catalogue and to the server search (`get_seearch_items_conditions`). |
| Search box Enter | Enter now searches what is in the box, not the text from 200 ms earlier. A name or code search with a single result is added by Enter. A hardware scanner typing into the box adds the item once, not twice (Enter and onScan). |
| Late-commit safety | Delta syncs re-read the last 2 minutes before their cursor, so a row saved in a transaction that committed late is not skipped. |
| Customer pole display (VFD) | POS Profile > POS Offline & Scale > **Enable Customer Display (VFD)**, then **VFD Command Set** (Epson ESC/POS, CD5220, Plain text), baud rate, characters per line, and **Display Line 1 / Line 2** for the idle screen (Line 1 empty = WELCOME, Line 2 empty = company name). Screens: the item just scanned with its amount and the running total; on the payment screen **TOTAL / PAID**, updated live as the cashier types amounts; **PAID / CHANGE** after the sale (kept 8 s), then THANK YOU and the idle lines. A **Display** chip in the navbar shows the state (green connected, orange not connected): click it to choose the port the first time, and afterwards to test the display (DISPLAY OK and the time for 3 s). The menu item **Connect Pole Display** does the same. The browser remembers the port (by USB id) and reconnects by itself, also when the display is plugged back in. Web Serial API: Chrome or Edge, site on https. Latin characters only (no Urdu font on VFDs). An unplugged or missing display never blocks a sale. |

### Price checker screens: kiosk display / signage (new)

What the price checker screens show around the price is set in the desk with **POS Kiosk Display** (workspace card "Price Checker Screens"). Without a display the screen looks as before, with white headings and item names.

| Area | How it works |
| --- | --- |
| Applies to | **POS Profiles** table (or **All POS Profiles**), optional **Company**, **Valid From / Upto**, **Priority**. Several displays can be scheduled for the same screens: at each moment the screen runs the enabled one that is valid with the highest priority (same priority: the one changed last). The desk warns when two displays have the same priority on the same POS Profile and overlapping dates. |
| Layout tab | Orientation (Auto / Landscape / Portrait). **Top bar**: logo, store name, tagline, date and time, online chip. **Ticker** at the bottom. **Search box** (off: hidden, scanners still work). **Centre**: slideshow / video while nobody scans, with a "Scan a product" hint; idle title, second line (Urdu) and hint for screens without slides. **Left sidebar** (Featured Items or Slides, width %, hidden below a screen width, default 1600 px) and **right sidebar** (running Offers or Slides, width %). **Sidebars Follow The Scan**: after a scan the right side shows the item's offers first (highlighted) and the left side other priced items of its group. |
| Slides tab | One table for all areas: **Area** (Centre / Left Sidebar / Right Sidebar), **Type**: Image, Video (public MP4 / WebM file or an https link to the file), Item (live price, MRP and saving from the screen's own price list), POS Offer (its title and discount, until when), Text (headline, second line, optional background picture). Title / subtitle, Image Fit (Cover / Contain), Seconds On Screen (0 = the display's default; videos play to the end unless set), **Show On** (All Screens / Landscape Only / Portrait Only). Each slide has its own **Valid From / Upto, Daily From / To** (a window such as 22:00 to 02:00 runs past midnight and belongs to the day it started) and **Days** (e.g. Fri,Sat). |
| Ticker tab | Lines with their own dates, daily hours and days; separator. |
| Timing tab | Seconds per slide, how long the price stays (default 20 s) and "not found" (8 s), offers scroll speed, ticker speed (px/s), how often the screen checks for changes, video sound (browsers allow sound only after the screen was touched; until then muted), cut videos after N seconds. |
| Theme tab | Background colour or picture, text, headings / item name (default #ffffff), price, accent, offers, ticker background and text colours, text size %. |
| Checks on save | Private files are refused (screens cannot open them); file types; YouTube / Vimeo pages refused (they are web pages, not video files); dates; days (any case, full names; typos refused); colours (#rgb / #rrggbb); timing ranges; sidebars together at most 60% of the width; disabled items / offers and left-sidebar slides with the left sidebar off are warned. |
| On the screen | A scan always wins: the price card takes the centre and the video pauses; after "Show Price For" the loop resumes and the sidebars return. The schedule is decided on the screen every 20 s, so it keeps running offline. The last answer of `api/kiosk_display.get_kiosk_display` is kept in browser storage; images and videos are kept in the browser's Cache Storage (needs https) within **Media Storage Limit**, played from there, and removed when no display uses them. A saved / deleted / renamed display reaches the open screens within seconds (realtime `posa_kiosk_display_changed`); the screens also check every few minutes and when the connection returns. |
| Screens (POS Kiosk Device) | Every screen reports itself every 5 minutes (`heartbeat`): POS Profile, display shown and its version, screen size, network, media kept (files, MB), user, IP, browser. The list shows Live, Running Offline or Not Reporting (nothing for 15 min). The screen name can be set on the screen (settings, 2-second press on the store name) or in the desk. |
| Access | `get_kiosk_display` and `heartbeat` use the same POS Profile check as the catalogue download, so Price Checker users work without extra permissions. Managing displays: System Manager and Sales Manager; Sales User can read. |

### Help tabs (new)

POS Offer, POS Profile, POS Coupon, Referral Code, Delivery Charges, POS Kiosk Display, Kitchen Production Unit, Station, Service Zone, Order Type and Service Table have a **Help** tab (last tab) with the purpose, setup steps, usage flow and best practices, in the WhatsBridge Settings style: a Tab Break plus an HTML field whose content is set in the form's refresh (`<doctype>.js`; POS Profile: `api/pos_profile.js` with the custom fields `posa_help_tab` / `posa_pos_profile_help`). The POS Profile help also describes the setup flow, the daily POS flow (open shift to close shift), the restaurant flow and the offline flow. Texts are wrapped in `__()` so they can be translated.

### Item Exchange / Replacement (new)

| Area | How it works |
| --- | --- |
| Settings | POS Profile > **Item Exchange** tab: Enable Item Exchange, Enable Item Replacement, Allow Exchange with Additional Payment, Allow Exchange with Refund, Require Manager Approval, Approver Role (default Sales Manager). All off by default. |
| Where | Return dialog > **Exchange / Replace Items** (shown only when exchange or replacement is enabled). Normal returns are unchanged. Online only. |
| Dialog | A: original invoice, items, sold / already returned / max returnable, return qty (validated). B: replacement items by search or barcode scan (scans go to the dialog while it is open), UOM, qty, price, discount % (capped by the item's max discount), stock, batch. Settlement card shows returned total, replacement total and the difference before submit. |
| Settlement | Difference = replacement − returned. Equal: nothing to pay. Positive: collected in the profile's payment modes (needs Allow Additional Payment). Negative: refunded in the chosen mode (needs Allow Refund). |
| Documents | One submitted **credit note** (return against the original invoice) and one submitted **new Sales Invoice**, both fully settled, plus a submitted **POS Item Exchange** record (POS-EXC-.YYYY.-) linking them, with items, payments, approver and time. The common value is refunded on the credit note and received on the new invoice in the default mode, so it nets to zero in the till. Resending the same request returns the same exchange (no duplicates). |
| Approval | When required, a user without the approver role must enter an approver's user and password. The approver and timestamp are stored. It cannot be bypassed from the client. |
| Cancellation | Only from the POS Item Exchange form (**Cancel Exchange**, reason required): cancels the new invoice, then the credit note. Nothing is deleted. Cancelling a linked invoice directly is refused. |

### QZ Tray silent / raw printing (ported from the v14 patch)

| Area | How it works |
| --- | --- |
| Settings | POS Profile (after Closing Shift Print Format): **Use QZ Tray for Silent Print**, **QZ Tray Printer Name** (default printer), **Use Raw Receipt Printing**, **Raw Receipt Width** (42 for 80 mm, 32 for 58 mm). All off by default. |
| What prints through QZ | Every `/printview` print of a **Sales Invoice, Sales Order or Payment Entry** (Submit & Print, Print Last Invoice, reprints, exchange invoices, Receive / Pay Payments), and offline receipts. Other documents (closing shift, expenses, purchase receipts) keep the browser print. |
| Raw mode | ESC/POS text: company name (double size), items with MRP / rate x qty, totals, taxes, rounding, payments, change, amount saved, CODE128 barcode of the document number, paper cut. Offline receipts carry the offline id and "OFFLINE SALE - PENDING SYNC". |
| HTML mode | The POS Profile print format (`frappe.www.printview.get_html_and_style`) is sent to QZ as an 80 mm page, with the site address as base URL (logo / images load) and scripts removed. |
| Printer per terminal | Menu > **QZ Tray Printer**: lists the printers QZ Tray sees, saves the choice on that computer (browser storage), Test Print, Reconnect, Download Certificate, and for a System Manager **Set up Certificate**. Order: terminal choice, then profile printer, then QZ default printer. |
| Certificate | `api/qz.py`: `setup_qz_certificate` (System Manager) creates a self-signed certificate and key in `sites/<site>/private/qz/` (key mode 600). The POS signs every QZ request with SHA512 through `sign_message`. Import the downloaded certificate in QZ Tray (Advanced > Site Manager > +) and restart QZ Tray, so it stops asking Allow. Uses the `cryptography` package, already required by Frappe. |
| Fallback | QZ Tray not running or no printer: a notice and the browser print opens. Printer error (e.g. out of paper): the cashier is asked whether to print with the browser, so a sale is not printed twice. |
| Also fixed | The rmsapp **Receive Payments** and **Pay Payments** dialogs called a `load_print_page` that did not exist, so their Submit & Print never printed. They now print the Payment Entry (with `custom_payment_entry_print_format` when set). |

### FBR: only printed invoices

POS Profile **Allow FBR on Submit** now means "send to FBR when printed". v14 also had a Sales Invoice `on_submit` hook that sent every submitted invoice; it is removed.

| Case | FBR |
| --- | --- |
| Submit (no print), online or offline | Not sent |
| Submit & Print | Sent first, then printed, so the receipt has the FBR number |
| Print Last Invoice / any reprint | Sent only if the invoice has no FBR number yet; never a second FBR invoice (row lock + existing number returned) |
| Item Exchange "Print New Invoice" / "Print Credit Note" | Sent, then printed |
| Offline sale printed (or reprinted before / after sync) | Sent by a background job (`short` queue) once the server has created the invoice |
| Cancelled invoice | Never sent |
| Sales Invoice submitted from the desk | Not sent (no POS print) |

### Fine dining (phase 1)

POS Profile > Restaurant and KDS > **Fine Dining**. Nothing changes until **Enable Fine Dining** is ticked; then each feature has its own checkbox. Works in the RMS / retail POS (`rmsapp`) and the waiter app (`waiterapp`).

| Feature (checkbox) | How it works |
| --- | --- |
| Ask Number of Guests (Covers) | After a table is chosen the POS asks the guests (1–12 buttons or typed); shown on the bar above the cart, saved on the invoice (`posa_covers`), on kitchen tickets and the guest check. **Covers Required Before Sending** asks again before the order is sent / held / paid. |
| Seat Numbers on Items | Seat buttons on the bar (All = shared, 1..guests); new items get the current seat; a seat chip on each item changes it. The same item for another seat is its own line. Seat on the KOT, the KDS and the guest check (grouped by seat). |
| Item Modifiers | New doctype **POS Modifier Group** (options, required, min / max choices, applies to items or item groups). Adding such an item opens the options window; a required choice cannot be skipped (cancel = item not added). The text goes on the item (`posa_modifiers`) and the KOT; an option with a **Paid Add-on Item** adds that item under the main item at its own price, and it follows the main item's qty, seat and course. Options can be changed until the item is sent. |
| Courses with Hold / Fire | New doctype **POS Course** (sequence, Hold Until Fired, default item groups, colour; Drinks, Starters, Mains, Desserts created on migrate). Items get their course from their item group. Held courses stay in the order and are left out of the kitchen ticket; the bar shows **Fire Mains (n)**, which sends them at once. A Hold / Fire chip on an item switches it before it is sent. Kitchen tickets list items course by course. |
| Void / Comp with Reason | What the kitchen has is read from the Kitchen Tickets (order tickets minus VOID tickets), never from the terminal. Taking off (or reducing) an item that was sent opens a void window when the order is sent, held, paid, printed or cancelled: reason (**POS Void Reason**), remarks, and with **Manager Approval** a manager's user and password (Approver Role, default Sales Manager; a user with the role approves alone). The save then sends a red **VOID** ticket to the units that had the item. **Comp** (chip on an item) makes an item free with a reason and approval. Everything is in **POS Void Log** (read-only: who asked, who approved, item, qty, amount, ticket). The server refuses a save that takes sent items off, or a free item, without an approved log. Offline uploads are never refused: they are logged as **Offline** (not approved) for review. A manager deleting a sent order at the desk approves by deleting. |
| Pre-Bill (Guest Check) | **Pre-Bill** on the bar saves the order and prints the new **Guest Check** print format (or the one chosen): table, guests, server, items by seat with options and add-ons, COMP lines, taxes, total and per-guest amount, "Not a tax invoice". Counted on the invoice (`posa_prebill_count`). With QZ Tray raw printing it prints as GUEST CHECK. Never sent to FBR. |

Guests, seats, courses and pre-bill are for orders at a table; options, void and comp apply to every order (take away too).

Kitchen display: VOID tickets in red at the top with a **Void Seen** button, table and guests on each ticket, course headings, seat badges and options under the item.

Also changed: a dine-in order was marked **Ready** on the Live Order Status screen every time it was saved without new kitchen items (for example a second save while the kitchen was still cooking). Now only an order with nothing for the kitchen is ready at once; others follow their kitchen tickets as before.

### Fine dining (phase 5: waiter app offline)

POS Profile > **Fine Dining: Waiter App > Waiter App Works Offline** (with Enable Offline Mode on the Offline and Devices tab). Off = the waiter app works exactly as before.

| Area | How it works |
| --- | --- |
| Start | The waiter app downloads and keeps the profile's item catalogue on the tablet (the same offline catalogue as the main POS). If the server cannot be reached when the app opens, it starts with the shift saved by the last online start. |
| Items | Item list, prices, UOMs and stock come from the tablet's catalogue (no server round trip), also while offline. |
| Make KOT offline | The order is kept on the tablet with a sale id and the waiter is told; as soon as the connection is back it is saved on the server once (never twice, the sale id is the key), and the server sends it to the kitchen as usual. |
| Online | Orders carry a sale id; everything else as before. |

Limits: while offline the waiter cannot resume orders saved on the server, fire courses, void, comp or print a pre-bill (they need the server and say so). An order the server refuses when it is uploaded (for example a dish that was 86'd meanwhile) stays on the tablet; the waiter re-enters it.

### Fine dining (phase 4: guests)

POS Profile > **Fine Dining: Guests** (under Enable Fine Dining), each on its own:

| Checkbox | How it works |
| --- | --- |
| Reservations and Waitlist | New **POS Reservation** (form, list and **Calendar** view): guest, phone, customer, guests, date / time, duration (90 min), table, occasion, allergies, notes, deposit; status Booked → Confirmed → Arrived → Seated → Completed (or Cancelled / No Show). A table cannot be booked twice for overlapping times (more guests than seats only warns). On the POS: **Floor > Bookings** lists today's bookings and the waitlist with Seat, Arrived, No Show, Cancel and a quick **Add** (booking or walk-in with quoted wait). A table booked within **Hold Table Before Booking** minutes (default 30) shows Reserved. **Seat** (from the list, the table, or tapping a table for a walk-in) opens a new order on the table with the party size, the booking's customer and allergies, saves it and links it; paying it completes the booking. |
| Guest Profiles | Customer > **Guest Profile**: VIP, Anniversary, Preferences, Allergies, Guest Notes (Birthday is the existing POS birthday field). When a customer is chosen the bar shows "Sara · 3 visits · Birthday!"; tap it for visits, last visit, average bill, favourite dishes, preferences, allergies, notes, and a birthday / anniversary within a week. The guest's allergies are copied to an order that has none. |
| Guest Feedback | The guest check prints "Tell us how we did" with a QR code and link to `/pos_feedback` (signed per bill, once per bill). The guest gives 1–5 stars for food, service, ambience and a comment; answers are **POS Guest Feedback** with the table and waiter. Staff can also record feedback in the desk. |

New report **POS Fine Dining Analytics** (per day): orders, guests, net sales, per guest, average table minutes, average kitchen minutes, voids, comps, service charge, tips, bookings, no-shows, average rating.

Also fixed: the Item > Fine Dining section of phase 3 was placed in the middle of the Item's first section; it now sits at the end of the Details tab.

QR menu and pay at the table are not included (they need a public ordering / payment site and a payment gateway).

### Fine dining (phase 3: kitchen)

POS Profile > **Fine Dining: Kitchen** (under Enable Fine Dining), each on its own:

| Checkbox | How it works |
| --- | --- |
| Expo (Pass) Screen | New page **Expo (Pass)** (`/desk/fd_expo`, choose the POS Profile once): a card per open table with guests, waiter, minutes, allergies and its courses: Held (grey), Cooking (orange), Ready (green), Served. **Serve** sends a course (asks when it is still cooking); its kitchen items become Served and a ticket whose items are all served is Served. Live updates. |
| Kitchen: Finish Single Items and Recall | On the kitchen display a cook taps an item when it is done (struck through); the first one makes the ticket Preparing, the last one Ready. **Recall** (top bar) lists the last finished tickets and brings one back to Preparing. |
| Kitchen Target Minutes | Tickets turn amber at 75% and red past the target. An item's own **Prep Minutes** (Item > Fine Dining) win; the ticket takes the longest. |
| 86 List | **86** on the POS bar (list, search, Back On) and on each kitchen item: the dish is marked unavailable today (Item > Unavailable Today). It cannot be added on any terminal (told at once), and the server refuses new quantities of it (what the kitchen already has may stay; offline uploads are never refused). |
| Allergens | New **POS Allergen** list and **Allergens** on items. **Allergies** on the POS bar records the guests' allergies on the order (list + free text). Adding an item that contains one warns the waiter and flags the line; kitchen tickets show a red ALLERGY banner and flag the matching items; the expo card shows it too. |

The kitchen display also stopped piling up timers on each refresh.

### Fine dining (phase 2: floor and bill)

POS Profile > Restaurant and KDS > **Fine Dining: Floor and Bill** (under Enable Fine Dining). Each checkbox on its own:

| Checkbox | How it works |
| --- | --- |
| Floor Plan and Table Moves | **Floor** button on the bar: every table of the company drawn at its Layout Position (X, Y, Width, Height; as % when all fit in 0..100, else scaled; a grid when none is set), coloured by live status: Free, Seated, Ordered, Course waiting, Bill requested, Cleaning, Reserved. Tap a table: **New Order Here**, **Open** its order (the current cart is saved first), **Move Table** (tap the new table), **Merge Table** (tap the other table: its items and guests come over, the other order is closed and its table freed), **Hand Over** to another user of the profile (the order moves to their open shift), Mark Available / Reserved. Refreshes every 20 s. |
| Tables Need Cleaning After Payment | A paid table shows Cleaning until marked Available on the floor. |
| Split Bill | **Split** on the bar (dine-in): **By Seat** (each seat its own check, shared items stay), **By Item** (chosen items / qty to a new check), **Equal Shares** (one bill; the guest check prints each share). Checks are separate open orders on the same table; the table stays occupied until the last one is paid. |
| Service Charge | % of the net total as a "Service Charge" row (own account) on dine-in orders, optionally from N guests. Not added to sales made offline. |
| Tips | **Tip** on the bar: % buttons or an amount; a "Tip" row (own account, e.g. tips payable) collected with the bill. |

Moved items keep what the kitchen has: a TRANSFER OUT ticket on the old order and a TRANSFER IN ticket on the new one (marked Served, never on the kitchen display), so nothing is cooked twice and no void is needed. Comp approvals move with their items. New report **POS Fine Dining Staff Report**: per waiter orders, guests, net sales, per guest, service charge, tips and an equal share of the tip pool. New fields: Sales Invoice Waiter, Tip, Equal Shares, Split From.

With fine dining off, a paid table is freed as before.

### POS Profile form layout

The POS G2Virtu fields (about 290) are grouped into tabs that follow the setup flow, with labelled sections and two columns:

| Tab | Holds |
| --- | --- |
| Details | ERPNext details; the sales team fields sit in the second column |
| Accounting | ERPNext accounting, plus MRP list and card tax |
| POS Configurations | ERPNext POS settings |
| More Info | ERPNext more info |
| POS Selling | Cart and items; rates and discounts; payments and credit |
| Returns and Exchange | Returns; Item Exchange / Replacement |
| Customers and Orders | Customers; Sales Orders; Delivery Charges |
| Screen and Search | Screen layout; search and scanning; performance |
| Shift and Cash | Shift; closing denominations; cash and expenses; POS G2Virtu payments |
| Printing and FBR | Print formats; QZ Tray silent printing; FBR integration |
| Restaurant and KDS | Kitchen order tickets; order types; service zones; captains; buffet |
| Offline and Devices | Offline mode; weighing scale barcodes; customer pole display (VFD) |
| Help | Purpose, usage and flow |

The order is set twice so both paths give the same form: the `insert_after` chain in `custom_field.json`, and a `field_order` Property Setter `POS Profile-main-field_order` in `property_setter.json`. The Property Setter replaces any order saved earlier through Customize Form on POS Profile. The v14 checkbox `posa_enable_offline_invoices` now shows only while it is ticked ("Offline Invoices (v14 setting)"), because the code still treats either offline checkbox as on.

### v16 desk: apps screen, dock, sidebar, desktop icon

| Piece | File | What it does |
| --- | --- | --- |
| Apps screen tile | `hooks.py` `add_to_apps_screen`, `app_logo_url`, `app_home` | "POS G2Virtu" tile with its own logo, opens `/desk/pos-g2virtu`. Shown only to users who can read POS Profile, Sales Invoice or POS Opening Shift (`posawesome.check_app_permission`). |
| Dock (rail) | `dock/posawesome/posawesome.json` | The app's own rail: POS G2Virtu sidebar, POS Terminal, RMS Terminal, Kitchen Display, and Price Checker (hidden by default; a user can turn it on). |
| Sidebar | `posawesome/sidebar/pos_g2virtu/pos_g2virtu.json` | Home, POS Terminal, Sales Invoice, POS Offline Invoice, POS Item Exchange, then sections: Terminals, Shift & Cash, Promotions, Restaurant, Price Checker Screens, Items & Barcodes, Reports, Operations, Setup. Every POS G2Virtu doctype, page and report in use is linked. |
| Desktop Icon | `desktop_icon/pos_g2virtu.json` | App icon for sites that use the Desktop Icons grid instead of the Apps screen (imported only in that mode). |
| Icons | `public/icons/posa-icons.svg` via `app_include_icons` | Dock and sidebar-header symbols drawn the way Frappe's soft / duotone module icons are. |
| Workspace | `posawesome/workspace/pos_g2virtu/` | Rebuilt home: 8 shortcuts (terminals, KDS, Live Order Status, Price Checker, Sales Invoice, Offline Invoices) and 8 cards matching the sidebar sections. |

Also: the duplicate workspace `posawesome/posawesome/workspace/pos_awesome/` (same name "POS G2Virtu", 2023 content) is removed; delete that folder on the server. The KDS page had an empty role row; removed. `workspace_sidebar` files are not shipped, because v16.6 retired them in favour of `Sidebar`.

## 3. Test results (mock ERPNext server, headless Chromium)

Data set: 30,050 items with barcodes (including 50 scale items), 30,650 prices and 2,001 customers.

| Check | Result |
| --- | --- |
| First full catalogue download | 10–11 s |
| Reload with catalogue from IndexedDB | 1.3–1.5 s |
| Local search / barcode lookup | 2.6–4 ms per query / ~0.002 ms per lookup |
| Online: scan EAN, repeat scan, 1.25 kg scale label, item code search, auto 10% group offer, checkout | Pass; server totals 1,328.50 net, 225.85 tax, 1,554.35 grand, rounded 1,554 |
| Network lost: scan + scale + offer + checkout, two sales | Pass; queued with correct totals; cart cleared |
| Server down (502) while network is up | Pass; sale queued |
| Reconnect: queue upload | Pass; server totals equal offline totals |
| Server rejects an invoice | Pass; it becomes Failed with the error shown, and Retry syncs it |
| Re-upload of an already synced `offline_id` | No duplicate invoice |
| **1,500 offline invoices** | Queued at 2.5–3 ms each; **synced 1,500/1,500 in 8 s, 0 total mismatches** |
| Waiter app | Loads with 0 Vue warnings |
| Live updates: Item Price, Item (`max_discount` + extra barcode), new Item with barcode/price/stock, new Customer, new POS Offer (shown in open invoice), RFID Card, Referral Code | Pass; terminal updated about 2 s after the change event |
| 50 change events in a burst | Pass; 1 sync |
| POS Profile item groups narrowed, then restored | Pass; out-of-scope items removed, then re-downloaded |
| Change made while the terminal is offline | Pass; applied on reconnect |
| Reported duplicate: draft resumed, item added, paid while the submit answer is lost (background submit on); offline copy uploaded first, **or** background job first | Pass; **one** submitted invoice (the original draft) in both orders |
| Lost answer on the draft save, then paid offline | Pass; one invoice |
| Online submit retried | Pass; `already_submitted`, nothing posted again |
| Two drafts made online, connection lost | Pass; Resume lists both with all item codes; draft badge correct |
| Draft resumed offline, item added, paid offline | Pass; on upload that draft becomes the sale (3 items), no new invoice |
| Hold offline, resume a server draft offline and hold again | Pass; saved as one new draft and the same draft updated; Resume shows each once |
| Server-side dedupe rules (`resolve_sale_draft`, `_sale_draft`) against a stub database | Pass; 10 cases |
| Price checker: setup, 30k-item download, EAN, scale label, offer, word search, not found, offline, reload in under 1 s, no customers downloaded | Pass |
| Search box: fast type + Enter, scanner typing into the box, single word-search result, many results, punctuation | Pass |
| Repeat free product (real Invoice.vue offer code, rmsapp and waiterapp): buy 10 get 1 at qty 5/10/19/20/35/100/21/9/30; Max Free Quantity 4; repeat off (unchanged); buy 12 get 2; item group; same item free; one free row only. Save rules for the new fields | Pass; 30 + 7 checks |
| **Offers:** one offer on two item codes (5%), one on two item groups (7%), the old single-group offer (10%), an item outside every offer | Pass; each row gets the right discount, the outside item none |
| Same item added again; hold and resume; qty added after resume; paid | Pass; offer price kept, discounts identical after resume (nothing applied twice), one invoice with the offer discounts |
| Cart row highlight | Pass; exactly the row just added / changed is tinted |
| Offer item details against a stub database (TP / MRP / sale / valuation / GP / discount, Bag UOM with factor 5 and its barcode, popup by group and by brand) | Pass |
| Pole display (simulated serial port): auto-connect at the profile baud rate, ESC/POS init, welcome with company name on line 2, item + total, navbar chip test, live TOTAL / PAID while typing (843 → 50), PAID / CHANGE, thank you | Pass |
| **Item Exchange** server rules against a stub database: equal / additional payment / refund, profile flags off, over-return, partial returns, discount limit, closed shift, approval (refused, wrong password, approver without role), manual creation blocked, direct invoice cancel blocked, cancel with reason, idempotent resend | Pass; 41 checks |
| Item Exchange dialog: button gated by profile, invoice search, over-return blocked, scan goes to dialog then back to cart, refund-not-allowed, additional payment, manager approval with wrong then right password | Pass; 11 steps |
| QZ Tray endpoints with the real `cryptography` package: no certificate yet, cashier refused, key mode 600 in the private folder, PEM without key, SHA512 signature verifies with the certificate | Pass; 17 checks |
| QZ Tray (fake QZ Tray websocket): certificate presented on open; raw receipt on Submit & Print (signed SHA512, no browser window); Print Last Invoice; Payment Entry receipt; out of paper asks then browser print; closing shift stays on the browser; offline sale receipt with offline id; printer dialog lists / saves / test-prints; 58 mm lines fit 32 characters; HTML mode with base URL and no scripts; QZ not running opens the browser; setting off never contacts QZ | Pass; 13 steps |
| **FBR** server rules (real `submit_to_fbr`, stub database, fake FBR): no on_submit hook; sent once; reprint returns the same number; cancelled / FBR off not sent; printed offline sale queued after commit, one job per invoice | Pass; 16 checks |
| FBR in the POS: Submit not sent; Submit & Print sent before printing; reprint not sent again; exchange print; offline Submit vs Submit & Print vs reprint while queued; after sync only printed ones sent; reprint of a synced sale sent once; profile off never calls FBR | Pass; 9 steps |
| **Fine dining** server rules (real `fine_dining.py` and `kds.create_kitchen_tickets`, stub database): switches; held course left out, fired later with modifiers; ticket per unit with table / covers / seat / course in course order; void refused without approval; waiter / wrong password / user without role / wrong reason type / disabled reason / more than sent / unsent row refused; approved void → VOID ticket to the right unit, log applied and linked, no second void, re-added item sent again; partial void; approval off; offline upload logged; delete with and without approval; manager delete at the desk; comp refused without approval, applied with reason, by sale id before the first save; queue ticket not ready while the kitchen works; pre-bill count and refusals; access; defaults | Pass; 52 checks |
| Fine dining in the browser (real mixin and components, Vue 3.5 from source): everything off = POS unchanged; guests on table choice; seats; required options and paid add-on; merge rules; Fire Mains; void of a sent item with wrong then right manager password; resume shows sent items; comp and charge again; pre-bill print URL; cancel of a sent order voids all; covers required; take away; each feature off; approval off | Pass; 56 steps |
| **Fine dining phase 2** server rules (real `fine_dining_floor.py`, service table hooks, KDS and phase 1 code, stub database): switches; floor states (Waiting, Bill, Free, Disabled), zones, waiter; move table (disabled / occupied refused, tickets follow); move part of a line with its add-on (kitchen count moves, nothing re-sent, no void, saving again changes nothing); move all (order deleted, table freed); merge (items, guests 2+3, table freed, kitchen count, no void); split by seat into 2 checks, one check paid keeps the table occupied; half of a comped line refused, whole line moves with its approval; equal shares; cleaning after payment; hand over to another shift; service charge after GST, tip row, no duplicates, removed for take away / no tip, minimum guests, offline upload, no account | Pass; 52 checks |
| Fine dining phase 2 in the browser: floor button, tables placed by layout, new order on a free table, service charge chip, tip 10%, split by item, equal shares + guest check, two checks on a table, move a check, hand over, open it, phase 2 off | Pass; 18 more steps (74 in all) |
| **Fine dining phase 3** server rules (real `fine_dining_kitchen.py` with the KDS and phase 1–2 code, stub database): ticket target from item prep minutes, guest allergies and flagged items, both off = tickets as before; item bump New → Preparing → Ready, undo, recall, both off refused; 86 set / told / existing qty kept / more refused / new order refused / offline upload accepted / back on, off refused; expo courses in order, cooking / held / ready, serve, off refused | Pass; 25 checks |
| Fine dining phase 3 in the browser: allergies dialog and order field, warning and flagged line, 86 dialog, 86 dish blocked, back on by realtime, phase 3 off | Pass; 9 more steps (83 in all) |
| **Fine dining phase 4** server rules (real `fine_dining_guests.py`, reservation controller, floor, stub database): end time, zone, overlap refused, after-end allowed, seats warning, bookings in order and waitlist apart, floor Reserved within the hold time, seat links the order, payment completes, waitlist removed, off refused; guest profile (VIP, visits, average, favourites, allergies, preferences, birthday in 3 days, walk-in none, off refused); feedback link and token, wrong token, stored ratings with waiter, once per bill, QR, off prints nothing | Pass; 22 checks |
| Fine dining phase 4 in the browser: bookings panel, waitlist add, seat a booking (table, guests, customer, allergies, saved and linked), guest chip and profile, seat a walk-in at a tapped table, phase 4 off | Pass; 10 more steps (93 in all) |
| **Fine dining phase 5** (real waiter `Invoice.vue` methods, fake offline module): toggle off = server save as before, no sale id; online = server save with a sale id; offline = no server call, order held on the tablet with sale id and items, waiter told, cart cleared; offline totals, item detail and stock from the tablet; online item detail from the server | Pass; 13 checks |
| Guest Check print format (Jinja): seats, shared items, options, add-ons, COMP, per-guest, no seats, equal shares, feedback QR on / off | Pass; 15 checks |
| **Kiosk display** server rules (real controller and API, stub database): profiles / all / company / dates / priority, every slide type's checks, private files, YouTube pages, colours, ranges, overlap warning, realtime notice after commit, expired / disabled slides, offers and items left out, media list with sizes, version hash, access check, device reports (ids, throttle, rename from screen and desk) | Pass; 71 checks |
| Kiosk schedule rules (screen side): dates, daily hours, open-ended and overnight windows, days, priority and ties, areas, ticker | Pass; 19 checks |
| Kiosk display in the browser: standard screen unchanged; full layout (widths, ticker at the bottom, logo, date); expired ticker line and offer left out; featured items with live prices; slides in order incl. muted video and live-price item slide; scan takes over and sidebars follow; back to the loop; not found; colours; live change via realtime; other profile's event ignored; priority display starting tomorrow then today; weekday slide; device report and rename; 5 media kept; **server down + reload: display, slides from the kept copies, ticker, prices**; portrait; small screen hides the left sidebar; hidden search box; display removed → standard screen and media deleted | Pass; 27 steps |

These tests ran against a mock server. Before going live, **test on a staging copy of your v16 site** with real tax templates, batch/serial items, loyalty, and your printers and scale labels.

## 4. Known limits / to check on staging
* **Fine dining:** the components were tested with the real Vue code and simplified Vuetify components, and both POS screens' templates compile; check the look on your terminals. Void / comp approval needs the server (a terminal without connection uploads them as Offline logs). Course firing sends at once, so the terminal must be online.
* **Pole display:** test with your model. Most ESC/POS and CD5220 VFDs work with the listed command sets; if yours shows garbage, try another command set or baud rate in the POS Profile. Web Serial needs Chrome or Edge and an https site (or localhost).
* **Offer item details** read live prices and Bin valuation from the server; the popup shows at most 1,000 items per offer.
* **Two terminals with the same draft:** if both resume the same server draft and both sell it while offline, both sales are posted (the server cannot tell they are the same cart). One terminal resuming a draft is safe.
* Keep the POS tab open. Frappe has no service worker, so **reloading** the page needs the server. If the page loads but `check_opening_shift` cannot reach the server, the POS continues with the last cached opening shift.
* Offline mode covers sales. Return Without Invoice also uses the offline path but has not been tested. Sales orders, credit sales, payment requests, M-Pesa, new addresses and invoice-based returns need the server; the UI tells the cashier so.
* Batch items offline use the batches cached for the item. ERPNext re-picks batches on sync if needed.
* The waiter app is ported to Vue 3 but runs online-only (no offline queue).
* The KDS, LOS and account summary pages were not changed.
* **QZ Tray:** tested against a simulated QZ Tray. Try your printer with Test Print first. While the server is down, QZ Tray cannot get a signature and shows its Allow prompt (tick "Remember this decision"). Pop-ups must stay allowed for the browser fallback. The waiter app does not use QZ Tray yet.
* **Item Exchange** needs the server (no offline exchange). Test it on staging with your batch/serial items and payment modes before enabling it on the live profiles.
* **Kiosk display:** videos as MP4 (H.264) or WebM, ideally 1080p and under ~100 MB each; a kept video is loaded into memory to play offline, so keep the kiosk PC's RAM in mind with several large videos. Media are kept offline only on https sites. Upload pictures in the screen's shape (1920×1080 for landscape, 1080×1920 for portrait) and use **Show On** for the other shape. Browsers start videos muted until someone touches the screen. A kiosk reloaded while the server is down needs the page itself to load from the server (as for the POS); a kiosk left open keeps running.
