// Fine dining: pure helpers (no Vue, no frappe), shared by the retail / RMS POS
// and the waiter app, and unit tested on their own.

const EPS = 1e-9;
const num = (v) => Number(v) || 0;

export function rowKey(row) {
	return (row && (row.posa_row_id || row.item_code)) || "";
}

// The course an item gets when it is added: the course whose item groups
// include the item's group; none when no course claims the group.
export function defaultCourse(item, courses) {
	const group = item && item.item_group;
	if (!group) return null;
	return (courses || []).find((c) => (c.item_groups || []).includes(group)) || null;
}

// "Hold" for a course that waits for the waiter's Fire, "Fired" otherwise.
export function statusFor(courseName, courses) {
	const c = (courses || []).find((x) => x.name === courseName);
	return c && Number(c.hold_until_fired) ? "Hold" : "Fired";
}

// Modifier groups that apply to an item (by item code or item group).
export function groupsFor(item, groups) {
	if (!item) return [];
	return (groups || []).filter(
		(g) =>
			(g.item_codes || []).includes(item.item_code) ||
			(item.item_group && (g.item_groups || []).includes(item.item_group))
	);
}

// selection: { groupName: [option, ...] }. Returns the problems, empty when fine.
export function checkSelection(groups, selection) {
	const errors = [];
	for (const g of groups || []) {
		const chosen = (selection && selection[g.name]) || [];
		const min = Math.max(num(g.min_select), Number(g.required) ? 1 : 0);
		const max = num(g.max_select);
		if (chosen.length < min) {
			errors.push({ group: g.name, kind: "min", min });
		} else if (max && chosen.length > max) {
			errors.push({ group: g.name, kind: "max", max });
		}
	}
	return errors;
}

// The text the kitchen reads, in the groups' order: "Medium Rare, Fries, + Extra Cheese".
export function modifiersText(groups, selection) {
	const parts = [];
	for (const g of groups || []) {
		const chosen = (selection && selection[g.name]) || [];
		for (const opt of g.options || []) {
			if (!chosen.includes(opt.option)) continue;
			parts.push(opt.item ? "+ " + opt.option : opt.option);
		}
	}
	return parts.join(", ");
}

// The paid add-on items of a selection: [{ item_code, option, group }].
export function addonItems(groups, selection) {
	const out = [];
	for (const g of groups || []) {
		const chosen = (selection && selection[g.name]) || [];
		for (const opt of g.options || []) {
			if (opt.item && chosen.includes(opt.option)) out.push({ item_code: opt.item, option: opt.option, group: g.name });
		}
	}
	return out;
}

// The default selection of a set of groups ("Selected By Default" options),
// or, when editing, the selection that produced `text`.
export function initialSelection(groups, text) {
	const sel = {};
	const have = text
		? String(text)
				.split(",")
				.map((s) => s.trim().replace(/^\+\s*/, ""))
				.filter(Boolean)
		: null;
	for (const g of groups || []) {
		sel[g.name] = (g.options || [])
			.filter((o) => (have ? have.includes(o.option) : Number(o.is_default)))
			.map((o) => o.option);
	}
	return sel;
}

// What was sent to the kitchen and is now less (or gone) in the cart:
// [{ row_id, qty, sent, now }]. `sent` = { row_id: qty } from the server.
export function pendingVoids(sent, items) {
	const cart = {};
	for (const row of items || []) {
		const k = rowKey(row);
		cart[k] = (cart[k] || 0) + num(row.qty);
	}
	const out = [];
	for (const [k, qty] of Object.entries(sent || {})) {
		const gone = num(qty) - (cart[k] || 0);
		if (gone > EPS) out.push({ row_id: k, qty: round(gone), sent: num(qty), now: cart[k] || 0 });
	}
	return out;
}

function round(v) {
	return Math.round(v * 1e6) / 1e6;
}

// Courses in the cart with their held / fired counts, in course order:
// [{ name, color, sequence, hold, fired }].
export function courseSummary(items, courses) {
	const by = {};
	for (const row of items || []) {
		if (!row.posa_course || row.posa_parent_row_id) continue;
		const e = (by[row.posa_course] = by[row.posa_course] || { name: row.posa_course, hold: 0, fired: 0 });
		if (row.posa_course_status === "Hold") e.hold += num(row.qty);
		else e.fired += num(row.qty);
	}
	const order = (courses || []).map((c) => c.name);
	return Object.values(by)
		.map((e) => {
			const c = (courses || []).find((x) => x.name === e.name) || {};
			return { ...e, color: c.color || null, sequence: num(c.sequence) };
		})
		.sort((a, b) => a.sequence - b.sequence || order.indexOf(a.name) - order.indexOf(b.name));
}

// Whether scanning / tapping `item` again may add to the existing row `el`
// instead of a new row. Fine dining keeps rows apart by seat, course and
// modifiers, so the kitchen and the bill stay exact.
export function canMerge(el, item, ctx) {
	if (!ctx || !ctx.on) return true;
	if (el.posa_parent_row_id || el.posa_modifiers || Number(el.posa_comp)) return false;
	if (ctx.modifiers && groupsFor(item, ctx.groups).length) return false;
	if (ctx.seats && num(el.posa_seat) !== num(ctx.seat)) return false;
	return true;
}

// How many seat buttons to offer: the guests, at least the highest seat used,
// at least 2.
export function seatCount(covers, items, tableSeats) {
	let n = Math.max(num(covers), 2);
	for (const row of items || []) n = Math.max(n, num(row.posa_seat));
	if (!num(covers) && num(tableSeats)) n = Math.max(n, num(tableSeats));
	return Math.min(n, 30);
}

// Add-on rows follow their main row: same qty, seat and course; gone when the
// main row is gone. Returns the add-on rows to remove.
export function syncAddons(items) {
	const byId = {};
	for (const row of items || []) byId[row.posa_row_id] = row;
	const orphans = [];
	for (const row of items || []) {
		if (!row.posa_parent_row_id) continue;
		const parent = byId[row.posa_parent_row_id];
		if (!parent) {
			orphans.push(row);
			continue;
		}
		if (num(row.qty) !== num(parent.qty)) {
			row.qty = num(parent.qty);
			row.stock_qty = num(parent.qty) * (num(row.conversion_factor) || 1);
		}
		row.posa_seat = parent.posa_seat;
		row.posa_course = parent.posa_course;
		row.posa_course_status = parent.posa_course_status;
	}
	return orphans;
}
