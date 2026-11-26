/**
 * COMMON GROUND — Telegram Bot API Notification Service (Stage 12G & BUG-009 Hardened)
 *
 * Sends an asynchronous notification to the café's Telegram chat whenever a new
 * order is committed to PostgreSQL.
 *
 * IMPORTANT:
 * - Reads `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` strictly from environment variables.
 * - Escapes Markdown special characters (`_`, `*`, `` ` ``, `[`) in user-supplied fields.
 * - Deduplicates notifications by `orderReference` so retries never spam the barista channel.
 * - Fails gracefully: a missing token or network timeout logs a warning and NEVER
 *   invalidates a committed order.
 */

const notifiedOrders = new Set();

/**
 * Escapes legacy Telegram Markdown special characters in untrusted user input.
 * @param {string} text
 * @returns {string}
 */
function escapeTelegramMarkdown(text) {
  if (text === null || text === undefined) return "";
  return String(text).replace(/([_*`\[])/g, "\\$1");
}

async function sendNewOrderTelegramAlert(order) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!botToken || !chatId) {
    return { sent: false, reason: "telegram_not_configured" };
  }

  const orderRef = String(order?.orderReference || order?.orderNumber || "");
  if (orderRef && notifiedOrders.has(orderRef)) {
    return { sent: false, reason: "duplicate_notification_prevented" };
  }

  const itemsLines = (order.items || [])
    .map(
      (item) =>
        `• ${item.quantity} × ${escapeTelegramMarkdown(item.name)}${
          item.customizationSummary
            ? ` (${escapeTelegramMarkdown(item.customizationSummary)})`
            : ""
        } — ${Number(item.lineTotalEgp).toFixed(0)} EGP`
    )
    .join("\n");

  const text = [
    `☕ *NEW ORDER #${escapeTelegramMarkdown(orderRef)}* — Common Ground`,
    `👤 *Customer:* ${escapeTelegramMarkdown(order.customerName)} (${escapeTelegramMarkdown(
      order.customerPhone
    )})`,
    `🚚 *Fulfillment:* ${escapeTelegramMarkdown(
      String(order.fulfillmentType || "pickup").toUpperCase()
    )}${
      order.deliveryAddress
        ? ` — ${escapeTelegramMarkdown(order.deliveryAddress)}`
        : ""
    }`,
    `💳 *Payment:* ${escapeTelegramMarkdown(order.paymentMethod)} (${escapeTelegramMarkdown(
      order.paymentStatus
    )})`,
    ``,
    `*Items:*`,
    itemsLines,
    order.specialInstructions
      ? `\n📝 *Note:* ${escapeTelegramMarkdown(order.specialInstructions)}`
      : "",
    ``,
    `💰 *Total:* ${Number(order.totalEgp).toFixed(2)} EGP`,
  ]
    .filter(Boolean)
    .join("\n");

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4500);

      const response = await fetch(
        `https://api.telegram.org/bot${botToken}/sendMessage`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text,
            parse_mode: "Markdown",
          }),
          signal: controller.signal,
        }
      );
      clearTimeout(timeout);

      if (response.ok) {
        if (orderRef) notifiedOrders.add(orderRef);
        return { sent: true, attempts: attempt };
      }

      if (response.status < 500 || attempt === 2) {
        console.warn(
          `[telegramService] Telegram API responded with HTTP ${response.status}`
        );
        return { sent: false, reason: `http_${response.status}` };
      }
    } catch (error) {
      if (attempt === 2) {
        console.warn("[telegramService] Non-blocking notification error:", error.message);
        return { sent: false, reason: error.message };
      }
    }
  }

  return { sent: false, reason: "unknown" };
}

module.exports = {
  sendNewOrderTelegramAlert,
  escapeTelegramMarkdown,
};
