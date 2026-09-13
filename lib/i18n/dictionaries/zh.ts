import type { Dictionary } from './en'

export const zh: Dictionary = {
  meta: {
    home: {
      title: 'Cookie 转换器 — Netscape cookies.txt 与 JSON 互转',
      description:
        '在 Netscape cookies.txt 与 JSON（Cookie-Editor、Puppeteer、键值对、请求头）之间转换 Cookie，格式自动识别，全部在浏览器本地完成。',
    },
    netscape: {
      title: 'Netscape cookies.txt 格式逐字段详解',
      description:
        'Netscape cookies.txt 文件中七个制表符分隔字段的含义、#HttpOnly_ 前缀的工作方式，以及哪些工具读写这一格式。',
    },
    json: {
      title: 'JSON Cookie 格式：Cookie-Editor、Puppeteer、键值对、请求头',
      description:
        '导出 Cookie 常见的四种 JSON 结构，附示例与字段对照表，说明每种格式能保存什么、会丢失什么。',
    },
    privacy: {
      title: '隐私 — 你粘贴的内容不会离开浏览器',
      description:
        'claudecookie.com 如何处理你的数据：Cookie 在你的浏览器中转换，站点只保留匿名的使用统计。',
    },
  },

  nav: {
    formats: '格式',
    netscapeFormat: 'Netscape cookies.txt',
    jsonFormat: 'JSON 格式',
    faq: '常见问题',
    privacy: '隐私',
    openMenu: '打开菜单',
    closeMenu: '关闭菜单',
    language: '语言',
    theme: '主题',
    themeLight: '浅色',
    themeDark: '深色',
  },

  hero: {
    eyebrow: 'Cookie 转换器',
    title: '把 Cookie 变成你需要的格式。',
    subtitle:
      'Netscape cookies.txt 与 JSON 互转 — Cookie-Editor、Puppeteer、键值对，或者一行 Cookie 请求头。粘贴进来，格式会自动识别。',
    privacy: '转换全部在你的浏览器中完成。',
  },

  converter: {
    inputLabel: '输入',
    outputLabel: '输出',
    detected: '已识别',
    detectedGuess: '推测',
    awaiting: '等待输入',
    unknown: '无法识别',
    convertTo: '转换为',
    convert: '转换',
    swap: '交换方向',
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
        a: '转换本身完全由浏览器中的 JavaScript 完成。站点会记录匿名的使用统计 — 转换了哪些格式、频率如何 — 以便了解使用情况。没有任何第三方统计或追踪器。',
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
    reference: '参考',
    about: '关于',
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

  common: {
    skipToContent: '跳到主要内容',
    backToConverter: '返回转换器',
    onThisPage: '本页目录',
    example: '示例',
    field: '字段',
    meaning: '含义',
    values: '取值',
    format: '格式',
    usedBy: '使用场景',
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
          title: 'Cookie-Editor 与 EditThisCookie',
          body: '浏览器扩展导出的格式，是四者中最完整的：保存了浏览器 Cookie 的全部属性，包括 hostOnly 和 session 标志。sameSite 使用 no_restriction、lax、strict 和 unspecified 这几个词。',
          usedBy: 'Cookie-Editor、EditThisCookie、Cookie Quick Manager',
        },
        {
          id: 'puppeteer',
          title: 'Puppeteer 与 Playwright',
          body: 'page.setCookie() 和 context.addCookies() 接受的格式。有效期字段名为 expires，会话 Cookie 用 -1 表示。sameSite 采用 HTTP 写法：None、Lax 和 Strict。省略 sameSite 会让浏览器应用自己的默认值，因此当它是 unspecified 时我们不写这个字段。',
          usedBy: 'Puppeteer、Playwright、各类 Selenium 封装',
        },
        {
          id: 'key-value',
          title: '键值对',
          body: '一个由名称到值的扁平对象，也就是传给 requests 会话或 axios 配置的东西。除此之外它什么都不保存 — 没有域名，没有有效期，没有标志位。',
          usedBy: 'Python requests、axios、各类 fetch 封装',
        },
        {
          id: 'header',
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
      title: '隐私',
      updated: '最后更新',
      intro:
        'Cookie 就是凭证。一条会话 Cookie 往往就足以让别人以你的身份登录。因此做这个工具唯一诚实的方式，就是让数据根本不离开你的设备 — 而且这一点应当可以被验证，而不是只能选择相信。',
      sections: [
        {
          title: '转换在你的浏览器里完成',
          body: '本站所有解析与序列化代码都是运行在你机器上的 JavaScript。当你粘贴 Cookie 并点击「转换」时，不会发出任何请求。这里没有 API，没有服务端处理，也没有任务队列。',
        },
        {
          title: '匿名使用统计',
          body: '站点会记录关于使用情况的匿名统计 — 转换了哪些格式、频率如何。仅为自有统计：没有 Google Analytics，没有第三方追踪器，也没有任何能识别你的信息。',
        },
        {
          title: '没有第三方追踪器',
          body: '这里没有 Google Analytics，没有 Yandex Metrica，没有标签管理器，也没有任何第三方脚本。本站设置的唯一一条 Cookie 是 cclang，用来记住你选择的语言，好让你下次访问时不会被地理定位重定向。它的取值只有三种：en、ru 或 zh。',
        },
        {
          title: '服务器会记录什么',
          body: 'Web 服务器会保留标准访问日志 — IP 地址、时间戳、请求路径、User-Agent。任何 Web 服务器都会这么做，运维也离不开它。这些日志能记录页面被请求过，却无法记录你在页面里粘贴了什么，因为那些内容根本不会到达服务器。',
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
  },
}
