/**
 * Уведомления через VK (сообщения в беседу)
 *
 * @module services/vk/notifications
 */

import type { Config } from '@/core/config/schema';
import type { Drama } from '@/core/drama/fetcher';

const VK_API_URL = 'https://api.vk.com/method/';
const DEFAULT_API_VERSION = '5.199';

let lastRandomId = 0;

/**
 * Генерирует уникальный random_id для предотвращения дубликатов
 *
 * Монотонный счётчик: если Date.now() не вырос, инкрементируем предыдущее
 * значение — гарантирует уникальность в рамках процесса.
 *
 * @returns Уникальный идентификатор
 */
function generateRandomId(): number {
  const now = Date.now();
  if (now > lastRandomId) {
    lastRandomId = now;
  } else {
    lastRandomId += 1;
  }
  return lastRandomId;
}

/**
 * Вызывает метод VK API
 *
 * @param method - Имя метода (например, messages.send)
 * @param accessToken - Токен сообщества
 * @param apiVersion - Версия API
 * @param params - Параметры метода
 * @returns Ответ метода (поле response)
 * @throws Ошибка при HTTP-сбое или ошибке API
 */
async function callVkApi(
  method: string,
  accessToken: string,
  apiVersion: string,
  params: Record<string, string> = {},
): Promise<unknown> {
  const body = new URLSearchParams({
    access_token: accessToken,
    v: apiVersion,
    ...params,
  });

  const response = await fetch(`${VK_API_URL}${method}`, {
    method: 'POST',
    body,
  });

  if (!response.ok) {
    throw new Error(`VK API HTTP ${response.status}`);
  }

  const json = (await response.json()) as {
    response?: unknown;
    error?: { error_code?: number; error_msg?: string };
  };

  if (json.error) {
    throw new Error(
      `VK API error ${json.error.error_code}: ${json.error.error_msg}`,
    );
  }

  return json.response;
}

/**
 * Скачивает постер и загружает его в VK
 *
 * @param accessToken - Токен сообщества
 * @param apiVersion - Версия API
 * @param peerId - ID беседы
 * @param posterUrl - URL постера
 * @returns Строка attachment (photo{owner_id}_{id}_{access_key}) или null при ошибке
 */
async function uploadPhotoToVk(
  accessToken: string,
  apiVersion: string,
  peerId: number,
  posterUrl: string,
  userAgent?: string,
): Promise<string | null> {
  try {
    const headers: Record<string, string> = {};
    if (userAgent) {
      headers['User-Agent'] = userAgent;
    }
    // без таймаута зависший CDN заблокировал бы весь цикл уведомлений
    const posterResponse = await fetch(posterUrl, {
      headers,
      signal: AbortSignal.timeout(15000),
    });
    if (!posterResponse.ok) {
      return null;
    }
    const blob = await posterResponse.blob();

    // VK периодически отклоняет валидные файлы (пустой photo) — повторяем несколько раз
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        const uploadServer = (await callVkApi(
          'photos.getMessagesUploadServer',
          accessToken,
          apiVersion,
          { peer_id: String(peerId) },
        )) as { upload_url: string };

        const form = new FormData();
        // Bun-овский Blob не совпадает с DOM-типом Blob из bun-types — нужен каст
        form.append('photo', blob as unknown as Blob, 'poster.jpg');
        const uploadResponse = await fetch(uploadServer.upload_url, {
          method: 'POST',
          body: form,
        });
        if (!uploadResponse.ok) {
          console.error(
            `Ошибка при загрузке фото в VK: HTTP ${uploadResponse.status}`,
          );
          continue;
        }
        const uploadJson = (await uploadResponse.json()) as {
          server: number;
          photo: string;
          hash: string;
        };
        if (!uploadJson.photo) {
          console.error(
            `VK не принял фото (пустой photo): ${JSON.stringify(uploadJson)}`,
          );
          continue;
        }

        const saved = (await callVkApi(
          'photos.saveMessagesPhoto',
          accessToken,
          apiVersion,
          {
            server: String(uploadJson.server),
            photo: uploadJson.photo,
            hash: uploadJson.hash,
          },
        )) as Array<{ owner_id: number; id: number; access_key: string }>;

        const photo = saved[0];
        if (!photo) {
          return null;
        }
        return `photo${photo.owner_id}_${photo.id}_${photo.access_key}`;
      } catch (error) {
        console.error('Ошибка при загрузке постера в VK:', error);
      }
    }
    return null;
  } catch (error) {
    console.error('Ошибка при загрузке постера в VK:', error);
    return null;
  }
}

/**
 * Собирает текст сообщения
 *
 * VK не рендерит `**bold**`/`[url|text]` в сообщениях сообществ — показывает
 * как есть, поэтому шлём обычный текст, а ссылку VK сам делает кликабельной.
 *
 * @param drama - Дорама
 * @param sourceName - Название источника
 * @returns Текст сообщения
 */
function buildMessage(drama: Drama, sourceName: string): string {
  let message = `${drama.title}\n${sourceName}`;
  if (drama.link) {
    message += `\n${drama.link}`;
  }
  return message;
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
  userAgent?: string,
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

  const ids = Array.isArray(peerIds) ? peerIds : [peerIds];

  for (const peerId of ids) {
    for (const [sourceName, dramas] of newDramasBySource.entries()) {
      for (const drama of dramas) {
        try {
          let attachment = '';
          if (drama.posterUrl) {
            attachment =
              (await uploadPhotoToVk(
                accessToken,
                apiVersion,
                peerId,
                drama.posterUrl,
                userAgent,
              )) ?? '';
          }

          const message = buildMessage(drama, sourceName);
          await callVkApi('messages.send', accessToken, apiVersion, {
            peer_id: String(peerId),
            message,
            random_id: String(generateRandomId()),
            ...(attachment ? { attachment } : {}),
          });

          console.log(
            `📤 Уведомление в VK успешно отправлено в беседу ${peerId}.`,
          );
        } catch (error) {
          console.error(
            `Ошибка при отправке уведомления в VK в беседу ${peerId}:`,
            error,
          );
        }
      }
    }
  }
}
