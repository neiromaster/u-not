# Инструкция для мониторинга дорам

## Цель

Твоя задача — найти новые дорамы, которые появились на сайтах из списка ниже с момента последней проверки. Результат нужно добавить в файл `drama-list.md`.

## Файлы

- **Входной файл (состояние):** `drama-list.md`
- **Выходной файл (результат):** `drama-list.md`

## Источники данных (URL)

В этом разделе нужно указать полные URL-адреса страниц, отсортированных от новых к старым.

```
[
  {
    "url": "https://api2.ivi.ru/mobileapi/catalogue/v7/?app_version=870&country=12&fields=title&from=0&genre=212&sort=new&to=29&withpreorderable=1",
    "type": "api",
    "jsonPath": "result.*.title"
  },
  {
    "url": "https://api.amediateka.tech/gateway/v1/cms/content/series/?deviceModel=Edge-141&deviceType=desktopWeb&deviceVendor=Apple&os=Mac%20OS&osVersion=10.15.7&browserVersion=141&browserType=Edge&platform=amediaWeb&supportLive=true&countries=33&ordering=-last_publish_date",
    "type": "api",
    "jsonPath": "results.*.title"
  },
  {
    "url": "https://ctx.playfamily.ru/screenapi/v5/noauth/collection/web/9?elementAlias=dorama_series_cat&elementType=COLLECTION&maxResults=23&pageToken=CgNicmcQABgAKgA&withInnerCollections=true&includeProductsForUpsale=false&filter=%7B%22sortOrder%22%3A%22DESC%22%2C%22sortType%22%3A%22RATING%22%7D",
    "type": "api",
    "jsonPath": "relation.element.collectionItems.*.element.name"
  }
]
```



## Шаги выполнения

1.  **Прочитай `drama-list.md`:** Считай содержимое файла `drama-list.md`, чтобы получить список всех дорам, которые были найдены в предыдущие разы.
2.  **Загрузи данные:** Для каждого объекта в разделе "Источники данных" выполни запрос по указанному `url` и получи ответ в формате JSON.
3.  **Извлеки названия:** Используя `jsonPath` для соответствующего сайта, извлеки все названия дорам из полученного JSON.
4.  **Найди новые дорамы:** Сравни список, полученный на шаге 3, со списком из шага 1. Создай новый список только из тех дорам, которых нет в `drama-list.md`.
5.  **Проверь результат:**
    *   **Если новых дорам нет:** Сообщи, что новых дорам не найдено. Ничего не делай с файлом.
    *   **Если новые дорамы есть:** Перейди к следующему шагу.
6.  **Добавь в файл:**
    *   Отсортируй список новых дорам по алфавиту.
    *   Сгенерируй метку времени в формате `ДД.ММ.ГГГГ ЧЧ:ММ`.
    *   Добавь в конец файла `drama-list.md` новую секцию, начинающуюся с метки времени, за которой следует отсортированный список новых дорам. Каждая дорама на новой строке.

