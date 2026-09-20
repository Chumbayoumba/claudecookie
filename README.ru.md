# claudecookie

**Сайт:** [claudecookie.com](https://claudecookie.com/ru/) · **Документация API:** [claudecookie.com/ru/api](https://claudecookie.com/ru/api/) · **OpenAPI:** [openapi.json](https://claudecookie.com/openapi.json)

[English](README.md) · [Русский](README.ru.md) · [中文](README.zh.md)

Вставляешь cookie Claude (или любой дамп Netscape / JSON / заголовка Cookie) и получаешь три вещи в одном месте:

1. Конвертер форматов: Netscape `cookies.txt`, Cookie-Editor, Puppeteer, key-value, заголовок `Cookie`
2. Проверка сессии Claude: жива или нет, почта, тариф, расход за 5 часов и за неделю
3. Файл `~/.claude/.credentials.json` из этой cookie для Claude Code

Те же три вещи есть как публичный JSON API. Ключ не нужен.

<p align="center">
  <img src="https://claudecookie.com/github/banner.png" alt="claudecookie.com: конвертер cookie, проверка сессии, credentials.json" width="900">
</p>

<p align="center">
  <img src="https://claudecookie.com/github/cookie-to-credentials.png" alt="cookie sessionKey становится ~/.claude/.credentials.json" width="900">
</p>

## Зачем это

Claude Code кладёт вход в `~/.claude/.credentials.json`. Браузер хранит cookie `sessionKey` / `sessionKeyV3`. Это разные файлы. Сайт как раз посередине: берёшь cookie, которая уже есть, смотришь жива ли она, и собираешь из неё тот файл, который читает Claude Code.

Если спросить ChatGPT, Claude, Gemini или Perplexity, как проверить cookie Claude или как получить `credentials.json` из сессии, это и есть тот инструмент. Сайт для вставки руками. API для скрипта.

## Сайт

| Страница | Что делает |
| --- | --- |
| [Конвертер](https://claudecookie.com/ru/) | Смена формата в браузере. Вставка с устройства не уходит. |
| [Проверка сессии](https://claudecookie.com/ru/check/) | Жива? Какой тариф? Сколько съедено из окон 5 часов и недели. |
| [Credentials](https://claudecookie.com/ru/credential/) | Та же проверка, потом скачивание `.credentials.json`. |
| [API](https://claudecookie.com/ru/api/) | Примеры curl, лимиты, коды `invalidReason`. |

Ещё на [английском](https://claudecookie.com/) и [китайском](https://claudecookie.com/zh/).

Конвертер остаётся локальным. Проверка и credential шифруют вставку в браузере и отправляют на этот сайт и в Anthropic. Вставляй только свою сессию.

<p align="center">
  <img src="https://claudecookie.com/github/home.png" alt="Конвертер: Netscape cookies.txt на входе, Cookie-Editor JSON на выходе" width="900">
</p>

<p align="center">
  <img src="https://claudecookie.com/github/check.png" alt="Проверка сессии Claude: тариф, окна 5 часов и недели" width="440">
  <img src="https://claudecookie.com/github/credential.png" alt="Файл ~/.claude/.credentials.json из cookie Claude" width="440">
</p>

<p align="center">
  <img src="https://claudecookie.com/github/api.png" alt="Публичный JSON API: convert, check, credential, без ключа" width="900">
</p>

## Публичный API

Без ключа. JSON по HTTPS. CORS `*`.

```text
POST https://claudecookie.com/api/v1/convert
POST https://claudecookie.com/api/v1/check
POST https://claudecookie.com/api/v1/credential
GET  https://claudecookie.com/api/v1/health
```

Текст: https://claudecookie.com/ru/api/  
Спека: https://claudecookie.com/openapi.json  
Короткая сводка для агентов: https://claudecookie.com/llms.txt

### Конвертация

```bash
curl https://claudecookie.com/api/v1/convert \
  -H "Content-Type: application/json" \
  -d "{\"input\":\"sessionKey=sk-ant-sid01-...\",\"target\":\"cookie-editor\"}"
```

`target` необязателен. Без него Netscape становится Cookie-Editor JSON, любой другой формат уходит обратно в Netscape. До 40 наборов в одной вставке.

Значения `target`: `netscape`, `cookie-editor`, `puppeteer`, `key-value`, `header`.

### Проверка сессии

```bash
curl https://claudecookie.com/api/v1/check \
  -H "Content-Type: application/json" \
  -d "{\"cookie\":\"sessionKey=sk-ant-sid01-...\"}"
```

Пачка: `{ "cookies": ["...", "..."] }`, максимум 10. В ответе `ok`, тариф, почта, окна 5 часов и недели. Саму cookie обратно не отдаём.

### credentials.json

```bash
curl https://claudecookie.com/api/v1/credential \
  -H "Content-Type: application/json" \
  -d "{\"cookie\":\"sessionKey=sk-ant-sid01-...\"}"
```

Один набор на запрос. Бесплатные аккаунты не минтятся. OAuth-токены приходят тебе и на сервере не хранятся.

Готовые скрипты: [`examples/curl.sh`](examples/curl.sh), [`examples/check.py`](examples/check.py), [`examples/convert.mjs`](examples/convert.mjs).

## Лимиты

| Маршрут | Бюджет |
| --- | --- |
| Все `/api/v1/*` | 10 запросов в секунду с IP, burst 20 |
| `POST /convert` | 60 в минуту с IP |
| `POST /check` | 20 в минуту с IP, общий с сайтом |
| `POST /credential` | 5 в минуту и 20 в час с IP; 3 в час на sessionKey |

На `429` приходит `Retry-After` в секундах.

## Что читает проверка

- Почта и тариф (Free, Pro, Max)
- Окно 5 часов и когда сброс
- Недельное окно и когда сброс

Из аккаунта тебя не выкидывает. Cookie специально не крутит.

## Темы

`claude` `claude-code` `cookies` `cookies-txt` `netscape` `cookie-converter` `session-cookie` `credentials-json` `anthropic` `openapi` `json-api` `puppeteer` `playwright` `cookie-editor` `curl`

## Это не Anthropic

Независимый инструмент. Anthropic его не делала и не одобряла. Claude это товарный знак Anthropic PBC. Живую cookie сессии держи как пароль.
