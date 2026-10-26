// Small replacement for lodash.debounce (trailing edge), the only lodash API used.
export function debounce(fn, wait = 0) {
	let timer = null;
	function debounced(...args) {
		const ctx = this;
		clearTimeout(timer);
		timer = setTimeout(() => {
			timer = null;
			fn.apply(ctx, args);
		}, wait);
	}
	debounced.cancel = () => clearTimeout(timer);
	return debounced;
}
export default { debounce };
