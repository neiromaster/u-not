/**
 * Уведомления через VK (сообщения в беседу)
 *
 * @module services/vk/notifications
 */

import type { Config } from '@/core/config/schema';
import type { Drama } from '@/core/drama/fetcher';

const VK_API_URL = 'https://api.vk.com/method/messages.send';
const DEFAULT_API_VERSION = '5.199';

/**
 * Генерирует уникальный random_id для предотвращения дубликатов
 *
 * @returns Уникальный идентификатор на основе текущего времени
 */
function generateRandomId(): number {
  return Date.now() + Math.floor(Math.random() * 1000);
}

/**
 * Отправляет уведомление в беседу VK
 *
 * @param vk - Конфигурация VK
 * @param newDramasBySource - Карта с новыми дорамами по источникам
 */
export async function sendVkNotification(
  vk: Config['vk'],
  newDramasBySource: Map<string, Drama[]>,
): Promise<void> {
  if (!vk) {
    console.log(
      '🔔 Конфигурация VK не найдена, уведомление не будет отправлено.',
    );
    return;
  }

  const { accessToken, peerId: peerIds, apiVersion = DEFAULT_API_VERSION } = vk;

  if (!accessToken || (Array.isArray(peerIds) && peerIds.length === 0)) {
    console.log(
      '🔔 Токен или ID беседы для VK не указаны, уведомление не будет отправлено.',
    );
    return;
  }

  let message = `✨ Найдены новые дорамы!\n\n`;

  for (const [sourceName, dramas] of newDramasBySource.entries()) {
    message += `**${sourceName}:**\n`;
    message += dramas.map((d) => `• ${d.title}`).join('\n');
    message += '\n\n';
  }

  const ids = Array.isArray(peerIds) ? peerIds : [peerIds];

  for (const peerId of ids) {
    try {
      const params = new URLSearchParams({
        access_token: accessToken,
        v: apiVersion,
        peer_id: String(peerId),
        message,
        random_id: String(generateRandomId()),
      });

      const response = await fetch(VK_API_URL, {
        method: 'POST',
        body: params,
      });

      if (!response.ok) {
        console.error(
          `Ошибка при отправке уведомления в VK в беседу ${peerId}: HTTP ${response.status}`,
        );
        continue;
      }

      const json = (await response.json()) as {
        error?: { error_code?: number; error_msg?: string };
      };

      if (json.error) {
        console.error(
          `Ошибка при отправке уведомления в VK в беседу ${peerId}: ${json.error.error_code} ${json.error.error_msg}`,
        );
        continue;
      }

      console.log(`📤 Уведомление в VK успешно отправлено в беседу ${peerId}.`);
    } catch (error) {
      console.error(
        `Ошибка при отправке уведомления в VK в беседу ${peerId}:`,
        error,
      );
    }
  }
}
