/**
 * Уведомления через Telegram
 *
 * @module services/telegram/notifications
 */

import { Bot, InputFile } from 'grammy';
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
 * Скачивает постер в приложении: Telegram сам не может забрать картинку
 * с региональных CDN (ivi/viju/wink блокируют их серверы), поэтому файл
 * нужно отдать ему напрямую. Возвращает null, если скачать не удалось.
 *
 * @param posterUrl - URL постера
 * @param userAgent - Браузерный User-Agent из конфига (опционально)
 * @returns Байты постера или null
 */
async function downloadPoster(
  posterUrl: string,
  userAgent?: string,
): Promise<Uint8Array | null> {
  try {
    const headers: Record<string, string> = {};
    if (userAgent) {
      headers['User-Agent'] = userAgent;
    }
    // без таймаута зависший CDN заблокировал бы весь цикл уведомлений
    const response = await fetch(posterUrl, {
      headers,
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) {
      return null;
    }
    return await response.bytes();
  } catch {
    return null;
  }
}

/**
 * Основной путь — качает постер в приложении и выгружает файлом: Telegram
 * не достаёт региональные CDN (ivi/viju/wink). Если ни скачать, ни выгрузить
 * не вышло — пробует отдать URL'ом (вдруг сеть Telegram его достанет).
 *
 * @param bot - Инстанс бота
 * @param chatId - ID чата
 * @param drama - Дорама с posterUrl
 * @param caption - HTML-подпись
 * @param userAgent - User-Agent для скачивания постера (опционально)
 * @returns true, если фото отправлено
 */
async function sendPhotoWithFallback(
  bot: Bot,
  chatId: string | number,
  drama: Drama,
  caption: string,
  userAgent?: string,
): Promise<boolean> {
  const posterUrl = drama.posterUrl;
  if (!posterUrl) {
    return false;
  }
  const poster = await downloadPoster(posterUrl, userAgent);
  if (poster) {
    try {
      await bot.api.sendPhoto(chatId, new InputFile(poster, 'poster.jpg'), {
        caption,
        parse_mode: 'HTML',
      });
      return true;
    } catch {
      // файл не зашёл — пробуем отдать URL
    }
  }
  try {
    await bot.api.sendPhoto(chatId, posterUrl, {
      caption,
      parse_mode: 'HTML',
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Отправляет уведомление в Telegram
 *
 * @param telegram - Конфигурация Telegram
 * @param newDramasBySource - Карта с новыми дорамами по источникам
 * @param userAgent - User-Agent для скачивания постера (опционально)
 */
export async function sendTelegramNotification(
  telegram: Config['telegram'],
  newDramasBySource: Map<string, Drama[]>,
  userAgent?: string,
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
            const sent = await sendPhotoWithFallback(
              bot,
              chatId,
              drama,
              caption,
              userAgent,
            );
            if (!sent) {
              console.warn(
                `⚠️ Не удалось отправить фото в чат ${chatId}, отправляю текст.`,
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
