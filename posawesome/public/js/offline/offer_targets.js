// What a POS Offer applies to. An offer can list several item codes, item
// groups or brands (offer_items / offer_item_groups / offer_brands); offers
// saved before the lists existed only have the single item / item_group /
// brand field, so that is used when the list is empty.

const TARGETS = {
  'Item Code': ['item', 'offer_items', 'item_code', 'item_code'],
  'Item Group': ['item_group', 'offer_item_groups', 'item_group', 'item_group'],
  Brand: ['brand', 'offer_brands', 'brand', 'brand'],
};

export function offerTargets(offer) {
  const t = offer && TARGETS[offer.apply_on];
  if (!t) return [];
  const [single, table, link] = t;
  let rows = offer[table];
  if (typeof rows === 'string') {
    try {
      rows = JSON.parse(rows);
    } catch (e) {
      rows = [];
    }
  }
  const values = (Array.isArray(rows) ? rows : [])
    .map((r) => (r && typeof r === 'object' ? r[link] : r))
    .filter(Boolean);
  if (!values.length && offer[single]) values.push(offer[single]);
  return values;
}

// True when the cart / catalogue item is one the offer applies to.
export function offerMatchesItem(offer, item) {
  const t = offer && TARGETS[offer.apply_on];
  if (!t || !item) return false;
  const value = item[t[3]];
  return !!value && offerTargets(offer).includes(value);
}

// Price check: offers on this item (by item code / group / brand) or on the
// whole bill, with the price after the offer where it can be worked out.
// Same rules as posapp._price_check_offers (used when the server is down).
export function priceCheckOffers(offers, item, selling, itemName = (code) => code, today = null) {
  // local date (not UTC: in Pakistan the UTC date is still yesterday before 5 am)
  const now = new Date();
  const local = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const day = today || (window.frappe && frappe.datetime && frappe.datetime.now_date ? frappe.datetime.now_date() : local);
  const num = (v) => Number(v) || 0;
  const round2 = (v) => Math.round(v * 100) / 100;
  const out = [];
  for (const o of offers || []) {
    if (!o || Number(o.disable) || o.offer === 'Loyalty Point') continue;
    if (o.valid_from && String(o.valid_from).slice(0, 10) > day) continue;
    if (o.valid_upto && String(o.valid_upto).slice(0, 10) < day) continue;
    const apply_on = o.apply_on;
    if (TARGETS[apply_on]) {
      if (!offerMatchesItem(o, item)) continue;
    } else if (apply_on !== 'Transaction') {
      continue;
    }
    let offer_price = null;
    let discount = 0;
    if (o.offer === 'Item Price' && selling) {
      if (o.discount_type === 'Rate' && num(o.rate)) offer_price = num(o.rate);
      else if (o.discount_type === 'Discount Percentage' && num(o.discount_percentage))
        offer_price = selling * (1 - num(o.discount_percentage) / 100);
      else if (o.discount_type === 'Discount Amount' && num(o.discount_amount))
        offer_price = selling - num(o.discount_amount);
      if (offer_price !== null) {
        offer_price = Math.max(round2(offer_price), 0);
        discount = Math.max(round2(selling - offer_price), 0);
      }
    }
    let give_item = null;
    if (o.offer === 'Give Product') {
      if (Number(o.replace_item) || Number(o.replace_cheapest_item)) give_item = item.item_name;
      else if (o.apply_type === 'Item Code' && o.apply_item_code) give_item = itemName(o.apply_item_code) || o.apply_item_code;
      else if (o.apply_type === 'Item Group' && o.apply_item_group) give_item = o.apply_item_group;
    }
    out.push({
      name: o.name,
      title: o.title || o.name,
      offer: o.offer,
      apply_on,
      discount_type: o.discount_type,
      discount_percentage: num(o.discount_percentage),
      discount_amount: num(o.discount_amount),
      rate: num(o.rate),
      discount_category: o.discount_category,
      min_qty: num(o.min_qty),
      max_qty: num(o.max_qty),
      min_amt: num(o.min_amt),
      given_qty: num(o.given_qty),
      is_recursive: num(o.is_recursive),
      max_given_qty: num(o.max_given_qty),
      give_item,
      valid_upto: o.valid_upto ? String(o.valid_upto) : null,
      coupon_based: o.coupon_based,
      description: String(o.description || '')
        .replace(/<[^>]*>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/\s+/g, ' ')
        .trim(),
      offer_price,
      offer_discount: discount,
    });
  }
  // item offers first, then whole-bill ones
  return out.sort((a, b) => (a.apply_on === 'Transaction' ? 1 : 0) - (b.apply_on === 'Transaction' ? 1 : 0));
}
