/**
 * COMMON GROUND — Telegram Bot API Notification Service (Stage 12G)
 *
 * Sends an asynchronous notification to the café's Telegram chat whenever a new
 * order is committed to PostgreSQL.
 *
 * IMPORTANT:
 * - Reads `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` strictly from environment variables.
 * - Never exposes tokens to the client.
 * - Fails gracefully: a missing token or network timeout logs a warning and NEVER
 *   invalidates a committed order.
 */

async function sendNewOrderTelegramAlert(order) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!botToken || !chatId) {
    return { sent: false, reason: "telegram_not_configured" };
  }

  try {
    const itemsLines = (order.items || [])
      .map(
        (item) =>
          `• ${item.quantity} × ${item.name}${
            item.customizationSummary ? ` (${item.customizationSummary})` : ""
          } — ${Number(item.lineTotalEgp).toFixed(0)} EGP`
      )
      .join("\n");

    const text = [
      `☕ *NEW ORDER #${order.orderReference}* — Common Ground`,
      `👤 *Customer:* ${order.customerName} (${order.customerPhone})`,
      `🚚 *Fulfillment:* ${order.fulfillmentType.toUpperCase()}${
        order.deliveryAddress ? ` — ${order.deliveryAddress}` : ""
      }`,
      `💳 *Payment:* ${order.paymentMethod} (${order.paymentStatus})`,
      ``,
      `*Items:*`,
      itemsLines,
      order.specialInstructions ? `\n📝 *Note:* ${order.specialInstructions}` : "",
      ``,
      `💰 *Total:* ${Number(order.totalEgp).toFixed(2)} EGP`,
    ]
      .filter(Boolean)
      .join("\n");

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

    if (!response.ok) {
      console.warn(
        `[telegramService] Telegram API responded with HTTP ${response.status}`
      );
      return { sent: false, reason: `http_${response.status}` };
    }

    return { sent: true };
  } catch (error) {
    console.warn("[telegramService] Non-blocking notification error:", error.message);
    return { sent: false, reason: error.message };
  }
}

module.exports = {
  sendNewOrderTelegramAlert,
};
