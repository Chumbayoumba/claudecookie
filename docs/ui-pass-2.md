# Второй дизайн-проход claudecookie

Характер: спокойная документационная оболочка, внутри которой три отполированных инструмента. Не полировать первый проход и не добавлять glow, stagger и новые иконки.

Ограничения, которые нельзя ломать:

- Навигация только plain `<a>`. `connect-src 'self'` режет RSC-роутер Next.
- Вход заголовков — только `transform` (`y`), без `opacity: 0` у H1 и индексного текста.
- `dict.meta.title` / `description` не укорачивать (тест длины). JSON-LD берёт meta, не видимый H1.
- Иконки — SVG, не эмодзи. Только три продуктовые: Converter, Check, Credentials.
- Живые cookie из бота и `stats.db` в проверке не использовать.
- Поведение Check / Credential / Turnstile / sealed box не менять.

## Что уже было после релиза `20260917-162918`

Живые скриншоты 17 сентября (тёмная тема):

- Шапка — filled `ToolSwitch` Convert / Check / Credentials + Docs + Guides + Privacy как отдельная ссылка.
- Hero повторяет `COOKIE CONVERTER` и длинный H1.
- Конвертер — две отдельные карточки, Convert уезжает под сгиб.
- Под ним одна clay-карточка `Need to check a Claude session?`.
- Check — длинный SEO-H1 + статья сразу под формой, кнопка `Check cookie`.
- Credential — степпер-индикатор, textarea всегда видна, та же кнопка `Check cookie`.
- JSON — outlined-кнопки вкладок + таблица сверху.
- Privacy — две `DataFlow`-карточки; текст про Метрику уже честный.

Аудит частично устарел: «Back to the converter» уже не рендерится (ключ мёртвый), футер уже Tools / Guides / Reference / About, JSON уже в вкладках. Этот проход чинит вес и характер, не придумывает IA заново.

## P1–P8

**P1.** Тихая шапка: Converter / Check / Credentials текстом. Активный — underline или `rgba(accent, 0.06)`. Docs ▾ и Guides ▾. Privacy только в Docs и футере. Футер: Tools / Guides / Docs. Крошки: Tools | Docs | Guides.

**P2.** Короткий видимый H1 на главной. Конвертер — одна рабочая панель. Sample / Upload / Clear — ghost-toolbar. Одна primary. More tools — две тихие карточки.

**P3.** Check как приложение: одна панель, `Check session`, результат — UI-состояние. Статья ниже и без лишних рамок.

**P4.** Credentials — настоящий wizard (один экран за раз): Paste → Verify session → Generate credentials. Поведение бэкенда не менять.

**P5.** JSON: underline-вкладки, слева мета, справа code, все примеры в DOM. Netscape: chips + warning + sticky TOC. Guides: badge + read time, колонка ~720px. Privacy: три строки сверху, содержание секций не менять.

**P6.** Почти белый фон, один тёплый accent, рабочая область чуть контрастнее docs. Убрать 30–40% рамок и glow.

**P7.** Page enter 220 ms, `y: 4`. Reaction-анимации на detect / convert / check / copied / verified / generated.

**P8.** en/ru/zh, тесты, браузер light/dark, один commit, деплой фронта.
