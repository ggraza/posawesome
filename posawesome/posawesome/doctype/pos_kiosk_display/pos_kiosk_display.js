// Copyright (c) 2026, Youssef Restom and contributors
// For license information, please see license.txt

frappe.ui.form.on("POS Kiosk Display", {
	refresh(frm) {
		if (!frm.is_new()) {
			frm.add_custom_button(__("Open Price Checker"), () => frappe.set_route("price_kiosk"));
			frm.add_custom_button(__("Screens"), () => frappe.set_route("List", "POS Kiosk Device", { kiosk_display: frm.doc.name }));
		}
		frm.set_query("pos_profile", "pos_profiles", () => ({
			filters: Object.assign({ disabled: 0 }, frm.doc.company ? { company: frm.doc.company } : {}),
		}));
		frm.set_query("item_code", "slides", () => ({ filters: { disabled: 0, is_sales_item: 1 } }));
		frm.set_query("pos_offer", "slides", () => ({ filters: { disable: 0 } }));
		frm.set_intro(
			__("Price checker screens of the chosen POS Profiles show this display. Changes reach them within seconds; images and videos are kept on each screen for offline play."),
			"blue"
		);
	},
	show_left_sidebar(frm) {
		if (frm.doc.show_left_sidebar && !frm.doc.left_sidebar_width) frm.set_value("left_sidebar_width", 19);
	},
});


// ----------------------------------------------------------------- Help tab
// Purpose and usage of POS Kiosk Display, shown in the Help tab (HTML field pos_kiosk_display_help).
frappe.ui.form.on("POS Kiosk Display", {
    refresh: function (frm) {
        if (frm.fields_dict.pos_kiosk_display_help) {
            frm.set_df_property("pos_kiosk_display_help", "options", posa_pos_kiosk_display_help_content());
        }
    },
});

function posa_pos_kiosk_display_help_content() {
    var help_content = `<table class="table table-bordered" style="background-color: var(--scrollbar-track-color);">
            <tr>
                <td>
                    <h4><i class="fa fa-television"></i> {{__("Kiosk Display Overview")}}</h4>
                    <ul>
                        <li>{{__("Controls what the customer price checker screens (/app/price_kiosk) show around the price: top bar, ticker, centre slideshow or video, left and right sidebars, colours and timings.")}}</li>
                        <li>{{__("A scan always comes first: the price card takes the centre and the video pauses; after Show Price For the loop comes back.")}}</li>
                        <li>{{__("Each screen keeps the display, its images and videos, so it keeps running when the server or internet is down (needs https).")}}</li>
                        <li>{{__("Changes reach open screens within seconds.")}}</li>
                    </ul>
                </td>
            </tr>
            <tr>
                <td>
                    <h4><i class="fa fa-list-ol"></i> {{__("Setup Flow")}}</h4>
                    <ol>
                        <li>{{__("Enter the Display Name; keep Enabled ticked.")}}</li>
                        <li>{{__("Applies To: add the POS Profiles of the screens, or tick All POS Profiles. Optional Company and Valid From / Upto.")}}</li>
                        <li>{{__("Layout tab: orientation, top bar (logo, tagline, date), ticker, search box, centre slideshow, sidebars and their widths.")}}</li>
                        <li>{{__("Slides tab: add Image, Video, Item, POS Offer or Text slides and choose their Area (Centre, Left or Right Sidebar).")}}</li>
                        <li>{{__("Ticker tab: add the scrolling lines.")}}</li>
                        <li>{{__("Timing and Theme tabs: seconds per slide, price time, ticker speed, colours and text size.")}}</li>
                        <li>{{__("Save. The screens update by themselves.")}}</li>
                    </ol>
                </td>
            </tr>
            <tr>
                <td>
                    <h4><i class="fa fa-clock-o"></i> {{__("Scheduling")}}</h4>
                    <ul>
                        <li><b>{{__("Priority")}}</b> - {{__("Several displays can be planned for the same screens; the valid one with the highest priority runs (e.g. Eid display priority 10 over the daily display priority 0).")}}</li>
                        <li><b>{{__("Slides and ticker lines")}}</b> - {{__("Each has its own Valid From / Upto, Daily From / To and Days (e.g. Fri,Sat). A window like 22:00 to 02:00 runs past midnight.")}}</li>
                        <li><b>{{__("Show On")}}</b> - {{__("Landscape Only / Portrait Only slides let you upload a wide and a tall version of the same picture.")}}</li>
                        <li>{{__("The screen decides the schedule itself, so it also works offline.")}}</li>
                    </ul>
                </td>
            </tr>
            <tr>
                <td>
                    <h4><i class="fa fa-film"></i> {{__("Slide Types")}}</h4>
                    <ul>
                        <li><b>{{__("Image")}}</b> - {{__("A public picture with optional title and subtitle. Fit Cover fills the area; Contain shows the whole picture.")}}</li>
                        <li><b>{{__("Video")}}</b> - {{__("A public MP4 / WebM file or an https link to the file (not a YouTube page). Plays muted to the end unless Seconds On Screen is set.")}}</li>
                        <li><b>{{__("Item")}}</b> - {{__("The item with its live price, MRP and saving from the screen's own price list.")}}</li>
                        <li><b>{{__("POS Offer")}}</b> - {{__("The offer's title, discount and end date.")}}</li>
                        <li><b>{{__("Text")}}</b> - {{__("A headline and second line, with an optional background picture.")}}</li>
                    </ul>
                </td>
            </tr>
            <tr>
                <td>
                    <h4><i class="fa fa-desktop"></i> {{__("Screens")}}</h4>
                    <ul>
                        <li>{{__("Every screen reports itself in POS Kiosk Device: what it shows, last seen, network and media kept.")}}</li>
                        <li>{{__("Name a screen on the screen itself (press the store name for 2 seconds) or in the POS Kiosk Device list.")}}</li>
                    </ul>
                </td>
            </tr>
            <tr>
                <td>
                    <h4><i class="fa fa-lightbulb-o"></i> {{__("Best Practices")}}</h4>
                    <ul>
                        <li>{{__("Upload files as public; private files are refused.")}}</li>
                        <li>{{__("Pictures 1920x1080 (landscape) or 1080x1920 (portrait); videos 1080p MP4 under about 100 MB.")}}</li>
                        <li>{{__("Keep the slide count small (5 to 8) and short texts readable from a distance.")}}</li>
                        <li>{{__("Use a higher priority display for campaigns instead of editing the daily one.")}}</li>
                    </ul>
                </td>
            </tr>
        </table>`;
    return help_content;
}
