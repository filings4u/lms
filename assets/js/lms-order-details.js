(() => {
  "use strict";

  const SUPABASE_URL = "https://elpbnytpciqnbexiaebp.supabase.co";
  const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVscGJueXRwY2lxbmJleGlhZWJwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAyOTYwMzQsImV4cCI6MjEwNTg3MjAzNH0.kWzPDxpdeorkJJpP6pvt4LCP-W9uGGVAgcQVVheVuE8";
  const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storage: window.sessionStorage,
      storageKey: "s4u-training-auth-session"
    }
  });

  const FONT_KEY = "s4u_lms_font_size";
  const FONT_DEFAULT = 14;
  const FONT_MIN = 12;
  const FONT_MAX = 18;
  const ACTIVE_NAV_INDEX = 9;

  const navItems = [
    ["lms-dashboard.html", "Dashboard", "⌂"],
    ["lms-my-courses.html", "My Courses", "▶"],
    ["lms-courses.html", "Course Library", "▦"],
    ["lms-progress.html", "Progress", "◉"],
    ["lms-certificates.html", "Certificates", "✓"],
    ["lms-live-training.html", "Live Training", "●"],
    ["lms-my-appointments.html", "Appointments", "◷"],
    ["lms-group-seats.html", "Group Seats", "♙"],
    ["lms-documents.html", "Documents", "▤"],
    ["lms-orders.html", "Orders", "≡"],
    ["lms-notifications.html", "Notifications", "✉"],
    ["lms-account.html", "Account", "○"],
    ["lms-support.html", "Support", "?"]
  ];

  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const titleCase = value => String(value || "").replace(/[_-]+/g, " ").replace(/\b\w/g, m => m.toUpperCase());
  const money = (value, currency = "usd") => {
    const n = Number(value);
    if (!Number.isFinite(n)) return "";
    try { return new Intl.NumberFormat("en-US", {style:"currency", currency:String(currency || "usd").toUpperCase()}).format(n); }
    catch { return `$${n.toFixed(2)}`; }
  };
  const fmtDateTime = value => {
    if (!value) return "—";
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? "—" : new Intl.DateTimeFormat("en-US", {
      month:"short", day:"numeric", year:"numeric", hour:"numeric", minute:"2-digit"
    }).format(d);
  };
  const badge = (label, kind="") => `<span class="badge ${kind}">${esc(label)}</span>`;
  const metric = (label, value, sub) => `<article class="metric"><small>${esc(label)}</small><strong>${esc(value)}</strong>${sub ? `<span>${esc(sub)}</span>` : ""}</article>`;

  function readFontSize(){
    const n = Number(localStorage.getItem(FONT_KEY));
    return Number.isFinite(n) ? Math.min(FONT_MAX, Math.max(FONT_MIN, n)) : FONT_DEFAULT;
  }
  function applyFontSize(n){
    const value = Math.min(FONT_MAX, Math.max(FONT_MIN, Number(n) || FONT_DEFAULT));
    document.documentElement.style.setProperty("--portal-font-root", value + "px");
    localStorage.setItem(FONT_KEY, String(value));
    const el = document.getElementById("fontSizeValue");
    if (el) el.textContent = value === FONT_DEFAULT ? "Default" : String(value);
    return value;
  }
  let portalFontSize = applyFontSize(readFontSize());

  function renderShell(){
    const links = navItems.map(([href,label,icon], index) => `<a href="${href}"${index === ACTIVE_NAV_INDEX ? ' class="active" aria-current="page"' : ""}><span class="ico">${icon}</span><span>${esc(label)}</span></a>`).join("");
    document.getElementById("trainingPortalApp").innerHTML = `
      <div class="app">
        <aside class="side" id="side">
          <div class="brand"><img src="images/training-logo.png" alt="screenings4u Learning Center"></div>
          <nav class="nav"><div class="nav-title">SCREENINGS4U LEARNING CENTER</div>${links}</nav>
          <div class="side-foot"><div style="font-size:.5625rem;color:#9fb3c7">Portal</div><div style="font-size:.6875rem;font-weight:800;color:#fff;margin-top:3px">lms.screenings4u.com</div></div>
        </aside>
        <main class="main">
          <header class="top">
            <div class="top-left">
              <button class="menu" id="menu" type="button" aria-label="Open navigation" aria-expanded="false" aria-controls="mobileNav"><span class="menu-bars" aria-hidden="true"><span></span><span></span><span></span></span></button>
              <div class="top-context"><span class="top-eyebrow">SCREENINGS4U LEARNING CENTER</span><span class="crumb">Orders / Details</span></div>
            </div>
            <div class="top-right">
              <div class="top-utility-group top-time-group"><div class="portal-clock" aria-label="Current date and time"><span id="portalClockDate" class="portal-clock-date"></span><strong id="portalClockTime" class="portal-clock-time"></strong></div></div>
              <div class="top-utility-group top-accessibility-group"><span class="top-utility-label">Text size</span><div class="font-sizer" role="group" aria-label="Page font size"><button type="button" id="fontDown" aria-label="Decrease font size">A−</button><button type="button" class="font-reset" id="fontSizeValue" aria-label="Reset font size">Default</button><button type="button" id="fontUp" aria-label="Increase font size">A+</button></div></div>
              <div class="top-utility-group top-action-group"><span class="pill">LEARNER</span><a class="top-support" href="lms-support.html">Support</a><button class="signout" id="logout" type="button">Sign out</button></div>
            </div>
          </header>
          <section class="mobile-nav" id="mobileNav" aria-hidden="true" aria-label="Portal navigation"><div class="mobile-nav-inner"><div class="mobile-nav-head"><div><span>Portal navigation</span><strong>SCREENINGS4U LEARNING CENTER</strong></div><span class="mobile-nav-current">Orders</span></div><nav class="mobile-nav-links">${links}</nav><div class="mobile-nav-foot"><span>lms.screenings4u.com</span><small>Select a page to close this menu.</small></div></div></section>
          <div class="content">
            <a class="order-details-back" href="lms-orders.html">← Back to Orders</a>
            <section class="hero"><span class="hero-kicker">SCREENINGS4U LEARNING CENTER</span><h1>Order Details</h1><p>Review the purchased items, payment status, and fulfillment information for this order.</p></section>
            <section class="section" id="content"><div class="panel"><div class="empty">Loading order details…</div></div></section>
          </div>
        </main>
      </div>`;
  }

  function bindShell(){
    portalFontSize = applyFontSize(readFontSize());
    document.getElementById("fontDown")?.addEventListener("click", () => { portalFontSize = applyFontSize(portalFontSize - 1); });
    document.getElementById("fontUp")?.addEventListener("click", () => { portalFontSize = applyFontSize(portalFontSize + 1); });
    document.getElementById("fontSizeValue")?.addEventListener("click", () => { portalFontSize = applyFontSize(FONT_DEFAULT); });

    const menu = document.getElementById("menu");
    const mobile = document.getElementById("mobileNav");
    const setMenu = open => {
      mobile?.classList.toggle("open", open);
      document.body.classList.toggle("mobile-nav-open", open);
      menu?.setAttribute("aria-expanded", String(open));
      mobile?.setAttribute("aria-hidden", String(!open));
    };
    menu?.addEventListener("click", () => setMenu(!mobile?.classList.contains("open")));
    mobile?.querySelectorAll("a").forEach(a => a.addEventListener("click", () => setMenu(false)));

    document.getElementById("logout")?.addEventListener("click", async () => {
      await db.auth.signOut();
      window.location.replace("https://lms.screenings4u.com/training-login.html");
    });
  }

  function startClock(){
    const update = () => {
      const now = new Date();
      const date = document.getElementById("portalClockDate");
      const time = document.getElementById("portalClockTime");
      if (date) date.textContent = new Intl.DateTimeFormat("en-US", {weekday:"short", month:"short", day:"numeric"}).format(now);
      if (time) time.textContent = new Intl.DateTimeFormat("en-US", {hour:"numeric", minute:"2-digit"}).format(now);
    };
    update();
    setInterval(update, 30000);
  }

  async function invokeOrders(){
    const {data, error} = await db.functions.invoke("training-orders-actions", {body:{action:"list"}});
    if (error) throw error;
    return Array.isArray(data?.orders) ? data.orders : [];
  }

  function itemName(item){
    return item?.lms_training_products?.name || item?.services?.name || item?.metadata?.name || "Training item";
  }

  function itemDetail(item){
    const p = item?.lms_training_products || {};
    const m = item?.metadata || {};
    if (p.product_kind === "group") {
      const seats = Number(p.seat_count || m.seat_count || item?.quantity || 0);
      return seats ? `${seats} learner seats` : "";
    }
    if (p.product_kind === "course") {
      const days = Number(p.access_days || m.access_days || 0);
      return days ? `${days}-day course access` : "";
    }
    if (p.product_kind === "extension") {
      const days = Number(p.access_days || m.access_days || 0);
      return days ? `${days}-day extension` : "";
    }
    return "";
  }

  function normalizedStatus(order){
    const payment = String(order?.payment_status || "").toLowerCase();
    const status = String(order?.status || "").toLowerCase();
    const fulfillment = String(order?.fulfillment_status || "").toLowerCase();
    if (payment === "refunded" || status === "refunded" || order?.refunded_at) return ["Refunded", "warn"];
    if (status === "cancelled" || fulfillment === "cancelled" || order?.cancelled_at) return ["Cancelled", "warn"];
    if (payment === "paid" || order?.paid_at) return [fulfillment === "completed" ? "Completed" : "Paid", "good"];
    if (payment) return [titleCase(payment), ""];
    if (status) return [titleCase(status), ""];
    return ["Recorded", ""];
  }

  function renderOrder(order){
    const content = document.getElementById("content");
    const [statusLabel, kind] = normalizedStatus(order);
    const items = Array.isArray(order.order_items) ? order.order_items : [];
    const method = order.payment_method ? titleCase(order.payment_method) : order.payment_provider ? titleCase(order.payment_provider) : "—";

    const itemRows = items.map(item => {
      const qty = Number(item.quantity || 1);
      const lineTotal = item.line_total ?? (Number(item.unit_price || 0) * qty);
      const detail = itemDetail(item);
      return `<div class="order-detail-item">
        <div>
          <strong>${esc(itemName(item))}</strong>
          ${detail ? `<span>${esc(detail)}</span>` : ""}
        </div>
        <div class="order-detail-item-side">
          ${qty > 1 ? `<span>Quantity: ${esc(qty)}</span>` : ""}
          <strong>${esc(money(lineTotal, order.currency))}</strong>
        </div>
      </div>`;
    }).join("");

    content.innerHTML = `
      <div class="order-detail-grid">
        ${metric("Order Number", order.order_number || "—", "Learning Center order")}
        ${metric("Order Date", fmtDateTime(order.created_at), "Purchase date")}
        ${metric("Status", statusLabel, "Current order status")}
        ${metric("Total", money(order.total, order.currency), "Order total")}
      </div>

      <div class="section">
        <div class="panel">
          <div class="panel-head"><div><h2>Purchased Items</h2><p>Courses, seats, extensions, supplies, and other items included in this order.</p></div></div>
          <div class="order-items-list">${itemRows || `<div class="empty">No line items are recorded for this order.</div>`}</div>
          <div class="order-detail-total"><span>Order Total</span><strong>${esc(money(order.total, order.currency))}</strong></div>
        </div>
      </div>

      <div class="section">
        <div class="panel">
          <div class="panel-head"><div><h2>Order Information</h2><p>Payment and fulfillment information recorded for this purchase.</p></div></div>
          <div class="table-wrap">
            <table class="order-meta-table">
              <tbody>
                <tr><td>Payment method</td><td>${esc(method)}</td></tr>
                <tr><td>Payment status</td><td>${badge(titleCase(order.payment_status || "Recorded"), kind)}</td></tr>
                <tr><td>Fulfillment status</td><td>${esc(titleCase(order.fulfillment_status || "Pending"))}</td></tr>
                <tr><td>Order status</td><td>${esc(titleCase(order.status || statusLabel))}</td></tr>
                ${order.customer_email ? `<tr><td>Email</td><td>${esc(order.customer_email)}</td></tr>` : ""}
                ${order.paid_at ? `<tr><td>Paid</td><td>${esc(fmtDateTime(order.paid_at))}</td></tr>` : ""}
              </tbody>
            </table>
          </div>
        </div>
      </div>`;
  }

  function renderMissing(message){
    document.getElementById("content").innerHTML = `
      <div class="panel">
        <div class="panel-head"><div><h2>Order Not Found</h2><p>${esc(message)}</p></div></div>
        <div style="padding:16px"><a class="orders-view-btn" href="lms-orders.html">Return to Orders</a></div>
      </div>`;
  }

  async function init(){
    renderShell();
    bindShell();
    startClock();

    const {data, error} = await db.auth.getSession();
    if (error) throw error;
    const session = data?.session;
    if (!session?.user?.id){
      const returnTo = encodeURIComponent(location.pathname + location.search);
      window.location.replace("https://lms.screenings4u.com/training-login.html?returnTo=" + returnTo);
      return;
    }

    const orderId = new URLSearchParams(location.search).get("order_id");
    if (!orderId) {
      renderMissing("No order was selected.");
      return;
    }

    try {
      const orders = await invokeOrders();
      const order = orders.find(o =>
        String(o.id || "") === String(orderId) ||
        String(o.order_number || "") === String(orderId)
      );
      if (!order) {
        renderMissing("This order is not available on the current learner account.");
        return;
      }
      renderOrder(order);
    } catch (error) {
      console.error("[LMS Order Details]", error);
      renderMissing("The order could not be loaded. Return to Orders and try again.");
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, {once:true});
  else init();
})();
