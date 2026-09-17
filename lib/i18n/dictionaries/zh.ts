import type { Dictionary } from './en'

export const zh: Dictionary = {
  meta: {
    home: {
      title: 'Cookie 转换器 — cookies.txt 转 JSON 在线互转工具',
      description:
        '在线把 Cookie 在 Netscape cookies.txt 与 JSON（Cookie-Editor、Puppeteer、键值对、请求头）之间互相转换，格式自动识别，全部在浏览器本地完成，免费不上传。',
    },
    netscape: {
      title: 'Netscape cookies.txt 格式：七个字段在线详解',
      description:
        'Netscape cookies.txt 的七个制表符字段、#HttpOnly_ 前缀，以及 curl、wget、yt-dlp 如何读写这一格式。',
    },
    json: {
      title: 'JSON Cookie 格式：Cookie-Editor、Puppeteer、键值对、请求头',
      description:
        '导出 Cookie 常见的四种 JSON 结构，附示例与字段对照表，说明 Cookie-Editor、Puppeteer、键值对和请求头各自能保存什么、会丢失什么。',
    },
    privacy: {
      title: '隐私政策 Privacy：本站如何处理你粘贴的 Cookie',
      description:
        '转换器在浏览器本地运行、不上传文件。Claude 会话检查会把加密后的 Cookie 发到本站后端和 Anthropic，本页说明范围与例外。',
    },
    check: {
      title: '在线检测 Claude Cookie：套餐、5小时与每周用量',
      description:
        '粘贴 claude.ai 会话 Cookie（sessionKey），Netscape 或 JSON。页面显示是否有效、套餐，以及 5 小时和每周用量窗口。',
    },
    credential: {
      title: '获取凭证文件：把 Claude Cookie 变成 credentials',
      description:
        '粘贴任意格式的 Claude 会话 Cookie，下载 Claude Code 使用的 ~/.claude/.credentials.json 凭证文件。',
    },
    claudeCodeLogin: {
      title: 'Claude Code 登录失败：session expired /login',
      description:
        'Claude Code 提示 session expired 或 run /login、登录失败时怎么处理：/logout 再 /login、ANTHROPIC_API_KEY 陷阱，以及如何清理 ~/.claude/.credentials.json。',
    },
    claudeUsage: {
      title: 'Claude 限流 usage limits：5 小时额度何时重置',
      description:
        'Claude Pro 与 Max 的限流怎么算：滚动 5 小时窗口和每周额度，在 claude.ai、Claude Code 和 Desktop 之间共享，为什么会「用量已达上限」，以及何时重置。',
    },
  },

  nav: {
    formats: '格式',
    netscapeFormat: 'Netscape cookies.txt',
    jsonFormat: 'JSON 格式',
    faq: '常见问题',
    privacy: '隐私政策',
    check: 'Cookie 测活',
    converter: 'Cookie 转换器',
    getCredential: '获取凭证文件',
    convertShort: '转换器',
    checkShort: '检测',
    credentialsShort: '凭证',
    docs: '文档',
    guides: '指南',
    claudeCodeLogin: 'Claude Code 登录修复',
    claudeUsage: 'Claude 用量限制',
    openMenu: '打开菜单',
    closeMenu: '关闭菜单',
    language: '语言',
    theme: '主题',
    themeLight: '浅色',
    themeDark: '深色',
  },

  hero: {
    eyebrow: 'Cookie 转换器',
    title: '转换 Cookie。',
    subtitle: '不会把它们发到任何地方。',
    formats: 'Netscape cookies.txt ↔ JSON ↔ Cookie-Editor ↔ Puppeteer ↔ Cookie header',
    privacy: '完全在你的浏览器中运行',
  },

  home: {
    formatsTitle: '支持互转的格式',
  },

  converter: {
    inputLabel: '输入',
    outputLabel: '输出',
    detected: '已识别',
    detectedGuess: '推测',
    awaiting: '等待输入',
    unknown: '无法识别',
    convertTo: '转换为',
    convert: '转换 Cookie',
    swap: '交换方向',
    batchSets: '组 Cookie',
    combine: '合并为一个文件',
    separate: '分开显示',
    setWord: '第',
    copy: '复制',
    copyLine: '复制为一行',
    copied: '已复制',
    download: '下载',
    clear: '清空',
    sample: '示例',
    upload: '上传',
    dropHere: '把 Cookie 文件拖到这里',
    dropHint: 'cookies.txt 或 .json',
    placeholder:
      '在这里粘贴你的 Cookie。\n\ncookies.txt 文件、Cookie-Editor 或 Puppeteer 导出的 JSON、简单的 {"name": "value"} 键值对，或者一行 Cookie 请求头，都可以。',
    outputPlaceholder: '转换结果会显示在这里。',
    defaultDomain: '默认域名',
    defaultDomainHint:
      '键值对和 Cookie 请求头不包含域名。在这里填一个，导出的文件才是可用的。',
    defaultDomainPlaceholder: 'example.com',
    fileTooLarge: '文件太大，上限为 2 MB。',
    readError: '无法读取该文件。',
  },

  // Chinese has no grammatical number, so every counter needs only `other`.
  stats: {
    cookies: { other: '条 Cookie' },
    domains: { other: '个域名' },
    expired: { other: '已过期' },
    session: { other: '会话' },
    secure: { other: 'secure' },
    httpOnly: { other: 'http-only' },
  },

  issues: {
    'issue.unknownFormat':
      '这不像任何已知格式。可以试试 Netscape cookies.txt 文件、JSON 导出、键值对，或者 Cookie 请求头。',
    'issue.tooLarge': '输入内容太大，上限为 2 MB。',
    'issue.duplicates':
      '有多条 Cookie 的名称、域名和路径完全相同。它们已被合并，保留最后一条 — 浏览器也是这么处理的。',
    'issue.missingDomain':
      '部分 Cookie 没有域名。请填写默认域名，否则生成的 Netscape 文件无法使用。',
    'issue.lossyTarget':
      '这个格式只保存名称和值。域名、路径、有效期、secure 和 http-only 都会丢失。',
    'issue.nameCollision':
      '两条 Cookie 名称相同但域名或路径不同。这个格式只能保留其中一条。',
    'issue.netscape.badLine': '这一行无法解析为 Cookie。',
    'issue.netscape.missingName': '这一行缺少 Cookie 名称。',
    'issue.netscape.emptyValue':
      '这一行只有六个字段而不是七个，因此值被当作空值读取。',
    'issue.netscape.spacesNotTabs':
      '这个文件中的制表符在某个环节被替换成了空格。已照常解析 — 建议检查各项值是否完整。',
    'issue.netscape.noCookies': '这个文件里没有找到任何 Cookie 行。',
    'issue.json.invalid': '这不是有效的 JSON。',
    'issue.json.unsupportedShape':
      'JSON 解析成功，但它的结构不是已知的 Cookie 格式。',
    'issue.json.notAnObject': '这一项不是对象。',
    'issue.json.missingName': '这一项没有名称，已跳过。',
    'issue.json.missingValue': '这一项没有值，已跳过。',
    'issue.json.empty': '这段 JSON 里没有找到 Cookie。',
    'issue.header.empty': '没有找到任何 name=value 形式的键值对。',
    'issue.header.badPair': '已跳过一段不是 name=value 形式的内容。',
  },

  formats: {
    netscape: { label: 'Netscape', hint: 'cookies.txt — curl、wget、yt-dlp' },
    'cookie-editor': { label: 'Cookie-Editor', hint: 'Chrome 与 Firefox 扩展' },
    puppeteer: { label: 'Puppeteer', hint: 'Puppeteer 与 Playwright' },
    'key-value': { label: '键值对', hint: 'requests、axios' },
    header: { label: '请求头', hint: 'Cookie 请求头' },
  },

  how: {
    title: '如何使用',
    steps: [
      {
        title: '粘贴、拖放或上传',
        body: '把 cookies.txt 拖到面板上，粘贴 JSON 导出，或者粘贴一行 Cookie 请求头。文件由你的浏览器读取，不会再传到别处。',
      },
      {
        title: '格式自动识别',
        body: 'Netscape 通过制表符布局识别，Cookie-Editor 通过 expirationDate 和 storeId 字段识别，Puppeteer 通过 expires 字段识别。输出会自动选择相反的格式。',
      },
      {
        title: '复制或下载',
        body: '把结果复制到剪贴板，或下载为 cookies.txt / cookies.json。点击交换按钮即可反向转换。',
      },
    ],
  },

  faq: {
    title: '常见问题',
    items: [
      {
        q: 'Netscape Cookie 格式是什么？',
        a: '一种纯文本文件，每行一条 Cookie，由七个制表符分隔的字段组成：域名、是否包含子域名、路径、secure 标志、有效期、名称和值。它由 Netscape Navigator 引入，至今仍是 curl、wget 和 yt-dlp 读写的格式。',
      },
      {
        q: '我粘贴的内容会被发送到服务器吗？',
        a: '转换器的输入不会离开你的设备。「检查 Cookie」和凭证页不同：内容先在浏览器里加密，再发到本站后端和 Anthropic。站点还会通过 Yandex Metrika 记录匿名使用统计 — 转换了哪些格式、频率如何。没有 Google Analytics。'
      },
      {
        q: '该选哪种 JSON 格式？',
        a: '要导回浏览器扩展，选 Cookie-Editor；要传给 page.setCookie() 或 context.addCookies()，选 Puppeteer；用于 requests 或 axios 会话，选键值对；只是想粘贴到 curl -H 后面，选请求头。',
      },
      {
        q: '为什么有的行以 #HttpOnly_ 开头？',
        a: '这是 curl 在 cookies.txt 中标记 http-only Cookie 的方式。由于该行以井号开头，不认识它的旧解析器会当作注释安全跳过，而 curl 和 yt-dlp 能够识别。没有这个标志的 Cookie 则按普通方式写入。',
      },
      {
        q: '有效期为 0 或 -1 是什么意思？',
        a: '两者都表示会话 Cookie，即浏览器关闭后失效。Netscape 文件写 0，Puppeteer 写 -1，Cookie-Editor 则省略该字段并把 session 设为 true。这三种写法都能被正确识别，并转换成目标格式所期望的形式。',
      },
      {
        q: '为什么键值对和请求头格式会丢数据？',
        a: '它们只保存名称和值，域名、路径、有效期、secure 和 http-only 没有地方存放。用于给单个请求附带 Cookie 完全够用，但之后若不补充域名，就无法转换回完整的 cookies.txt。',
      },
      {
        q: '可以把浏览器扩展里的 Cookie 用到 yt-dlp 或 curl 上吗？',
        a: '可以，这也是大多数人来到这里的原因。从 Cookie-Editor 导出 JSON，粘贴进来，输出就是一个 Netscape cookies.txt 文件，可以直接传给 yt-dlp --cookies 或 curl -b。',
      },
    ],
  },

  footer: {
    tagline: '一个完全在浏览器本地运行的 Cookie 格式转换器。',
    tools: '工具',
    converter: '转换器',
    checker: '会话检测',
    credentials: '凭证',
    guides: '指南',
    docs: '文档',
    disclaimer:
      '本站与 Anthropic 无任何关联，也未获得其认可。Claude 是 Anthropic PBC 的商标。',
    geoAttribution: 'IP 地理定位数据来自 DB-IP',
    rights: '保留所有权利。',
  },

  localeHint: {
    message: '本页面提供中文版本。',
    accept: '切换',
    dismiss: '留在此页',
  },

  check: {
    eyebrow: '检测会话',
    title: '这个 Claude 会话还有效吗？',
    subtitle:
      '粘贴 Netscape 或 JSON 导出。检查会读取账号、套餐，以及 5 小时和每周用量窗口——和 Claude 设置里看到的数字一样。',
    inputLabel: 'Cookie 文件',
    placeholder: 'Netscape cookies.txt 或 JSON 数组。需要 sessionKey / sessionKeyV3。可一次粘贴多条批量检测。',
    submit: '检测会话',
    checking: '正在检查…',
    clear: '清空',
    batchHeading: '已检测',
    valid: '会话有效',
    invalid: '会话无效',
    trustEncrypt: '在浏览器中加密',
    trustSend: '仅用于检测',
    trustLine: '发送前在浏览器中加密',
    formatsHint: 'Netscape · JSON · sessionKey',
    reasons: {
      empty: '请先粘贴 Cookie 文件。',
      missing_session: '文件里没有 Claude 的 sessionKey。',
      expired: 'Claude 拒绝了这个会话。请从已登录的浏览器重新导出。',
      unreachable: 'Claude 没有应答。请稍后再试。',
      rate_limited: '这个地址检查太频繁。请等一分钟再试。',
    },
    email: '邮箱',
    name: '名称',
    plan: '套餐',
    session: '会话用量（5 小时）',
    weekly: '每周用量',
    used: '已用',
    resets: '重置于',
    unknownWindow: 'Claude 没有返回这个窗口',
    error: '检查没有完成。请再试一次。',
    readsTitle: '这个检查会读取什么',
    reads: [
      {
        title: '账号与套餐',
        body: '会话对应的邮箱，以及它属于哪个 Claude 套餐——Free、Pro 或 Max。',
      },
      {
        title: '5 小时窗口',
        body: '当前 5 小时用量窗口已用掉多少，以及何时重置。',
      },
      {
        title: '每周窗口',
        body: '付费套餐还有一个滚动的每周限额，这里同样会显示已用比例和重置时间。',
      },
    ],
    formatsTitle: '支持的格式',
    formatsBody:
      'Netscape cookies.txt 导出、JSON Cookie 数组（Cookie-Editor 或 Puppeteer），或原始的 Cookie: 请求头。只需要 sessionKey / sessionKeyV3。',
    privacyNote: '粘贴内容会在浏览器中加密，再发到本站后端和 Anthropic 以完成检测。',
    privacyLink: '如何处理这些数据',
    howTitle: '如何获取 Claude 会话 Cookie',
    howSteps: [
      {
        title: '在已登录的浏览器打开 claude.ai',
        body: '打开 DevTools（F12）→ Application → Cookies → https://claude.ai，复制 sessionKey（或 sessionKeyV3）的值。也可以用 Cookie-Editor 扩展 → Export → JSON 一次性导出整份。',
      },
      {
        title: '粘贴到上方',
        body: '把 cookies.txt 或 JSON 导出拖到输入框，或只粘贴 sessionKey 那一行。内容会先在浏览器里加密再发送 — 只需要 sessionKey / sessionKeyV3。',
      },
      {
        title: '查看结果',
        body: '测活会用这条 Cookie 向 Claude 发起请求，显示会话是否仍然有效、账号邮箱与套餐（Free、Pro 或 Max），以及 5 小时和每周用量还剩多少。',
      },
    ],
    faqTitle: 'Claude Cookie 与会话 — 常见问题',
    faq: [
      {
        q: 'Claude 的 sessionKey 是什么？',
        a: '这是你登录后 claude.ai 设置的 Cookie — 一个长令牌（sessionKey，或较新的 sessionKeyV3），用于验证你的浏览器会话。任何拿到它的人都能以你的账号操作，所以要像密码一样对待。Claude Code 把等价凭证以 OAuth 令牌形式存在 ~/.claude/.credentials.json，而不是这条 Cookie。',
      },
      {
        q: 'sessionKey 还是 sessionKeyV3，用哪个？',
        a: '哪个都行。两者都是 claude.ai 的会话 Cookie，sessionKeyV3 更新，有些账号两者都有。测活会读取存在的那一个 — 只需要其中之一。',
      },
      {
        q: 'Claude 的 sessionKey 能用多久？',
        a: '大约 30 天，除非提前失效。当你退出登录、修改密码或结束其他会话时它会轮换，旧值随即失效，之后需要重新导出。',
      },
      {
        q: '测活会让 Cookie 失效吗？',
        a: '不会。测活只读取账号、套餐和用量窗口，不会让你退出登录，也不会轮换密钥。它只发一个轻量请求，和 claude.ai 绘制用量页面时发的一样。',
      },
      {
        q: '为什么 Claude 提示「会话已过期」或「run /login」？',
        a: 'Claude 持有的令牌已失效。常见原因：到期（约 30 天的 Cookie，或后台刷新失败的访问令牌）、你改了密码、在别处退出、管理员吊销了会话，或系统时钟不对。在 Claude Code 里还要检查 ANTHROPIC_API_KEY 环境变量 — 它会与订阅登录冲突。可靠的修复：先 /logout 再 /login；如果反复出现，删除 ~/.claude/.credentials.json 后重新登录。',
      },
      {
        q: '5 小时和每周窗口是什么意思？',
        a: 'Claude Pro 和 Max 用两种方式计量：滚动的 5 小时会话窗口和固定的每周窗口，而且这份用量在 claude.ai、Claude Code 和 Claude Desktop 之间共享。5 小时窗口在你发出第一条消息后 5 小时重置；每周窗口在 Settings → Usage 显示的固定日期与时间重置。测活会显示各自已用多少。',
      },
      {
        q: '这条 Cookie 能用在 Claude Code 上吗？',
        a: 'Claude Code 通过自己的 OAuth 流程（/login）登录，凭证存在 ~/.claude/.credentials.json，而不是粘贴的 Cookie。本页测活的是 claude.ai 浏览器会话 — 同一个账号 — 因此可用来确认会话是否还活着，并查看 Claude Code 将受到的套餐与限额。',
      },
      {
        q: '在这里粘贴 Cookie 安全吗？',
        a: '转换器的输入不会离开你的设备。会话测活不同：它必须把 Cookie 发到本站后端和 Anthropic，所以内容会先在浏览器里加密。只粘贴你自己掌控的账号的 Cookie，并请阅读隐私政策了解具体处理方式。',
      },
    ],
  },

  credential: {
    inputLabel: 'Cookie 文件',
    placeholder:
      'Netscape cookies.txt 或 JSON 数组。需要 sessionKey / sessionKeyV3。可一次粘贴多条批量检测。',
    submit: '验证会话',
    checking: '检测中…',
    converting: '正在生成…',
    clear: '清除',
    convert: '生成凭证',
    cancel: '取消',
    stepPaste: '粘贴',
    stepVerify: '验证',
    stepGenerate: '生成',
    pasteTitle: '粘贴你的 Claude Cookie',
    verified: '会话已验证',
    ready: '凭证已就绪',
    placeAt: '放到',
    captchaHint: '完成下方验证后开始转换。',
    resultTitle: '凭证文件',
    copy: '复制',
    copied: '已复制',
    save: '下载文件',
    secretNote:
      '这是有效登录凭证。保存为 ~/.claude/.credentials.json，并像对待密码一样保管。用完后请关闭标签页。',
    batchHeading: '已检测',
    error: '转换未完成，请重试。',
    reasons: {
      empty: '请先粘贴 Cookie 文件。',
      missing_session: '文件里没有 Claude 的 sessionKey。',
      expired: 'Claude 拒绝了此会话。请从已登录的浏览器重新导出。',
      unreachable: 'Claude 没有响应，请稍后再试。',
      rate_limited: '此地址尝试次数过多，请稍等一分钟再试。',
      captcha_failed: '验证未通过，请重试。',
      convert_failed: '会话有效，但无法生成凭证文件。',
    },
  },

  moreTools: {
    title: '更多工具',
    checkTitle: '检测 Claude 会话',
    checkBody: '验证会话并查看套餐与用量限额。',
    checkCta: '打开检测',
    credTitle: '创建 Claude 凭证',
    credBody: '把有效会话变成 .credentials.json',
    credCta: '创建凭证',
  },

  common: {
    skipToContent: '跳到主要内容',
    home: '首页',
    tools: '工具',
    cookieFormats: 'Cookie 格式',
    minRead: '分钟阅读',
    guideBadge: '指南',
    onThisPage: '本页目录',
    example: '示例',
    field: '字段',
    meaning: '含义',
    values: '取值',
    format: '格式',
    usedBy: '哪些工具在用',
    storesDomain: '域名',
    storesExpiry: '有效期',
    storesFlags: '标志位',
    yes: '是',
    no: '否',
    tryIt: '在转换器中试试',
  },

  pages: {
    netscape: {
      title: 'Netscape cookies.txt 格式',
      intro:
        '所有命令行工具至今仍在使用的格式。每条 Cookie 占一行，共七个字段，用制表符分隔 — 不是空格。以 # 开头的行是注释，只有一个刻意设计的例外。',
      chips: ['7 个字段', '制表符分隔', '每行一条 Cookie'],
      tabWarningTitle: '制表符，不要空格',
      tabWarningBody: '严格的解析器可能会拒绝制表符被换成空格的文件。',
      fieldsTitle: '七个字段',
      fields: [
        {
          name: 'domain',
          meaning: 'Cookie 所属的主机。开头的点表示它同样作用于子域名。',
          values: '.example.com',
        },
        {
          name: 'includeSubdomains',
          meaning: '是否包含子域名。与开头的点含义重复，各解析器对以哪个为准并不一致 — 本站以点为准。',
          values: 'TRUE 或 FALSE',
        },
        {
          name: 'path',
          meaning: 'Cookie 生效的 URL 路径。',
          values: '/ 或 /app',
        },
        {
          name: 'secure',
          meaning: '是否仅通过 HTTPS 发送。',
          values: 'TRUE 或 FALSE',
        },
        {
          name: 'expires',
          meaning: '以秒为单位的 Unix 时间戳。0 表示会话 Cookie。',
          values: '1767225600 或 0',
        },
        { name: 'name', meaning: 'Cookie 名称。', values: 'session_id' },
        {
          name: 'value',
          meaning: 'Cookie 的值，原样取到行尾，其中可以自由包含 = 和 ;。',
          values: 'abc123',
        },
      ],
      httpOnlyTitle: '#HttpOnly_ 前缀',
      httpOnlyBody:
        '原始格式无法表达 http-only 属性，于是 curl 增加了一种写法：在域名前加上 #HttpOnly_ 前缀。由于该行以井号开头，不理解它的解析器会把它当成注释跳过，而不会报错。curl、wget 和 yt-dlp 都能识别这个前缀。',
      gotchasTitle: '容易踩的坑',
      gotchas: [
        '分隔符是制表符。通过聊天窗口或网页表单转发文件时，制表符经常被换成空格，严格的解析器就会失败。本转换器仍会解析这类文件，并给出提示。',
        '值一直延伸到行尾，因此可以不转义地包含 = 和 ;。按这些字符切分会破坏 JWT 和 base64 内容。',
        '有效期已过的行依然是合法的。工具只会忽略这条 Cookie，看起来就跟它不存在一模一样。',
        '有些程序在值为空时会省略末尾的制表符，于是只剩下六个字段而不是七个。',
        '缺少 Netscape 文件头或制表符时，yt-dlp 等工具会报 “does not look like a netscape format cookies file”。粘到这里即可下载规范化后的 cookies.txt。',
      ],
      toolsTitle: '使用这一格式的工具',
      tools: [
        { name: 'curl', body: 'curl -b cookies.txt 发送，-c cookies.txt 保存。' },
        { name: 'wget', body: '--load-cookies 与 --save-cookies。' },
        { name: 'yt-dlp', body: '--cookies cookies.txt，这也是转换浏览器导出文件最常见的原因。' },
        { name: 'Python requests', body: '通过 http.cookiejar.MozillaCookieJar 使用。' },
      ],
    },

    json: {
      title: 'JSON Cookie 格式',
      intro:
        'Cookie 并没有统一的 JSON 格式。常见的有四种结构，它们能保存的信息量各不相同。下面是每一种的样子和它的能力边界。',
      mappingTitle: '各格式能保存什么',
      formatsTitle: '四种结构',
      entries: [
        {
          id: 'cookie-editor',
          tab: 'Cookie-Editor',
          title: 'Cookie-Editor 与 EditThisCookie',
          body: '浏览器扩展导出的格式，是四者中最完整的：保存了浏览器 Cookie 的全部属性，包括 hostOnly 和 session 标志。sameSite 使用 no_restriction、lax、strict 和 unspecified 这几个词。',
          usedBy: 'Cookie-Editor、EditThisCookie、Cookie Quick Manager',
        },
        {
          id: 'puppeteer',
          tab: 'Puppeteer',
          title: 'Puppeteer 与 Playwright',
          body: 'page.setCookie() 和 context.addCookies() 接受的格式。有效期字段名为 expires，会话 Cookie 用 -1 表示。sameSite 采用 HTTP 写法：None、Lax 和 Strict。省略 sameSite 会让浏览器应用自己的默认值，因此当它是 unspecified 时我们不写这个字段。',
          usedBy: 'Puppeteer、Playwright、各类 Selenium 封装',
        },
        {
          id: 'key-value',
          tab: '键值对',
          title: '键值对',
          body: '一个由名称到值的扁平对象，也就是传给 requests 会话或 axios 配置的东西。除此之外它什么都不保存 — 没有域名，没有有效期，没有标志位。',
          usedBy: 'Python requests、axios、各类 fetch 封装',
        },
        {
          id: 'header',
          tab: '请求头',
          title: 'Cookie 请求头字符串',
          body: '严格来说不是 JSON，但属于同一个话题：Cookie 请求头的字面值。各键值对之间用分号加空格连接。这正是你粘贴到 curl -H 之后或 Postman 里的内容。',
          usedBy: 'curl、Postman、HTTPie、浏览器开发者工具',
        },
      ],
      lossTitle: '格式之间转换会丢失信息',
      lossBody:
        '从完整格式转成键值对或请求头是单向的：域名、路径、有效期和标志位无处存放。再转回来，得到的是会话 Cookie，域名取决于你填写的内容。当某次转换会丢数据时，转换器会给出提示。',
    },

    privacy: {
      title: '隐私政策',
      updated: '最后更新',
      intro:
        'Cookie 就是凭证。一条会话 Cookie 往往就足以让别人以你的身份登录。转换器的输入不会离开你的设备。会话检测和凭证工具会在浏览器中加密粘贴内容，再发到本站和 Anthropic。',
      summary: [
        { label: '转换器', note: '不会离开你的浏览器', leaves: false },
        { label: '会话检测', note: '加密后发送以完成检测', leaves: true },
        { label: '凭证', note: '在服务端验证，不存储令牌', leaves: true },
      ],
      flows: {
        converterTitle: '转换器',
        converterSteps: ['你的浏览器', '解析 / 转换', '输出'],
        converterNote: '不会离开你的设备',
        checkTitle: '会话检测与凭证',
        checkSteps: ['你的浏览器', '加密后的内容', '本站后端', 'Anthropic', '结果'],
        checkNote: '发送前在浏览器中加密',
      },
      sections: [
        {
          title: '转换在你的浏览器里完成',
          body: '本站所有解析与序列化代码都是运行在你机器上的 JavaScript。Cookie 的解析和格式化完全在你的设备上完成，而不是在服务器上。'
        },
        {
          title: 'Claude 会话检查会离开浏览器',
          body: '「检查 Cookie」页会把加密后的内容发到本站自己的后端。后端用这条会话 Cookie 向 Claude 读取账号、套餐和用量窗口。',
        },
        {
          title: '获取凭证文件同样会离开浏览器',
          body: '凭证页会先做同一次加密检测。如果你接着转换，内容会发到本站后端和 Anthropic，以便生成 Claude Code 凭证文件。文件回到你的浏览器。OAuth 令牌不会存在服务器上。转换前需通过 Cloudflare Turnstile 验证。',
        },
        {
          title: '匿名使用统计',
          body: '站点会通过 Yandex Metrika 记录关于使用情况的匿名统计 — 转换了哪些格式、频率如何。没有 Google Analytics，也不会为此保存能识别你的信息。',
        },
        {
          title: '没有第三方追踪器',
          body: '这里没有 Google Analytics，也没有标签管理器。本站用 Yandex Metrika 做自有统计：浏览量和本站转化目标。本站自己设置的唯一一条 Cookie 是 cclang，用来记住你选择的语言，好让你下次访问时不会被地理定位重定向。它的取值只有三种：en、ru 或 zh。',
        },
        {
          title: '服务器会记录什么',
          body: 'Web 服务器会保留标准访问日志 — IP 地址、时间戳、请求路径、User-Agent。日志里不包含粘贴内容。转换器的输入不会离开你的设备。检测和凭证页的内容会在发送前于浏览器中加密。',
        },
        {
          title: '语言与地理定位',
          body: 'Web 服务器使用离线数据库从 IP 地址推断出大致所在国家，仅用于在首次访问时打开对应语言的页面。位置数据不会被保存，也不会发送给任何第三方地理定位服务。',
        },
        {
          title: '不过还是要谨慎',
          body: '如果你粘贴的是重要账号的有效会话 Cookie，用完请关闭标签页，并记住复制过的内容仍留在剪贴板里。对待导出的 Cookie 文件，应当像对待密码文件一样。',
        },
      ],
      disclaimerTitle: '本站与 Anthropic 无关',
      disclaimerBody:
        '这是一个独立的开放工具，并非由 Anthropic PBC 制作，未获其认可，也与其没有任何关联。Claude 是 Anthropic PBC 的商标，此处仅用于指代。',
    },

    credential: {
      title: '创建凭证文件',
      badge: 'Claude Code',
      intro:
        '先验证账号，再根据 Claude 会话生成 ~/.claude/.credentials.json。',
      leadTitle: '如何使用',
      steps: [
        {
          title: '粘贴 Cookie',
          body: '支持 Netscape、JSON 或原始 Cookie 请求头。只需 sessionKey 或 sessionKeyV3。可一次检测多组。',
        },
        {
          title: '确认会话',
          body: '有效内容会先显示邮箱、套餐以及 5 小时和每周限额，然后才开始转换。',
        },
        {
          title: '转换并保存',
          body: '通过验证后复制或下载 .credentials.json，放到 ~/.claude/.credentials.json。',
        },
      ],
      note: '只粘贴你自己掌控的会话。凭证文件是有效登录：像对待密码一样保管，用完后关闭标签页。',
    },

    claudeCodeLogin: {
      title: 'Claude Code 老是掉登录：解决「session expired, run /login」',
      intro:
        'Claude Code 在任务中途停下并提示「Your session has expired. Please run /login」，或者每隔几小时就悄悄退回登录界面。下面解释这条消息到底意味着什么，以及从简单到彻底的修复顺序。',
      updated: '2026-09-14',
      readMinutes: 6,
      sections: [
        {
          title: '「会话已过期」到底是什么意思',
          body:
            'Claude Code 并不会在每个请求里发送你的密码。当你运行 /login 完成浏览器登录后，它会把一个 OAuth 令牌存到 ~/.claude/.credentials.json（或系统钥匙串）。这个访问令牌有效期很短，靠一个更长效的刷新令牌在后台续期。\n\n「Your session has expired. Please run /login」意味着 Claude Code 持有的令牌已失效，而后台续期被拒绝了。这不是你代码或提示词的 bug，而是需要重新建立的登录状态。',
        },
        {
          title: '最常见有效的做法：先 /logout 再 /login',
          body:
            '在 Claude Code 里运行 /login 并完成浏览器登录。如果单独 /login 不生效，先 /logout 丢弃过期凭证，再从干净状态 /login。一个干净的 logout→login 循环能解决绝大多数情况。\n\n如果浏览器步骤打开却无法完成，把授权链接复制到一个已登录 claude.ai 的浏览器里确认，再把返回的代码粘贴回终端。',
        },
        {
          title: '如果反复出现或几小时后又掉',
          body:
            '当 /login 成功、却很快又被登出时，是续期本身失败了。常见原因：你改了 Anthropic 密码、在别处退出了 claude.ai（或「退出所有会话」）、账号或管理员吊销了会话、机器休眠或离线超过了续期窗口，或者系统时钟不对——时钟漂移会让有效令牌看起来像过期。\n\n先解决根因：把时钟设为自动同步，Claude Code 运行时别在网页端退出全部会话。然后做一次干净的 /logout → /login。',
        },
        {
          title: 'ANTHROPIC_API_KEY 陷阱',
          body:
            '登录「留不住」最常见的原因，是 shell 配置里设了 ANTHROPIC_API_KEY 环境变量。Claude Code 会优先用 API Key 而不是你的订阅登录，而这个按量计费的 Key 可能已过期、撞了限额或权限不同——于是表现为鉴权错误，尽管你的订阅其实没问题。\n\n检查一下：`echo $ANTHROPIC_API_KEY`（macOS/Linux）或 `echo %ANTHROPIC_API_KEY%`（Windows）。如果它被设了、而你本想用 Pro/Max 订阅，就从 shell 配置（~/.zshrc、~/.bashrc 或 Windows 环境变量）里删掉它，重启终端后再 /login。',
        },
        {
          title: '最后手段：删除凭证文件',
          body:
            '如果 /logout → /login 仍然反复，说明保存的凭证损坏了——可能是写了一半的 ~/.claude/.credentials.json，或 macOS 钥匙串里被锁定、不可写的条目。关闭 Claude Code，删除 ~/.claude/.credentials.json，重新打开并运行 /login 从头登录。在 macOS 上你可能还需要在「钥匙串访问」里删掉「Claude Code」条目。\n\n这个文件里是实时凭证：像对待密码文件一样对待它，绝不要把它的内容贴进聊天或截图。',
        },
        {
          title: '先确认你的会话到底还活着没',
          body:
            '在花时间修复之前，先弄清底层的 claude.ai 会话是否还有效——也就是 Claude Code 登录的同一个账号。导出你的 claude.ai 会话 Cookie，用下方的检测跑一下：几秒内就能知道会话是否有效、是什么套餐、5 小时和每周限额还剩多少，从而把「会话过期」和「撞了用量限额」区分开。',
        },
      ],
      faqTitle: 'Claude Code 登录 — 常见问题',
      faq: [
        {
          q: 'Claude Code 一次登录能维持多久？',
          a: '/login 背后的刷新令牌大约能维持 30 天的活跃期，但它签发的访问令牌很短、在后台续期。正常情况下你每隔几周才需要重新 /login——如果是每隔几小时，说明有东西在阻止续期（见上文 ANTHROPIC_API_KEY 和时钟的原因）。',
        },
        {
          q: '重装 Claude Code 能修好登录吗？',
          a: '基本不能——重装不会清掉 ~/.claude/.credentials.json，损坏的凭证依旧在。删除该文件（或钥匙串条目）再 /login 才是对症的做法；只有二进制本身坏了才需要重装。',
        },
        {
          q: '出现这种情况会扣订阅的钱吗？',
          a: '不会。会话/登录错误不消耗用量也不花钱。但如果设了 ANTHROPIC_API_KEY，Claude Code 可能在按 token 计费那个 API Key，而不是用你的订阅——如果你本想用 Pro 或 Max，这就是删掉它的理由。',
        },
        {
          q: 'API Key 还是订阅登录，用哪个？',
          a: '在 Pro/Max 上做交互式编码，用订阅登录（/login）并确保 ANTHROPIC_API_KEY 未设置。只有在需要按量计费、无浏览器步骤的自动化或 CI 里，才用 API Key。',
        },
        {
          q: '为什么休眠或挂 VPN 后 Claude Code 会掉登录？',
          a: '机器休眠或离线超过续期窗口会让令牌失效，而 VPN 或代理可能让续期请求失败、或看起来像新的登录地点。重新联网、确认时钟正确，然后在稳定连接下 /login 一次。',
        },
      ],
      sourcesTitle: '参考来源',
      sources: [
        { label: 'Claude Code — 错误参考（code.claude.com/docs）', url: 'https://code.claude.com/docs/en/errors' },
        { label: 'Anthropic 帮助中心 — 登录 Claude Code', url: 'https://support.anthropic.com/' },
      ],
      ctaTitle: '你的 Claude 会话还活着吗？',
      ctaBody:
        '粘贴你的 claude.ai 会话 Cookie，几秒内就能知道它是否有效、什么套餐，以及 5 小时和每周用量还剩多少。',
      ctaLabel: '检测 Cookie',
    },

    claudeUsage: {
      title: 'Claude 限流与用量：5 小时和每周窗口何时重置',
      intro:
        'Claude Pro 和 Max 用两个不同的窗口限制用量，而毫无缘由地看到「Claude usage limit reached」是最常见的困扰之一。下面讲清两个限制到底怎么运作、为什么共享额度比你以为的掉得快，以及各自何时重置。',
      updated: '2026-09-14',
      readMinutes: 8,
      sections: [
        {
          title: '两个限制：滚动的 5 小时窗口和固定的每周窗口',
          body:
            '每个付费 Claude 套餐都同时用两种方式计量。5 小时窗口是滚动的会话限制：从你的第一条消息开始，限制接下来五小时内的用量。每周窗口是另一个更大的、按七天计的额度。\n\n两个都可能撞上。撞到 5 小时上限会暂停你几个小时；撞到每周上限则要等到本周重置，等五小时并不能恢复。',
        },
        {
          title: '这是 claude.ai、Claude Code 和 Desktop 共享的一个额度',
          body:
            '最出乎意料的一点：用量不是按应用分别计的。claude.ai 网页版、Claude Code 和桌面版 Claude 里的消息都从同一个额度扣。上午在 Claude Code 里密集用一场，下午可能就在网页端被限流了。\n\n模型选择也很关键——Opus 级别的模型消耗额度远比小模型快，所以用最大模型的 Max 用户会撞到 Pro 用户很少见到的限制。',
        },
        {
          title: '什么时候重置？',
          body:
            '5 小时窗口在开启它的第一条消息之后五小时重置——它是滚动的，也就是永远是「从你开始算起五小时」，而不是某个固定钟点。\n\n每周窗口按绑定到账号的固定日程重置，不滚动。具体日期和时间显示在 claude.ai 的 Settings → Usage（例如「周六 00:30」）；它因账号而异，没有统一的重置时刻。如果撞到每周上限，只有这个固定的每周重置能恢复它。',
        },
        {
          title: 'Pro、Max 5× 与 Max 20×',
          body:
            '套餐的主要差别在于这些窗口有多大。Pro（$20/月）面向日常对话和轻量编码。Max 的 5× 和 20× 把额度成倍放大，面向密集的 Claude Code 使用。因为所有东西共享一个额度，实际要问的不是「哪个应用」，而是「总共用了多少、用的哪个模型」——Claude Code 里的 /cost 命令会显示当前会话的花费。',
        },
        {
          title: '现在就看看你自己的用量',
          body:
            '真正重要的是你自己的数字，而看它们并不需要打开 claude.ai。导出你的 claude.ai 会话 Cookie，用下方的检测跑一下——它会显示你的套餐，以及 5 小时和每周窗口各用了多少、何时重置。这是判断你到底是撞了限额还是只是遇到临时错误的最快方式。',
        },
      ],
      faqTitle: 'Claude 用量限制 — 常见问题',
      faq: [
        {
          q: '为什么这么快就撞到每周上限？',
          a: '几乎都是因为每周额度在 claude.ai、Claude Code 和 Desktop 之间共享，而用大模型（Opus 级）的 Claude Code 会话会很快耗掉它。用 Claude Code 里的 /cost 看看是什么在消耗，日常工作可以考虑换小一点的模型。',
        },
        {
          q: '换成小一点的模型有用吗？',
          a: '有用。小/快的模型消耗共享额度比最大模型慢得多，所以日常改动换用它能明显拉长你的 5 小时和每周窗口。',
        },
        {
          q: 'API 也有同样的限制吗？',
          a: '没有。5 小时和每周窗口针对 Pro/Max 订阅。API 按 token 单独计费（按量付费）——这也是为什么在 shell 里设了 ANTHROPIC_API_KEY 可能会悄悄扣你的钱，而不是走订阅。',
        },
        {
          q: '不打开 claude.ai 能查用量吗？',
          a: '能——把会话 Cookie 粘进本站的检测，它会显示套餐和两个用量窗口。读的是和 claude.ai 在 Settings → Usage 里一样的数字。',
        },
        {
          q: '5 小时和每周的重置有什么区别？',
          a: '5 小时窗口是滚动的（第一条消息后五小时）；每周窗口固定在你账号的某个日期和时间，显示在 Settings → Usage。撞到每周上限只能靠那个固定的每周重置来清除。',
        },
      ],
      sourcesTitle: '参考来源',
      sources: [
        { label: 'Anthropic 帮助中心 — 用量限制', url: 'https://support.anthropic.com/' },
        { label: 'Claude Code — 花费与 /cost 命令（code.claude.com/docs）', url: 'https://code.claude.com/docs/en/costs' },
      ],
      ctaTitle: '你的额度还剩多少？',
      ctaBody:
        '粘贴你的 claude.ai 会话 Cookie，查看套餐以及 5 小时和每周窗口各用了多少、何时重置。',
      ctaLabel: '查看用量',
    },
  },
}
