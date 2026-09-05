/**
 * Тесты загрузки дорам из источников
 *
 * @module tests/drama/fetcher
 */

import { afterEach, expect, test } from 'bun:test';
import type { Source } from '@/core/config/schema';
import { fetchAllSources, fetchDramasFromSource } from '@/core/drama/fetcher';

const source: Source = {
  name: 'Okko',
  url: 'https://example.com/api',
  type: 'api',
  jsonPath: 'result.*.title',
};

const originalFetch = globalThis.fetch;

const flaresolverr = {
  url: 'http://localhost:8190',
  api: 'secret-key',
};

afterEach(() => {
  globalThis.fetch = originalFetch;
});

test('извлекает названия, постеры и ссылки', async () => {
  globalThis.fetch = (() =>
    Promise.resolve(
      new Response(
        JSON.stringify({
          results: [
            {
              title: 'Дорама 1',
              assets: {
                productPoster: 'https://img.example.com/{SIZE}/poster1.jpg',
              },
              webUrl: '/watch/1',
            },
            {
              title: 'Дорама 2',
              assets: {
                productPoster: 'https://img.example.com/{SIZE}/poster2.jpg',
              },
              webUrl: '/watch/2',
            },
          ],
        }),
        { status: 200 },
      ),
    )) as unknown as typeof fetch;

  const richSource: Source = {
    ...source,
    jsonPath: 'results.*.title',
    posterJsonPath: 'results.*.assets.productPoster',
    linkJsonPath: 'results.*.webUrl',
    linkBaseUrl: 'https://amediateka.ru',
  };

  const result = await fetchDramasFromSource(richSource);
  expect(result.dramas).toEqual([
    {
      title: 'Дорама 1',
      posterUrl: 'https://img.example.com/400x600/poster1.jpg',
      link: 'https://amediateka.ru/watch/1',
    },
    {
      title: 'Дорама 2',
      posterUrl: 'https://img.example.com/400x600/poster2.jpg',
      link: 'https://amediateka.ru/watch/2',
    },
  ]);
});

test('не смещает постеры и ссылки, если у дорамы в середине их нет', async () => {
  globalThis.fetch = (() =>
    Promise.resolve(
      new Response(
        JSON.stringify({
          results: [
            {
              title: 'Дорама 1',
              assets: {
                productPoster: 'https://img.example.com/{SIZE}/poster1.jpg',
              },
              webUrl: '/watch/1',
            },
            { title: 'Дорама 2' },
            {
              title: 'Дорама 3',
              assets: {
                productPoster: 'https://img.example.com/{SIZE}/poster3.jpg',
              },
              webUrl: '/watch/3',
            },
          ],
        }),
        { status: 200 },
      ),
    )) as unknown as typeof fetch;

  const richSource: Source = {
    ...source,
    jsonPath: 'results.*.title',
    posterJsonPath: 'results.*.assets.productPoster',
    linkJsonPath: 'results.*.webUrl',
    linkBaseUrl: 'https://amediateka.ru',
  };

  const result = await fetchDramasFromSource(richSource);
  expect(result.dramas).toEqual([
    {
      title: 'Дорама 1',
      posterUrl: 'https://img.example.com/400x600/poster1.jpg',
      link: 'https://amediateka.ru/watch/1',
    },
    { title: 'Дорама 2' },
    {
      title: 'Дорама 3',
      posterUrl: 'https://img.example.com/400x600/poster3.jpg',
      link: 'https://amediateka.ru/watch/3',
    },
  ]);
});

test('извлекает названия, если jsonPath указывает прямо на массив строк', async () => {
  globalThis.fetch = (() =>
    Promise.resolve(
      new Response(
        JSON.stringify({
          titles: ['Дорама 1', 'Дорама 2'],
        }),
        { status: 200 },
      ),
    )) as unknown as typeof fetch;

  const stringArraySource: Source = {
    ...source,
    jsonPath: 'titles.*',
  };

  const result = await fetchDramasFromSource(stringArraySource);
  expect(result.dramas).toEqual([{ title: 'Дорама 1' }, { title: 'Дорама 2' }]);
});

test('извлекает постеры и ссылки с $-префиксными путями', async () => {
  globalThis.fetch = (() =>
    Promise.resolve(
      new Response(
        JSON.stringify({
          result: [
            {
              title: 'Дорама 1',
              assets: {
                productPoster: 'https://img.example.com/{SIZE}/poster1.jpg',
              },
              webUrl: '/watch/1',
            },
          ],
        }),
        { status: 200 },
      ),
    )) as unknown as typeof fetch;

  const richSource: Source = {
    ...source,
    jsonPath: '$.result.*.title',
    posterJsonPath: '$.result.*.assets.productPoster',
    linkJsonPath: '$.result.*.webUrl',
    linkBaseUrl: 'https://amediateka.ru',
  };

  const result = await fetchDramasFromSource(richSource);
  expect(result.dramas).toEqual([
    {
      title: 'Дорама 1',
      posterUrl: 'https://img.example.com/400x600/poster1.jpg',
      link: 'https://amediateka.ru/watch/1',
    },
  ]);
});

test('подставляет posterBaseUrl перед относительным URL постера', async () => {
  globalThis.fetch = (() =>
    Promise.resolve(
      new Response(
        JSON.stringify({
          items: [
            {
              name: 'Дорама 1',
              logo: '/images/poster1.jpg',
              slug: 'dorama-1',
            },
          ],
        }),
        { status: 200 },
      ),
    )) as unknown as typeof fetch;

  const richSource: Source = {
    ...source,
    jsonPath: '$.items.*.name',
    posterJsonPath: '$.items.*.logo',
    linkJsonPath: '$.items.*.slug',
    posterBaseUrl: 'https://images.example.com',
    linkBaseUrl: 'https://wink.example.com/series/',
  };

  const result = await fetchDramasFromSource(richSource);
  expect(result.dramas).toEqual([
    {
      title: 'Дорама 1',
      posterUrl: 'https://images.example.com/images/poster1.jpg',
      link: 'https://wink.example.com/series/dorama-1',
    },
  ]);
});

test('возвращает только названия без постеров и ссылок', async () => {
  globalThis.fetch = (() =>
    Promise.resolve(
      new Response(
        JSON.stringify({
          result: [{ title: 'Дорама 1' }, { title: 'Дорама 2' }],
        }),
        { status: 200 },
      ),
    )) as unknown as typeof fetch;

  const result = await fetchDramasFromSource(source);
  expect(result.dramas).toEqual([{ title: 'Дорама 1' }, { title: 'Дорама 2' }]);
});

test('бросает ошибку при ошибке HTTP', async () => {
  globalThis.fetch = (() =>
    Promise.resolve(
      new Response('Not Found', { status: 404 }),
    )) as unknown as typeof fetch;

  expect(fetchDramasFromSource(source)).rejects.toThrow(
    'Источник Okko (https://example.com/api): HTTP 404',
  );
});

test('бросает ошибку при ошибке сети', async () => {
  globalThis.fetch = (() =>
    Promise.reject(new Error('network error'))) as unknown as typeof fetch;

  expect(fetchDramasFromSource(source)).rejects.toThrow(
    'Источник Okko (https://example.com/api): network error',
  );
});

test('бросает ошибку, если список дорам пуст', async () => {
  globalThis.fetch = (() =>
    Promise.resolve(
      new Response(JSON.stringify({ result: [] }), { status: 200 }),
    )) as unknown as typeof fetch;

  expect(fetchDramasFromSource(source)).rejects.toThrow('пустой список дорам');
});

test('передаёт User-Agent в заголовках запроса', async () => {
  let capturedInit: RequestInit | undefined;
  globalThis.fetch = ((_url: string, init?: RequestInit) => {
    capturedInit = init;
    return Promise.resolve(
      new Response(JSON.stringify({ result: [{ title: 'Дорама 1' }] }), {
        status: 200,
      }),
    );
  }) as unknown as typeof fetch;

  await fetchDramasFromSource(source, 'test-agent');
  const headers = capturedInit?.headers as Record<string, string>;
  expect(headers['User-Agent']).toBe('test-agent');
});

test('извлекает дорамы через Flaresolverr из HTML-обёртки', async () => {
  globalThis.fetch = (() =>
    Promise.resolve(
      new Response(
        JSON.stringify({
          solution: {
            response: `<html><body><pre>${JSON.stringify({
              result: [{ title: 'Дорама 1' }, { title: 'Дорама 2' }],
            })}</pre></body></html>`,
          },
        }),
        { status: 200 },
      ),
    )) as unknown as typeof fetch;

  const flaresolverrSource: Source = {
    ...source,
    flaresolverr: true,
  };

  const result = await fetchDramasFromSource(
    flaresolverrSource,
    undefined,
    flaresolverr,
  );
  expect(result.dramas).toEqual([{ title: 'Дорама 1' }, { title: 'Дорама 2' }]);
});

test('извлекает дорамы через Flaresolverr из чистого JSON', async () => {
  globalThis.fetch = (() =>
    Promise.resolve(
      new Response(
        JSON.stringify({
          solution: {
            response: JSON.stringify({ result: [{ title: 'Дорама 1' }] }),
          },
        }),
        { status: 200 },
      ),
    )) as unknown as typeof fetch;

  const flaresolverrSource: Source = {
    ...source,
    flaresolverr: true,
  };

  const result = await fetchDramasFromSource(
    flaresolverrSource,
    undefined,
    flaresolverr,
  );
  expect(result.dramas).toEqual([{ title: 'Дорама 1' }]);
});

test('передаёт X-Api-Key в запрос к Flaresolverr', async () => {
  let capturedUrl = '';
  let capturedInit: RequestInit | undefined;
  globalThis.fetch = ((url: string, init?: RequestInit) => {
    capturedUrl = url;
    capturedInit = init;
    return Promise.resolve(
      new Response(
        JSON.stringify({
          solution: {
            response: JSON.stringify({ result: [{ title: 'Дорама 1' }] }),
          },
        }),
        { status: 200 },
      ),
    );
  }) as unknown as typeof fetch;

  const flaresolverrSource: Source = {
    ...source,
    flaresolverr: true,
  };

  await fetchDramasFromSource(flaresolverrSource, undefined, flaresolverr);
  expect(capturedUrl).toBe('http://localhost:8190/v1');
  const headers = capturedInit?.headers as Record<string, string>;
  expect(headers['X-Api-Key']).toBe('secret-key');
});

test('бросает ошибку, если Flaresolverr вернул пустой ответ', async () => {
  globalThis.fetch = (() =>
    Promise.resolve(
      new Response(JSON.stringify({ solution: { response: '' } }), {
        status: 200,
      }),
    )) as unknown as typeof fetch;

  const flaresolverrSource: Source = {
    ...source,
    flaresolverr: true,
  };

  expect(
    fetchDramasFromSource(flaresolverrSource, undefined, flaresolverr),
  ).rejects.toThrow('Flaresolverr вернул пустой ответ');
});

test('бросает ошибку при ошибке HTTP от Flaresolverr', async () => {
  globalThis.fetch = (() =>
    Promise.resolve(
      new Response('Bad Gateway', { status: 502 }),
    )) as unknown as typeof fetch;

  const flaresolverrSource: Source = {
    ...source,
    flaresolverr: true,
  };

  expect(
    fetchDramasFromSource(flaresolverrSource, undefined, flaresolverr),
  ).rejects.toThrow('Flaresolverr HTTP 502');
});

test('декодирует HTML-сущности в JSON внутри <pre> от Flaresolverr', async () => {
  globalThis.fetch = (() =>
    Promise.resolve(
      new Response(
        JSON.stringify({
          solution: {
            response:
              '<html><body><pre>{"result":[{"title":"Tom &amp; Jerry &lt;3"}]}</pre></body></html>',
          },
        }),
        { status: 200 },
      ),
    )) as unknown as typeof fetch;

  const flaresolverrSource: Source = {
    ...source,
    flaresolverr: true,
  };

  const result = await fetchDramasFromSource(
    flaresolverrSource,
    undefined,
    flaresolverr,
  );
  expect(result.dramas).toEqual([{ title: 'Tom & Jerry <3' }]);
});

test('бросает понятную ошибку, если JSON внутри <pre> повреждён', async () => {
  globalThis.fetch = (() =>
    Promise.resolve(
      new Response(
        JSON.stringify({
          solution: {
            response: '<html><body><pre>not json at all</pre></body></html>',
          },
        }),
        { status: 200 },
      ),
    )) as unknown as typeof fetch;

  const flaresolverrSource: Source = {
    ...source,
    flaresolverr: true,
  };

  expect(
    fetchDramasFromSource(flaresolverrSource, undefined, flaresolverr),
  ).rejects.toThrow('не содержит JSON');
});

test('передаёт заголовки источника и User-Agent в запрос через Flaresolverr', async () => {
  let capturedBody: Record<string, unknown> | undefined;
  globalThis.fetch = ((_url: string, init?: RequestInit) => {
    capturedBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
    return Promise.resolve(
      new Response(
        JSON.stringify({
          solution: {
            response: JSON.stringify({ result: [{ title: 'Дорама 1' }] }),
          },
        }),
        { status: 200 },
      ),
    );
  }) as unknown as typeof fetch;

  const flaresolverrSource: Source = {
    ...source,
    flaresolverr: true,
    headers: { session_id: 'abc123' },
  };

  await fetchDramasFromSource(flaresolverrSource, 'test-agent', flaresolverr);
  const headers = capturedBody?.headers as Record<string, string>;
  expect(headers).toEqual({ session_id: 'abc123', 'User-Agent': 'test-agent' });
});

test('включает причину из тела ошибки Flaresolverr при HTTP-ошибке', async () => {
  globalThis.fetch = (() =>
    Promise.resolve(
      new Response(JSON.stringify({ error: 'Error solving the challenge' }), {
        status: 500,
      }),
    )) as unknown as typeof fetch;

  const flaresolverrSource: Source = {
    ...source,
    flaresolverr: true,
  };

  expect(
    fetchDramasFromSource(flaresolverrSource, undefined, flaresolverr),
  ).rejects.toThrow('Error solving the challenge');
});

test('бросает понятную ошибку, если Flaresolverr вернул не JSON', async () => {
  globalThis.fetch = (() =>
    Promise.resolve(
      new Response('<html>Flaresolverr error page</html>', { status: 200 }),
    )) as unknown as typeof fetch;

  const flaresolverrSource: Source = {
    ...source,
    flaresolverr: true,
  };

  expect(
    fetchDramasFromSource(flaresolverrSource, undefined, flaresolverr),
  ).rejects.toThrow('не JSON');
});

test('бросает ошибку, если целевой HTTP-статус в solution.status не 2xx', async () => {
  globalThis.fetch = (() =>
    Promise.resolve(
      new Response(
        JSON.stringify({
          solution: { status: 404, response: '<html>Not Found</html>' },
        }),
        { status: 200 },
      ),
    )) as unknown as typeof fetch;

  const flaresolverrSource: Source = {
    ...source,
    flaresolverr: true,
  };

  expect(
    fetchDramasFromSource(flaresolverrSource, undefined, flaresolverr),
  ).rejects.toThrow('404');
});

test('создаёт одну сессию Flaresolverr для всех источников и уничтожает её после', async () => {
  const calls: { cmd: string; session?: string }[] = [];
  globalThis.fetch = ((_url: string, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
    calls.push({
      cmd: body.cmd as string,
      session: body.session as string | undefined,
    });
    if (body.cmd === 'sessions.create') {
      return Promise.resolve(
        new Response(JSON.stringify({ status: 'ok', session: body.session }), {
          status: 200,
        }),
      );
    }
    if (body.cmd === 'sessions.destroy') {
      return Promise.resolve(
        new Response(JSON.stringify({ status: 'ok' }), { status: 200 }),
      );
    }
    return Promise.resolve(
      new Response(
        JSON.stringify({
          solution: {
            response: JSON.stringify({ result: [{ title: 'Дорама 1' }] }),
          },
        }),
        { status: 200 },
      ),
    );
  }) as unknown as typeof fetch;

  const a: Source = {
    ...source,
    name: 'Okko',
    flaresolverr: true,
  };
  const b: Source = {
    ...source,
    name: 'Okko2',
    flaresolverr: true,
  };

  const { results, failedSources } = await fetchAllSources(
    [a, b],
    undefined,
    flaresolverr,
  );

  const creates = calls.filter((c) => c.cmd === 'sessions.create');
  const destroys = calls.filter((c) => c.cmd === 'sessions.destroy');
  const gets = calls.filter((c) => c.cmd === 'request.get');
  expect(creates).toHaveLength(1);
  expect(destroys).toHaveLength(1);
  expect(gets).toHaveLength(2);
  expect(gets.every((g) => g.session === creates[0]?.session)).toBe(true);
  expect(failedSources).toEqual([]);
  expect(results).toHaveLength(2);
});

test('без Flaresolverr fetchAllSources не создаёт сессий и возвращает результаты', async () => {
  let called = false;
  globalThis.fetch = ((_url: string, _init?: RequestInit) => {
    called = true;
    return Promise.resolve(
      new Response(JSON.stringify({ result: [{ title: 'Дорама 1' }] }), {
        status: 200,
      }),
    );
  }) as unknown as typeof fetch;

  const { results, failedSources } = await fetchAllSources(
    [source],
    'test-agent',
  );
  expect(called).toBe(true);
  expect(failedSources).toEqual([]);
  expect(results).toHaveLength(1);
  expect(results[0]?.dramas).toEqual([{ title: 'Дорама 1' }]);
});
