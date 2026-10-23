/* ==========================================================================
   UniAI — Language switcher (i18n.js)
   English · 日本語 · 한국어 · 中文 (Simplified)

   A standalone add-on. It needs NO changes to index.html, main.css or the
   other scripts except one script tag, placed AFTER security.js:

     <script src="JS/i18n.js"></script>

   How it works
   - A dictionary maps the exact English text on the page to Japanese, Korean
     and Chinese. Text nodes AND placeholder / title / aria-label / alt
     attributes are translated, including content other scripts add later
     (a MutationObserver watches for it).
   - The original English is remembered, so switching back to English is
     exact. Text that is not in the dictionary simply stays English.
   - The choice is saved in localStorage ("uniai-language") and restored on
     the next visit. It is kept on this device and is not synced.
   - The switcher injects its own button (top bar) and its own CSS.

   Growing the dictionary
   - Open the site in a language, then run in the console:
         UniAII18n.missing()
     It lists every visible English string that has no translation yet.
   - Add entries in the DICT below, or at runtime:
         UniAII18n.extend({ "Some text": ["日本語", "한국어", "中文"] })
   - A key containing {x} is a template, e.g. "Avg. Cost: {x}" matches
     "Avg. Cost: $20,000/yr" and keeps whatever {x} captured.
   - Add data-no-translate to any element you never want translated.

   For other scripts:
       UniAII18n.t("Saved")                   // translated string, for JS-built UI
       window.addEventListener("uniai:language-change", e => e.detail.lang)
   ========================================================================== */

(function () {
  "use strict";

  const STORE_KEY = "uniai-language";

  const LANGS = [
    { code: "en", label: "English", short: "EN", html: "en" },
    { code: "ja", label: "日本語", short: "JA", html: "ja" },
    { code: "ko", label: "한국어", short: "KO", html: "ko" },
    { code: "zh", label: "中文", short: "中", html: "zh-CN" }
  ];

  // Column order for every DICT entry: [ja, ko, zh]
  const COL = { ja: 0, ko: 1, zh: 2 };

  /* ------------------------------------------------------------------------
     Dictionary: "English" : [日本語, 한국어, 中文]
     ------------------------------------------------------------------------ */

  const DICT = {
    /* page title + navigation */
    "UniAI — Plan Smarter. Go Farther.": [
      "UniAI — もっと賢く計画、もっと遠くへ。",
      "UniAI — 더 똑똑하게 계획하고, 더 멀리 나아가세요.",
      "UniAI — 更聪明地规划，走得更远。"
    ],
    "Home": ["ホーム", "홈", "首页"],
    "University Finder": ["大学検索", "대학 찾기", "大学查找"],
    "Scholarships": ["奨学金", "장학금", "奖学金"],
    "Study Abroad Guide": ["留学ガイド", "유학 가이드", "留学指南"],
    "AI Assistant": ["AIアシスタント", "AI 어시스턴트", "AI 助手"],
    "Visa Guide": ["ビザガイド", "비자 가이드", "签证指南"],
    "SOP & LOR Tools": ["SOP・推薦状ツール", "SOP·추천서 도구", "SOP 与推荐信工具"],
    "AI Free Jobs": ["AIフリー求人", "AI 프리 일자리", "AI 自由职业"],
    "Roadmap": ["ロードマップ", "로드맵", "路线图"],
    "Saved": ["保存済み", "저장됨", "已收藏"],
    "Profile": ["プロフィール", "프로필", "个人资料"],
    "Settings": ["設定", "설정", "设置"],
    "Language": ["言語", "언어", "语言"],

    /* top bar + account */
    "Search universities, courses, countries...": [
      "大学・コース・国を検索...",
      "대학, 과정, 국가 검색...",
      "搜索大学、课程、国家..."
    ],
    "Open menu": ["メニューを開く", "메뉴 열기", "打开菜单"],
    "Log in": ["ログイン", "로그인", "登录"],
    "Sign Up Free": ["無料登録", "무료 가입", "免费注册"],
    "Notifications": ["通知", "알림", "通知"],
    "Student": ["学生", "학생", "学生"],
    "Dream University": ["志望大学", "꿈의 대학", "梦想大学"],
    "Unlock Workspace": ["ワークスペースを開く", "워크스페이스 열기", "解锁工作区"],
    "Sign in to unlock AI chat, application tracking, and personalized guidance.": [
      "サインインすると、AIチャット、出願管理、パーソナライズされたガイダンスが利用できます。",
      "로그인하면 AI 채팅, 지원 현황 관리, 맞춤형 안내를 이용할 수 있어요.",
      "登录后即可使用 AI 聊天、申请跟踪和个性化指导。"
    ],

    /* home hero */
    "Study abroad, powered by UniAI": [
      "UniAIで叶える留学",
      "UniAI와 함께하는 유학",
      "由 UniAI 驱动的留学"
    ],
    "Plan Smarter.": ["もっと賢く計画。", "더 똑똑하게 계획하고.", "更聪明地规划。"],
    "Go Farther.": ["もっと遠くへ。", "더 멀리 나아가세요.", "走得更远。"],
    "AI-powered tools and guidance to help you study abroad with confidence.": [
      "AIを活用したツールとガイダンスで、自信を持って留学に踏み出せます。",
      "AI 기반 도구와 안내로 자신 있게 유학을 준비하세요.",
      "借助 AI 工具与指导，自信地踏上留学之路。"
    ],
    "Start Your Journey →": ["旅を始める →", "여정 시작하기 →", "开启你的旅程 →"],
    "UK": ["英国", "영국", "英国"],
    "USA": ["米国", "미국", "美国"],
    "Japan": ["日本", "일본", "日本"],
    "Australia": ["オーストラリア", "호주", "澳大利亚"],
    "United States": ["アメリカ", "미국", "美国"],
    "United Kingdom": ["イギリス", "영국", "英国"],
    "Germany": ["ドイツ", "독일", "德国"],
    "Canada": ["カナダ", "캐나다", "加拿大"],
    "{x} Universities": ["{x}校の大学", "대학 {x}곳", "{x} 所大学"],
    "Avg. Cost: {x}": ["平均費用: {x}", "평균 비용: {x}", "平均费用：{x}"],
    "Universities": ["大学", "대학", "大学"],
    "Countries": ["国・地域", "국가", "国家"],
    "Success Rate": ["成功率", "성공률", "成功率"],
    "AI Support": ["AIサポート", "AI 지원", "AI 支持"],
    "Popular Destinations": ["人気の留学先", "인기 유학지", "热门留学目的地"],
    "View All →": ["すべて見る →", "전체 보기 →", "查看全部 →"],
    "Beta": ["ベータ", "베타", "测试版"],
    "Online": ["オンライン", "온라인", "在线"],
    "How can I help you today?": [
      "今日は何をお手伝いしましょうか？",
      "오늘 무엇을 도와드릴까요?",
      "今天有什么可以帮你？"
    ],
    "Quick Tools": ["クイックツール", "빠른 도구", "快捷工具"],
    "Cost Calculator": ["費用計算", "비용 계산기", "费用计算器"],
    "Estimate living and tuition costs": [
      "生活費と学費を見積もる",
      "생활비와 학비 예상하기",
      "估算生活费和学费"
    ],
    "Currency Converter": ["通貨換算", "환율 계산기", "货币转换"],
    "Convert between currencies": ["通貨を換算する", "통화 간 환전 계산", "在不同货币间换算"],

    /* university matcher */
    "UNIVERSITY MATCHER": ["大学マッチング", "대학 매칭", "大学匹配"],
    "Students matched": ["マッチした学生", "매칭된 학생", "已匹配学生"],
    "Your preferences": ["希望条件", "내 선호 조건", "你的偏好"],
    "Set the criteria you care about most.": [
      "重視する条件を設定しましょう。",
      "가장 중요하게 생각하는 기준을 설정하세요.",
      "设置你最看重的条件。"
    ],
    "Destination": ["留学先", "유학지", "目的地"],
    "Where do you want to study?": [
      "どこで学びたいですか？",
      "어디에서 공부하고 싶나요?",
      "你想去哪里留学？"
    ],
    "🌍 All Countries": ["🌍 すべての国", "🌍 모든 국가", "🌍 所有国家"],
    "Academic profile": ["学業プロフィール", "학업 프로필", "学术背景"],
    "Enter your current GPA": ["現在のGPAを入力", "현재 GPA 입력", "输入你当前的 GPA"],
    "Annual budget": ["年間予算", "연간 예산", "年度预算"],
    "Maximum tuition budget": ["学費の上限", "최대 학비 예산", "学费预算上限"],
    "/ year": ["/ 年", "/ 년", "/ 年"],
    "Find my universities": ["大学を探す", "내 대학 찾기", "查找适合我的大学"],
    "Your university matches": ["マッチした大学", "내게 맞는 대학", "你的大学匹配结果"],
    "Best matches": ["ベストマッチ", "최적 매칭", "最佳匹配"],

    /* scholarships */
    "FUNDING & OPPORTUNITIES": ["資金とチャンス", "재정 지원 및 기회", "资助与机会"],
    "Search scholarships": ["奨学金を検索", "장학금 검색", "搜索奖学金"],
    "Search": ["検索", "검색", "搜索"],
    "Popular searches": ["人気の検索", "인기 검색어", "热门搜索"],
    "Clear search": ["検索をクリア", "검색 지우기", "清除搜索"],
    "No scholarships found": ["奨学金が見つかりません", "장학금을 찾을 수 없어요", "未找到奖学金"],
    "Try searching for a different country, field, degree level, or scholarship name.": [
      "別の国、分野、学位レベル、奨学金名で検索してみてください。",
      "다른 국가, 분야, 학위 과정, 장학금 이름으로 검색해 보세요.",
      "试试搜索其他国家、专业领域、学位层次或奖学金名称。"
    ],

    /* roadmap */
    "THE ROADMAP": ["ロードマップ", "로드맵", "路线图"],
    "Your journey at a glance": ["旅の全体像", "한눈에 보는 여정", "旅程一览"],
    "Start the journey →": ["旅を始める →", "여정 시작하기 →", "开启旅程 →"],

    /* notification centre (notifications.js) */
    "Mark all read": ["すべて既読にする", "모두 읽음 표시", "全部标为已读"],
    "Clear all": ["すべて削除", "모두 지우기", "全部清除"],
    "All": ["すべて", "전체", "全部"],
    "Unread": ["未読", "읽지 않음", "未读"],
    "Unread ({x})": ["未読 ({x})", "읽지 않음 ({x})", "未读 ({x})"],
    "Dismiss": ["閉じる", "삭제", "忽略"],
    "Deadline": ["締め切り", "마감", "截止日期"],
    "Sync": ["同期", "동기화", "同步"],
    "What's new": ["新機能", "새로운 소식", "新功能"],
    "Tip": ["ヒント", "팁", "提示"],
    "You're all caught up.": ["すべて確認済みです。", "모두 확인했어요.", "你已查看全部通知。"],
    "No notifications yet. Deadline reminders, roadmap progress and updates will show up here.": [
      "まだ通知はありません。締め切りのリマインダー、ロードマップの進捗、お知らせがここに表示されます。",
      "아직 알림이 없어요. 마감 알림, 로드맵 진행 상황, 업데이트 소식이 여기에 표시됩니다.",
      "暂无通知。截止日期提醒、路线图进度和更新将显示在这里。"
    ],
    "Welcome to UniAI": ["UniAIへようこそ", "UniAI에 오신 것을 환영합니다", "欢迎使用 UniAI"],
    "Start with the University Finder, then save universities and scholarships to track them here.": [
      "まず大学検索から始めて、気になる大学や奨学金を保存するとここで管理できます。",
      "대학 찾기부터 시작하고, 대학과 장학금을 저장하면 여기서 관리할 수 있어요.",
      "先从大学查找开始，把大学和奖学金保存下来，就能在这里跟踪。"
    ],
    "Notifications are live": ["通知機能が使えるようになりました", "알림 기능이 시작되었어요", "通知功能已上线"],
    "You'll now get reminders for saved scholarship deadlines, roadmap milestones and account sync.": [
      "保存した奨学金の締め切り、ロードマップの節目、アカウント同期についてお知らせします。",
      "저장한 장학금 마감일, 로드맵 단계, 계정 동기화에 대한 알림을 받게 됩니다.",
      "现在你会收到已保存奖学金的截止提醒、路线图里程碑和账户同步通知。"
    ],
    "A smarter University Finder": ["より賢くなった大学検索", "더 똑똑해진 대학 찾기", "更智能的大学查找"],
    "Search understands MIT, UCL and typos. Cards show real data only, and GPA works as 4.0, 10-point or %.": [
      "MITやUCLなどの略称やタイプミスにも対応。カードには実際のデータのみ表示し、GPAは4.0・10段階・％で入力できます。",
      "MIT, UCL 같은 약어와 오타도 이해해요. 카드에는 실제 데이터만 표시되며 GPA는 4.0, 10점제, %로 입력할 수 있어요.",
      "搜索可识别 MIT、UCL 等缩写和拼写错误。卡片只显示真实数据，GPA 支持 4.0 制、10 分制或百分制。"
    ],
    "UniAI can now be used in Japanese, Korean and Chinese. Use the globe button in the top bar.": [
      "UniAIが日本語・韓国語・中国語で使えるようになりました。上部バーの地球儀ボタンから切り替えられます。",
      "이제 UniAI를 일본어, 한국어, 중국어로 사용할 수 있어요. 상단 바의 지구본 버튼을 눌러 보세요.",
      "UniAI 现已支持日语、韩语和中文。请使用顶部栏的地球图标切换。"
    ]
  };

  /* ------------------------------------------------------------------------
     Lookup tables built from DICT
     ------------------------------------------------------------------------ */

  const norm = (s) => String(s).replace(/\s+/g, " ").trim();
  const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  const EXACT = new Map();
  const TEMPLATES = [];

  function addEntry(key, vals) {
    if (!Array.isArray(vals) || vals.length < 3) return;
    const k = norm(key);
    if (k.indexOf("{x}") === -1) {
      EXACT.set(k, vals);
      return;
    }
    const pattern = k.split("{x}").map(escapeRe).join("(.+?)");
    TEMPLATES.push({ re: new RegExp("^" + pattern + "$"), vals });
  }

  Object.keys(DICT).forEach((k) => addEntry(k, DICT[k]));

  function lookup(text, lang) {
    const col = COL[lang];
    if (col === undefined) return null;

    const key = norm(text);
    if (!key) return null;

    const hit = EXACT.get(key);
    if (hit) return hit[col];

    for (const t of TEMPLATES) {
      const m = t.re.exec(key);
      if (m) return t.vals[col].replace("{x}", m[1]);
    }
    return null;
  }

  /** Translate while keeping the original leading / trailing whitespace. */
  function translateKeepingSpace(text, lang) {
    const out = lookup(text, lang);
    if (out === null) return null;
    const lead = text.match(/^\s*/)[0];
    const trail = text.match(/\s*$/)[0];
    return lead + out + trail;
  }

  /* ------------------------------------------------------------------------
     State
     ------------------------------------------------------------------------ */

  const ATTRS = ["placeholder", "title", "aria-label", "alt"];
  const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEXTAREA", "CODE", "PRE", "SVG"]);

  let lang = "en";
  let observer = null;
  const textRec = new WeakMap(); // text node -> { orig, applied }
  const attrRec = new WeakMap(); // element -> { attrName: { orig, applied } }
  let originalTitle = null;

  function readSaved() {
    try {
      const saved = localStorage.getItem(STORE_KEY);
      if (LANGS.some((l) => l.code === saved)) return saved;
    } catch (err) {
      /* storage blocked: stay on English */
    }
    return "en";
  }

  function save(code) {
    try {
      localStorage.setItem(STORE_KEY, code);
    } catch (err) {
      /* ignore */
    }
  }

  /* ------------------------------------------------------------------------
     Applying translations
     ------------------------------------------------------------------------ */

  function skipped(el) {
    for (let n = el; n && n.nodeType === 1; n = n.parentNode) {
      if (SKIP_TAGS.has(n.tagName.toUpperCase())) return true;
      if (n.isContentEditable || n.hasAttribute("data-no-translate")) return true;
      if (n.hasAttribute("data-i18n-ui")) return true; // the switcher itself
    }
    return false;
  }

  function applyText(node) {
    const cur = node.nodeValue;
    const rec = textRec.get(node);

    // Our own earlier write: just re-evaluate for the current language.
    if (rec && cur === rec.applied) {
      const target = lang === "en" ? rec.orig : translateKeepingSpace(rec.orig, lang) ?? rec.orig;
      if (target !== cur) {
        rec.applied = target;
        node.nodeValue = target;
      }
      return;
    }

    // Fresh text, or another script replaced it: treat what is there as the original.
    if (lang === "en") {
      if (rec) textRec.delete(node);
      return;
    }

    const tr = translateKeepingSpace(cur, lang);
    if (tr !== null && tr !== cur) {
      textRec.set(node, { orig: cur, applied: tr });
      node.nodeValue = tr;
    } else if (rec) {
      textRec.delete(node);
    }
  }

  function applyAttr(el, name) {
    if (!el.hasAttribute(name)) return;
    const cur = el.getAttribute(name);
    let recs = attrRec.get(el);
    const rec = recs && recs[name];

    if (rec && cur === rec.applied) {
      const target = lang === "en" ? rec.orig : translateKeepingSpace(rec.orig, lang) ?? rec.orig;
      if (target !== cur) {
        rec.applied = target;
        el.setAttribute(name, target);
      }
      return;
    }

    if (lang === "en") {
      if (rec) delete recs[name];
      return;
    }

    const tr = translateKeepingSpace(cur, lang);
    if (tr !== null && tr !== cur) {
      if (!recs) {
        recs = {};
        attrRec.set(el, recs);
      }
      recs[name] = { orig: cur, applied: tr };
      el.setAttribute(name, tr);
    } else if (rec) {
      delete recs[name];
    }
  }

  function applyTree(root) {
    if (!root) return;

    if (root.nodeType === 3) {
      if (root.parentNode && !skipped(root.parentNode)) applyText(root);
      return;
    }
    if (root.nodeType !== 1 || skipped(root)) return;

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, {
      acceptNode(n) {
        if (n.nodeType === 1) {
          return SKIP_TAGS.has(n.tagName.toUpperCase()) ||
            n.hasAttribute("data-no-translate") ||
            n.hasAttribute("data-i18n-ui")
            ? NodeFilter.FILTER_REJECT
            : NodeFilter.FILTER_ACCEPT;
        }
        return NodeFilter.FILTER_ACCEPT;
      }
    });

    const visit = (el) => {
      ATTRS.forEach((a) => applyAttr(el, a));
    };

    visit(root);
    let n = walker.nextNode();
    while (n) {
      if (n.nodeType === 3) applyText(n);
      else visit(n);
      n = walker.nextNode();
    }
  }

  function applyTitle() {
    if (originalTitle === null) originalTitle = document.title;
    const tr = lang === "en" ? null : lookup(originalTitle, lang);
    document.title = tr !== null ? tr : originalTitle;
  }

  /* ------------------------------------------------------------------------
     Watching for content other scripts add or change
     ------------------------------------------------------------------------ */

  const pending = new Set();
  let scheduled = false;

  function flush() {
    scheduled = false;
    const batch = [...pending];
    pending.clear();
    batch.forEach((n) => {
      if (n.isConnected) applyTree(n);
    });
  }

  function queue(node) {
    pending.add(node);
    if (!scheduled) {
      scheduled = true;
      requestAnimationFrame(flush);
    }
  }

  function startObserver() {
    if (observer || !document.body) return;
    observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.type === "childList") {
          m.addedNodes.forEach((n) => {
            if (n.nodeType === 1 || n.nodeType === 3) queue(n);
          });
        } else if (m.type === "characterData") {
          queue(m.target);
        } else if (m.type === "attributes") {
          queue(m.target);
        }
      }
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ATTRS
    });
  }

  function stopObserver() {
    if (observer) {
      observer.disconnect();
      observer = null;
    }
    pending.clear();
  }

  /* ------------------------------------------------------------------------
     Switching language
     ------------------------------------------------------------------------ */

  function setLanguage(code, options) {
    const info = LANGS.find((l) => l.code === code);
    if (!info) return false;

    lang = code;
    document.documentElement.lang = info.html;
    document.documentElement.setAttribute("data-lang", code);

    if (!options || options.persist !== false) save(code);

    stopObserver();
    applyTitle();
    if (document.body) applyTree(document.body);
    if (code !== "en") startObserver();

    updateSwitcher();

    try {
      window.dispatchEvent(new CustomEvent("uniai:language-change", { detail: { lang: code } }));
    } catch (err) {
      /* ignore */
    }
    return true;
  }

  /* ------------------------------------------------------------------------
     Switcher UI (own CSS, injected into the top bar)
     ------------------------------------------------------------------------ */

  let root = null;
  let button = null;
  let menu = null;

  function injectStyles() {
    if (document.getElementById("i18n-styles")) return;
    const style = document.createElement("style");
    style.id = "i18n-styles";
    style.textContent =
      /* CJK-capable system fonts; Latin text keeps the site's own font first. */
      'html[lang="ja"] body,html[lang="ja"] button,html[lang="ja"] input,html[lang="ja"] textarea,html[lang="ja"] select{font-family:var(--font-body,"Plus Jakarta Sans","Inter"),"Hiragino Sans","Yu Gothic UI","Meiryo",system-ui,sans-serif}' +
      'html[lang="ko"] body,html[lang="ko"] button,html[lang="ko"] input,html[lang="ko"] textarea,html[lang="ko"] select{font-family:var(--font-body,"Plus Jakarta Sans","Inter"),"Apple SD Gothic Neo","Malgun Gothic",system-ui,sans-serif}' +
      'html[lang="zh-CN"] body,html[lang="zh-CN"] button,html[lang="zh-CN"] input,html[lang="zh-CN"] textarea,html[lang="zh-CN"] select{font-family:var(--font-body,"Plus Jakarta Sans","Inter"),"PingFang SC","Microsoft YaHei","Noto Sans SC",system-ui,sans-serif}' +
      /* switcher */
      ".i18n{position:relative;display:inline-flex;flex:0 0 auto}" +
      ".i18n-btn{display:inline-flex;align-items:center;gap:7px;height:40px;padding:0 12px;border-radius:12px;cursor:pointer;" +
      "border:1px solid var(--border,rgba(128,128,128,.28));background:var(--card-bg,transparent);color:var(--text,inherit);" +
      "font:600 .82rem/1 var(--font-body,inherit);transition:border-color .15s,background .15s}" +
      ".i18n-btn:hover,.i18n-btn[aria-expanded='true']{border-color:var(--primary,#6d5dfb)}" +
      ".i18n-btn:focus-visible,.i18n-item:focus-visible{outline:2px solid var(--primary,#6d5dfb);outline-offset:2px}" +
      ".i18n-btn svg{width:16px;height:16px;stroke:currentColor;fill:none;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}" +
      ".i18n-menu{position:absolute;right:0;top:calc(100% + 8px);z-index:100001;min-width:150px;padding:6px;margin:0;list-style:none;" +
      "border-radius:14px;border:1px solid var(--border,rgba(128,128,128,.28));background:var(--card-bg,#fff);color:var(--text,#111);" +
      "box-shadow:0 18px 46px rgba(0,0,0,.25)}" +
      ".i18n-menu[hidden]{display:none}" +
      ".i18n-item{display:flex;align-items:center;justify-content:space-between;gap:12px;width:100%;padding:9px 10px;border:0;border-radius:9px;" +
      "background:transparent;color:inherit;cursor:pointer;text-align:left;font:500 .9rem/1.2 var(--font-body,inherit)}" +
      ".i18n-item:hover{background:rgba(109,93,251,.12)}" +
      ".i18n-item[aria-checked='true']{font-weight:700;color:var(--primary,#6d5dfb)}" +
      ".i18n-item[aria-checked='true']::after{content:'✓'}" +
      ".i18n.floating{position:fixed;left:16px;bottom:calc(16px + env(safe-area-inset-bottom,0px));z-index:100000}" +
      ".i18n.floating .i18n-menu{right:auto;left:0;top:auto;bottom:calc(100% + 8px)}" +
      "@media(max-width:640px){.i18n-label{display:none}}";
    document.head.appendChild(style);
  }

  function build() {
    injectStyles();

    root = document.createElement("div");
    root.className = "i18n";
    root.setAttribute("data-i18n-ui", "");

    button = document.createElement("button");
    button.type = "button";
    button.className = "i18n-btn";
    button.setAttribute("aria-haspopup", "menu");
    button.setAttribute("aria-expanded", "false");
    button.setAttribute("aria-label", "Language");
    button.innerHTML =
      '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/>' +
      '<path d="M3 12h18M12 3c2.8 2.6 4.2 5.6 4.2 9s-1.4 6.4-4.2 9c-2.8-2.6-4.2-5.6-4.2-9S9.2 5.6 12 3z"/></svg>' +
      '<span class="i18n-label"></span>';

    menu = document.createElement("ul");
    menu.className = "i18n-menu";
    menu.setAttribute("role", "menu");
    menu.hidden = true;

    LANGS.forEach((l) => {
      const li = document.createElement("li");
      li.setAttribute("role", "none");

      const item = document.createElement("button");
      item.type = "button";
      item.className = "i18n-item";
      item.setAttribute("role", "menuitemradio");
      item.setAttribute("data-lang", l.code);
      item.setAttribute("lang", l.html);
      item.textContent = l.label;
      item.addEventListener("click", () => {
        setLanguage(l.code);
        closeMenu(true);
      });

      li.appendChild(item);
      menu.appendChild(li);
    });

    root.appendChild(button);
    root.appendChild(menu);

    const actions = document.querySelector(".topbar-actions");
    if (actions) {
      actions.insertBefore(root, actions.firstChild);
    } else {
      root.classList.add("floating"); // no top bar found: pin to the corner
      document.body.appendChild(root);
    }

    button.addEventListener("click", () => (menu.hidden ? openMenu() : closeMenu(true)));

    document.addEventListener("click", (e) => {
      if (!menu.hidden && !root.contains(e.target)) closeMenu(false);
    });

    document.addEventListener("keydown", (e) => {
      if (menu.hidden) return;
      if (e.key === "Escape") {
        closeMenu(true);
      } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const items = [...menu.querySelectorAll(".i18n-item")];
        const i = items.indexOf(document.activeElement);
        const next = e.key === "ArrowDown" ? (i + 1) % items.length : (i - 1 + items.length) % items.length;
        items[next].focus();
      }
    });

    updateSwitcher();
  }

  function openMenu() {
    menu.hidden = false;
    button.setAttribute("aria-expanded", "true");
    const current = menu.querySelector('[aria-checked="true"]');
    if (current) current.focus();
  }

  function closeMenu(returnFocus) {
    menu.hidden = true;
    button.setAttribute("aria-expanded", "false");
    if (returnFocus) button.focus();
  }

  function updateSwitcher() {
    if (!root) return;
    const info = LANGS.find((l) => l.code === lang) || LANGS[0];
    root.querySelector(".i18n-label").textContent = info.label;
    const word = lang === "en" ? null : lookup("Language", lang);
    button.setAttribute("aria-label", word || "Language");
    menu.querySelectorAll(".i18n-item").forEach((el) => {
      el.setAttribute("aria-checked", String(el.getAttribute("data-lang") === lang));
    });
  }

  /* ------------------------------------------------------------------------
     Public API
     ------------------------------------------------------------------------ */

  /** Visible English text that has no translation yet (for growing the dictionary). */
  function missing() {
    const found = new Set();
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let n = walker.nextNode();

    while (n) {
      const parent = n.parentNode;
      const text = norm(n.nodeValue);
      const translated = textRec.has(n) && n.nodeValue === textRec.get(n).applied;

      if (
        text.length > 1 &&
        /[A-Za-z]/.test(text) &&
        !translated &&
        parent &&
        !skipped(parent) &&
        parent.getClientRects().length > 0 &&
        lookup(text, lang === "en" ? "ja" : lang) === null
      ) {
        found.add(text);
      }
      n = walker.nextNode();
    }

    const list = [...found];
    try {
      console.log("UniAI i18n: " + list.length + " untranslated visible strings");
      console.log(list.map((s) => JSON.stringify(s) + ": [\"\", \"\", \"\"],").join("\n"));
    } catch (err) {
      /* ignore */
    }
    return list;
  }

  window.UniAII18n = {
    languages: LANGS.map((l) => ({ code: l.code, label: l.label })),
    get language() {
      return lang;
    },
    setLanguage,
    t(text) {
      if (lang === "en") return text;
      const tr = translateKeepingSpace(String(text), lang);
      return tr !== null ? tr : text;
    },
    extend(entries) {
      Object.keys(entries || {}).forEach((k) => addEntry(k, entries[k]));
      if (lang !== "en" && document.body) applyTree(document.body);
    },
    missing
  };

  /* ------------------------------------------------------------------------
     Start
     ------------------------------------------------------------------------ */

  function start() {
    build();
    const saved = readSaved();
    if (saved !== "en") setLanguage(saved, { persist: false });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();