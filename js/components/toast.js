/**
 * COMMON GROUND — Accessible Toast Feedback Component
 * Provides immediate, non-blocking confirmation when a user quick-adds an item.
 */

let toastContainer = null;

function ensureContainer() {
  if (!toastContainer) {
    toastContainer = document.createElement("div");
    toastContainer.className = "toast-container";
    toastContainer.setAttribute("role", "status");
    toastContainer.setAttribute("aria-live", "polite");
    document.body.appendChild(toastContainer);
  }
  return toastContainer;
}

/**
 * Displays a temporary toast message at the bottom-right of the screen.
 * @param {string} message
 * @param {object} [options]
 * @param {string} [options.actionLabel]
 * @param {string} [options.actionHref]
 */
export function showToast(message, options = {}) {
  const isStaffPortal =
    typeof window !== "undefined" &&
    /barista|admin/i.test(window.location.pathname || "");
  const defaultLabel = isStaffPortal ? "" : "View bag";
  const defaultHref = isStaffPortal ? "" : "menu.html#your-bag";
  const { actionLabel = defaultLabel, actionHref = defaultHref } = options;
  const container = ensureContainer();

  const toast = document.createElement("div");
  toast.className = "toast";

  const textSpan = document.createElement("span");
  textSpan.textContent = message;
  toast.appendChild(textSpan);

  if (actionLabel && actionHref) {
    const actionLink = document.createElement("a");
    actionLink.className = "toast__action";
    actionLink.href = actionHref;
    actionLink.textContent = actionLabel;
    toast.appendChild(actionLink);
  }

  container.appendChild(toast);

  window.setTimeout(() => {
    toast.remove();
  }, 3000);
}
