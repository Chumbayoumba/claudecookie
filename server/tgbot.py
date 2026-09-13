#!/usr/bin/env python3
"""claudecookie Telegram admin bot.

Owner-only. Long-polls Telegram (no webhook, so no inbound port or certificate),
reads the SQLite database the ingest service writes, and does two things:

  * answers the owner's button presses with usage stats;
  * pushes a message + a cookie-file attachment on every new conversion, so the
    owner never loses a cookie set they converted.

stdlib only: urllib for the Telegram HTTP API, sqlite3 for reads.

Config /etc/claudecookie/bot.conf (JSON): { "bot_token": "...", "owner_id": 123, ... }
The token is a secret; it is never logged.
"""

from __future__ import annotations

import io
import json
import os
import sqlite3
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone

DB_PATH = os.environ.get("CC_STATS_DB", "/var/lib/claudecookie/stats.db")
CONF_PATH = os.environ.get("CC_STATS_CONF", "/etc/claudecookie/bot.conf")

with open(CONF_PATH, "r", encoding="utf-8") as f:
    CONF = json.load(f)

TOKEN = CONF["bot_token"]
OWNER = int(CONF["owner_id"])
API = f"https://api.telegram.org/bot{TOKEN}"

FORMAT_LABEL = {
    "netscape": "Netscape", "cookie-editor": "Cookie-Editor",
    "puppeteer": "Puppeteer", "key-value": "Key-Value", "header": "Header",
}
LOCALE_LABEL = {"en": "English", "ru": "Русский", "zh": "中文"}
SPARK = "▁▂▃▄▅▆▇█"


# --- Telegram API (stdlib) ---------------------------------------------------

def _api(method: str, payload: dict, files: dict | None = None) -> dict:
    url = f"{API}/{method}"
    try:
        if files:
            return _multipart(url, payload, files)
        data = json.dumps(payload).encode()
        req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"})
        with urllib.request.urlopen(req, timeout=65) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        try:
            return json.loads(e.read())
        except Exception:
            return {"ok": False, "error": str(e)}
    except Exception as e:
        return {"ok": False, "error": str(e)}


def _multipart(url: str, fields: dict, files: dict) -> dict:
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

    req = urllib.request.Request(url, data=body.getvalue(),
                                 headers={"Content-Type": f"multipart/form-data; boundary={boundary}"})
    try:
        with urllib.request.urlopen(req, timeout=65) as r:
            return json.loads(r.read())
    except Exception as e:
        return {"ok": False, "error": str(e)}


def send(chat_id: int, text: str, keyboard=None):
    payload = {"chat_id": chat_id, "text": text, "parse_mode": "HTML",
               "disable_web_page_preview": True}
    if keyboard is not None:
        payload["reply_markup"] = {"inline_keyboard": keyboard}
    return _api("sendMessage", payload)


def edit(chat_id: int, message_id: int, text: str, keyboard=None):
    payload = {"chat_id": chat_id, "message_id": message_id, "text": text,
               "parse_mode": "HTML", "disable_web_page_preview": True}
    if keyboard is not None:
        payload["reply_markup"] = {"inline_keyboard": keyboard}
    return _api("editMessageText", payload)


def send_document(chat_id: int, filename: str, content: str, caption: str = ""):
    return _api("sendDocument", {"chat_id": chat_id, "caption": caption, "parse_mode": "HTML"},
                files={"document": (filename, content)})


def answer_callback(cb_id: str, text: str = ""):
    _api("answerCallbackQuery", {"callback_query_id": cb_id, "text": text})


# --- Database (read-only side) ----------------------------------------------

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
    conn.execute("INSERT INTO settings(key,value) VALUES(?,?) "
                 "ON CONFLICT(key) DO UPDATE SET value=excluded.value", (key, str(value)))
    conn.commit()
    conn.close()


def get_state(conn, key, default="0"):
    r = conn.execute("SELECT value FROM botstate WHERE key=?", (key,)).fetchone()
    return r[0] if r else default


def set_state(conn, key, value):
    conn.execute("INSERT INTO botstate(key,value) VALUES(?,?) "
                 "ON CONFLICT(key) DO UPDATE SET value=excluded.value", (key, str(value)))
    conn.commit()


# --- Views (text builders) ---------------------------------------------------

def fmt(n) -> str:
    return f"{int(n):,}".replace(",", " ")


def view_overview(conn) -> str:
    t = int(time.time())
    day0 = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    conv = scalar(conn, "SELECT COUNT(*) FROM events WHERE type='convert'")
    conv_today = scalar(conn, "SELECT COUNT(*) FROM events WHERE type='convert' AND day=?", day0)
    conv_7 = scalar(conn, "SELECT COUNT(*) FROM events WHERE type='convert' AND ts>=?", t - 7 * 86400)
    conv_30 = scalar(conn, "SELECT COUNT(*) FROM events WHERE type='convert' AND ts>=?", t - 30 * 86400)
    pv = scalar(conn, "SELECT COUNT(*) FROM events WHERE type='pageview'")
    visitors = scalar(conn, "SELECT COUNT(DISTINCT visitor) FROM events")
    cookies = scalar(conn, "SELECT COALESCE(SUM(n),0) FROM events WHERE type='convert'")
    return (
        "<b>📊 Обзор</b>\n\n"
        f"🔄 Конвертаций: <b>{fmt(conv)}</b>\n"
        f"   сегодня {fmt(conv_today)} · 7д {fmt(conv_7)} · 30д {fmt(conv_30)}\n"
        f"🍪 Кук обработано: <b>{fmt(cookies)}</b>\n"
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
    dom = conn.execute("SELECT domains FROM events WHERE type='convert' AND domains IS NOT NULL").fetchall()
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
            f"• {d} — <b>{fmt(c)}</b>" for d, c in top_dom))
    return "\n".join(parts)


def view_countries(conn) -> str:
    countries = conn.execute(
        "SELECT COALESCE(country,'??') country, COUNT(*) count FROM events "
        "GROUP BY country ORDER BY count DESC LIMIT 12").fetchall()
    locales = conn.execute(
        "SELECT COALESCE(locale,'?') locale, COUNT(*) count FROM events "
        "WHERE type='pageview' GROUP BY locale ORDER BY count DESC").fetchall()
    devices = conn.execute(
        "SELECT device, COUNT(DISTINCT visitor) count FROM events GROUP BY device").fetchall()

    def flag(cc):
        if cc and len(cc) == 2 and cc != "??":
            return "".join(chr(0x1F1E6 + ord(c) - 65) for c in cc.upper())
        return "🏳"

    parts = ["<b>🌍 География</b>\n"]
    parts.append("<u>Страны</u>\n" + _bars(countries, lambda r: f"{flag(r['country'])} {r['country']}"))
    parts.append("\n<u>Языки</u>\n" + _bars(
        locales, lambda r: LOCALE_LABEL.get(r["locale"], r["locale"])))
    parts.append("\n<u>Устройства</u>\n" + _bars(devices, lambda r: r["device"]))
    return "\n".join(parts)


def view_trend(conn) -> str:
    t = int(time.time())
    rows = conn.execute(
        "SELECT day, COUNT(*) c FROM events WHERE type='convert' AND ts>=? GROUP BY day",
        (t - 30 * 86400,)).fetchall()
    by = {r["day"]: r["c"] for r in rows}
    vals = []
    for i in range(29, -1, -1):
        d = datetime.fromtimestamp(t - i * 86400, timezone.utc).strftime("%Y-%m-%d")
        vals.append(by.get(d, 0))
    mx = max(vals) or 1
    spark = "".join(SPARK[min(len(SPARK) - 1, round(v / mx * (len(SPARK) - 1)))] for v in vals)
    total = sum(vals)
    return (
        "<b>📈 Конвертации за 30 дней</b>\n\n"
        f"<code>{spark}</code>\n\n"
        f"Всего за период: <b>{fmt(total)}</b>\n"
        f"Пик за день: <b>{fmt(mx)}</b>"
    )


def view_recent(conn):
    rows = conn.execute(
        "SELECT id, ts, from_fmt, to_fmt, n, country, domains FROM events "
        "WHERE type='convert' ORDER BY id DESC LIMIT 8").fetchall()
    if not rows:
        return "<b>🕐 Последнее</b>\n\n<i>Пока нет конвертаций.</i>", []
    lines = ["<b>🕐 Последние конвертации</b>\n"]
    kb = []
    for r in rows:
        tm = datetime.fromtimestamp(r["ts"], timezone.utc).strftime("%d.%m %H:%M")
        d = (r["domains"] or "").split(",")[0] if r["domains"] else "—"
        lines.append(
            f"<code>{tm}</code> · {FORMAT_LABEL.get(r['from_fmt'], r['from_fmt'])}→"
            f"{FORMAT_LABEL.get(r['to_fmt'], r['to_fmt'])} · {fmt(r['n'] or 0)} кук · {d}")
        kb.append([{"text": f"📄 Файл {tm}", "callback_data": f"file:{r['id']}"}])
    kb.append([{"text": "‹ Назад", "callback_data": "home"}])
    return "\n".join(lines), kb


def view_settings(conn) -> tuple[str, list]:
    push = get_setting(conn, "push_each", "1") == "1"
    daily = get_setting(conn, "daily_summary", "1") == "1"
    txt = (
        "<b>⚙️ Настройки уведомлений</b>\n\n"
        f"🔔 Пуш на каждую конвертацию: <b>{'вкл' if push else 'выкл'}</b>\n"
        f"📅 Дневная сводка (09:00 UTC): <b>{'вкл' if daily else 'выкл'}</b>"
    )
    kb = [
        [{"text": f"🔔 Пуш: {'выключить' if push else 'включить'}", "callback_data": "set:push_each"}],
        [{"text": f"📅 Сводка: {'выключить' if daily else 'включить'}", "callback_data": "set:daily_summary"}],
        [{"text": "‹ Назад", "callback_data": "home"}],
    ]
    return txt, kb


HOME_KB = [
    [{"text": "📊 Обзор", "callback_data": "overview"},
     {"text": "🔄 Конвертации", "callback_data": "conversions"}],
    [{"text": "🌍 География", "callback_data": "countries"},
     {"text": "📈 30 дней", "callback_data": "trend"}],
    [{"text": "🕐 Последнее", "callback_data": "recent"},
     {"text": "⚙️ Настройки", "callback_data": "settings"}],
]


def home_text() -> str:
    return ("<b>🍪 claudecookie · admin</b>\n\n"
            "Личная статистика конвертера. Выбери раздел:")


# --- Update handling ---------------------------------------------------------

def handle_update(u: dict):
    msg = u.get("message")
    cb = u.get("callback_query")

    if msg:
        frm = msg.get("from", {})
        if frm.get("id") != OWNER:
            return  # silent: the bot does not exist for anyone but the owner
        text = msg.get("text", "")
        if text.startswith("/start") or text.startswith("/help"):
            send(OWNER, home_text(), HOME_KB)
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
        conn = db()
        try:
            if data == "home":
                edit(chat_id, mid, home_text(), HOME_KB)
            elif data == "overview":
                edit(chat_id, mid, view_overview(conn), _back())
            elif data == "conversions":
                edit(chat_id, mid, view_conversions(conn), _back())
            elif data == "countries":
                edit(chat_id, mid, view_countries(conn), _back())
            elif data == "trend":
                edit(chat_id, mid, view_trend(conn), _back())
            elif data == "recent":
                txt, kb = view_recent(conn)
                edit(chat_id, mid, txt, kb)
            elif data == "settings":
                txt, kb = view_settings(conn)
                edit(chat_id, mid, txt, kb)
            elif data.startswith("set:"):
                key = data.split(":", 1)[1]
                cur = get_setting(conn, key, "1")
                set_setting(key, "0" if cur == "1" else "1")
                conn2 = db()
                txt, kb = view_settings(conn2)
                conn2.close()
                edit(chat_id, mid, txt, kb)
            elif data.startswith("file:"):
                rid = int(data.split(":", 1)[1])
                r = conn.execute("SELECT ts, to_fmt, output FROM events WHERE id=?", (rid,)).fetchone()
                if r and r["output"]:
                    ext = "json" if r["to_fmt"] in ("cookie-editor", "puppeteer", "key-value") else "txt"
                    tm = datetime.fromtimestamp(r["ts"], timezone.utc).strftime("%Y%m%d-%H%M")
                    send_document(chat_id, f"cookies-{tm}.{ext}", r["output"],
                                  caption=f"🍪 {tm} · {FORMAT_LABEL.get(r['to_fmt'], r['to_fmt'])}")
                else:
                    answer_callback(cb["id"], "Файл недоступен")
            answer_callback(cb["id"])
        finally:
            conn.close()


def _back():
    return [[{"text": "‹ Назад", "callback_data": "home"}]]


# --- Push loop: notify on each new conversion --------------------------------

def push_loop():
    while True:
        try:
            conn = db()
            if get_setting(conn, "push_each", "1") == "1":
                last = int(get_state(conn, "last_push_id", "0"))
                rows = conn.execute(
                    "SELECT id, ts, from_fmt, to_fmt, n, country, domains, output "
                    "FROM events WHERE type='convert' AND id>? ORDER BY id ASC LIMIT 20",
                    (last,)).fetchall()
                for r in rows:
                    _push_conversion(r)
                    set_state(conn, "last_push_id", r["id"])
            else:
                # Keep the marker current so toggling push back on does not replay history.
                mx = scalar(conn, "SELECT COALESCE(MAX(id),0) FROM events WHERE type='convert'")
                set_state(conn, "last_push_id", mx)
            conn.close()
        except Exception:
            pass
        time.sleep(3)


def _push_conversion(r):
    tm = datetime.fromtimestamp(r["ts"], timezone.utc).strftime("%d.%m %H:%M")
    dom = (r["domains"] or "").split(",")[0] if r["domains"] else "—"
    text = (
        "🍪 <b>Новая конвертация</b>\n"
        f"{FORMAT_LABEL.get(r['from_fmt'], r['from_fmt'])} → "
        f"{FORMAT_LABEL.get(r['to_fmt'], r['to_fmt'])}\n"
        f"{fmt(r['n'] or 0)} кук · {dom} · {tm}"
    )
    if r["output"]:
        ext = "json" if r["to_fmt"] in ("cookie-editor", "puppeteer", "key-value") else "txt"
        send_document(OWNER, f"cookies-{tm.replace('.', '').replace(' ', '-').replace(':', '')}.{ext}",
                      r["output"], caption=text)
    else:
        send(OWNER, text)


# --- Daily summary at 09:00 UTC ---------------------------------------------

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
        except Exception:
            pass
        time.sleep(60)


# --- Long-poll main loop -----------------------------------------------------

def main():
    threading.Thread(target=push_loop, daemon=True).start()
    threading.Thread(target=daily_loop, daemon=True).start()
    print("cc-bot polling", flush=True)

    offset = 0
    # Drop any backlog queued before the bot started.
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
            except Exception:
                pass


if __name__ == "__main__":
    main()
