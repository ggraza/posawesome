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
  * **Enable Offline Mode**: turn on for the terminals that should keep selling without the server.
  * **Scale Barcode Prefixes**: comma-separated, for example `21,22`. Also set the item/value positions for your scale labels. The defaults are EAN-13 with a 7-digit item part (looked up as an Item Barcode or Item Code) and a 5-digit weight with 3 decimals, which is the v14 behaviour.
* The POS opens at `/app/rmsapp` (retail) and `/app/waiterapp` (waiter/captain).
  * The old pages `posapp`, `retailapp`, `rmsapp2`, `mobileapp`, `price_checker` and `pricechecker` now forward to `rmsapp`. Their Vue 2 sources were never in the repository, only in a prebuilt v14 bundle that cannot run on v16.

### Custom fields that were only on your v14 site

The code reads 18 POS Profile fields that exist on your v14 database but were never exported to `fixtures/custom_field.json`. Examples are `posa_allow_order_type`, `posa_card_taxes_and_charges`, `posa_block_sale_beyond_available_qty` and `posa_sales_person`. The full list is in `hooks.py`, marked "created on the v14 site".

* An upgraded database keeps them, so nothing breaks.
* A **fresh** site does not have them. Run `bench --site <old-site> export-fixtures --app posawesome` once to put them into the fixtures. They are already added to the fixture filter.

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

### Offline mode (new)

| Area | How it works |
| --- | --- |
| Catalogue | Items, barcodes, UOMs, item taxes, Item Prices (selling list, MRP list, customer price lists, validity dates), Bin stock, customers, offers, coupons, delivery charges and tax templates are stored in **IndexedDB** per site and profile. The first download is paged with keyset (`modified,name`) pagination. After that, a delta sync runs every N minutes (profile setting), plus deletions from the Deleted Document log. |
| Item lookup | Barcode, scale barcode, item code and ranked name search run against an in-memory index. The terminal uses it only after one **complete** download; until then it uses the server endpoints as on v14. |
| Scale items | Weight barcodes set the qty; price barcodes set qty = amount / rate. Price and UOM come from the cached Item Prices. |
| Offers | POS Offers come from the cached bootstrap, so automatic offers also apply offline. |
| Totals | `offline/taxes.js` reproduces ERPNext `taxes_and_totals`: inclusive and exclusive taxes, On Net Total / Actual / Previous Row, item tax templates, additional discount and rounding. The offline receipt therefore matches the invoice ERPNext creates. |
| Queue | When the server cannot be reached (no network, timeout, 502/503/504), the sale is stored in IndexedDB with an `offline_id` and an 80 mm receipt is printed locally. Stock sold offline is subtracted from the local available qty. |
| Upload | Uploads go in batches to `posawesome.posawesome.api.offline.upload_offline_invoices`. They are **idempotent**: `offline_id` is unique on Sales Invoice (`posa_offline_id`) and on the new **POS Offline Invoice** doctype. Large batches go to the `long` queue, and a scheduler job retries every hour. |
| Errors | Failed invoices stay in the queue with the server error. The cashier can retry, export as JSON, or discard them (status chip in the navbar). Back office can retry from the POS Offline Invoice list. |

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

These tests ran against a mock server. Before going live, **test on a staging copy of your v16 site** with real tax templates, batch/serial items, loyalty, and your printers and scale labels.

## 4. Known limits / to check on staging
* Keep the POS tab open. Frappe has no service worker, so **reloading** the page needs the server. If the page loads but `check_opening_shift` cannot reach the server, the POS continues with the last cached opening shift.
* Offline mode covers sales. Return Without Invoice also uses the offline path but has not been tested. Drafts, sales orders, credit sales, payment requests, M-Pesa, new addresses and invoice-based returns need the server; the UI tells the cashier so.
* Batch items offline use the batches cached for the item. ERPNext re-picks batches on sync if needed.
* The waiter app is ported to Vue 3 but runs online-only (no offline queue).
* The KDS, LOS and account summary pages were not changed.
