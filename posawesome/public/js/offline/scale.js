// Weighing-scale barcodes.
//
// A scale prints e.g. EAN-13 "21 12345 01250 7": prefix 21, item 12345, weight
// 01.250 kg, check digit. Everything is configurable on the POS Profile (tab
// "POS Offline & Scale"); the defaults reproduce the v14 behaviour of this app
// (item part = first 7 digits looked up as a barcode, weight = digits 8-12 with
// 3 decimals).

function int(v, d) {
	const n = parseInt(v, 10);
	return Number.isFinite(n) ? n : d;
}

export function scaleConfig(profile = {}) {
	const prefixes = String(profile.posa_scale_barcode_start ?? "")
		.split(/[,\s]+/)
		.map((p) => p.trim())
		.filter(Boolean);
	return {
		enabled: prefixes.length > 0,
		prefixes,
		length: int(profile.posa_scale_barcode_length, 13),
		itemStart: int(profile.posa_scale_item_start, 1),
		itemLength: int(profile.posa_scale_item_length, 7),
		lookup: profile.posa_scale_item_lookup || "Item Barcode or Item Code",
		valueType: profile.posa_scale_value_type || "Weight",
		valueStart: int(profile.posa_scale_value_start, 8),
		valueLength: int(profile.posa_scale_value_length, 5),
		decimals: int(profile.posa_scale_value_decimals, 3),
		checkDigit: !!int(profile.posa_scale_validate_check_digit, 0),
	};
}

export function ean13CheckDigitValid(code) {
	if (!/^\d+$/.test(code) || (code.length !== 13 && code.length !== 8 && code.length !== 12)) return false;
	const digits = code.split("").map(Number);
	const check = digits.pop();
	let sum = 0;
	// weights 3,1,3,1... from the right of the payload
	for (let i = digits.length - 1, w = 3; i >= 0; i--, w = w === 3 ? 1 : 3) sum += digits[i] * w;
	return (10 - (sum % 10)) % 10 === check;
}

/**
 * Parse a scanned code. Returns null when it is not a scale barcode, otherwise
 * { itemPart, value, valueType, raw }.
 */
export function parseScaleBarcode(code, config) {
	if (!config || !config.enabled || !code) return null;
	const raw = String(code).trim();
	if (!/^\d+$/.test(raw)) return null;
	if (!config.prefixes.some((p) => raw.startsWith(p))) return null;
	if (config.length && raw.length !== config.length) return null;
	if (config.checkDigit && !ean13CheckDigitValid(raw)) return null;
	const itemPart = raw.substr(config.itemStart - 1, config.itemLength);
	const valueDigits = raw.substr(config.valueStart - 1, config.valueLength);
	if (!itemPart || !/^\d+$/.test(valueDigits)) return null;
	const value = parseInt(valueDigits, 10) / Math.pow(10, config.decimals);
	return { itemPart, value, valueType: config.valueType, raw };
}

/** The code part without the prefix (for setups keyed on item code only). */
export function stripPrefix(itemPart, config) {
	const p = config.prefixes.find((x) => itemPart.startsWith(x));
	return p ? itemPart.slice(p.length) : itemPart;
}
