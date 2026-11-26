// QZ Tray printing for POS Awesome.
//
// POS Profile settings:
//   posa_silent_print     "Use QZ Tray for Silent Print": invoices, orders and
//                         payment receipts go straight to the printer through
//                         QZ Tray, without the browser print dialog.
//   posa_qz_printer_name  default printer (each terminal can pick its own in
//                         the menu: QZ Tray Printer).
//   posa_raw_printing     "Use Raw Receipt Printing": send ESC/POS text
//                         commands instead of the HTML print format.
//   posa_raw_print_width  characters per line (42 for 80mm, 32 for 58mm).
//
// Every print in the POS opens /printview in a new window. While QZ printing is
// on, those calls are caught here (install()) for the doctypes in QZ_DOCTYPES
// and sent to QZ Tray instead. When QZ Tray is not running, or no printer is
// set, the normal browser print window opens as before.

import qz from '../lib/qz-tray.js';

const PRINTER_KEY = 'posa_qz_printer_name';
const CERT_KEY = 'posa_qz_certificate';
const QZ_DOCTYPES = ['Sales Invoice', 'Sales Order', 'Payment Entry'];
const CONNECT_TIMEOUT_MS = 2500;
const ESC = '\x1B';
const GS = '\x1D';

const _ = (t, a) => (typeof __ === 'function' ? __(t, a) : t);
const truthy = (v) => v === true || v === 1 || v === '1' || v === 'true';
const num = (v) => {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
};

function storage(key, value) {
  try {
    if (value === undefined) return localStorage.getItem(key) || '';
    if (value) localStorage.setItem(key, value);
    else localStorage.removeItem(key);
  } catch (e) {
    // private mode / blocked storage
  }
  return value;
}

export class QzUnavailableError extends Error {
  constructor(message) {
    super(message);
    this.name = 'QzUnavailableError';
  }
}

function call(method, args = {}) {
  return new Promise((resolve, reject) => {
    if (typeof frappe === 'undefined' || !frappe.call) return reject(new Error('frappe.call missing'));
    frappe.call({
      method,
      args,
      freeze: false,
      callback: (r) => resolve(r && r.message),
      error: (e) => reject(e || new Error(method + ' failed')),
    });
  });
}

// ---------------------------------------------------------------- QZ Tray --

let securitySet = false;
let connecting = null;

function setupSecurity() {
  if (securitySet) return;
  securitySet = true;
  // The certificate is public: it is kept on the terminal so a print made
  // while the server is down still presents it. The signature needs the
  // server's private key, so offline QZ Tray asks the cashier to Allow.
  qz.security.setCertificatePromise((resolve) => {
    call('posawesome.posawesome.api.qz.get_certificate')
      .then((cert) => {
        if (cert) storage(CERT_KEY, cert);
        resolve(cert || storage(CERT_KEY) || undefined);
      })
      .catch(() => resolve(storage(CERT_KEY) || undefined));
  });
  qz.security.setSignatureAlgorithm('SHA512');
  qz.security.setSignaturePromise((toSign) => (resolve) => {
    call('posawesome.posawesome.api.qz.sign_message', { message: toSign })
      .then((sig) => resolve(sig || undefined))
      .catch(() => resolve(undefined));
  });
}

// isActive() is already true while QZ Tray is still being looked for on its
// ports, so a connection in progress does not count.
export function isConnected() {
  return !connecting && !!(qz.websocket && qz.websocket.isActive());
}

export function connect(timeoutMs = CONNECT_TIMEOUT_MS) {
  if (isConnected()) return Promise.resolve(true);
  if (!connecting) {
    setupSecurity();
    connecting = qz.websocket
      .connect({ retries: 0, delay: 0 })
      .then(() => true)
      .catch((e) => {
        console.warn('QZ Tray: not connected', e);
        return false;
      })
      .finally(() => {
        connecting = null;
      });
  }
  const pending = connecting;
  if (!timeoutMs) return pending;
  return Promise.race([pending, new Promise((r) => setTimeout(() => r(false), timeoutMs))]);
}

export async function disconnect() {
  if (isConnected()) {
    try {
      await qz.websocket.disconnect();
    } catch (e) {
      // already closed
    }
  }
}

export async function findPrinters() {
  if (!(await connect())) throw new QzUnavailableError(_('QZ Tray is not running on this computer.'));
  const list = await qz.printers.find();
  return Array.isArray(list) ? list : list ? [String(list)] : [];
}

export function savedPrinter() {
  return storage(PRINTER_KEY);
}

export function savePrinter(name) {
  storage(PRINTER_KEY, name || '');
}

async function preparePrinter(profile) {
  if (!(await connect())) throw new QzUnavailableError(_('QZ Tray is not running on this computer.'));
  let printer = savedPrinter() || (profile && profile.posa_qz_printer_name) || '';
  if (!printer) {
    try {
      printer = await qz.printers.getDefault();
    } catch (e) {
      printer = '';
    }
  }
  if (!printer) throw new QzUnavailableError(_('No QZ Tray printer is selected.'));
  return printer;
}

export async function printRaw(data, profile) {
  const printer = await preparePrinter(profile);
  await qz.print(qz.configs.create(printer), [{ type: 'raw', format: 'command', flavor: 'plain', data }]);
}

export async function printHtml(html, profile, widthMm = 80) {
  const printer = await preparePrinter(profile);
  const config = qz.configs.create(printer, {
    size: { width: widthMm, height: null },
    units: 'mm',
    margins: { top: 0, right: 0, bottom: 0, left: 0 },
    colorType: 'grayscale',
    interpolation: 'nearest-neighbor',
  });
  // QZ renders the page itself; a window.print() inside it is not wanted.
  const clean = String(html || '').replace(/<script[\s\S]*?<\/script>/gi, '');
  await qz.print(config, [{ type: 'pixel', format: 'html', flavor: 'plain', data: clean }]);
}

// ------------------------------------------------------- ESC/POS receipt --

function clean(v) {
  return String(v == null ? '' : v)
    .normalize('NFC')
    .replace(/[\x00-\x1f\x7f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function widthOf(profile, width) {
  const w = Math.round(num(width || (profile && profile.posa_raw_print_width) || 42));
  return Math.min(Math.max(w || 42, 24), 64);
}

function lr(left, right, width) {
  const r = clean(right);
  const l = String(left == null ? '' : left).match(/^ */)[0] + clean(left);
  if (!r) return l.slice(0, width);
  const room = Math.max(0, width - r.length - 1);
  return (l.slice(0, room).padEnd(room, ' ') + ' ' + r).slice(0, width);
}

function center(text, width) {
  const t = clean(text).slice(0, width);
  return ' '.repeat(Math.max(0, Math.floor((width - t.length) / 2))) + t;
}

function wrap(text, width) {
  const out = [];
  let cur = '';
  for (let word of clean(text).split(' ')) {
    if (!word) continue;
    while (word.length > width) {
      if (cur) out.push(cur), (cur = '');
      out.push(word.slice(0, width));
      word = word.slice(width);
    }
    if (!word) continue;
    if (!cur) cur = word;
    else if ((cur + ' ' + word).length <= width) cur += ' ' + word;
    else out.push(cur), (cur = word);
  }
  if (cur) out.push(cur);
  return out;
}

function money(v, precision = 2) {
  const x = num(v);
  const s = Math.abs(x)
    .toFixed(precision)
    .replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return (x < 0 ? '-' : '') + s;
}

function qtyText(v) {
  return String(Math.round(num(v) * 1000) / 1000);
}

const TITLES = {
  'Sales Invoice': 'SALES RECEIPT',
  'Sales Order': 'SALES ORDER',
  'Payment Entry': 'PAYMENT RECEIPT',
};

// The document as ESC/POS commands: bold double-size company name, the items
// with MRP / rate / qty / amount, totals, taxes, payments, the amount saved, a
// CODE128 barcode of the document number and a paper cut.
export function buildEscPos(doc, opts = {}) {
  const profile = opts.profile || {};
  const W = widthOf(profile, opts.width);
  const L = [];
  const hr = (c = '-') => L.push(c.repeat(W));
  const add = (s) => L.push(s);
  const isPE = doc.doctype === 'Payment Entry';
  const returnBill = truthy(doc.is_return);

  let head = '';
  head += ESC + '@'; // reset
  head += ESC + 'a' + '\x01'; // centre
  head += ESC + 'E' + '\x01' + GS + '!' + '\x11'; // bold, double size
  const company = clean(doc.company || profile.company || '');
  const bigW = Math.floor(W / 2);
  head += wrap(company, bigW).join('\n') + '\n';
  head += GS + '!' + '\x00' + ESC + 'E' + '\x00';
  (opts.headerLines || []).forEach((h) => {
    head += wrap(h, W).join('\n') + '\n';
  });
  let title = _(TITLES[doc.doctype] || doc.doctype || 'RECEIPT');
  if (returnBill) title = _('RETURN') + ' ' + title;
  if (opts.title) title = opts.title;
  head += ESC + 'E' + '\x01' + clean(title) + ESC + 'E' + '\x00' + '\n';
  if (opts.label) head += clean(opts.label) + '\n';
  head += ESC + 'a' + '\x00'; // left

  hr('=');
  add(lr(_('No'), doc.name, W));
  const date = [doc.posting_date || doc.transaction_date || '', String(doc.posting_time || '').slice(0, 8)]
    .filter(Boolean)
    .join(' ');
  if (date) add(lr(_('Date'), date, W));
  const party = doc.customer_name || doc.customer || doc.party_name || doc.party || '';
  if (party) add(lr(isPE ? _('Party') : _('Customer'), party, W));
  if (doc.contact_mobile) add(lr(_('Phone'), doc.contact_mobile, W));
  const cashier = opts.cashier || doc.owner || '';
  if (cashier) add(lr(_('Cashier'), cashier, W));

  let saved = 0;
  const items = Array.isArray(doc.items) ? doc.items : [];
  if (items.length) {
    hr();
    // Amount column is fixed, the rest share the line.
    add(lr(_('Item'), '', W));
    add(lr('  ' + _('MRP') + ' / ' + _('Rate') + ' x ' + _('Qty'), _('Amount'), W));
    hr();
    items.forEach((it) => {
      const qty = num(it.qty);
      const rate = num(it.rate);
      const amount = it.amount != null ? num(it.amount) : rate * qty;
      const mrp = num(it.maximum_retail_price) > 0 ? num(it.maximum_retail_price) : num(it.price_list_rate);
      if (mrp > rate) saved += (mrp - rate) * qty;
      wrap(it.item_name || it.item_code || '', W).forEach((r) => add(r));
      const mrpText = mrp > rate ? money(mrp) + ' / ' : '';
      add(lr('  ' + mrpText + money(rate) + ' x ' + qtyText(qty) + ' ' + clean(it.uom || ''), money(amount), W));
    });
  }

  hr();
  if (isPE) {
    if (doc.payment_type) add(lr(_('Type'), doc.payment_type, W));
    if (doc.mode_of_payment) add(lr(_('Mode'), doc.mode_of_payment, W));
    if (doc.reference_no) add(lr(_('Reference'), doc.reference_no, W));
    (doc.references || []).forEach((r) =>
      add(lr(clean(r.reference_name), money(r.allocated_amount), W))
    );
    hr('=');
    L.push(ESC + 'E' + '\x01' + lr(_('Amount'), money(doc.paid_amount), W) + ESC + 'E' + '\x00');
  } else {
    if (doc.total != null) add(lr(_('Total'), money(doc.total), W));
    if (num(doc.discount_amount)) {
      add(lr(_('Discount'), money(doc.discount_amount), W));
      saved += num(doc.discount_amount);
    }
    (doc.taxes || []).forEach((t) => {
      const amt = num(t.tax_amount != null ? t.tax_amount : t.base_tax_amount);
      if (amt) add(lr(t.description || t.account_head || _('Tax'), money(amt), W));
    });
    const grand = num(doc.grand_total);
    const rounded = !truthy(doc.disable_rounded_total) && num(doc.rounded_total) ? num(doc.rounded_total) : grand;
    if (rounded !== grand) add(lr(_('Rounding'), money(rounded - grand), W));
    hr('=');
    L.push(
      ESC + 'E' + '\x01' + GS + '!' + '\x01' + lr(_('Net Total'), money(rounded), W) + GS + '!' + '\x00' + ESC + 'E' + '\x00'
    );
    const payments = (doc.payments || []).filter((p) => num(p.amount));
    if (payments.length) {
      hr();
      payments.forEach((p) => add(lr(p.mode_of_payment || _('Payment'), money(p.amount), W)));
    }
    if (num(doc.change_amount)) add(lr(_('Change'), money(doc.change_amount), W));
    if (num(doc.outstanding_amount) > 0.005) add(lr(_('Balance Due'), money(doc.outstanding_amount), W));
    if (saved > 0.005 && !returnBill) {
      hr();
      L.push(ESC + 'a' + '\x01' + ESC + 'E' + '\x01' + _('You saved') + ' ' + money(saved) + ESC + 'E' + '\x00' + ESC + 'a' + '\x00');
    }
  }

  if (doc.remarks && clean(doc.remarks) !== 'No Remarks') {
    hr();
    wrap(doc.remarks, W).forEach((r) => add(r));
  }
  (opts.footerLines || []).forEach((f) => wrap(f, W).forEach((r) => add(center(r, W))));

  let tail = ESC + 'a' + '\x01';
  const code = clean(doc.name).replace(/[^\x20-\x7e]/g, '');
  if (code && code.length <= 40) {
    // CODE128, code set B, height 60 dots, text below. Module width 2 when
    // it fits the paper (576 dots on 80mm, 384 on 58mm), else 1.
    const modules = (code.length + 3) * 11 + 2;
    const dots = W >= 42 ? 576 : 384;
    const mw = modules * 2 <= dots - 16 ? 2 : 1;
    tail += GS + 'h' + '\x3C' + GS + 'w' + String.fromCharCode(mw) + GS + 'H' + '\x02';
    tail += GS + 'k' + '\x49' + String.fromCharCode(code.length + 2) + '{B' + code + '\n';
  }
  tail += _('Thank you') + '\n';
  tail += ESC + 'a' + '\x00' + '\n\n\n\n' + GS + 'V' + '\x00';

  return head + L.join('\n') + '\n' + tail;
}

// ------------------------------------------------------- printing flow ---

let profile = null;
let installed = false;
let nativeOpen = null;

export function enabled(p = profile) {
  return !!p && truthy(p.posa_silent_print);
}

export function rawEnabled(p = profile) {
  return enabled(p) && truthy(p.posa_raw_printing);
}

function reason(e) {
  if (e && e.message) return e.message;
  if (typeof e === 'string') return e;
  return _('Unknown error');
}

// When QZ Tray is not there the browser print opens without asking; when the
// printer itself failed the cashier is asked, so a sale is not printed twice.
function fallback(e, browserPrint) {
  console.warn('QZ print failed', e);
  if (e && e.name === 'QzUnavailableError') {
    if (typeof frappe !== 'undefined' && frappe.show_alert) {
      frappe.show_alert({ message: reason(e) + ' ' + _('Printing with the browser.'), indicator: 'orange' }, 5);
    }
    browserPrint();
    return;
  }
  const msg = _('QZ Tray printing failed.') + '\n\n' + _('Reason') + ': ' + reason(e) + '\n\n' + _('Print with the browser instead?');
  if (window.confirm(msg)) browserPrint();
}

function loadDoc(doctype, name) {
  return call('frappe.client.get', { doctype, name });
}

function loadHtml(doctype, name, format, noLetterhead) {
  return call('frappe.www.printview.get_html_and_style', {
    doc: doctype,
    name,
    print_format: format || undefined,
    no_letterhead: noLetterhead,
  });
}

// Print a saved document through QZ Tray. Resolves true when it was printed.
export async function printDocument({ doctype, name, format, noLetterhead, prebill }) {
  if (rawEnabled()) {
    await preparePrinter(profile); // fail fast, before loading the document
    const doc = await loadDoc(doctype, name);
    if (!doc) throw new Error(_('Unable to load the document to print.'));
    const opts = { profile, cashier: doc.owner };
    if (prebill) {
      // fine dining guest check: not the tax invoice
      opts.title = _('GUEST CHECK');
      opts.label = _('Not a tax invoice');
      opts.headerLines = [doc.posa_service_table ? _('Table') + ' ' + doc.posa_service_table : '', Number(doc.posa_covers) ? _('Guests') + ': ' + doc.posa_covers : ''].filter(Boolean);
    }
    await printRaw(buildEscPos(doc, opts), profile);
    return true;
  }
  await preparePrinter(profile);
  const r = await loadHtml(doctype, name, format, noLetterhead == null ? 1 : noLetterhead);
  const html = r && (r.html || (r.message && r.message.html));
  const style = (r && (r.style || (r.message && r.message.style))) || '';
  if (!html) throw new Error(_('Unable to load print HTML from server.'));
  // QZ Tray renders the page itself, so relative links (logo, /files/...) need
  // the site address.
  const base = typeof window !== 'undefined' && window.location ? window.location.origin + '/' : '';
  await printHtml(
    `<!DOCTYPE html><html><head><meta charset="utf-8">${base ? `<base href="${base}">` : ''}<style>${style}</style></head><body>${html}</body></html>`,
    profile
  );
  return true;
}

// The Sales Invoice of an offline sale (v16 queue record: { offline_id,
// invoice, user, created_local }) in the shape buildEscPos reads.
export function offlineDoc(record) {
  const inv = (record && record.invoice) || {};
  const created = String(record.created_local || record.created_on || '');
  return Object.assign({}, inv, {
    doctype: 'Sales Invoice',
    name: record.offline_id || inv.name || '',
    posting_date: inv.posting_date || created.slice(0, 10),
    posting_time: inv.posting_time || created.slice(11, 19),
    owner: record.user || inv.owner || '',
  });
}

// Offline sale: doc from offlineDoc(), html the offline receipt page.
export async function printOffline(doc, html, label) {
  if (rawEnabled()) {
    const cashier = doc.owner || (typeof frappe !== 'undefined' && frappe.session && frappe.session.user_fullname) || '';
    await printRaw(buildEscPos(doc, { profile, label, cashier }), profile);
  } else {
    await printHtml(html, profile);
  }
}

export { fallback as printFallback };

// A stand-in for the print window, so callers that add a load listener or
// call print()/close() on it keep working.
function fakeWindow() {
  const noop = () => {};
  return { addEventListener: noop, removeEventListener: noop, print: noop, close: noop, focus: noop, closed: false, document: { write: noop, open: noop, close: noop } };
}

function parsePrintview(url) {
  try {
    const base = /^https?:/.test(window.location.href) ? window.location.href : 'http://localhost/';
    const u = new URL(String(url), base);
    if (!/\/printview\/?$/.test(u.pathname)) return null;
    const doctype = u.searchParams.get('doctype');
    const name = u.searchParams.get('name');
    if (!QZ_DOCTYPES.includes(doctype) || !name) return null;
    return {
      doctype,
      name,
      format: u.searchParams.get('format') || '',
      noLetterhead: u.searchParams.get('no_letterhead'),
      prebill: u.searchParams.get('posa_prebill') === '1',
    };
  } catch (e) {
    return null;
  }
}

function install() {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  nativeOpen = window.open.bind(window);
  window.open = function (url, ...rest) {
    const job = enabled() && url ? parsePrintview(url) : null;
    if (!job) return nativeOpen(url, ...rest);
    printDocument(job).catch((e) => fallback(e, () => nativeOpen(url, ...rest)));
    return fakeWindow();
  };
}

// Called with the POS Profile when the POS loads.
export function init(posProfile) {
  profile = posProfile || null;
  install();
  if (enabled()) connect(0).catch(() => {});
}

export function currentProfile() {
  return profile;
}

// ------------------------------------------------------- settings dialog --

export function openDialog() {
  const d = new frappe.ui.Dialog({
    title: _('QZ Tray Printer'),
    fields: [
      { fieldtype: 'HTML', fieldname: 'status' },
      { fieldtype: 'Select', fieldname: 'printer', label: _('Printer on this computer'), options: [''] },
      { fieldtype: 'HTML', fieldname: 'help' },
    ],
    primary_action_label: _('Save'),
    primary_action(values) {
      savePrinter(values.printer || '');
      frappe.show_alert({ message: _('Printer saved for this computer'), indicator: 'green' });
      d.hide();
    },
    secondary_action_label: _('Test Print'),
    secondary_action() {
      const p = d.get_value('printer');
      if (p) savePrinter(p);
      const doc = {
        doctype: 'Sales Invoice',
        name: 'TEST-0001',
        company: (profile && profile.company) || '',
        posting_date: frappe.datetime.nowdate(),
        posting_time: frappe.datetime.now_time(),
        customer_name: _('Test Customer'),
        items: [
          { item_name: _('Test item one'), qty: 2, rate: 90, price_list_rate: 100, amount: 180, uom: 'Nos' },
          { item_name: _('Test item two with a long name that wraps'), qty: 1, rate: 50, amount: 50, uom: 'Nos' },
        ],
        total: 230,
        grand_total: 230,
        rounded_total: 230,
        payments: [{ mode_of_payment: 'Cash', amount: 500 }],
        change_amount: 270,
      };
      const job = rawEnabled()
        ? printRaw(buildEscPos(doc, { profile, label: _('TEST PRINT') }), profile)
        : printHtml(`<div style="font-family:sans-serif;width:72mm;text-align:center"><h3>${frappe.utils.escape_html(doc.company)}</h3><p>${_('QZ Tray test print')}</p><p>${frappe.datetime.now_datetime()}</p></div>`, profile);
      job
        .then(() => frappe.show_alert({ message: _('Test print sent'), indicator: 'green' }))
        .catch((e) => frappe.msgprint({ title: _('QZ Tray'), message: frappe.utils.escape_html(reason(e)), indicator: 'red' }));
    },
  });

  const mode = !enabled()
    ? _('QZ printing is off in this POS Profile (Use QZ Tray for Silent Print).')
    : rawEnabled()
    ? _('Mode: raw ESC/POS receipt, {0} characters per line.', [widthOf(profile)])
    : _('Mode: HTML print format through QZ Tray.');

  const setStatus = (ok, text) =>
    d.fields_dict.status.$wrapper.html(
      `<div style="margin-bottom:8px"><span class="indicator-pill ${ok ? 'green' : 'red'}">${frappe.utils.escape_html(text)}</span></div><div class="text-muted small">${frappe.utils.escape_html(mode)}</div>`
    );

  const isAdmin = frappe.user && frappe.user.has_role && frappe.user.has_role('System Manager');
  d.fields_dict.help.$wrapper.html(`
    <div class="text-muted small" style="margin-top:6px">
      ${_('QZ Tray must be installed and running on this computer (qz.io/download).')}
      ${_('To stop QZ Tray asking to Allow each print, download the certificate and add it in QZ Tray: Advanced, Site Manager, +, then restart QZ Tray.')}
    </div>
    <div style="margin-top:8px">
      <button class="btn btn-xs btn-default qz-download">${_('Download Certificate')}</button>
      ${isAdmin ? `<button class="btn btn-xs btn-default qz-setup" style="margin-left:6px">${_('Set up Certificate')}</button>` : ''}
      <button class="btn btn-xs btn-default qz-reconnect" style="margin-left:6px">${_('Reconnect')}</button>
    </div>`);

  const refresh = () => {
    setStatus(false, _('Connecting to QZ Tray...'));
    findPrinters()
      .then((list) => {
        setStatus(true, _('QZ Tray connected'));
        const field = d.fields_dict.printer;
        field.df.options = [''].concat(list);
        field.refresh();
        const want = savedPrinter() || (profile && profile.posa_qz_printer_name) || '';
        d.set_value('printer', list.includes(want) ? want : '');
      })
      .catch((e) => setStatus(false, reason(e)));
  };

  d.fields_dict.help.$wrapper.on('click', '.qz-reconnect', () => disconnect().then(refresh));
  d.fields_dict.help.$wrapper.on('click', '.qz-setup', () =>
    call('posawesome.posawesome.api.qz.setup_qz_certificate').catch(() => {})
  );
  d.fields_dict.help.$wrapper.on('click', '.qz-download', () =>
    call('posawesome.posawesome.api.qz.get_certificate_download')
      .then((r) => {
        if (!r || !r.pem) return;
        storage(CERT_KEY, r.pem);
        const name = (String(r.company || '').replace(/[^a-zA-Z0-9_\- ]/g, '').trim() || 'qz-certificate') + '.crt';
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([r.pem], { type: 'application/x-x509-ca-cert' }));
        a.download = name;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
          URL.revokeObjectURL(a.href);
          a.remove();
        }, 1000);
      })
      .catch(() => {})
  );

  d.show();
  refresh();
  return d;
}
