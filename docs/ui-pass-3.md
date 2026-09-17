# Третий проход: окно конвертера

Характер сайта не менять: спокойная документационная оболочка, внутри одно utility-окно. Не радикальный редизайн, не glow, не новые маркетинговые иконки по сайту.

## Живые факты до этого прохода

Релиз `20260917-174857` (второй дизайн-проход, `38107e3`): одна рамка, Input | отдельная колонка Swap | Output, Convert слева «Convert cookies», живой автоконверт по debounce 150 ms. Пустой Input — textarea с длинным placeholder. FormatBadge — pill `Waiting for input`. Copy/Download всегда видны, disabled. Высота панели `24rem` плюс chrome ≈ 550 px.

## C0

Снимок leftover ingest (`c5fee68`) зафиксирован до правок окна. В git не вошли `.env`, png и one-off `push`/`verify`. Этот проход не выкладывает ingest.

## Четыре сдвига

1. Центральную колонку убрать. Swap 36–38 px на divider, `⇄`, rotate 180 ms. Оставить внешний border, один вертикальный divider, toolbar `border-b`, footer `border-t`. Empty-окно ≈ 420–460 px.
2. Пустой Input — центрированная drop/paste-зона, не карточка в карточке. Короткий заголовок, chips форматов, Choose a file, Local + «Stays in this browser». Drag-over на всю панель. Input чуть активнее Output.
3. Детект с живого ввода: Waiting → Detecting… → `{format} detected · N cookies`. Output пуст до Convert или примера. Copy/Download появляются после reveal. Copy → Copied 1.2 с.
4. CTA справа: `Convert to {format} →` / `✓ Converted` / `Convert again`. Ctrl+Enter / ⌘Enter реально конвертирует.

## Ограничения

- Навигация только plain `<a>`.
- H1 и индексный текст без `opacity: 0`.
- `dict.meta` не укорачивать.
- Иконки SVG, не эмодзи.
- Живые cookie и `stats.db` в проверке не использовать.
- Check / Credential / Turnstile / sealed box не менять.
- `docs/ui-pass-2.md` не переписывать.
