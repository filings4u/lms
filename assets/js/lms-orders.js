(() => {
  "use strict";

  console.info("[LMS Orders] build 20261004-training6");

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
  let allOrders = [];
  let searchTerm = "";
  let statusFilter = "all";

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
  const money = (value, currency = "usd") => {
    const n = Number(value);
    if (!Number.isFinite(n)) return "";
    try { return new Intl.NumberFormat("en-US", {style:"currency", currency:String(currency || "usd").toUpperCase()}).format(n); }
    catch { return `$${n.toFixed(2)}`; }
  };
  const fmtDate = value => {
    if (!value) return "";
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? "" : new Intl.DateTimeFormat("en-US", {month:"short", day:"numeric", year:"numeric"}).format(d);
  };
  const fmtDateTime = value => {
    if (!value) return "";
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? "" : new Intl.DateTimeFormat("en-US", {month:"short", day:"numeric", year:"numeric", hour:"numeric", minute:"2-digit"}).format(d);
  };
  const titleCase = value => String(value || "").replace(/[_-]+/g, " ").replace(/\b\w/g, m => m.toUpperCase());
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
              <div class="top-context"><span class="top-eyebrow">SCREENINGS4U LEARNING CENTER</span><span class="crumb">Orders</span></div>
            </div>
            <div class="top-right">
              <div class="top-utility-group top-time-group"><div class="portal-clock" aria-label="Current date and time"><span id="portalClockDate" class="portal-clock-date"></span><strong id="portalClockTime" class="portal-clock-time"></strong></div></div>
              <div class="top-utility-group top-accessibility-group"><span class="top-utility-label">Text size</span><div class="font-sizer" role="group" aria-label="Page font size"><button type="button" id="fontDown" aria-label="Decrease font size">A−</button><button type="button" class="font-reset" id="fontSizeValue" aria-label="Reset font size">Default</button><button type="button" id="fontUp" aria-label="Increase font size">A+</button></div></div>
              <div class="top-utility-group top-action-group"><span class="pill">LEARNER</span><a class="top-support" href="lms-support.html">Support</a><button class="signout" id="logout" type="button">Sign out</button></div>
            </div>
          </header>
          <section class="mobile-nav" id="mobileNav" aria-hidden="true" aria-label="Portal navigation"><div class="mobile-nav-inner"><div class="mobile-nav-head"><div><span>Portal navigation</span><strong>SCREENINGS4U LEARNING CENTER</strong></div><span class="mobile-nav-current">Orders</span></div><nav class="mobile-nav-links">${links}</nav><div class="mobile-nav-foot"><span>lms.screenings4u.com</span><small>Select a page to close this menu.</small></div></div></section>
          <div class="content">
            <section class="hero"><span class="hero-kicker">SCREENINGS4U LEARNING CENTER</span><h1>Orders</h1><p>Review your Learning Center purchases and training order history.</p></section>
            <section class="section" id="content"></section>
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
    const close = document.getElementById("mobileClose");
    const setMenu = open => {
      mobile?.classList.toggle("open", open);
      document.body.classList.toggle("mobile-nav-open", open);
      menu?.setAttribute("aria-expanded", String(open));
      mobile?.setAttribute("aria-hidden", String(!open));
    };
    menu?.addEventListener("click", () => setMenu(!mobile?.classList.contains("open")));
    close?.addEventListener("click", () => setMenu(false));
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
    return item?.lms_training_products?.name || item?.services?.name || item?.metadata?.name || "";
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

  function renderFilters(){
    return `<div class="panel orders-history-panel">
      <div class="panel-head">
        <div>
          <h2>Purchase History</h2>
          <p>Training orders associated with this learner account.</p>
        </div>
        <span class="badge">${esc(allOrders.length)} ${allOrders.length === 1 ? "order" : "orders"}</span>
      </div>
      <div class="orders-filter-grid">
        <label>
          <span class="orders-filter-label">Search</span>
          <input id="orderSearch" type="search" placeholder="Order number or course">
        </label>
        <label>
          <span class="orders-filter-label">Status</span>
          <select id="orderStatus">
            <option value="all">All orders</option>
            <option value="paid">Paid / Completed</option>
            <option value="pending">Pending</option>
            <option value="cancelled">Cancelled</option>
            <option value="refunded">Refunded</option>
          </select>
        </label>
      </div>
    </div>`;
  }

  function renderOrders(){
    const content = document.getElementById("content");
    const orderValue = allOrders.reduce((sum,o) => sum + Number(o.total || 0), 0);
    const itemCount = allOrders.reduce((sum,o) => sum + (Array.isArray(o.order_items) ? o.order_items.reduce((s,i) => s + Number(i.quantity || 1),0) : 0), 0);
    const latestOrder = allOrders[0]?.created_at ? fmtDate(allOrders[0].created_at) : "";

    const term = searchTerm.trim().toLowerCase();
    const filtered = allOrders.filter(order => {
      const [statusLabel] = normalizedStatus(order);
      const haystack = [order.order_number, order.customer_email, ...(order.order_items || []).map(itemName)].filter(Boolean).join(" ").toLowerCase();
      const matchesSearch = !term || haystack.includes(term);
      const sl = statusLabel.toLowerCase();
      const matchesStatus = statusFilter === "all" ||
        (statusFilter === "paid" && (sl === "paid" || sl === "completed")) ||
        (statusFilter === "pending" && !["paid","completed","cancelled","refunded"].includes(sl)) ||
        (statusFilter === "cancelled" && sl === "cancelled") ||
        (statusFilter === "refunded" && sl === "refunded");
      return matchesSearch && matchesStatus;
    });

    const rows = filtered.map(order => {
      const [statusLabel, kind] = normalizedStatus(order);
      const orderNo = order.order_number || "—";
      const method = order.payment_method ? titleCase(order.payment_method) : order.payment_provider ? titleCase(order.payment_provider) : "—";
      const names = (order.order_items || []).map(itemName).filter(Boolean);
      const itemSummary = names.length ? names.join(", ") : "Training purchase";
      return `<tr>
        <td><strong>${esc(orderNo)}</strong><small>${esc(fmtDateTime(order.created_at))}</small></td>
        <td><strong>${esc(itemSummary)}</strong><small>${esc((order.order_items || []).length)} line item${(order.order_items || []).length === 1 ? "" : "s"}</small></td>
        <td>${esc(method)}</td>
        <td>${badge(statusLabel, kind)}</td>
        <td><strong>${esc(money(order.total, order.currency))}</strong></td>
        <td><button class="orders-view-btn" type="button" data-order-id="${esc(order.id || order.order_number || "")}">View</button></td>
      </tr>`;
    }).join("");

    content.innerHTML = `
      <div class="metrics">
        ${metric("Training Orders", allOrders.length, "Orders on this account")}
        ${metric("Items Purchased", itemCount, "Courses, seats, and add-ons")}
        ${metric("Order Value", money(orderValue, allOrders[0]?.currency || "usd"), "Recorded order total")}
        ${metric("Latest Order", latestOrder || "—", latestOrder ? "Most recent purchase" : "No order date")}
      </div>

      <div class="section">${renderFilters()}</div>

      <div class="section">
        <div class="panel">
          <div class="panel-head">
            <div>
              <h2>Orders</h2>
              <p>Open an order to review purchased items, payment, and fulfillment details.</p>
            </div>
          </div>
          <div class="table-wrap">
            <table class="orders-table">
              <thead><tr><th>Order</th><th>Purchase</th><th>Method</th><th>Status</th><th>Total</th><th></th></tr></thead>
              <tbody>${rows || `<tr><td colspan="6"><div class="empty">No orders match the current filters.</div></td></tr>`}</tbody>
            </table>
          </div>
        </div>
      </div>

      <div id="orderDetailModal" class="modal-backdrop" hidden>
        <div class="modal orders-modal" role="dialog" aria-modal="true" aria-labelledby="orderDetailTitle">
          <div class="orders-modal-head">
            <div><span class="hero-kicker">ORDER DETAILS</span><h2 id="orderDetailTitle">Order</h2></div>
            <button type="button" class="orders-modal-close" aria-label="Close">×</button>
          </div>
          <div id="orderDetailBody"></div>
        </div>
      </div>`;

    document.getElementById("orderSearch")?.addEventListener("input", e => {
      searchTerm = e.target.value || "";
      renderOrders();
    });

    const status = document.getElementById("orderStatus");
    if (status) {
      status.value = statusFilter;
      status.addEventListener("change", e => {
        statusFilter = e.target.value || "all";
        renderOrders();
      });
    }
    const search = document.getElementById("orderSearch");
    if (search) search.value = searchTerm;

    document.querySelectorAll(".orders-view-btn").forEach(button => {
      button.addEventListener("click", () => {
        const id = button.dataset.orderId;
        const order = allOrders.find(o => String(o.id || o.order_number || "") === String(id));
        if (order) openOrderDetail(order);
      });
    });

    document.querySelector(".orders-modal-close")?.addEventListener("click", closeOrderDetail);
    document.getElementById("orderDetailModal")?.addEventListener("click", e => {
      if (e.target.id === "orderDetailModal") closeOrderDetail();
    });
  }

  function openOrderDetail(order){
    const modal = document.getElementById("orderDetailModal");
    const body = document.getElementById("orderDetailBody");
    const title = document.getElementById("orderDetailTitle");
    if (!modal || !body || !title) return;

    const [statusLabel, kind] = normalizedStatus(order);
    title.textContent = order.order_number || "Order";
    const items = (order.order_items || []).map(item => {
      const name = itemName(item) || "Training item";
      const detail = itemDetail(item);
      const qty = Number(item.quantity || 1);
      const line = item.line_total ?? (Number(item.unit_price || 0) * qty);
      return `<div class="orders-detail-item">
        <div><strong>${esc(name)}</strong>${detail ? `<span>${esc(detail)}</span>` : ""}</div>
        <div>${qty > 1 ? `<span>Qty ${esc(qty)}</span>` : ""}<strong>${esc(money(line, order.currency))}</strong></div>
      </div>`;
    }).join("");

    body.innerHTML = `
      <div class="orders-detail-summary">
        <div><span>Status</span>${badge(statusLabel, kind)}</div>
        <div><span>Order date</span><strong>${esc(fmtDateTime(order.created_at))}</strong></div>
        <div><span>Payment</span><strong>${esc(titleCase(order.payment_status || "Recorded"))}</strong></div>
        <div><span>Fulfillment</span><strong>${esc(titleCase(order.fulfillment_status || "Pending"))}</strong></div>
      </div>
      <div class="orders-detail-items">${items || `<div class="empty">No line items recorded.</div>`}</div>
      <div class="orders-detail-total"><span>Total</span><strong>${esc(money(order.total, order.currency))}</strong></div>`;
    modal.hidden = false;
    document.body.style.overflow = "hidden";
  }

  function closeOrderDetail(){
    const modal = document.getElementById("orderDetailModal");
    if (modal) modal.hidden = true;
    document.body.style.overflow = "";
  }

  async function init(){
    renderShell();
    bindShell();
    startClock();

    const {data, error} = await db.auth.getSession();
    if (error) throw error;
    const session = data?.session;
    if (!session?.user?.id){
      window.location.replace("https://lms.screenings4u.com/training-login.html?returnTo=%2Flms-orders.html");
      return;
    }

    try {
      allOrders = await invokeOrders();
      renderOrders();
    } catch (error) {
      console.error("[LMS Orders]", error);
      throw error;
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, {once:true});
  else init();
})();
