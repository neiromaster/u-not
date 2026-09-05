/**
 * Уведомления через Telegram
 *
 * @module services/telegram/notifications
 */

import { Bot } from 'grammy';
import type { Config } from '@/core/config/schema';
import type { Drama } from '@/core/drama/fetcher';

/**
 * Экранирует HTML-спецсимволы для parse_mode: 'HTML'
 *
 * @param value - Строка для экранирования
 * @returns Экранированная строка
 */
function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

/**
 * Собирает caption для сообщения
 *
 * @param drama - Дорама
 * @param sourceName - Название источника
 * @returns HTML-подпись
 */
function buildCaption(drama: Drama, sourceName: string): string {
  let caption = `<b>${escapeHtml(drama.title)}</b>\n<i>${escapeHtml(sourceName)}</i>`;
  if (drama.link) {
    caption += `\n\n<a href="${escapeHtml(drama.link)}">Смотреть</a>`;
  }
  return caption;
}

/**
 * Отправляет уведомление в Telegram
 *
 * @param telegram - Конфигурация Telegram
 * @param newDramasBySource - Карта с новыми дорамами по источникам
 */
export async function sendTelegramNotification(
  telegram: Config['telegram'],
  newDramasBySource: Map<string, Drama[]>,
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
  const ids = Array.isArray(chatIds) ? chatIds : [chatIds];

  for (const chatId of ids) {
    for (const [sourceName, dramas] of newDramasBySource.entries()) {
      for (const drama of dramas) {
        const caption = buildCaption(drama, sourceName);
        const sendText = () =>
          bot.api.sendMessage(chatId, caption, { parse_mode: 'HTML' });
        try {
          if (drama.posterUrl) {
            try {
              await bot.api.sendPhoto(chatId, drama.posterUrl, {
                caption,
                parse_mode: 'HTML',
              });
            } catch (photoError) {
              // Если фото не отправилось (например, Telegram не смог загрузить
              // постер), отправляем текст без фото — не теряем уведомление.
              console.warn(
                `⚠️ Не удалось отправить фото в чат ${chatId}, отправляю текст:`,
                photoError,
              );
              await sendText();
            }
          } else {
            await sendText();
          }
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
  }
}
