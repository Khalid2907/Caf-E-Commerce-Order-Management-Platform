/**
 * COMMON GROUND — Admin Management Suite Controller
 *
 * Implements all 7 Figma Admin Workspace views backed by real PostgreSQL REST APIs:
 * 1. Overview (08 · Admin overview)
 * 2. Orders & Order Inspector (09 · Admin orders)
 * 3. Menu & Inventory CRUD (10 · Menu management)
 * 4. Customers & Loyalty CRM (19 · Customers & loyalty)
 * 5. Discounts & Promo Codes (20 · Discounts)
 * 6. Sales Analytics (21 · Sales analytics)
 * 7. Store Settings & Staff Roster (11 · Store settings)
 */

import { showToast } from "../components/toast.js";
import { STORAGE_KEYS, formatPrice } from "../config/constants.js";
import {
  formatLocaleNumber,
  i18n,
  localizeCustomizationSummary,
  localizeProduct,
  localizeStatus,
  translatePageDOM,
} from "../i18n/i18n.js";
import { apiRequest } from "../services/apiClient.js";
import { storageService } from "../services/storageService.js";

const state = {
  activeSection: "overview",
  overview: null,
  orders: [],
  selectedOrder: null,
  orderFilterStatus: "all",
  orderSearch: "",
  products: [],
  categories: [],
  selectedProduct: null,
  isCreatingProduct: false,
  productSearch: "",
  productCategoryFilter: "all",
  customers: [],
  selectedCustomer: null,
  coupons: [],
  selectedCoupon: null,
  isCreatingCoupon: false,
  analytics: null,
  settings: null,
  staff: [],
};

function switchSection(sectionId) {
  state.activeSection = sectionId;
  document.querySelectorAll("[data-admin-section]").forEach((panel) => {
    panel.hidden = panel.dataset.adminSection !== sectionId;
  });
  document.querySelectorAll("[data-admin-nav]").forEach((btn) => {
    btn.classList.toggle("is-active", btn.dataset.adminNav === sectionId);
  });

  const crumbMap = {
    overview: "Overview",
    orders: "Orders",
    menu: "Menu & inventory",
    customers: "Customers",
    discounts: "Discounts",
    analytics: "Analytics",
    settings: "Store settings",
  };
  const crumbEl = document.getElementById("admin-crumb-current");
  if (crumbEl) crumbEl.textContent = crumbMap[sectionId] || "Overview";
  translatePageDOM();
}

// =============================================================================
// 1. OVERVIEW RENDERER (08 · Admin overview)
// =============================================================================
function renderOverview() {
  const ov = state.overview;
  if (!ov) return;

  const netEl = document.getElementById("ov-net-sales");
  const ordEl = document.getElementById("ov-total-orders");
  const ordSubEl = document.getElementById("ov-orders-sub");
  const avgEl = document.getElementById("ov-avg-order");
  const badgeEl = document.getElementById("sidebar-active-orders-badge");

  if (netEl) netEl.textContent = formatPrice(ov.netSalesEgp);
  if (ordEl) ordEl.textContent = formatLocaleNumber(ov.totalOrders);
  if (ordSubEl) {
    const isAr = i18n.getLanguage() === "ar";
    ordSubEl.textContent = isAr
      ? `${formatLocaleNumber(ov.activeOrders)} نشط · ${formatLocaleNumber(
          ov.completedOrders
        )} مكتمل`
      : `${ov.activeOrders} active · ${ov.completedOrders} completed`;
  }
  if (avgEl) avgEl.textContent = formatPrice(ov.avgOrderEgp);
  if (badgeEl) badgeEl.textContent = formatLocaleNumber(ov.activeOrders);

  const isAr = i18n.getLanguage() === "ar";
  const arDayMap = {
    Wed: "الأربعاء",
    Thu: "الخميس",
    Fri: "الجمعة",
    Sat: "السبت",
    Sun: "الأحد",
    Mon: "الإثنين",
    Tue: "الثلاثاء",
  };
  const arProductNameMap = {
    "Spanish Latte": "سبانيش لاتيه",
    "Flat White": "فلات وايت",
    Americano: "أمريكانو",
    "Butter Croissant": "كرواسون بالزبدة",
    Cappuccino: "كابتشينو",
    "Iced Matcha": "آيس ماتشا",
    "Caramel Latte": "كراميل لاتيه",
  };

  // Weekly Bar Chart
  const chartContainer = document.getElementById("ov-weekly-chart");
  if (chartContainer && Array.isArray(ov.weeklySalesEgp)) {
    chartContainer.replaceChildren();
    const maxVal = Math.max(...ov.weeklySalesEgp.map((d) => d.salesEgp), 1);
    ov.weeklySalesEgp.forEach((d, idx) => {
      const col = document.createElement("div");
      col.className = `weekly-bar${
        idx === ov.weeklySalesEgp.length - 1 ? " is-today" : ""
      }`;
      const fill = document.createElement("div");
      fill.className = "weekly-bar__fill";
      fill.style.blockSize = `${Math.max(18, Math.round((d.salesEgp / maxVal) * 140))}px`;
      const dayLabel = isAr ? arDayMap[d.day] || d.day : d.day;
      fill.title = `${dayLabel}: ${formatPrice(d.salesEgp)}`;

      const day = document.createElement("span");
      day.className = "weekly-bar__day";
      day.textContent = dayLabel;

      col.appendChild(fill);
      col.appendChild(day);
      chartContainer.appendChild(col);
    });
  }

  // Crowd Favorites
  const favContainer = document.getElementById("ov-crowd-favorites");
  if (favContainer && Array.isArray(ov.crowdFavorites)) {
    favContainer.replaceChildren();
    const maxUnits = Math.max(...ov.crowdFavorites.map((f) => f.units_sold), 1);
    ov.crowdFavorites.forEach((f) => {
      const item = document.createElement("div");
      item.className = "progress-item";
      const row = document.createElement("div");
      row.className = "progress-item__row";
      const name = document.createElement("span");
      name.textContent = isAr ? arProductNameMap[f.name] || f.name : f.name;
      const units = document.createElement("strong");
      units.textContent = formatLocaleNumber(f.units_sold);
      row.appendChild(name);
      row.appendChild(units);

      const track = document.createElement("div");
      track.className = "progress-item__track";
      const fill = document.createElement("div");
      fill.className = "progress-item__fill";
      fill.style.inlineSize = `${Math.round((f.units_sold / maxUnits) * 100)}%`;
      track.appendChild(fill);

      item.appendChild(row);
      item.appendChild(track);
      favContainer.appendChild(item);
    });
  }

  // Latest 4 orders table
  const latestTbody = document.getElementById("ov-latest-orders-tbody");
  if (latestTbody) {
    latestTbody.replaceChildren();
    state.orders.slice(0, 4).forEach((ord) => {
      const tr = document.createElement("tr");
      tr.dataset.inspectOrder = ord.orderReference;

      const tdRef = document.createElement("td");
      const refStrong = document.createElement("strong");
      refStrong.textContent = `#${ord.orderReference}`;
      tdRef.appendChild(refStrong);
      const tdCust = document.createElement("td");
      tdCust.textContent = ord.customerName;
      const tdStatus = document.createElement("td");
      const pill = document.createElement("span");
      pill.className = `status-badge status-badge--${ord.uiStatus.toLowerCase()}`;
      pill.textContent = localizeStatus(ord.uiStatus);
      tdStatus.appendChild(pill);
      const tdTotal = document.createElement("td");
      const totalStrong = document.createElement("strong");
      totalStrong.textContent = formatPrice(ord.totalEgp);
      tdTotal.appendChild(totalStrong);

      tr.appendChild(tdRef);
      tr.appendChild(tdCust);
      tr.appendChild(tdStatus);
      tr.appendChild(tdTotal);
      latestTbody.appendChild(tr);
    });
  }
}

// =============================================================================
// 2. ORDERS & ORDER INSPECTOR (09 · Admin orders)
// =============================================================================
function renderOrdersSection() {
  const tbody = document.getElementById("admin-orders-tbody");
  if (!tbody) return;

  const filtered = state.orders.filter((o) => {
    const matchesStatus =
      state.orderFilterStatus === "all" ||
      o.uiStatus.toLowerCase() === state.orderFilterStatus.toLowerCase() ||
      o.status.toLowerCase() === state.orderFilterStatus.toLowerCase();
    const q = state.orderSearch.trim().toLowerCase();
    const matchesSearch =
      !q ||
      o.orderReference.toLowerCase().includes(q) ||
      o.customerName.toLowerCase().includes(q) ||
      (o.customerPhone && o.customerPhone.toLowerCase().includes(q));
    return matchesStatus && matchesSearch;
  });

  if (!state.selectedOrder && filtered.length > 0) {
    state.selectedOrder = filtered[0];
  }

  tbody.replaceChildren();
  filtered.forEach((ord) => {
    const tr = document.createElement("tr");
    tr.dataset.selectOrderRef = ord.orderReference;
    if (
      state.selectedOrder &&
      state.selectedOrder.orderReference === ord.orderReference
    ) {
      tr.classList.add("is-selected");
    }

    const tdRef = document.createElement("td");
    const refStrong = document.createElement("strong");
    refStrong.textContent = `#${ord.orderReference}`;
    tdRef.appendChild(refStrong);

    const tdCust = document.createElement("td");
    const nameP = document.createElement("strong");
    nameP.textContent = ord.customerName;
    const ageSpan = document.createElement("span");
    ageSpan.className = "admin-table__sku";
    ageSpan.textContent = ord.ageLabel;
    tdCust.appendChild(nameP);
    tdCust.appendChild(ageSpan);

    const tdType = document.createElement("td");
    tdType.textContent = localizeStatus(
      ord.fulfillmentType === "delivery" ? "Delivery" : "Pickup"
    );

    const tdStatus = document.createElement("td");
    const pill = document.createElement("span");
    pill.className = `status-badge status-badge--${ord.uiStatus.toLowerCase()}`;
    pill.textContent = localizeStatus(ord.uiStatus);
    tdStatus.appendChild(pill);

    const tdTotal = document.createElement("td");
    const totalStrong = document.createElement("strong");
    totalStrong.textContent = formatPrice(ord.totalEgp);
    tdTotal.appendChild(totalStrong);

    tr.appendChild(tdRef);
    tr.appendChild(tdCust);
    tr.appendChild(tdType);
    tr.appendChild(tdStatus);
    tr.appendChild(tdTotal);
    tbody.appendChild(tr);
  });

  renderOrderInspector();
}

function renderOrderInspector() {
  const ord = state.selectedOrder;
  const isAr = i18n.getLanguage() === "ar";
  const titleEl = document.getElementById("insp-order-title");
  const statusEl = document.getElementById("insp-order-status");
  const metaEl = document.getElementById("insp-order-meta");
  const custNameEl = document.getElementById("insp-order-customer");
  const custPhoneEl = document.getElementById("insp-order-phone");
  const itemsEl = document.getElementById("insp-order-items");
  const noteEl = document.getElementById("insp-order-note");
  const totalEl = document.getElementById("insp-order-total");
  const advanceBtn = document.getElementById("insp-order-advance-btn");

  if (!ord) return;

  if (titleEl) {
    titleEl.textContent = isAr
      ? `طلب #${ord.orderReference}`
      : `Order #${ord.orderReference}`;
  }
  if (statusEl) {
    statusEl.className = `status-badge status-badge--${ord.uiStatus.toLowerCase()}`;
    statusEl.textContent = localizeStatus(ord.uiStatus);
  }
  if (metaEl) {
    const modeLabel = localizeStatus(
      ord.fulfillmentType === "delivery" ? "Delivery" : "Pickup"
    );
    const ageText =
      isAr && typeof ord.minutesAgo === "number"
        ? ord.minutesAgo <= 0
          ? "الآن"
          : `منذ ${formatLocaleNumber(ord.minutesAgo)} د`
        : ord.ageLabel;
    metaEl.textContent = `${modeLabel} · ${ageText}`;
  }
  if (custNameEl) custNameEl.textContent = ord.customerName;
  if (custPhoneEl) {
    const payLabel =
      isAr && String(ord.paymentMethod || "").toLowerCase().includes("cash")
        ? "نقداً عند الاستلام"
        : ord.paymentMethod;
    custPhoneEl.textContent = `${ord.customerPhone} · ${payLabel}`;
  }

  if (itemsEl) {
    itemsEl.replaceChildren();
    (ord.items || []).forEach((it) => {
      const locProd = localizeProduct({ id: it.productId, name: it.name });
      const displayName = locProd?.name || it.name;
      const displayMeta = localizeCustomizationSummary(it.customizationSummary);

      const row = document.createElement("div");
      row.className = "receipt-item";
      const top = document.createElement("div");
      top.className = "receipt-item__row";
      const n = document.createElement("span");
      n.textContent = `${formatLocaleNumber(it.quantity)} × ${displayName}`;
      const p = document.createElement("strong");
      p.textContent = formatPrice(it.lineTotalEgp);
      top.appendChild(n);
      top.appendChild(p);
      row.appendChild(top);

      if (displayMeta) {
        const m = document.createElement("p");
        m.className = "receipt-item__meta";
        m.textContent = displayMeta;
        row.appendChild(m);
      }
      itemsEl.appendChild(row);
    });
  }

  if (noteEl) {
    noteEl.hidden = !ord.specialInstructions;
    noteEl.textContent = ord.specialInstructions
      ? isAr
        ? `ملاحظة: ${ord.specialInstructions}`
        : `NOTE: ${ord.specialInstructions}`
      : "";
  }

  if (totalEl) totalEl.textContent = formatPrice(ord.totalEgp);

  if (advanceBtn) {
    const nextActionMap = {
      Pending: {
        label: isAr ? "قبول وبدء التحضير" : "Accept & start preparing",
        target: "Preparing",
      },
      Accepted: {
        label: isAr ? "بدء التحضير" : "Start preparing",
        target: "Preparing",
      },
      Preparing: {
        label: isAr ? "تحديد كجاهز للاستلام" : "Mark ready for pickup",
        target: "Ready",
      },
      Ready: {
        label: isAr ? "تحديد كمكتمل" : "Mark as completed",
        target: "Completed",
      },
    };
    const next = nextActionMap[ord.status];
    if (next) {
      advanceBtn.hidden = false;
      advanceBtn.textContent = next.label;
      advanceBtn.dataset.targetStatus = next.target;
    } else {
      advanceBtn.hidden = true;
    }
  }
}

// =============================================================================
// 3. MENU & INVENTORY CRUD (10 · Menu management)
// =============================================================================
function renderMenuInventorySection() {
  const tbody = document.getElementById("admin-products-tbody");
  if (!tbody) return;

  const totalKpi = document.getElementById("menu-kpi-total");
  const availKpi = document.getElementById("menu-kpi-available");
  const lowKpi = document.getElementById("menu-kpi-low");
  const soldOutKpi = document.getElementById("menu-kpi-soldout");

  const totalCount = state.products.length;
  const availCount = state.products.filter((p) => p.available).length;
  const lowCount = state.products.filter((p) => p.stockStatus === "Low stock").length;
  const soldCount = state.products.filter((p) => !p.available || p.stockStatus === "Sold out").length;

  if (totalKpi) totalKpi.textContent = String(totalCount);
  if (availKpi) availKpi.textContent = String(availCount);
  if (lowKpi) lowKpi.textContent = String(lowCount);
  if (soldOutKpi) soldOutKpi.textContent = String(soldCount);

  // Populate category select in toolbar & editor
  const catFilter = document.getElementById("admin-product-cat-filter");
  const editCatSelect = document.getElementById("edit-prod-category");
  if (catFilter && catFilter.options.length <= 1 && state.categories.length > 0) {
    state.categories.forEach((c) => {
      const opt = document.createElement("option");
      opt.value = c.slug;
      opt.textContent = c.name;
      catFilter.appendChild(opt);
    });
  }
  if (editCatSelect && editCatSelect.options.length === 0 && state.categories.length > 0) {
    state.categories.forEach((c) => {
      const opt = document.createElement("option");
      opt.value = c.slug;
      opt.textContent = c.name;
      editCatSelect.appendChild(opt);
    });
  }

  const filtered = state.products.filter((p) => {
    const matchesCat =
      state.productCategoryFilter === "all" ||
      p.categoryId === state.productCategoryFilter;
    const q = state.productSearch.trim().toLowerCase();
    const matchesSearch =
      !q ||
      p.name.toLowerCase().includes(q) ||
      (p.sku && p.sku.toLowerCase().includes(q));
    return matchesCat && matchesSearch;
  });

  if (!state.selectedProduct && !state.isCreatingProduct && filtered.length > 0) {
    state.selectedProduct = filtered[0];
  }

  const isAr = i18n.getLanguage() === "ar";
  tbody.replaceChildren();
  filtered.forEach((rawProd) => {
    const prod = localizeProduct(rawProd);
    const tr = document.createElement("tr");
    tr.dataset.selectProductSlug = prod.slug;
    if (
      !state.isCreatingProduct &&
      state.selectedProduct &&
      state.selectedProduct.slug === prod.slug
    ) {
      tr.classList.add("is-selected");
    }

    const tdProd = document.createElement("td");
    const cell = document.createElement("div");
    cell.className = "admin-table__prod-cell";
    const img = document.createElement("img");
    img.className = "admin-table__thumb";
    img.src = prod.image;
    img.alt = prod.name;
    const textWrap = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = prod.name;
    const sku = document.createElement("span");
    sku.className = "admin-table__sku ltr-inline";
    sku.textContent = prod.sku;
    textWrap.appendChild(title);
    textWrap.appendChild(sku);
    cell.appendChild(img);
    cell.appendChild(textWrap);
    tdProd.appendChild(cell);

    const tdCat = document.createElement("td");
    tdCat.textContent = prod.categoryName || prod.categoryId;

    const tdPrice = document.createElement("td");
    const priceStrong = document.createElement("strong");
    priceStrong.textContent = formatPrice(prod.priceEgp);
    tdPrice.appendChild(priceStrong);

    const tdStatus = document.createElement("td");
    const badge = document.createElement("span");
    const badgeStyle =
      rawProd.stockStatus === "Sold out"
        ? "status-badge--cancelled"
        : rawProd.stockStatus === "Low stock"
        ? "status-badge--preparing"
        : "status-badge--new";
    badge.className = `status-badge ${badgeStyle}`;
    badge.textContent = localizeStatus(rawProd.stockStatus);
    tdStatus.appendChild(badge);

    const tdStock = document.createElement("td");
    tdStock.textContent = prod.isStockTracked
      ? isAr
        ? `${formatLocaleNumber(prod.stockQuantity)} متبقي`
        : `${prod.stockQuantity} left`
      : "—";

    tr.appendChild(tdProd);
    tr.appendChild(tdCat);
    tr.appendChild(tdPrice);
    tr.appendChild(tdStatus);
    tr.appendChild(tdStock);
    tbody.appendChild(tr);
  });

  populateProductEditorForm();
}

function populateProductEditorForm() {
  const heading = document.getElementById("prod-editor-heading");
  const imgPreview = document.getElementById("edit-prod-preview");
  const nameInput = document.getElementById("edit-prod-name");
  const catSelect = document.getElementById("edit-prod-category");
  const priceInput = document.getElementById("edit-prod-price");
  const stockInput = document.getElementById("edit-prod-stock");
  const availSelect = document.getElementById("edit-prod-availability");
  const descInput = document.getElementById("edit-prod-desc");
  const allergenInput = document.getElementById("edit-prod-allergens");
  const deleteBtn = document.getElementById("edit-prod-delete-btn");

  if (state.isCreatingProduct) {
    if (heading) heading.textContent = "Add new product";
    if (imgPreview) imgPreview.src = "assets/images/product-flat-white.png";
    if (nameInput) nameInput.value = "";
    if (catSelect) catSelect.value = "coffee";
    if (priceInput) priceInput.value = "95";
    if (stockInput) stockInput.value = "25";
    if (availSelect) availSelect.value = "true";
    if (descInput) descInput.value = "";
    if (allergenInput) allergenInput.value = "Contains dairy.";
    if (deleteBtn) deleteBtn.hidden = true;
    return;
  }

  const p = state.selectedProduct;
  if (!p) return;

  if (heading) heading.textContent = "Edit product";
  if (imgPreview) imgPreview.src = p.image;
  if (nameInput) nameInput.value = p.name;
  if (catSelect) catSelect.value = p.categoryId;
  if (priceInput) priceInput.value = String(p.priceEgp);
  if (stockInput) stockInput.value = String(p.stockQuantity ?? 25);
  if (availSelect) availSelect.value = p.available ? "true" : "false";
  if (descInput) descInput.value = p.shortDescription || "";
  if (allergenInput) allergenInput.value = p.allergenNote || "";
  if (deleteBtn) deleteBtn.hidden = false;
}

// =============================================================================
// 4. CUSTOMERS & LOYALTY (19 · Customers & loyalty)
// =============================================================================
function renderCustomersSection() {
  const tbody = document.getElementById("admin-customers-tbody");
  if (!tbody) return;

  if (!state.selectedCustomer && state.customers.length > 0) {
    state.selectedCustomer = state.customers[0];
  }

  tbody.replaceChildren();
  state.customers.forEach((c) => {
    const tr = document.createElement("tr");
    tr.dataset.selectCustomerId = String(c.id);
    if (state.selectedCustomer && state.selectedCustomer.id === c.id) {
      tr.classList.add("is-selected");
    }

    const tdName = document.createElement("td");
    const nameStrong = document.createElement("strong");
    nameStrong.textContent = c.fullName;
    const emailSpan = document.createElement("span");
    emailSpan.className = "admin-table__sku";
    emailSpan.textContent = c.email || "";
    tdName.appendChild(nameStrong);
    tdName.appendChild(emailSpan);

    const tdOrders = document.createElement("td");
    tdOrders.textContent = String(c.ordersCount);

    const tdSpent = document.createElement("td");
    const spentStrong = document.createElement("strong");
    spentStrong.textContent = formatPrice(c.totalSpentEgp);
    tdSpent.appendChild(spentStrong);

    const tdVisit = document.createElement("td");
    tdVisit.textContent = c.lastVisit || "Today";

    const tdPoints = document.createElement("td");
    const ptsStrong = document.createElement("strong");
    ptsStrong.textContent = String(c.loyaltyPoints);
    tdPoints.appendChild(ptsStrong);

    tr.appendChild(tdName);
    tr.appendChild(tdOrders);
    tr.appendChild(tdSpent);
    tr.appendChild(tdVisit);
    tr.appendChild(tdPoints);
    tbody.appendChild(tr);
  });

  const sc = state.selectedCustomer;
  if (sc) {
    const nameEl = document.getElementById("insp-cust-name");
    const ptsEl = document.getElementById("insp-cust-points");
    const ordersEl = document.getElementById("insp-cust-orders");
    const spentEl = document.getElementById("insp-cust-spent");
    const contactEl = document.getElementById("insp-cust-contact");
    const usualEl = document.getElementById("insp-cust-usual");
    const ptsInput = document.getElementById("insp-cust-points-input");

    if (nameEl) nameEl.textContent = sc.fullName;
    if (ptsEl) ptsEl.textContent = `${sc.loyaltyPoints} points`;
    if (ordersEl) ordersEl.textContent = `${sc.ordersCount} orders`;
    if (spentEl) spentEl.textContent = `${formatPrice(sc.totalSpentEgp)} spent`;
    if (contactEl) contactEl.textContent = `${sc.email || ""} · ${sc.phone}`;
    if (usualEl)
      usualEl.textContent = `Usual: ${sc.usualDrink} · Pairing: ${sc.favoritePairing}`;
    if (ptsInput) ptsInput.value = String(sc.loyaltyPoints);
  }
}

// =============================================================================
// 5. DISCOUNTS & PROMO CODES (20 · Discounts)
// =============================================================================
function renderDiscountsSection() {
  const tbody = document.getElementById("admin-coupons-tbody");
  if (!tbody) return;

  if (!state.selectedCoupon && !state.isCreatingCoupon && state.coupons.length > 0) {
    state.selectedCoupon = state.coupons[0];
  }

  tbody.replaceChildren();
  state.coupons.forEach((c) => {
    const tr = document.createElement("tr");
    tr.dataset.selectCouponId = String(c.id);
    if (
      !state.isCreatingCoupon &&
      state.selectedCoupon &&
      state.selectedCoupon.id === c.id
    ) {
      tr.classList.add("is-selected");
    }

    const tdCode = document.createElement("td");
    const codeStrong = document.createElement("strong");
    codeStrong.textContent = c.code;
    const descSpan = document.createElement("span");
    descSpan.className = "admin-table__sku";
    descSpan.textContent = c.description;
    tdCode.appendChild(codeStrong);
    tdCode.appendChild(descSpan);

    const tdStatus = document.createElement("td");
    const pill = document.createElement("span");
    const cls =
      c.status === "Active"
        ? "status-badge--new"
        : c.status === "Scheduled"
        ? "status-badge--preparing"
        : "status-badge--refunded";
    pill.className = `status-badge ${cls}`;
    pill.textContent = c.status;
    tdStatus.appendChild(pill);

    const tdUses = document.createElement("td");
    tdUses.textContent = `${c.usedCount} / ${c.usageLimit}`;

    const tdEnds = document.createElement("td");
    tdEnds.textContent = c.endsAt;

    tr.appendChild(tdCode);
    tr.appendChild(tdStatus);
    tr.appendChild(tdUses);
    tr.appendChild(tdEnds);
    tbody.appendChild(tr);
  });

  const sc = state.selectedCoupon;
  const codeInput = document.getElementById("edit-coupon-code");
  const descInput = document.getElementById("edit-coupon-desc");
  const typeSelect = document.getElementById("edit-coupon-type");
  const valInput = document.getElementById("edit-coupon-value");
  const minInput = document.getElementById("edit-coupon-min");
  const statusSelect = document.getElementById("edit-coupon-status");

  if (state.isCreatingCoupon) {
    if (codeInput) codeInput.value = "";
    if (descInput) descInput.value = "";
    if (typeSelect) typeSelect.value = "percentage";
    if (valInput) valInput.value = "10";
    if (minInput) minInput.value = "100";
    if (statusSelect) statusSelect.value = "Active";
  } else if (sc) {
    if (codeInput) codeInput.value = sc.code;
    if (descInput) descInput.value = sc.description;
    if (typeSelect) typeSelect.value = sc.discountType;
    if (valInput) valInput.value = String(sc.discountValue);
    if (minInput) minInput.value = String(sc.minOrderEgp);
    if (statusSelect) statusSelect.value = sc.status;
  }
}

// =============================================================================
// 6. SETTINGS & STAFF (11 · Store settings)
// =============================================================================
function renderSettingsSection() {
  const s = state.settings;
  if (s) {
    const prepInput = document.getElementById("set-prep-minutes");
    const bufferInput = document.getElementById("set-buffer-minutes");
    const maxInput = document.getElementById("set-max-orders");
    const feeInput = document.getElementById("set-delivery-fee");
    const minOrderInput = document.getElementById("set-min-order");
    const pauseBtn = document.getElementById("settings-pause-orders-btn");
    const storeTopPill = document.getElementById("admin-topbar-store-status");

    if (prepInput) prepInput.value = String(s.standardPrepMinutes);
    if (bufferInput) bufferInput.value = String(s.pickupBufferMinutes);
    if (maxInput) maxInput.value = String(s.maxActiveOrders);
    if (feeInput) feeInput.value = String(s.deliveryFeeEgp);
    if (minOrderInput) minOrderInput.value = String(s.deliveryMinOrderEgp);

    if (pauseBtn) {
      pauseBtn.textContent = s.isAcceptingOrders
        ? "Pause online ordering"
        : "Resume online ordering";
    }
    if (storeTopPill) {
      storeTopPill.textContent = s.isAcceptingOrders
        ? "●  Store open"
        : "●  Orders paused";
    }
  }

  const staffTbody = document.getElementById("admin-staff-tbody");
  if (staffTbody && Array.isArray(state.staff)) {
    staffTbody.replaceChildren();
    state.staff.forEach((st) => {
      const tr = document.createElement("tr");

      const tdName = document.createElement("td");
      const nameStrong = document.createElement("strong");
      nameStrong.textContent = st.fullName;
      const emailSpan = document.createElement("span");
      emailSpan.className = "admin-table__sku";
      emailSpan.textContent = st.email;
      tdName.appendChild(nameStrong);
      tdName.appendChild(emailSpan);

      const tdRole = document.createElement("td");
      tdRole.textContent = `${st.title} (${st.role})`;

      const tdStation = document.createElement("td");
      tdStation.textContent = st.station;

      const tdShift = document.createElement("td");
      tdShift.textContent = st.shiftLabel;

      const tdStatus = document.createElement("td");
      const statusBadge = document.createElement("span");
      statusBadge.className = "status-badge status-badge--new";
      statusBadge.textContent = st.isOnShift ? "On shift" : "Off shift";
      tdStatus.appendChild(statusBadge);

      tr.appendChild(tdName);
      tr.appendChild(tdRole);
      tr.appendChild(tdStation);
      tr.appendChild(tdShift);
      tr.appendChild(tdStatus);
      staffTbody.appendChild(tr);
    });
  }
}

async function loadAllAdminData() {
  const storedToken = storageService.get(STORAGE_KEYS.AUTH_TOKEN);
  const storedUser = storageService.get(STORAGE_KEYS.AUTH_USER);
  if (!storedToken || !storedUser || storedUser.role !== "admin") {
    const authOverlay = document.getElementById("admin-auth-overlay");
    if (authOverlay) authOverlay.hidden = false;
    return;
  }

  try {
    const [
      overview,
      orders,
      products,
      categories,
      customers,
      coupons,
      analytics,
      settings,
      staff,
    ] = await Promise.all([
      apiRequest("/api/admin/overview"),
      apiRequest("/api/admin/orders"),
      apiRequest("/api/products"),
      apiRequest("/api/categories"),
      apiRequest("/api/admin/customers"),
      apiRequest("/api/admin/coupons"),
      apiRequest("/api/admin/analytics"),
      apiRequest("/api/admin/settings"),
      apiRequest("/api/admin/staff"),
    ]);

    state.overview = overview;
    state.orders = orders || [];
    state.products = products || [];
    state.categories = categories || [];
    state.customers = customers || [];
    state.coupons = coupons || [];
    state.analytics = analytics || null;
    state.settings = settings;
    state.staff = staff || [];

    renderOverview();
    renderOrdersSection();
    renderMenuInventorySection();
    renderCustomersSection();
    renderDiscountsSection();
    renderSettingsSection();
    translatePageDOM();

    const authOverlay = document.getElementById("admin-auth-overlay");
    if (authOverlay) authOverlay.hidden = true;
  } catch (err) {
    if (err.status === 401 || err.status === 403) {
      const authOverlay = document.getElementById("admin-auth-overlay");
      if (authOverlay) authOverlay.hidden = false;
    }
  }
}

function initAdminPage() {
  i18n.init();
  i18n.subscribe(() => {
    renderOverview();
    renderOrdersSection();
    renderMenuInventorySection();
    renderCustomersSection();
    renderDiscountsSection();
    renderSettingsSection();
    translatePageDOM();
    translatePageDOM();
  });

  // Check URL hash (#orders, #menu, #customers, #discounts, #analytics, #settings)
  const initialHash = window.location.hash.replace(/^#/, "");
  if (
    ["overview", "orders", "menu", "customers", "discounts", "analytics", "settings"].includes(
      initialHash
    )
  ) {
    switchSection(initialHash);
  }

  // Sidebar navigation
  document.querySelectorAll("[data-admin-nav]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = btn.dataset.adminNav;
      window.location.hash = target;
      switchSection(target);
    });
  });

  // Admin Login Form
  const loginForm = document.getElementById("admin-login-form");
  const emailInput = document.getElementById("admin-login-email");
  const passInput = document.getElementById("admin-login-password");
  const loginErr = document.getElementById("admin-login-error");

  const quickFillBtn = document.getElementById("admin-quick-fill-btn");
  if (quickFillBtn) {
    quickFillBtn.addEventListener("click", () => {
      emailInput.value = "sam.rivera@commonground.coffee";
      passInput.value = "CommonGroundAdmin2026!";
    });
  }

  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (loginErr) loginErr.textContent = "";
      try {
        const res = await apiRequest("/api/auth/login", {
          method: "POST",
          body: {
            email: emailInput.value,
            password: passInput.value,
          },
        });
        if (res.user.role !== "admin") {
          if (loginErr)
            loginErr.textContent =
              "Manager (admin) role required for Store Management. Use Sam Rivera's account.";
          return;
        }
        storageService.set(STORAGE_KEYS.AUTH_TOKEN, res.token);
        storageService.set(STORAGE_KEYS.AUTH_USER, res.user);
        await loadAllAdminData();
      } catch (err) {
        if (loginErr) loginErr.textContent = err.message;
      }
    });
  }

  // Orders Section Events
  const ordersTbody = document.getElementById("admin-orders-tbody");
  if (ordersTbody) {
    ordersTbody.addEventListener("click", (e) => {
      const tr = e.target.closest("[data-select-order-ref]");
      if (!tr) return;
      const ref = tr.dataset.selectOrderRef;
      state.selectedOrder =
        state.orders.find((o) => o.orderReference === ref) || null;
      renderOrdersSection();
    });
  }

  document.querySelectorAll("[data-order-tab]").forEach((tab) => {
    tab.addEventListener("click", () => {
      state.orderFilterStatus = tab.dataset.orderTab;
      document
        .querySelectorAll("[data-order-tab]")
        .forEach((t) => t.classList.toggle("is-active", t === tab));
      renderOrdersSection();
    });
  });

  const orderSearchInput = document.getElementById("admin-order-search");
  if (orderSearchInput) {
    orderSearchInput.addEventListener("input", (e) => {
      state.orderSearch = e.target.value;
      renderOrdersSection();
    });
  }

  const advanceOrderBtn = document.getElementById("insp-order-advance-btn");
  if (advanceOrderBtn) {
    advanceOrderBtn.addEventListener("click", async () => {
      if (!state.selectedOrder) return;
      const targetStatus = advanceOrderBtn.dataset.targetStatus;
      try {
        const updated = await apiRequest(
          `/api/admin/orders/${encodeURIComponent(
            state.selectedOrder.orderReference
          )}/status`,
          {
            method: "PATCH",
            body: { status: targetStatus },
          }
        );
        state.selectedOrder = updated;
        showToast(
          `Order #${updated.orderReference} updated to ${updated.uiStatus}`
        );
        await loadAllAdminData();
      } catch (err) {
        showToast(err.message);
      }
    });
  }

  const cancelOrderBtn = document.getElementById("insp-order-cancel-btn");
  if (cancelOrderBtn) {
    cancelOrderBtn.addEventListener("click", async () => {
      if (!state.selectedOrder) return;
      try {
        const updated = await apiRequest(
          `/api/admin/orders/${encodeURIComponent(
            state.selectedOrder.orderReference
          )}/status`,
          {
            method: "PATCH",
            body: { status: "Cancelled", paymentStatus: "Refunded" },
          }
        );
        state.selectedOrder = updated;
        showToast(`Order #${updated.orderReference} cancelled and refunded`);
        await loadAllAdminData();
      } catch (err) {
        showToast(err.message);
      }
    });
  }

  // Menu & Inventory Events
  const prodTbody = document.getElementById("admin-products-tbody");
  if (prodTbody) {
    prodTbody.addEventListener("click", (e) => {
      const tr = e.target.closest("[data-select-product-slug]");
      if (!tr) return;
      state.isCreatingProduct = false;
      state.selectedProduct =
        state.products.find((p) => p.slug === tr.dataset.selectProductSlug) || null;
      renderMenuInventorySection();
    });
  }

  const addProdBtn = document.getElementById("admin-add-product-btn");
  if (addProdBtn) {
    addProdBtn.addEventListener("click", () => {
      state.isCreatingProduct = true;
      state.selectedProduct = null;
      renderMenuInventorySection();
      document.getElementById("edit-prod-name")?.focus();
    });
  }

  const prodSearchInput = document.getElementById("admin-product-search");
  if (prodSearchInput) {
    prodSearchInput.addEventListener("input", (e) => {
      state.productSearch = e.target.value;
      renderMenuInventorySection();
    });
  }

  const prodCatFilter = document.getElementById("admin-product-cat-filter");
  if (prodCatFilter) {
    prodCatFilter.addEventListener("change", (e) => {
      state.productCategoryFilter = e.target.value;
      renderMenuInventorySection();
    });
  }

  const prodForm = document.getElementById("admin-product-editor-form");
  if (prodForm) {
    prodForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const payload = {
        name: document.getElementById("edit-prod-name")?.value,
        categoryId: document.getElementById("edit-prod-category")?.value,
        priceEgp: Number(document.getElementById("edit-prod-price")?.value || 0),
        stockQuantity: Number(document.getElementById("edit-prod-stock")?.value || 0),
        isAvailable:
          document.getElementById("edit-prod-availability")?.value === "true",
        shortDescription: document.getElementById("edit-prod-desc")?.value,
        allergenNote: document.getElementById("edit-prod-allergens")?.value,
        isStockTracked: true,
      };

      try {
        if (state.isCreatingProduct) {
          await apiRequest("/api/products", {
            method: "POST",
            body: payload,
          });
          showToast(`Created new product "${payload.name}"`);
          state.isCreatingProduct = false;
        } else if (state.selectedProduct) {
          await apiRequest(
            `/api/products/${encodeURIComponent(state.selectedProduct.slug)}`,
            {
              method: "PATCH",
              body: payload,
            }
          );
          showToast(`Saved changes to "${payload.name}"`);
        }
        await loadAllAdminData();
      } catch (err) {
        showToast(`Save error: ${err.message}`);
      }
    });
  }

  const deleteProdBtn = document.getElementById("edit-prod-delete-btn");
  if (deleteProdBtn) {
    deleteProdBtn.addEventListener("click", async () => {
      if (!state.selectedProduct) return;
      try {
        await apiRequest(
          `/api/products/${encodeURIComponent(state.selectedProduct.slug)}`,
          { method: "DELETE" }
        );
        showToast(`Removed "${state.selectedProduct.name}" from catalog`);
        state.selectedProduct = null;
        await loadAllAdminData();
      } catch (err) {
        showToast(`Delete error: ${err.message}`);
      }
    });
  }

  // Category Quick-Add
  const addCategoryBtn = document.getElementById("admin-add-category-btn");
  if (addCategoryBtn) {
    addCategoryBtn.addEventListener("click", async () => {
      const catNameInput = document.getElementById("new-category-name-input");
      if (!catNameInput) return;
      if (catNameInput.hidden) {
        catNameInput.hidden = false;
        catNameInput.focus();
        return;
      }
      const name = catNameInput.value.trim();
      if (!name) return;
      try {
        await apiRequest("/api/categories", {
          method: "POST",
          body: { name },
        });
        catNameInput.value = "";
        catNameInput.hidden = true;
        showToast(`Category "${name}" created`);
        await loadAllAdminData();
      } catch (err) {
        showToast(err.message);
      }
    });
  }

  // Customers Inspector Events
  const custTbody = document.getElementById("admin-customers-tbody");
  if (custTbody) {
    custTbody.addEventListener("click", (e) => {
      const tr = e.target.closest("[data-select-customer-id]");
      if (!tr) return;
      const id = Number(tr.dataset.selectCustomerId);
      state.selectedCustomer = state.customers.find((c) => c.id === id) || null;
      renderCustomersSection();
    });
  }

  const savePointsBtn = document.getElementById("insp-cust-save-points-btn");
  if (savePointsBtn) {
    savePointsBtn.addEventListener("click", async () => {
      if (!state.selectedCustomer) return;
      const pts = Number(
        document.getElementById("insp-cust-points-input")?.value || 0
      );
      try {
        await apiRequest(
          `/api/admin/customers/${state.selectedCustomer.id}/points`,
          {
            method: "PATCH",
            body: { loyaltyPoints: pts },
          }
        );
        showToast(`Updated ${state.selectedCustomer.fullName}'s balance to ${pts} points`);
        await loadAllAdminData();
      } catch (err) {
        showToast(err.message);
      }
    });
  }

  // Discounts Events
  const couponsTbody = document.getElementById("admin-coupons-tbody");
  if (couponsTbody) {
    couponsTbody.addEventListener("click", (e) => {
      const tr = e.target.closest("[data-select-coupon-id]");
      if (!tr) return;
      state.isCreatingCoupon = false;
      const id = Number(tr.dataset.selectCouponId);
      state.selectedCoupon = state.coupons.find((c) => c.id === id) || null;
      renderDiscountsSection();
    });
  }

  const createCouponBtn = document.getElementById("admin-create-coupon-btn");
  if (createCouponBtn) {
    createCouponBtn.addEventListener("click", () => {
      state.isCreatingCoupon = true;
      state.selectedCoupon = null;
      renderDiscountsSection();
      document.getElementById("edit-coupon-code")?.focus();
    });
  }

  const couponForm = document.getElementById("admin-coupon-editor-form");
  if (couponForm) {
    couponForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const payload = {
        code: document.getElementById("edit-coupon-code")?.value,
        description: document.getElementById("edit-coupon-desc")?.value,
        discountType: document.getElementById("edit-coupon-type")?.value,
        discountValue: Number(document.getElementById("edit-coupon-value")?.value || 10),
        minOrderEgp: Number(document.getElementById("edit-coupon-min")?.value || 0),
        status: document.getElementById("edit-coupon-status")?.value,
      };
      try {
        if (state.isCreatingCoupon) {
          await apiRequest("/api/admin/coupons", {
            method: "POST",
            body: payload,
          });
          showToast(`Created discount code ${payload.code}`);
          state.isCreatingCoupon = false;
        } else if (state.selectedCoupon) {
          await apiRequest(`/api/admin/coupons/${state.selectedCoupon.id}`, {
            method: "PATCH",
            body: payload,
          });
          showToast(`Updated discount code ${payload.code}`);
        }
        await loadAllAdminData();
      } catch (err) {
        showToast(err.message);
      }
    });
  }

  // Store Settings Save
  const saveSettingsBtn = document.getElementById("admin-save-settings-btn");
  if (saveSettingsBtn) {
    saveSettingsBtn.addEventListener("click", async () => {
      const payload = {
        standardPrepMinutes: Number(
          document.getElementById("set-prep-minutes")?.value || 10
        ),
        pickupBufferMinutes: Number(
          document.getElementById("set-buffer-minutes")?.value || 5
        ),
        maxActiveOrders: Number(
          document.getElementById("set-max-orders")?.value || 12
        ),
        deliveryFeeEgp: Number(
          document.getElementById("set-delivery-fee")?.value || 25
        ),
        deliveryMinOrderEgp: Number(
          document.getElementById("set-min-order")?.value || 100
        ),
      };
      try {
        await apiRequest("/api/admin/settings", {
          method: "PATCH",
          body: payload,
        });
        showToast("✓ Store settings saved across storefront and barista workspace");
        await loadAllAdminData();
      } catch (err) {
        showToast(err.message);
      }
    });
  }

  const pauseSettingsBtn = document.getElementById("settings-pause-orders-btn");
  if (pauseSettingsBtn) {
    pauseSettingsBtn.addEventListener("click", async () => {
      if (!state.settings) return;
      try {
        await apiRequest("/api/admin/settings", {
          method: "PATCH",
          body: { isAcceptingOrders: !state.settings.isAcceptingOrders },
        });
        await loadAllAdminData();
        showToast(
          state.settings.isAcceptingOrders
            ? "Online ordering resumed"
            : "Online ordering paused"
        );
      } catch (err) {
        showToast(err.message);
      }
    });
  }

  // Real-time Socket.IO subscription
  if (typeof window.io === "function") {
    const socket = window.io();
    socket.on("order:created", () => loadAllAdminData());
    socket.on("order:updated", () => loadAllAdminData());
    socket.on("product:updated", () => loadAllAdminData());
  }

  loadAllAdminData();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initAdminPage);
} else {
  initAdminPage();
}
