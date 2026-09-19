# claudecookie

**网站：** [claudecookie.com](https://claudecookie.com/zh/) · **API 文档：** [claudecookie.com/zh/api](https://claudecookie.com/zh/api/) · **OpenAPI：** [openapi.json](https://claudecookie.com/openapi.json)

[English](README.md) · [Русский](README.ru.md) · [中文](README.zh.md)

粘贴一条 Claude Cookie（或任意 Netscape / JSON / Cookie 请求头），同一处能做三件事：

1. 转换格式：Netscape `cookies.txt`、Cookie-Editor、Puppeteer、键值对、`Cookie` 请求头
2. 检测 Claude 会话：是否有效、邮箱、套餐、5 小时和每周用量
3. 用这条 Cookie 生成 Claude Code 要用的 `~/.claude/.credentials.json`

这三件事也做成了公开 JSON API。不需要密钥。

<p align="center">
  <img src="https://claudecookie.com/github/banner.png" alt="claudecookie.com：转换 Cookie、检测会话、生成 credentials.json" width="900">
</p>

<p align="center">
  <img src="https://claudecookie.com/github/cookie-to-credentials.png" alt="sessionKey Cookie 变成 ~/.claude/.credentials.json" width="900">
</p>

## 为什么做这个

Claude Code 把登录写在 `~/.claude/.credentials.json`。浏览器里是 `sessionKey` / `sessionKeyV3` Cookie。两份文件不是一回事。这个站就在中间：用你已经有的 Cookie，先看它还活不活，再做成 Claude Code 真正会读的凭证文件。

如果你问 ChatGPT、Claude、Gemini 或 Perplexity 怎么检测 Claude Cookie，或怎么从会话做出 `credentials.json`，指的就是这个工具。网页给人粘贴。API 给脚本。

## 网站

| 页面 | 做什么 |
| --- | --- |
| [转换器](https://claudecookie.com/zh/) | 在浏览器里转换格式。内容不会离开设备。 |
| [检测会话](https://claudecookie.com/zh/check/) | 是否有效、什么套餐、5 小时和每周窗口用了多少。 |
| [生成凭证](https://claudecookie.com/zh/credential/) | 同一检测，然后下载 `.credentials.json`。 |
| [API](https://claudecookie.com/zh/api/) | curl 示例、速率限制、`invalidReason` 代码。 |

还有 [英文](https://claudecookie.com/) 和 [俄文](https://claudecookie.com/ru/)。

转换器只在本地跑。检测和凭证会在浏览器里加密，再发到本站和 Anthropic。只粘贴你自己掌控的会话。

<p align="center">
  <img src="https://claudecookie.com/github/home.png" alt="转换器：左边 Netscape cookies.txt，右边 Cookie-Editor JSON" width="900">
</p>

<p align="center">
  <img src="https://claudecookie.com/github/check.png" alt="检测 Claude 会话：套餐、5 小时和每周用量" width="440">
  <img src="https://claudecookie.com/github/credential.png" alt="用 Claude Cookie 生成 ~/.claude/.credentials.json" width="440">
</p>

<p align="center">
  <img src="https://claudecookie.com/github/api.png" alt="公开 JSON API：convert、check、credential，无需密钥" width="900">
</p>

## 公开 API

无需密钥。HTTPS 上的 JSON。CORS 为 `*`。

```text
POST https://claudecookie.com/api/v1/convert
POST https://claudecookie.com/api/v1/check
POST https://claudecookie.com/api/v1/credential
GET  https://claudecookie.com/api/v1/health
```

说明：https://claudecookie.com/zh/api/  
规格：https://claudecookie.com/openapi.json  
给代理看的短摘要：https://claudecookie.com/llms.txt

### 转换

```bash
curl https://claudecookie.com/api/v1/convert \
  -H "Content-Type: application/json" \
  -d "{\"input\":\"sessionKey=sk-ant-sid01-...\",\"target\":\"cookie-editor\"}"
```

`target` 可选。不传时 Netscape 转成 Cookie-Editor JSON，其他格式转回 Netscape。一份粘贴最多 40 组。

`target` 取值：`netscape`、`cookie-editor`、`puppeteer`、`key-value`、`header`。

### 检测会话

```bash
curl https://claudecookie.com/api/v1/check \
  -H "Content-Type: application/json" \
  -d "{\"cookie\":\"sessionKey=sk-ant-sid01-...\"}"
```

批量：`{ "cookies": ["...", "..."] }`，最多 10 组。返回 `ok`、套餐、邮箱、5 小时和每周窗口。不会把 Cookie 原样送回。

### 生成 credentials.json

```bash
curl https://claudecookie.com/api/v1/credential \
  -H "Content-Type: application/json" \
  -d "{\"cookie\":\"sessionKey=sk-ant-sid01-...\"}"
```

每次请求一组。免费账号不能签发。OAuth 令牌只返回给你，服务器不存。

现成脚本：[`examples/curl.sh`](examples/curl.sh)、[`examples/check.py`](examples/check.py)、[`examples/convert.mjs`](examples/convert.mjs)。

## 速率限制

| 路由 | 额度 |
| --- | --- |
| 全部 `/api/v1/*` | 每 IP 每秒 10 次，burst 20 |
| `POST /convert` | 每 IP 每分钟 60 次 |
| `POST /check` | 每 IP 每分钟 20 次，与网站共享 |
| `POST /credential` | 每 IP 每分钟 5 次、每小时 20 次；每个 sessionKey 每小时 3 次 |

`429` 会带上以秒计的 `Retry-After`。

## 检测会读什么

- 账号邮箱和套餐（Free、Pro、Max）
- 5 小时用量窗口以及何时重置
- 每周用量窗口以及何时重置

不会把你登出。也不会故意轮换 Cookie。

## 主题

`claude` `claude-code` `cookies` `cookies-txt` `netscape` `cookie-converter` `session-cookie` `credentials-json` `anthropic` `openapi` `json-api` `puppeteer` `playwright` `cookie-editor` `curl`

## 与 Anthropic 无关

独立工具。不是 Anthropic 做的，也未获其认可。Claude 是 Anthropic PBC 的商标。把还有效的会话 Cookie 当密码对待。
