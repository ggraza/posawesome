// Mounts a POS app full screen on top of the desk without destroying the desk DOM
// (v14 mounted Vue 2 straight onto .main-section, which wiped the navbar and made
// every other route unusable until a reload). The desk is hidden while the POS
// route is active and restored when the user navigates away.
const HIDDEN_ATTR = "data-posa-hidden";

function deskParts() {
	const main = document.querySelector(".main-section") || document.body;
	return { main, parts: Array.from(main.children).filter((el) => !el.classList.contains("posa-root")) };
}

function hideDesk() {
	const { parts } = deskParts();
	parts.forEach((el) => {
		if (!el.hasAttribute(HIDDEN_ATTR)) {
			el.setAttribute(HIDDEN_ATTR, el.style.display || "");
			el.style.display = "none";
		}
	});
	document.body.classList.add("posa-fullscreen");
}

function showDesk() {
	document.querySelectorAll(`[${HIDDEN_ATTR}]`).forEach((el) => {
		el.style.display = el.getAttribute(HIDDEN_ATTR);
		el.removeAttribute(HIDDEN_ATTR);
	});
	document.body.classList.remove("posa-fullscreen");
}

export function getFullscreenRoot(routeName) {
	const { main } = deskParts();
	let root = main.querySelector(`.posa-root[data-route="${routeName}"]`);
	if (!root) {
		root = document.createElement("div");
		root.className = "posa-root";
		root.dataset.route = routeName;
		main.appendChild(root);
		const sync = () => {
			const route = (frappe.get_route && frappe.get_route()) || [];
			const active = route[0] === routeName;
			root.style.display = active ? "" : "none";
			if (active) hideDesk();
			else if (!document.querySelector(".posa-root:not([style*='display: none'])")) showDesk();
		};
		if (frappe.router && frappe.router.on) frappe.router.on("change", () => setTimeout(sync, 0));
		root._posa_sync = sync;
	}
	hideDesk();
	root.style.display = "";
	return root;
}
