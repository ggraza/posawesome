// Vue 2's `new Vue()` event bus API ($on/$off/$once/$emit) for Vue 3, where
// instance event methods were removed. Each POS app creates its own bus.
export function createEventBus() {
	const handlers = new Map();

	const bus = {
		$on(event, fn) {
			if (Array.isArray(event)) {
				event.forEach((e) => bus.$on(e, fn));
				return bus;
			}
			if (!handlers.has(event)) handlers.set(event, []);
			handlers.get(event).push(fn);
			return bus;
		},
		$once(event, fn) {
			const wrapper = (...args) => {
				bus.$off(event, wrapper);
				fn(...args);
			};
			wrapper._original = fn;
			return bus.$on(event, wrapper);
		},
		$off(event, fn) {
			if (event === undefined) {
				handlers.clear();
				return bus;
			}
			if (Array.isArray(event)) {
				event.forEach((e) => bus.$off(e, fn));
				return bus;
			}
			if (!handlers.has(event)) return bus;
			if (!fn) {
				handlers.delete(event);
				return bus;
			}
			const list = handlers.get(event).filter((h) => h !== fn && h._original !== fn);
			if (list.length) handlers.set(event, list);
			else handlers.delete(event);
			return bus;
		},
		$emit(event, ...args) {
			const list = handlers.get(event);
			if (!list) return bus;
			// copy: handlers may unsubscribe while we iterate
			for (const fn of list.slice()) {
				try {
					fn(...args);
				} catch (e) {
					console.error(`[posawesome] handler for "${event}" failed`, e);
				}
			}
			return bus;
		},
		listenerCount(event) {
			return (handlers.get(event) || []).length;
		},
	};
	return bus;
}
