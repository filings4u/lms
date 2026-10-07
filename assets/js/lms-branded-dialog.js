(() => {
  "use strict";

  let active = null;

  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));

  function close(result) {
    if (!active) return;
    const { node, resolve } = active;
    active = null;
    node.remove();
    document.body.classList.remove("lms-dialog-open");
    resolve(result);
  }

  function open(options = {}) {
    if (active) close(false);

    const {
      title = "Screenings4u Learning Center",
      message = "",
      type = "info",
      confirmText = "OK",
      cancelText = "Cancel",
      showCancel = false
    } = options;

    return new Promise((resolve) => {
      const node = document.createElement("div");
      node.className = `lms-brand-dialog lms-brand-dialog--${type}`;
      node.setAttribute("role", "dialog");
      node.setAttribute("aria-modal", "true");
      node.innerHTML = `
        <div class="lms-brand-dialog__backdrop" data-dialog-cancel></div>
        <section class="lms-brand-dialog__panel" aria-labelledby="lmsDialogTitle">
          <div class="lms-brand-dialog__brand">
            <img src="images/training-logo.png" alt="Screenings4u Learning Center">
          </div>
          <div class="lms-brand-dialog__body">
            <div class="lms-brand-dialog__eyebrow">SCREENINGS4U LEARNING CENTER</div>
            <h2 id="lmsDialogTitle">${esc(title)}</h2>
            <p>${esc(message)}</p>
            <div class="lms-brand-dialog__actions">
              ${showCancel ? `<button type="button" class="lms-brand-dialog__button lms-brand-dialog__button--secondary" data-dialog-cancel>${esc(cancelText)}</button>` : ""}
              <button type="button" class="lms-brand-dialog__button lms-brand-dialog__button--primary" data-dialog-confirm>${esc(confirmText)}</button>
            </div>
          </div>
        </section>`;

      document.body.appendChild(node);
      document.body.classList.add("lms-dialog-open");
      active = { node, resolve };

      node.querySelectorAll("[data-dialog-cancel]").forEach((el) => el.addEventListener("click", () => close(false)));
      node.querySelector("[data-dialog-confirm]")?.addEventListener("click", () => close(true));

      const key = (event) => {
        if (!active || active.node !== node) return;
        if (event.key === "Escape") { event.preventDefault(); document.removeEventListener("keydown", key); close(false); }
        if (event.key === "Enter") { event.preventDefault(); document.removeEventListener("keydown", key); close(true); }
      };
      document.addEventListener("keydown", key);
      node.querySelector("[data-dialog-confirm]")?.focus();
    });
  }

  window.LMSDialog = {
    alert(message, options = {}) {
      return open({
        title: options.title || "Learning Center",
        message,
        type: options.type || "info",
        confirmText: options.confirmText || "OK",
        showCancel: false
      });
    },
    confirm(message, options = {}) {
      return open({
        title: options.title || "Please Confirm",
        message,
        type: options.type || "warning",
        confirmText: options.confirmText || "Confirm",
        cancelText: options.cancelText || "Cancel",
        showCancel: true
      });
    }
  };
})();
