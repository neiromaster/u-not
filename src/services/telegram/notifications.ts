/**
 * Уведомления через Telegram
 *
 * @module services/telegram/notifications
 */

import { Bot } from 'grammy';
import type { Config } from '@/core/config/schema';

/**
 * Отправляет уведомление в Telegram
 *
 * @param telegram - Конфигурация Telegram
 * @param newDramasBySource - Карта с новыми дорамами по источникам
 */
export async function sendTelegramNotification(
  telegram: Config['telegram'],
  newDramasBySource: Map<string, string[]>,
): Promise<void> {
  if (!telegram) {
    console.log(
      '🔔 Конфигурация Telegram не найдена, уведомление не будет отправлено.',
    );
    return;
  }

  const { botToken, chatId: chatIds } = telegram;

  if (
    !botToken ||
    !chatIds ||
    (Array.isArray(chatIds) && chatIds.length === 0)
  ) {
    console.log(
      '🔔 Токен или ID чата для Telegram не указаны, уведомление не будет отправлено.',
    );
    return;
  }

  const bot = new Bot(botToken);
  let message = `<b>✨ Найдены новые дорамы!</b>\n\n`;

  for (const [sourceName, dramas] of newDramasBySource.entries()) {
    message += `<b>${sourceName}:</b>\n`;
    message += dramas.map((d) => `• ${d}`).join('\n');
    message += '\n\n';
  }

  const ids = Array.isArray(chatIds) ? chatIds : [chatIds];

  for (const chatId of ids) {
    try {
      await bot.api.sendMessage(chatId, message, { parse_mode: 'HTML' });
      console.log(
        `📤 Уведомление в Telegram успешно отправлено в чат ${chatId}.`,
      );
    } catch (error) {
      console.error(
        `❌ Ошибка при отправке уведомления в Telegram в чат ${chatId}:`,
        error,
      );
    }
  }
}
