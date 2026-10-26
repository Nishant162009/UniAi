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
    "{x}/yr": ["{x}/年", "{x}/년", "{x}/年"],
    "{x} saved": ["{x}件保存済み", "저장 {x}개", "已保存 {x} 项"],
    "{x} active": ["{x}件進行中", "진행 중 {x}개", "进行中 {x} 项"],
    "{x} upcoming": ["{x}件予定", "예정 {x}개", "即将到来 {x} 项"],
    "{x} tracked": ["{x}件追跡中", "추적 중 {x}개", "已跟踪 {x} 项"],
    "{x} words": ["{x}語", "{x}단어", "{x} 字"],
    "{x} word": ["{x}語", "{x}단어", "{x} 字"],
    "{x} destinations": ["{x}か所の留学先", "유학지 {x}곳", "{x} 个目的地"],
    "{x} destination": ["{x}か所の留学先", "유학지 {x}곳", "{x} 个目的地"],
    "{x} saved items": ["保存済み{x}件", "저장된 항목 {x}개", "{x} 个已保存项目"],
    "{x} scholarships": ["奨学金{x}件", "장학금 {x}개", "{x} 项奖学金"],
    "Showing {x} scholarships": ["奨学金{x}件を表示中", "장학금 {x}개 표시 중", "正在显示 {x} 项奖学金"],
    "Showing {x} of {y} scholarships": ["奨学金{y}件中{x}件を表示", "장학금 {y}개 중 {x}개 표시", "共 {y} 项奖学金，显示 {x} 项"],
    "Showing {x} destinations": ["{x}か所の留学先を表示中", "유학지 {x}곳 표시 중", "正在显示 {x} 个目的地"],
    "Showing {x} of {y} destinations": ["{y}か所中{x}か所を表示", "유학지 {y}곳 중 {x}곳 표시", "共 {y} 个目的地，显示 {x} 个"],
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

/* Generated from every string found in index.html and the site scripts. */
  const DICT_MORE = {
    "3 new scholarship matches for STEM applicants.": ["STEM分野の出願者向けの奨学金が3件新しくマッチしました。", "STEM 지원자를 위한 새로운 장학금 3건이 매칭되었어요.", "为 STEM 申请者新匹配了 3 项奖学金。"],
    "Visa timeline for Japan updated for Fall 2027.": ["2027年秋入学向けの日本のビザスケジュールが更新されました。", "2027년 가을 학기 일본 비자 일정이 업데이트되었어요.", "日本 2027 年秋季入学的签证时间表已更新。"],
    "Your SOP draft is ready for a second pass.": ["SOPの下書きが2回目の見直しに進める状態です。", "SOP 초안을 두 번째로 다듬을 준비가 되었어요.", "你的 SOP 草稿已准备好进行第二轮修改。"],
    "Hi,": ["こんにちは、", "안녕하세요,", "你好，"],
    "there": ["ゲストさん", "게스트님", "访客"],
    "🔍 Which universities can I get into with 85%?": ["🔍 85%の成績でどの大学に入れますか？", "🔍 85% 성적으로 어떤 대학에 갈 수 있나요?", "🔍 85% 的成绩能申请哪些大学？"],
    "🌐 How much will it cost to study in Germany?": ["🌐 ドイツ留学にはいくらかかりますか？", "🌐 독일 유학에는 비용이 얼마나 들까요?", "🌐 去德国留学需要多少费用？"],
    "📄 What are the visa requirements for Japan?": ["📄 日本のビザ要件は何ですか？", "📄 일본 비자 요건은 무엇인가요?", "📄 日本的签证要求有哪些？"],
    "Find universities that": ["あなたに合った", "나에게 맞는", "找到适合"],
    "fit": ["大学を", "대학을", "你的"],
    "you.": ["見つけよう。", "찾아보세요.", "大学。"],
    "Tell us about your academics, destination, and budget. We'll help you discover universities worth considering.": ["学業成績、留学先、予算を教えてください。検討する価値のある大学を見つけるお手伝いをします。", "학업 성적, 희망 유학지, 예산을 알려주세요. 고려해 볼 만한 대학을 찾도록 도와드릴게요.", "告诉我们你的学业背景、目的地和预算，我们将帮你发现值得考虑的大学。"],
    "many": ["多数", "다수", "众多"],
    "Start with a profile": ["プロフィールから始める", "프로필로 시작하기", "从一个档案开始"],
    "Not sure where to begin? Try one of these.": ["どこから始めればいいか迷っていますか？ これらを試してみてください。", "어디서부터 시작할지 막막한가요? 아래 예시를 시도해 보세요.", "不知道从哪里开始？试试这些。"],
    "GPA 3.6 · Up to $40k": ["GPA 3.6 · 上限 $40k", "GPA 3.6 · 최대 $40k", "GPA 3.6 · 最高 $40k"],
    "GPA 3.4 · Up to $35k": ["GPA 3.4 · 上限 $35k", "GPA 3.4 · 최대 $35k", "GPA 3.4 · 最高 $35k"],
    "GPA 3.2 · Budget focused": ["GPA 3.2 · 予算重視", "GPA 3.2 · 예산 중심", "GPA 3.2 · 预算优先"],
    "GPA 3.5 · STEM focused": ["GPA 3.5 · 理系中心", "GPA 3.5 · STEM 중심", "GPA 3.5 · 侧重理工科"],
    "You don't need to choose a country. Leave it open to explore matches worldwide.": ["国を選ぶ必要はありません。空欄のままにすれば、世界中のマッチを探せます。", "국가를 꼭 고를 필요는 없어요. 비워 두면 전 세계에서 맞는 대학을 찾아볼 수 있어요.", "不必选择国家。留空即可在全球范围内探索匹配的大学。"],
    "Universities matching your preferences will appear here.": ["希望条件に合う大学がここに表示されます。", "선호 조건에 맞는 대학이 여기에 표시됩니다.", "符合你偏好的大学将显示在这里。"],
    "Your shortlist starts here": ["ここからあなたの候補リストが始まります", "여기서 나만의 후보 목록이 시작돼요", "你的备选清单从这里开始"],
    "Enter your details above or choose a profile to discover your university matches.": ["上の項目を入力するか、プロフィールを選ぶと、あなたに合う大学が表示されます。", "위 항목을 입력하거나 프로필을 선택하면 나에게 맞는 대학을 확인할 수 있어요.", "在上方填写信息或选择一个档案，即可看到适合你的大学。"],
    "Find funding for": ["次の一歩を支える", "다음 챕터를 위한", "为你的下一段旅程"],
    "your next chapter.": ["資金を見つけよう。", "재정 지원을 찾아보세요.", "找到资助。"],
    "Discover high-signal scholarships for international study, filtered by destination, degree level, field, and eligibility.": ["留学先、学位レベル、分野、応募資格で絞り込める、厳選された海外留学向け奨学金を探しましょう。", "유학지, 학위 과정, 분야, 지원 자격별로 걸러낸 엄선된 해외 유학 장학금을 찾아보세요.", "按目的地、学位层次、专业领域和申请资格筛选，发现优质的国际留学奖学金。"],
    "🎓 Fully funded": ["🎓 全額支給", "🎓 전액 지원", "🎓 全额资助"],
    "💰 Tuition support": ["💰 学費サポート", "💰 학비 지원", "💰 学费资助"],
    "Global": ["世界", "전 세계", "全球"],
    "Destinations": ["留学先", "유학지", "目的地"],
    "Multiple": ["複数", "다양한", "多种"],
    "Degree levels": ["学位レベル", "학위 과정", "学位层次"],
    "Curated": ["厳選", "엄선된", "精选"],
    "Opportunities": ["機会", "기회", "机会"],
    "SCHOLARSHIP FINDER": ["奨学金検索", "장학금 찾기", "奖学金查找"],
    "What are you looking for?": ["どんなものをお探しですか？", "어떤 장학금을 찾고 있나요?", "你在寻找什么？"],
    "Search across countries, fields, scholarship names, and funding opportunities.": ["国、分野、奨学金名、支援制度から横断的に検索できます。", "국가, 분야, 장학금 이름, 재정 지원 기회를 한 번에 검색해 보세요.", "可按国家、专业领域、奖学金名称和资助机会进行搜索。"],
    "🇨🇦 Canada": ["🇨🇦 カナダ", "🇨🇦 캐나다", "🇨🇦 加拿大"],
    "🇬🇧 UK": ["🇬🇧 英国", "🇬🇧 영국", "🇬🇧 英国"],
    "🇦🇺 Australia": ["🇦🇺 オーストラリア", "🇦🇺 호주", "🇦🇺 澳大利亚"],
    "🎓 Masters": ["🎓 修士", "🎓 석사", "🎓 硕士"],
    "✦ Fully funded": ["✦ 全額支給", "✦ 전액 지원", "✦ 全额资助"],
    "Showing scholarships": ["奨学金を表示中", "장학금 표시 중", "正在显示奖学金"],
    "Curated opportunities": ["厳選された機会", "엄선된 기회", "精选机会"],
    "NO MATCHES": ["該当なし", "검색 결과 없음", "无匹配结果"],
    "YOUR STUDY ABROAD ROADMAP": ["あなたの留学ロードマップ", "나의 유학 로드맵", "你的留学路线图"],
    "From": ["", "", ""],
    "“I want to study abroad”": ["「留学したい」", "“유학을 가고 싶다”에서", "“我想出国留学”"],
    "to boarding the plane.": ["から、搭乗の瞬間まで。", "비행기에 오르기까지.", "到登上飞机的那一刻。"],
    "A step-by-step roadmap covering research, tests, finances, applications, visas, and everything you need before departure.": ["リサーチ、試験、資金計画、出願、ビザ、出発前に必要なすべてを網羅した、ステップごとのロードマップです。", "리서치, 시험, 재정 계획, 지원, 비자, 출국 전 필요한 모든 것을 단계별로 다룬 로드맵이에요.", "涵盖调研、考试、资金、申请、签证以及出发前所有准备的分步路线图。"],
    "6 stages": ["6つのステージ", "6단계", "6 个阶段"],
    "from planning to departure": ["計画から出発まで", "계획부터 출국까지", "从规划到出发"],
    "Choose your country": ["留学先の国を選ぶ", "유학할 국가 선택하기", "选择你的国家"],
    "Application": ["出願", "지원", "申请"],
    "Ready to submit": ["提出の準備完了", "제출 준비 완료", "已可提交"],
    "6 steps": ["6ステップ", "6단계", "6 个步骤"],
    "Plan": ["計画", "계획", "规划"],
    "Prepare": ["準備", "준비", "准备"],
    "Fund": ["資金", "자금", "资金"],
    "Apply": ["出願", "지원", "申请"],
    "Decide": ["決定", "결정", "决定"],
    "Fly": ["出発", "출국", "启程"],
    "EXPLORE THE LIBRARY": ["ライブラリを見る", "라이브러리 둘러보기", "探索资料库"],
    "Guides for every part of your journey.": ["留学のあらゆる場面に役立つガイド。", "유학의 모든 단계에 필요한 가이드.", "覆盖留学全程的指南。"],
    "Pick a destination, test, application topic, or visa guide. Each card opens its own dedicated guide.": ["留学先、試験、出願、ビザなどのトピックから選んでください。各カードから専用ガイドに移動できます。", "유학지, 시험, 지원 준비, 비자 등 주제를 선택하세요. 각 카드를 누르면 전용 가이드가 열려요.", "选择目的地、考试、申请主题或签证指南，每张卡片都会打开对应的专属指南。"],
    "guides planned": ["予定のガイド", "예정된 가이드", "篇指南计划中"],
    "DESTINATIONS": ["留学先", "유학지", "目的地"],
    "Choose where you want to study": ["留学したい国を選ぶ", "공부하고 싶은 나라를 선택하세요", "选择你想留学的地方"],
    "8 guides": ["ガイド8本", "가이드 8개", "8 篇指南"],
    "DESTINATION": ["留学先", "유학지", "目的地"],
    "USA Guide": ["アメリカ留学ガイド", "미국 가이드", "美国留学指南"],
    "Universities, admissions, costs, scholarships, tests, visa and life in the USA.": ["大学、入試、費用、奨学金、試験、ビザ、アメリカでの生活について。", "대학, 입학, 비용, 장학금, 시험, 비자, 미국 생활까지.", "大学、录取、费用、奖学金、考试、签证以及在美国的生活。"],
    "F-1 Visa": ["F-1ビザ", "F-1 비자", "F-1 签证"],
    "Costs": ["費用", "비용", "费用"],
    "Japan Guide": ["日本留学ガイド", "일본 가이드", "日本留学指南"],
    "Study options, universities, Japanese language, costs, scholarships and visa.": ["留学の選択肢、大学、日本語、費用、奨学金、ビザについて。", "유학 옵션, 대학, 일본어, 비용, 장학금, 비자 안내.", "留学选择、大学、日语、费用、奖学金与签证。"],
    "JLPT": ["JLPT", "JLPT", "JLPT"],
    "Visa": ["ビザ", "비자", "签证"],
    "UK Guide": ["イギリス留学ガイド", "영국 가이드", "英国留学指南"],
    "Universities, applications, tuition, scholarships, student visa and living costs.": ["大学、出願、学費、奨学金、学生ビザ、生活費について。", "대학, 지원, 학비, 장학금, 학생 비자, 생활비 안내.", "大学、申请、学费、奖学金、学生签证与生活成本。"],
    "Student Visa": ["学生ビザ", "학생 비자", "学生签证"],
    "Germany Guide": ["ドイツ留学ガイド", "독일 가이드", "德国留学指南"],
    "Public universities, programs, language, funding, applications and visa planning.": ["国公立大学、プログラム、言語、資金、出願、ビザの準備について。", "공립대학, 프로그램, 언어, 재정 지원, 지원 절차, 비자 준비 안내.", "公立大学、专业项目、语言、资助、申请与签证规划。"],
    "Canada Guide": ["カナダ留学ガイド", "캐나다 가이드", "加拿大留学指南"],
    "Programs, universities, tuition, scholarships, applications and study permit basics.": ["プログラム、大学、学費、奨学金、出願、学習許可証（スタディパーミット）の基本について。", "프로그램, 대학, 학비, 장학금, 지원 절차, 학업 허가(스터디 퍼밋) 기본 안내.", "专业项目、大学、学费、奖学金、申请以及学习许可的基础知识。"],
    "Programs": ["プログラム", "프로그램", "项目"],
    "Study Permit": ["スタディパーミット", "스터디 퍼밋", "学习许可"],
    "Australia Guide": ["オーストラリア留学ガイド", "호주 가이드", "澳大利亚留学指南"],
    "Universities, courses, costs, scholarships, applications and student visa planning.": ["大学、コース、費用、奨学金、出願、学生ビザの準備について。", "대학, 과정, 비용, 장학금, 지원 절차, 학생 비자 준비 안내.", "大学、课程、费用、奖学金、申请与学生签证规划。"],
    "Netherlands Guide": ["オランダ留学ガイド", "네덜란드 가이드", "荷兰留学指南"],
    "English-taught programs, universities, costs, applications and student life.": ["英語で学べるプログラム、大学、費用、出願、学生生活について。", "영어로 진행되는 프로그램, 대학, 비용, 지원 절차, 학생 생활 안내.", "英语授课项目、大学、费用、申请与学生生活。"],
    "Student Life": ["学生生活", "학생 생활", "学生生活"],
    "France Guide": ["フランス留学ガイド", "프랑스 가이드", "法国留学指南"],
    "Study options, universities, tuition, language, applications and visa planning.": ["留学の選択肢、大学、学費、言語、出願、ビザの準備について。", "유학 옵션, 대학, 학비, 언어, 지원 절차, 비자 준비 안내.", "留学选择、大学、学费、语言、申请与签证规划。"],
    "TESTS & LANGUAGE": ["試験・語学", "시험 및 어학", "考试与语言"],
    "Prepare for the scores you need": ["必要なスコアに向けて準備する", "필요한 점수를 위해 준비하세요", "为你需要的分数做好准备"],
    "6 guides": ["ガイド6本", "가이드 6개", "6 篇指南"],
    "ENGLISH TEST": ["英語試験", "영어 시험", "英语考试"],
    "IELTS Guide": ["IELTSガイド", "IELTS 가이드", "雅思（IELTS）指南"],
    "Understand the test format, sections, scoring and preparation path.": ["試験の形式、セクション、採点方法、準備の進め方を理解しましょう。", "시험 형식, 영역, 채점 방식, 준비 방법을 이해해 보세요.", "了解考试形式、各部分、评分方式以及备考路径。"],
    "Academic": ["アカデミック", "아카데믹", "学术类"],
    "Band Score": ["バンドスコア", "밴드 점수", "分数段"],
    "Prep": ["対策", "대비", "备考"],
    "TOEFL Guide": ["TOEFLガイド", "TOEFL 가이드", "托福（TOEFL）指南"],
    "Explore the exam structure, scoring and a practical preparation roadmap.": ["試験の構成、採点方法、実践的な対策ロードマップを紹介します。", "시험 구성, 채점 방식, 실용적인 준비 로드맵을 살펴보세요.", "了解考试结构、评分方式和实用的备考路线图。"],
    "iBT": ["iBT", "iBT", "iBT"],
    "Scoring": ["採点", "채점", "评分"],
    "JAPANESE": ["日本語", "일본어", "日语"],
    "JLPT Guide": ["JLPTガイド", "JLPT 가이드", "日语能力考（JLPT）指南"],
    "Understand N5 to N1, preparation, sections, vocabulary and kanji.": ["N5からN1までの概要、対策、各セクション、語彙、漢字について。", "N5~N1 단계, 준비 방법, 영역별 구성, 어휘와 한자 안내.", "了解 N5 至 N1 等级、备考、各部分、词汇与汉字。"],
    "N5–N1": ["N5～N1", "N5~N1", "N5–N1"],
    "Kanji": ["漢字", "한자", "汉字"],
    "ADMISSIONS TEST": ["入試用試験", "입학 시험", "入学考试"],
    "GRE Guide": ["GREガイド", "GRE 가이드", "GRE 指南"],
    "Learn about sections, scoring, preparation and how to plan your attempt.": ["セクション、採点、対策、受験計画の立て方を学びましょう。", "영역 구성, 채점, 준비 방법, 응시 계획 세우는 법을 알아보세요.", "了解考试各部分、评分、备考以及如何规划应试。"],
    "Verbal": ["言語（Verbal）", "언어 추론(Verbal)", "语文（Verbal）"],
    "Quant": ["数的推論（Quant）", "수리 추론(Quant)", "数学（Quant）"],
    "BUSINESS TEST": ["ビジネス系試験", "경영 대학원 시험", "商科考试"],
    "GMAT Guide": ["GMATガイド", "GMAT 가이드", "GMAT 指南"],
    "Understand the exam, scoring, preparation and business-school applications.": ["試験の概要、採点、対策、ビジネススクール出願について理解しましょう。", "시험 개요, 채점, 준비 방법, 경영대학원 지원 절차를 이해해 보세요.", "了解考试、评分、备考以及商学院申请。"],
    "Focus": ["集中力", "집중력", "专注力"],
    "GERMAN": ["ドイツ語", "독일어", "德语"],
    "German Language Guide": ["ドイツ語ガイド", "독일어 가이드", "德语学习指南"],
    "Explore language levels, common exams and how German fits into study plans.": ["語学レベル、主な試験、留学計画におけるドイツ語の位置づけを確認しましょう。", "언어 레벨, 대표 시험, 유학 계획에서 독일어가 차지하는 역할을 알아보세요.", "了解语言等级、常见考试，以及德语在留学规划中的作用。"],
    "A1–C1": ["A1～C1", "A1~C1", "A1–C1"],
    "APPLICATION": ["出願", "지원", "申请"],
    "Build a stronger application": ["より強い出願書類を作る", "더 탄탄한 지원서를 만들어 보세요", "打造更有竞争力的申请"],
    "5 guides": ["ガイド5本", "가이드 5개", "5 篇指南"],
    "SOP Guide": ["SOPガイド", "SOP 가이드", "SOP 指南"],
    "Understand what makes a clear, specific and authentic statement of purpose.": ["明確で具体的、そして自分らしい志望理由書（SOP）の条件を理解しましょう。", "명확하고 구체적이며 진정성 있는 학업계획서(SOP)의 조건을 이해해 보세요.", "了解怎样的个人陈述（SOP）清晰、具体且真实。"],
    "Structure": ["構成", "구성", "结构"],
    "Story": ["ストーリー", "스토리", "故事"],
    "Review": ["見直し", "검토", "修改"],
    "LOR Guide": ["LORガイド", "LOR 가이드", "推荐信（LOR）指南"],
    "Plan recommendation letters, choose recommenders and organize requests.": ["推薦状の計画、推薦者の選び方、依頼の整理方法を学びましょう。", "추천서 계획, 추천인 선정, 요청 관리 방법을 알아보세요.", "规划推荐信、选择推荐人并整理请求事项。"],
    "Recommenders": ["推薦者", "추천인", "推荐人"],
    "Tips": ["コツ", "팁", "技巧"],
    "Resume / CV Guide": ["履歴書／CVガイド", "이력서/CV 가이드", "简历／CV 指南"],
    "Build an application-ready academic and professional profile.": ["出願にそのまま使える学業・職歴のプロフィールを作りましょう。", "지원에 바로 쓸 수 있는 학업·경력 프로필을 만들어 보세요.", "打造可直接用于申请的学术与职业档案。"],
    "Projects": ["プロジェクト", "프로젝트", "项目经历"],
    "Experience": ["経験", "경력", "经历"],
    "FUNDING": ["資金援助", "재정 지원", "资助"],
    "Scholarship Guide": ["奨学金ガイド", "장학금 가이드", "奖学金指南"],
    "Find scholarship types, eligibility factors, timelines and application planning.": ["奨学金の種類、応募資格、スケジュール、出願計画を確認しましょう。", "장학금 종류, 지원 자격, 일정, 신청 계획을 알아보세요.", "了解奖学金类型、申请资格、时间安排与申请规划。"],
    "Funding": ["資金", "재정 지원", "资助"],
    "Deadlines": ["締め切り", "마감일", "截止日期"],
    "Applications": ["出願", "지원", "申请"],
    "University Application Guide": ["大学出願ガイド", "대학 지원 가이드", "大学申请指南"],
    "Understand applications, documents, deadlines, portals and decision tracking.": ["出願、必要書類、締め切り、ポータル、合否の管理について理解しましょう。", "지원, 서류, 마감일, 포털, 합격 결과 관리 방법을 이해해 보세요.", "了解申请、材料、截止日期、申请系统与录取结果跟踪。"],
    "Documents": ["書類", "서류", "材料"],
    "Portals": ["ポータル", "포털", "申请系统"],
    "VISA & ARRIVAL": ["ビザと渡航準備", "비자 및 도착 준비", "签证与抵达"],
    "Get ready for life after admission": ["合格後の生活に備えよう", "합격 이후의 생활을 준비하세요", "为录取后的生活做好准备"],
    "VISA": ["ビザ", "비자", "签证"],
    "Student Visa Guide": ["学生ビザガイド", "학생 비자 가이드", "学生签证指南"],
    "Understand the visa journey, documents, financial planning and interview preparation.": ["ビザ取得の流れ、必要書類、資金計画、面接対策を理解しましょう。", "비자 절차, 서류, 재정 계획, 인터뷰 준비를 이해해 보세요.", "了解签证流程、材料、资金规划与面签准备。"],
    "Finance": ["資金計画", "재정", "资金"],
    "Interview": ["面接", "인터뷰", "面签"],
    "ARRIVAL": ["到着", "도착", "抵达"],
    "Accommodation Guide": ["住まいガイド", "숙소 가이드", "住宿指南"],
    "Compare housing options and prepare for your first place abroad.": ["住居の選択肢を比較して、海外での最初の住まいに備えましょう。", "주거 옵션을 비교하고 해외에서의 첫 보금자리를 준비하세요.", "比较住房选择，为你在国外的第一个住处做准备。"],
    "Housing": ["住居", "주거", "住房"],
    "Budget": ["予算", "예산", "预算"],
    "Safety": ["安全", "안전", "安全"],
    "MONEY": ["お金", "금전", "金钱"],
    "Finance Abroad Guide": ["海外での資金管理ガイド", "해외 재정 관리 가이드", "海外理财指南"],
    "Plan tuition, living costs, banking, payments and your student budget.": ["学費、生活費、銀行、支払い、学生の予算計画を立てましょう。", "학비, 생활비, 은행, 결제, 학생 예산 계획을 세워 보세요.", "规划学费、生活费、银行、支付以及你的学生预算。"],
    "Banking": ["銀行", "은행", "银行"],
    "Payments": ["支払い", "결제", "支付"],
    "PRE-DEPARTURE": ["出発前", "출국 전", "出发前"],
    "Insurance Guide": ["保険ガイド", "보험 가이드", "保险指南"],
    "Understand the role of student health and travel coverage before departure.": ["出発前に知っておきたい、学生向け医療保険と旅行保険の役割を理解しましょう。", "출국 전 알아야 할 학생 의료보험과 여행자보험의 역할을 이해해 보세요.", "了解出发前学生医疗保险与旅行保险的作用。"],
    "Health": ["医療", "건강", "健康"],
    "Travel": ["旅行", "여행", "旅行"],
    "Coverage": ["補償", "보장", "保障范围"],
    "FINAL CHECK": ["最終チェック", "최종 점검", "最终检查"],
    "Pre-Departure Guide": ["出発前ガイド", "출국 전 가이드", "行前准备指南"],
    "Everything to organize before you leave home and arrive at your university.": ["家を出てから大学に到着するまでに整えておくべきことをまとめました。", "집을 떠나기 전부터 대학에 도착할 때까지 준비해야 할 모든 것.", "从离开家到抵达大学之前需要准备的一切。"],
    "Packing": ["荷造り", "짐 싸기", "行李打包"],
    "Arrival": ["到着", "도착", "抵达"],
    "THE COMPLETE JOURNEY": ["留学の全行程", "유학의 전체 여정", "完整的留学旅程"],
    "Six stages. One destination.": ["6つの段階、ひとつのゴール。", "여섯 단계, 하나의 목적지.", "六个阶段，一个目的地。"],
    "Follow the order or jump directly to the stage you're working on right now.": ["順番どおりに進めても、今取り組んでいる段階へ直接ジャンプしても構いません。", "순서대로 따라가도 좋고, 지금 진행 중인 단계로 바로 이동해도 좋아요.", "可以按顺序阅读，也可以直接跳到你正在进行的阶段。"],
    "START HERE": ["ここから開始", "여기서 시작", "从这里开始"],
    "Define where you're going": ["目的地を決めよう", "어디로 갈지 정하세요", "明确你的目标"],
    "Before applications, figure out what you're actually looking for. Choose your destination, degree, intake, and realistic budget.": ["出願の前に、自分が本当に何を求めているのかを整理しましょう。留学先、学位、入学時期、現実的な予算を決めます。", "지원에 앞서 내가 정말 원하는 것이 무엇인지 정리해 보세요. 유학지, 학위, 입학 시기, 현실적인 예산을 정합니다.", "申请之前，先想清楚自己真正想要什么：选择目的地、学位、入学时间和切合实际的预算。"],
    "✓ Choose destination": ["✓ 留学先を選ぶ", "✓ 유학지 선택하기", "✓ 选择目的地"],
    "✓ Pick your degree": ["✓ 学位を選ぶ", "✓ 학위 과정 정하기", "✓ 确定学位"],
    "✓ Set your budget": ["✓ 予算を設定する", "✓ 예산 정하기", "✓ 设定预算"],
    "✓ Build Safe / Target / Dream list": ["✓ 安全校・実力相応校・挑戦校のリストを作る", "✓ Safe / Target / Dream 목록 만들기", "✓ 建立保底 / 匹配 / 冲刺院校清单"],
    "Open University Finder →": ["大学検索を開く →", "대학 찾기 열기 →", "打开大学查找 →"],
    "KEY QUESTION": ["重要な問い", "핵심 질문", "关键问题"],
    "“Where do I actually have a realistic shot?”": ["「自分が現実的に狙えるのはどこだろう？」", "“내가 현실적으로 도전할 수 있는 곳은 어디일까?”", "“我真正有希望被录取的学校是哪些？”"],
    "PREPARE": ["準備", "준비", "准备"],
    "Get your scores ready": ["スコアを揃えよう", "점수를 준비하세요", "准备好你的分数"],
    "Map every test and academic requirement before deadlines start approaching.": ["締め切りが近づく前に、必要な試験と学業要件をすべて洗い出しましょう。", "마감이 다가오기 전에 필요한 시험과 학업 요건을 모두 정리해 두세요.", "在截止日期临近之前，梳理出所有需要的考试和学业要求。"],
    "IDEAL TIMING": ["理想的な時期", "이상적인 시기", "理想时间"],
    "8–12 weeks": ["8～12週間", "8~12주", "8–12 周"],
    "before first deadline": ["最初の締め切りの", "첫 마감일 전", "首个截止日期之前"],
    "FUND IT": ["資金を確保", "자금 마련", "筹措资金"],
    "Build your money plan": ["資金計画を立てよう", "자금 계획을 세우세요", "制定你的资金计划"],
    "Don't look at tuition alone. Combine scholarships, loans, savings, tuition, housing, insurance, and everyday living costs.": ["学費だけを見ないでください。奨学金、ローン、貯金、学費、住居費、保険、日々の生活費をまとめて考えましょう。", "학비만 보지 마세요. 장학금, 대출, 저축, 학비, 주거비, 보험, 일상 생활비를 함께 고려하세요.", "不要只看学费，要综合考虑奖学金、贷款、存款、学费、住房、保险和日常生活开销。"],
    "Loans": ["ローン", "대출", "贷款"],
    "Tuition": ["学費", "학비", "学费"],
    "Living costs": ["生活費", "생활비", "生活费"],
    "USE THESE TOOLS": ["こちらのツールをご利用ください", "이 도구를 활용해 보세요", "可使用以下工具"],
    "Cost Calculator →": ["費用計算 →", "비용 계산기 →", "费用计算器 →"],
    "Currency Converter →": ["通貨換算 →", "환율 계산기 →", "货币转换 →"],
    "TELL YOUR STORY": ["自分の物語を伝える", "나의 이야기를 전하세요", "讲述你的故事"],
    "Build an application that sounds like you": ["あなたらしさが伝わる出願書類を作ろう", "나다움이 느껴지는 지원서를 만드세요", "打造一份有你个人风格的申请材料"],
    "Your SOP, LORs, resume, portfolio, and supporting documents should tell one consistent story.": ["SOP、推薦状、履歴書、ポートフォリオ、添付書類は、一貫したひとつのストーリーを語るものにしましょう。", "SOP, 추천서, 이력서, 포트폴리오, 증빙 서류가 하나의 일관된 이야기를 전해야 해요.", "你的 SOP、推荐信、简历、作品集和支撑材料应当讲述同一个连贯的故事。"],
    "✓ Statement of Purpose": ["✓ 志望理由書（SOP）", "✓ 학업계획서(SOP)", "✓ 个人陈述（SOP）"],
    "✓ Recommendation Letters": ["✓ 推薦状", "✓ 추천서", "✓ 推荐信"],
    "✓ Resume / CV": ["✓ 履歴書／CV", "✓ 이력서/CV", "✓ 简历／CV"],
    "✓ Transcripts": ["✓ 成績証明書", "✓ 성적 증명서", "✓ 成绩单"],
    "APPLY": ["出願", "지원하기", "申请"],
    "Submit, track, and wait": ["提出して、追跡して、待つ", "제출하고, 추적하고, 기다리기", "提交、跟踪与等待"],
    "Apply strategically instead of sending everything at once. Track deadlines, application fees, portals, interviews, and decisions.": ["すべてを一度に送るのではなく、戦略的に出願しましょう。締め切り、出願料、ポータル、面接、結果を管理します。", "한꺼번에 모두 제출하기보다 전략적으로 지원하세요. 마감일, 지원비, 포털, 인터뷰, 결과를 관리합니다.", "有策略地申请，而不是一次性全部投出。跟踪截止日期、申请费、申请系统、面试和录取结果。"],
    "Application tracker": ["出願トラッカー", "지원 현황 관리", "申请跟踪器"],
    "Ready": ["準備完了", "준비 완료", "就绪"],
    "PRO TIP": ["ワンポイント", "꿀팁", "小贴士"],
    "Apply in waves instead of relying on one university.": ["1校に頼らず、複数回に分けて出願しましょう。", "한 학교에만 기대지 말고 여러 차례로 나누어 지원하세요.", "分批申请，不要把希望寄托在一所大学上。"],
    "YOU'RE GOING": ["いよいよ出発", "이제 출발이에요", "你要出发了"],
    "Visa, housing & takeoff": ["ビザ、住まい、そして出発", "비자, 숙소, 그리고 출발", "签证、住宿与启程"],
    "Once you've got the offer, the job changes from getting accepted to getting ready to leave.": ["合格通知を受け取ったら、目標は「合格すること」から「出発の準備を整えること」へ変わります。", "합격 통지를 받은 뒤에는 목표가 '합격'에서 '출국 준비'로 바뀝니다.", "拿到录取通知后，任务就从“被录取”变成了“做好出发的准备”。"],
    "✓ Student visa": ["✓ 学生ビザ", "✓ 학생 비자", "✓ 学生签证"],
    "✓ Accommodation": ["✓ 住居", "✓ 숙소", "✓ 住宿"],
    "✓ Health insurance": ["✓ 医療保険", "✓ 건강보험", "✓ 医疗保险"],
    "✓ Flights": ["✓ 航空券", "✓ 항공권", "✓ 机票"],
    "✓ Airport pickup": ["✓ 空港への出迎え", "✓ 공항 픽업", "✓ 机场接送"],
    "Open Visa Guide →": ["ビザガイドを開く →", "비자 가이드 열기 →", "打开签证指南 →"],
    "Before you fly ✈️": ["出発前チェック ✈️", "출국 전 점검 ✈️", "出发前检查 ✈️"],
    "Don't let a university offer become a last-minute panic.": ["合格を、直前のパニックにしないために。", "합격의 기쁨이 막판 혼란이 되지 않도록 하세요.", "别让录取通知变成临行前的手忙脚乱。"],
    "Visa approved": ["ビザ取得済み", "비자 승인 완료", "签证已获批"],
    "Accommodation confirmed": ["住居の確定", "숙소 확정", "住宿已确定"],
    "Health insurance arranged": ["医療保険の手配", "건강보험 가입", "已办理医疗保险"],
    "Flight booked": ["航空券の予約", "항공권 예약", "已订机票"],
    "University documents saved": ["大学関連書類の保存", "대학 서류 저장", "大学文件已保存"],
    "Emergency contacts ready": ["緊急連絡先の準備", "비상 연락처 준비", "紧急联系人已备好"],
    "Money / payment plan ready": ["資金・支払い計画の準備", "자금·결제 계획 준비", "资金／支付计划已备好"],
    "Airport arrival plan ready": ["空港到着後の計画の準備", "공항 도착 후 계획 준비", "机场抵达计划已备好"],
    "READY?": ["準備はいいですか？", "준비되셨나요?", "准备好了吗？"],
    "Your study abroad journey starts with one decision.": ["あなたの留学の旅は、ひとつの決断から始まります。", "당신의 유학 여정은 하나의 결심에서 시작돼요.", "你的留学之旅，从一个决定开始。"],
    "Start by finding universities that actually fit your profile.": ["まずは、あなたのプロフィールに本当に合う大学を探しましょう。", "먼저 나의 프로필에 정말 잘 맞는 대학을 찾아보세요.", "先从寻找真正适合你个人情况的大学开始。"],
    "Find my universities →": ["大学を探す →", "내 대학 찾기 →", "查找适合我的大学 →"],
    "New chat": ["新しいチャット", "새 채팅", "新对话"],
    "Clear all chats": ["すべてのチャットを削除", "모든 채팅 삭제", "清除所有对话"],
    "Your intelligent university admissions assistant": ["あなたのためのインテリジェントな大学入試アシスタント", "나를 위한 지능형 대학 입학 도우미", "你的智能大学申请助手"],
    "Ask me about universities, scholarships, admissions, visas, SOPs, LORs, IELTS, TOEFL and career planning.": ["大学、奨学金、入試、ビザ、SOP、推薦状、IELTS、TOEFL、キャリアプランについて何でも聞いてください。", "대학, 장학금, 입학, 비자, SOP, 추천서, IELTS, TOEFL, 진로 계획까지 무엇이든 물어보세요.", "你可以向我咨询大学、奖学金、录取、签证、SOP、推荐信、雅思、托福和职业规划。"],
    "Write an SOP": ["SOPを書く", "SOP 작성하기", "撰写 SOP"],
    "Create a strong Statement of Purpose": ["説得力のある志望理由書（SOP）を作成します", "설득력 있는 학업계획서(SOP)를 만들어 보세요", "写出有说服力的个人陈述"],
    "Find universities": ["大学を探す", "대학 찾기", "查找大学"],
    "Explore the best STEM universities": ["おすすめの理系（STEM）大学を探します", "최고의 STEM 대학을 알아보세요", "探索最好的理工科（STEM）大学"],
    "Visa guidance": ["ビザのアドバイス", "비자 안내", "签证指导"],
    "Understand student visa requirements": ["学生ビザの要件を理解します", "학생 비자 요건을 이해해 보세요", "了解学生签证要求"],
    "Application strategy": ["出願戦略", "지원 전략", "申请策略"],
    "Build your application roadmap": ["出願のロードマップを組み立てます", "나만의 지원 로드맵을 세워 보세요", "制定你的申请路线图"],
    "University Search": ["大学検索", "대학 검색", "大学搜索"],
    "UniAI Ready": ["UniAI 準備完了", "UniAI 준비 완료", "UniAI 已就绪"],
    "UniAI can make mistakes. Always verify important admission, visa, scholarship and university information with official sources.": ["UniAIは間違えることがあります。入試、ビザ、奨学金、大学に関する重要な情報は、必ず公式情報で確認してください。", "UniAI는 실수를 할 수 있어요. 입학, 비자, 장학금, 대학에 관한 중요한 정보는 꼭 공식 출처에서 확인하세요.", "UniAI 可能会出错。涉及录取、签证、奖学金和大学的重要信息，请务必以官方渠道为准。"],
    "UNIAI WORKSPACE": ["UNIAI ワークスペース", "UNIAI 워크스페이스", "UNIAI 工作区"],
    "Your Application Workspace": ["あなた専用の出願ワークスペース", "나의 지원 워크스페이스", "你的申请工作区"],
    "Everything you need to plan and manage your university journey.": ["大学進学の計画と管理に必要なものがすべてそろっています。", "대학 진학을 계획하고 관리하는 데 필요한 모든 것이 한곳에 있어요.", "规划和管理你的升学之路所需的一切都在这里。"],
    "+ New Project": ["+ 新規プロジェクト", "+ 새 프로젝트", "+ 新建项目"],
    "Explore": ["探索", "탐색", "探索"],
    "Discover universities based on your GPA, budget, country, course and academic profile.": ["GPA、予算、国、コース、学業プロフィールに基づいて大学を探します。", "GPA, 예산, 국가, 전공, 학업 프로필을 기준으로 대학을 찾아보세요.", "根据你的 GPA、预算、国家、专业和学术背景来发现大学。"],
    "Explore Universities": ["大学を探索する", "대학 탐색하기", "探索大学"],
    "AI Powered": ["AI搭載", "AI 기반", "AI 驱动"],
    "SOP Studio": ["SOPスタジオ", "SOP 스튜디오", "SOP 工作室"],
    "Draft, analyze and improve your Statement of Purpose with structured AI feedback.": ["志望理由書（SOP）を、構造化されたAIフィードバックで下書き・分析・改善します。", "구조화된 AI 피드백으로 학업계획서(SOP)를 초안 작성·분석·개선하세요.", "借助结构化的 AI 反馈来起草、分析并改进你的个人陈述（SOP）。"],
    "Open SOP Studio": ["SOPスタジオを開く", "SOP 스튜디오 열기", "打开 SOP 工作室"],
    "UniAI Assistant": ["UniAI アシスタント", "UniAI 어시스턴트", "UniAI 助手"],
    "Get personalized guidance for universities, admissions, scholarships, visas and applications.": ["大学、入試、奨学金、ビザ、出願について、あなたに合わせたアドバイスを受けられます。", "대학, 입학, 장학금, 비자, 지원에 대한 맞춤형 안내를 받아 보세요.", "获取有关大学、录取、奖学金、签证和申请的个性化指导。"],
    "Start Chat": ["チャットを始める", "채팅 시작하기", "开始聊天"],
    "Track": ["管理", "관리", "跟踪"],
    "Application Tracker": ["出願トラッカー", "지원 현황 관리", "申请跟踪器"],
    "Keep track of universities, application status, documents and upcoming deadlines.": ["大学、出願状況、書類、これからの締め切りを管理します。", "대학, 지원 상태, 서류, 다가오는 마감일을 관리하세요.", "跟踪大学、申请状态、材料和即将到来的截止日期。"],
    "View Applications": ["出願を見る", "지원 현황 보기", "查看申请"],
    "Scholarship Finder": ["奨学金検索", "장학금 찾기", "奖学金查找"],
    "Find scholarship opportunities and organize the ones that match your profile.": ["奨学金のチャンスを見つけて、あなたに合うものを整理しましょう。", "장학금 기회를 찾고 나에게 맞는 것들을 정리하세요.", "发现奖学金机会，并整理出适合你的那些。"],
    "Find Scholarships": ["奨学金を探す", "장학금 찾기", "查找奖学金"],
    "Planning": ["計画", "계획", "规划"],
    "Visa Planner": ["ビザプランナー", "비자 플래너", "签证规划器"],
    "Organize visa requirements, documents and preparation steps for your destination country.": ["留学先の国のビザ要件、書類、準備手順を整理しましょう。", "유학 예정 국가의 비자 요건, 서류, 준비 단계를 정리하세요.", "整理你目的地国家的签证要求、材料和准备步骤。"],
    "Open Visa Planner": ["ビザプランナーを開く", "비자 플래너 열기", "打开签证规划器"],
    "Recent Activity": ["最近のアクティビティ", "최근 활동", "最近活动"],
    "Your latest workspace activity.": ["ワークスペースでの最新のアクティビティです。", "워크스페이스의 최근 활동입니다.", "你在工作区的最新活动。"],
    "Clear": ["クリア", "지우기", "清除"],
    "Your recent activity will appear here.": ["最近のアクティビティはここに表示されます。", "최근 활동이 여기에 표시됩니다.", "你的最近活动将显示在这里。"],
    "VISA & IMMIGRATION": ["ビザ・入国管理", "비자 및 출입국", "签证与移民"],
    "Your journey starts": ["あなたの旅は、", "당신의 여정은", "你的旅程"],
    "with the right visa.": ["正しいビザから始まります。", "올바른 비자에서 시작돼요.", "始于正确的签证。"],
    "Explore student visa requirements, documents, financial requirements, processing steps and important information for your destination.": ["留学先のための学生ビザの要件、書類、資金要件、手続きの流れ、重要な情報を確認しましょう。", "유학지의 학생 비자 요건, 서류, 재정 요건, 처리 절차, 주요 정보를 살펴보세요.", "了解目的地的学生签证要求、材料、资金要求、办理流程及重要信息。"],
    "Explore destinations": ["留学先を探す", "유학지 둘러보기", "探索目的地"],
    "Student-focused guidance": ["学生に寄り添ったガイド", "학생 중심 가이드", "面向学生的指导"],
    "Simple. Clear. Organized.": ["シンプル。明確。整理されている。", "간단하고, 명확하고, 정돈되어 있어요.", "简单、清晰、条理分明。"],
    "Checklist ready": ["チェックリスト準備完了", "체크리스트 준비 완료", "清单已备好"],
    "Funds": ["資金", "자금", "资金"],
    "Financial guidance": ["資金面のガイダンス", "재정 가이드", "资金指导"],
    "Visa pathways": ["ビザの種類", "비자 유형", "签证途径"],
    "Step-by-step": ["ステップごと", "단계별", "分步"],
    "Guidance": ["ガイダンス", "안내", "指导"],
    "Focused information": ["学生に特化した情報", "학생에 맞춘 정보", "聚焦学生的信息"],
    "FIND YOUR DESTINATION": ["留学先を探す", "유학지 찾기", "寻找你的目的地"],
    "Where are you planning to study?": ["どこで学ぶ予定ですか？", "어디에서 공부할 계획인가요?", "你打算去哪里留学？"],
    "Choose a country to explore its student visa requirements and application information.": ["国を選んで、学生ビザの要件と申請情報を確認しましょう。", "국가를 선택해 학생 비자 요건과 신청 정보를 확인하세요.", "选择一个国家，了解其学生签证要求和申请信息。"],
    "Explore visa guides": ["ビザガイドを探す", "비자 가이드 둘러보기", "探索签证指南"],
    "Search destination": ["留学先を検索", "유학지 검색", "搜索目的地"],
    "Region": ["地域", "지역", "地区"],
    "All regions": ["すべての地域", "모든 지역", "所有地区"],
    "North America": ["北米", "북미", "北美洲"],
    "Europe": ["ヨーロッパ", "유럽", "欧洲"],
    "Asia": ["アジア", "아시아", "亚洲"],
    "Oceania": ["オセアニア", "오세아니아", "大洋洲"],
    "Middle East": ["中東", "중동", "中东"],
    "Visa type": ["ビザの種類", "비자 종류", "签证类型"],
    "All visa types": ["すべてのビザの種類", "모든 비자 종류", "所有签证类型"],
    "Reset": ["リセット", "초기화", "重置"],
    "Loading destinations...": ["留学先を読み込み中...", "유학지를 불러오는 중...", "正在加载目的地…"],
    "Student visa guides": ["学生ビザガイド", "학생 비자 가이드", "学生签证指南"],
    "Loading visa guides": ["ビザガイドを読み込み中", "비자 가이드 불러오는 중", "正在加载签证指南"],
    "Preparing destination information...": ["留学先の情報を準備しています...", "유학지 정보를 준비하고 있어요...", "正在准备目的地信息…"],
    "We couldn't find that destination": ["その留学先は見つかりませんでした", "해당 유학지를 찾을 수 없어요", "没有找到该目的地"],
    "Try searching for another country or remove one of your filters to see more destinations.": ["別の国を検索するか、フィルターを外して、より多くの留学先を表示してみてください。", "다른 국가를 검색하거나 필터를 해제해 더 많은 유학지를 확인해 보세요.", "试试搜索其他国家，或去掉一些筛选条件以查看更多目的地。"],
    "Clear all filters": ["すべてのフィルターをクリア", "모든 필터 지우기", "清除所有筛选条件"],
    "VISA GUIDE": ["ビザガイド", "비자 가이드", "签证指南"],
    "SOP & LOR Studio": ["SOP・推薦状スタジオ", "SOP·추천서 스튜디오", "SOP 与推荐信工作室"],
    "Build, refine, and evaluate application documents using your real academic and professional experiences.": ["あなた自身の学業・職務経験をもとに、出願書類を作成・推敲・評価します。", "실제 학업·직무 경험을 바탕으로 지원 서류를 작성하고 다듬고 평가하세요.", "结合你真实的学业与职业经历来撰写、打磨并评估申请材料。"],
    "SOP Writer": ["SOPライター", "SOP 작성기", "SOP 写作"],
    "LOR Writer": ["推薦状ライター", "추천서 작성기", "推荐信写作"],
    "Evaluator": ["評価ツール", "평가 도구", "评估器"],
    "STEP 1": ["ステップ 1", "1단계", "第 1 步"],
    "Build your SOP": ["SOPを作成する", "SOP 작성하기", "撰写你的 SOP"],
    "Start with your background, motivation, experiences, and goals.": ["これまでの背景、動機、経験、目標から始めましょう。", "배경, 동기, 경험, 목표부터 시작해 보세요.", "从你的背景、动机、经历和目标开始。"],
    "Applicant profile": ["出願者プロフィール", "지원자 프로필", "申请人资料"],
    "Basic information about the application.": ["出願に関する基本情報です。", "지원에 관한 기본 정보입니다.", "有关申请的基本信息。"],
    "Full name": ["氏名", "이름", "姓名"],
    "Target program": ["志望プログラム", "지원 프로그램", "目标专业"],
    "Target university": ["志望大学", "지원 대학", "目标大学"],
    "Intake": ["入学時期", "입학 시기", "入学时间"],
    "Select intake": ["入学時期を選択", "입학 시기 선택", "选择入学时间"],
    "Fall 2027": ["2027年秋", "2027년 가을", "2027 年秋季"],
    "Spring 2027": ["2027年春", "2027년 봄", "2027 年春季"],
    "Fall 2028": ["2028年秋", "2028년 가을", "2028 年秋季"],
    "Spring 2028": ["2028年春", "2028년 봄", "2028 年春季"],
    "Your motivation": ["あなたの動機", "나의 동기", "你的动机"],
    "Tell us what genuinely led you toward this field.": ["この分野に進むきっかけとなった本当の理由を教えてください。", "이 분야를 향하게 된 진짜 계기를 들려주세요.", "告诉我们是什么真正让你走向了这个领域。"],
    "Why did you become interested in this field?": ["この分野に興味を持ったのはなぜですか？", "이 분야에 관심을 갖게 된 이유는 무엇인가요?", "你为什么会对这个领域产生兴趣？"],
    "Think about a project, class, problem, experience, or moment that influenced your academic direction.": ["学問の方向性に影響を与えたプロジェクト、授業、問題、経験、あるいは出来事を思い出してみてください。", "학업 방향에 영향을 준 프로젝트, 수업, 문제, 경험 또는 순간을 떠올려 보세요.", "回想一个影响了你学业方向的项目、课程、问题、经历或某个瞬间。"],
    "Academic & professional experiences": ["学業・職務経験", "학업 및 직무 경험", "学术与职业经历"],
    "Add experiences that provide evidence for your goals.": ["あなたの目標を裏付ける経験を追加しましょう。", "목표를 뒷받침하는 경험을 추가하세요.", "添加能为你的目标提供佐证的经历。"],
    "+ Add Experience": ["+ 経験を追加", "+ 경험 추가", "+ 添加经历"],
    "Add your first experience": ["最初の経験を追加しましょう", "첫 번째 경험을 추가하세요", "添加你的第一段经历"],
    "Projects, internships, research, coursework, competitions, volunteering, or professional work.": ["プロジェクト、インターンシップ、研究、授業、コンテスト、ボランティア、職務経験など。", "프로젝트, 인턴십, 연구, 수업, 대회, 봉사활동, 직무 경험 등.", "项目、实习、研究、课程、竞赛、志愿服务或工作经历。"],
    "Add Experience": ["経験を追加", "경험 추가", "添加经历"],
    "Future goals": ["将来の目標", "앞으로의 목표", "未来目标"],
    "Explain what you want to do next and why this program matters.": ["次に何をしたいのか、そしてこのプログラムがなぜ重要なのかを説明してください。", "다음에 하고 싶은 일과 이 프로그램이 왜 중요한지 설명하세요.", "说明你接下来想做什么，以及这个项目为何对你重要。"],
    "Short-term goal": ["短期目標", "단기 목표", "短期目标"],
    "Long-term goal": ["長期目標", "장기 목표", "长期目标"],
    "READY TO DRAFT?": ["下書きを始めますか？", "초안을 작성할 준비가 되셨나요?", "准备好起草了吗？"],
    "Turn your experiences into a structured SOP.": ["あなたの経験を、構成のしっかりしたSOPに変えましょう。", "당신의 경험을 탄탄한 구성의 SOP로 만들어 보세요.", "把你的经历变成结构清晰的 SOP。"],
    "Your experiences should drive the story — not generic statements.": ["物語の中心は、ありきたりな表現ではなく、あなたの経験であるべきです。", "이야기의 중심은 뻔한 문장이 아니라 당신의 경험이어야 해요.", "故事应由你的经历来推动，而不是空泛的套话。"],
    "Generate SOP": ["SOPを生成", "SOP 생성하기", "生成 SOP"],
    "DRAFT": ["下書き", "초안", "草稿"],
    "Your SOP": ["あなたのSOP", "나의 SOP", "你的 SOP"],
    "Regenerate": ["再生成", "다시 생성", "重新生成"],
    "Evaluate": ["評価する", "평가하기", "评估"],
    "Editable draft": ["編集可能な下書き", "편집 가능한 초안", "可编辑草稿"],
    "Recommendation Letter Writer": ["推薦状ライター", "추천서 작성기", "推荐信写作工具"],
    "Build a recommendation letter around specific evidence, achievements, and examples.": ["具体的な根拠、実績、事例にもとづいて推薦状を作成します。", "구체적인 근거, 성과, 사례를 바탕으로 추천서를 작성하세요.", "围绕具体的事实依据、成就和事例来撰写推荐信。"],
    "Recommender information": ["推薦者の情報", "추천인 정보", "推荐人信息"],
    "Establish the relationship between the recommender and applicant.": ["推薦者と出願者の関係を明らかにしましょう。", "추천인과 지원자의 관계를 밝혀 주세요.", "说明推荐人与申请人之间的关系。"],
    "Recommender name": ["推薦者の氏名", "추천인 이름", "推荐人姓名"],
    "Position / designation": ["役職・肩書き", "직위 / 직함", "职位／头衔"],
    "Institution / organization": ["所属機関・組織", "소속 기관 / 조직", "所属机构／组织"],
    "Relationship with applicant": ["出願者との関係", "지원자와의 관계", "与申请人的关系"],
    "Applicant information": ["出願者の情報", "지원자 정보", "申请人信息"],
    "Provide the context needed for the recommendation.": ["推薦に必要な背景情報を入力してください。", "추천에 필요한 배경 정보를 입력하세요.", "请提供撰写推荐所需的背景信息。"],
    "Applicant name": ["出願者の氏名", "지원자 이름", "申请人姓名"],
    "Evidence & examples": ["根拠と事例", "근거와 사례", "依据与事例"],
    "Strong recommendations are built around specific observations, not generic adjectives.": ["説得力のある推薦状は、漠然とした形容詞ではなく、具体的な観察にもとづいています。", "설득력 있는 추천서는 막연한 형용사가 아니라 구체적인 관찰에 근거합니다.", "有说服力的推荐信建立在具体观察之上，而不是笼统的形容词。"],
    "+ Add Example": ["+ 事例を追加", "+ 사례 추가", "+ 添加事例"],
    "Add a real example": ["実際の事例を追加しましょう", "실제 사례를 추가하세요", "添加一个真实事例"],
    "For example: a project, research contribution, leadership situation, academic achievement, or problem the applicant solved.": ["例：プロジェクト、研究への貢献、リーダーシップの場面、学業上の成果、出願者が解決した課題など。", "예: 프로젝트, 연구 기여, 리더십 경험, 학업 성과, 지원자가 해결한 문제 등.", "例如：某个项目、研究贡献、领导力场景、学业成就，或申请人解决过的问题。"],
    "Add Example": ["事例を追加", "사례 추가", "添加事例"],
    "Recommender assessment": ["推薦者による評価", "추천인 평가", "推荐人评价"],
    "Describe qualities that are supported by your examples.": ["事例で裏付けられる資質について記述してください。", "사례로 뒷받침되는 자질을 서술하세요.", "请描述有事例支撑的个人特质。"],
    "Key strengths": ["主な強み", "주요 강점", "主要优势"],
    "Relative standing": ["相対的な位置づけ", "상대적 위치", "相对水平"],
    "Create an evidence-based recommendation letter.": ["根拠にもとづいた推薦状を作成します。", "근거에 기반한 추천서를 작성하세요.", "撰写一封基于事实依据的推荐信。"],
    "The strongest letters connect qualities with specific examples.": ["最も力強い推薦状は、資質と具体的な事例を結びつけています。", "가장 강력한 추천서는 자질과 구체적인 사례를 연결합니다.", "最有力的推荐信会把个人特质与具体事例紧密联系起来。"],
    "Generate LOR": ["推薦状を生成", "추천서 생성하기", "生成推荐信"],
    "Recommendation Letter": ["推薦状", "추천서", "推荐信"],
    "REVIEW": ["レビュー", "검토", "评审"],
    "Application Document Evaluator": ["出願書類評価ツール", "지원 서류 평가기", "申请材料评估器"],
    "Review your document for clarity, specificity, evidence, structure, and program alignment.": ["明確さ、具体性、根拠、構成、プログラムとの適合性の観点から書類を確認します。", "명확성, 구체성, 근거, 구성, 프로그램과의 적합성을 기준으로 서류를 검토합니다.", "从清晰度、具体性、依据、结构以及与项目的契合度等方面审阅你的材料。"],
    "Document type": ["書類の種類", "서류 종류", "材料类型"],
    "Statement of Purpose": ["志望理由書（SOP）", "학업계획서(SOP)", "个人陈述（SOP）"],
    "Letter of Recommendation": ["推薦状", "추천서", "推荐信"],
    "Your document": ["あなたの書類", "내 서류", "你的材料"],
    "Paste your current draft below. The evaluator will identify areas that need stronger evidence or clearer reasoning.": ["現在の下書きを下に貼り付けてください。評価ツールが、根拠の補強や論理の明確化が必要な点を見つけ出します。", "현재 초안을 아래에 붙여넣으세요. 평가기가 근거를 보강하거나 논리를 더 명확히 해야 할 부분을 찾아 드립니다.", "请将当前草稿粘贴到下方。评估器会指出需要补充依据或理清逻辑的地方。"],
    "DOCUMENT REVIEW": ["書類レビュー", "서류 검토", "材料评审"],
    "Find what an evaluator would question.": ["審査官が疑問に思う点を見つけ出しましょう。", "심사관이 의문을 가질 만한 부분을 찾아보세요.", "找出评审官可能会质疑的地方。"],
    "Look beyond grammar: focus on evidence, specificity, structure, motivation, and fit.": ["文法だけでなく、根拠、具体性、構成、動機、適合性に注目します。", "문법을 넘어 근거, 구체성, 구성, 동기, 적합성에 초점을 맞춥니다.", "不止看语法：更关注依据、具体性、结构、动机与契合度。"],
    "Evaluate Document": ["書類を評価する", "서류 평가하기", "评估材料"],
    "REVIEW RESULTS": ["レビュー結果", "검토 결과", "评审结果"],
    "Document Analysis": ["書類の分析", "서류 분석", "材料分析"],
    "Re-evaluate": ["再評価", "다시 평가", "重新评估"],
    "Overall": ["総合", "종합", "总分"],
    "Reviewer summary": ["レビュー総評", "검토 요약", "评审总结"],
    "Your evaluation summary will appear here.": ["評価の要約がここに表示されます。", "평가 요약이 여기에 표시됩니다.", "你的评估总结将显示在这里。"],
    "Detailed feedback": ["詳細なフィードバック", "상세 피드백", "详细反馈"],
    "Specific areas to revise before submitting.": ["提出前に修正すべき具体的なポイントです。", "제출 전에 수정해야 할 구체적인 부분입니다.", "提交前需要修改的具体之处。"],
    "NEXT STEP": ["次のステップ", "다음 단계", "下一步"],
    "Revise and evaluate again": ["修正して、もう一度評価する", "수정하고 다시 평가하기", "修改后再次评估"],
    "Use the feedback to improve your draft, then run the evaluator again.": ["フィードバックを参考に下書きを改善し、もう一度評価ツールを実行してください。", "피드백을 참고해 초안을 개선한 뒤 평가기를 다시 실행하세요.", "根据反馈改进草稿，然后再次运行评估器。"],
    "Edit Document": ["書類を編集", "서류 편집하기", "编辑材料"],
    "AI JOB NETWORK · LIVE": ["AI求人ネットワーク · ライブ", "AI 일자리 네트워크 · 라이브", "AI 职位网络 · 实时"],
    "Find work.": ["仕事を見つけよう。", "일자리를 찾으세요.", "找到工作。"],
    "Skip the paywall.": ["有料の壁なしで。", "유료 장벽 없이.", "无需付费门槛。"],
    "Remote, campus-friendly and portfolio-first opportunities that don't require a paid AI subscription.": ["有料のAIサブスクリプションが不要な、リモート、キャンパス向け、ポートフォリオ重視の仕事を紹介します。", "유료 AI 구독이 필요 없는 원격, 캠퍼스 친화적, 포트폴리오 중심 일자리를 소개해요.", "不需要付费 AI 订阅的远程、校园友好、以作品集为先的机会。"],
    "READY TO SCAN": ["スキャン準備完了", "스캔 준비 완료", "准备扫描"],
    "Opportunity engine online": ["求人エンジン オンライン", "기회 탐색 엔진 온라인", "机会引擎在线"],
    "RUN AI SCAN": ["AIスキャンを実行", "AI 스캔 실행", "运行 AI 扫描"],
    "ACTIVE ROLES": ["募集中の求人", "모집 중인 일자리", "在招职位"],
    "REMOTE": ["リモート", "원격", "远程"],
    "NO PAID AI": ["有料AI不要", "유료 AI 불필요", "无需付费 AI"],
    "AVG. MATCH": ["平均マッチ度", "평균 매칭률", "平均匹配度"],
    "ALL": ["すべて", "전체", "全部"],
    "CAMPUS": ["キャンパス", "캠퍼스", "校园"],
    "DESIGN": ["デザイン", "디자인", "设计"],
    "TECH": ["テック", "테크", "科技"],
    "Best match": ["マッチ度順", "매칭률 순", "最佳匹配"],
    "Highest pay": ["報酬が高い順", "보수 높은 순", "薪酬最高"],
    "Lowest hours": ["時間が短い順", "시간 짧은 순", "工时最短"],
    "REMOTE · 12 HRS/WEEK": ["リモート · 週12時間", "원격 · 주 12시간", "远程 · 每周 12 小时"],
    "Research assistant — climate data": ["リサーチアシスタント — 気候データ", "리서치 어시스턴트 — 기후 데이터", "研究助理 — 气候数据"],
    "Clean public datasets and turn messy climate information into short, useful research briefs.": ["公開データセットを整理し、雑多な気候情報を短く役立つ調査ブリーフにまとめます。", "공개 데이터셋을 정리하고 복잡한 기후 정보를 짧고 유용한 연구 브리프로 만듭니다.", "整理公开数据集，把杂乱的气候信息整理成简短实用的研究简报。"],
    "Research": ["リサーチ", "리서치", "研究"],
    "Data": ["データ", "데이터", "数据"],
    "AI MATCH": ["AIマッチ度", "AI 매칭률", "AI 匹配度"],
    "$400/mo": ["月額$400", "월 $400", "每月 $400"],
    "VIEW ROLE →": ["求人を見る →", "공고 보기 →", "查看职位 →"],
    "HYBRID · CAMPUS": ["ハイブリッド · キャンパス", "하이브리드 · 캠퍼스", "混合办公 · 校园"],
    "International office peer mentor": ["国際オフィスのピアメンター", "국제처 피어 멘토", "国际办公室同伴导师"],
    "Help incoming students navigate housing, orientation and their first weeks on campus.": ["新入生が住まい探しやオリエンテーション、キャンパスでの最初の数週間を乗り切れるようサポートします。", "신입생이 주거 마련, 오리엔테이션, 캠퍼스에서의 첫 몇 주를 잘 보낼 수 있도록 돕습니다.", "帮助新生解决住宿、迎新以及校园生活最初几周的各种问题。"],
    "Mentoring": ["メンタリング", "멘토링", "辅导"],
    "Communication": ["コミュニケーション", "커뮤니케이션", "沟通"],
    "Campus": ["キャンパス", "캠퍼스", "校园"],
    "$18/hr": ["時給$18", "시급 $18", "每小时 $18"],
    "REMOTE · CONTRACT": ["リモート · 契約", "원격 · 계약직", "远程 · 合同制"],
    "Open-source docs intern": ["オープンソースのドキュメント担当インターン", "오픈소스 문서화 인턴", "开源文档实习生"],
    "Improve README quality and developer documentation for a modern developer-tools organization.": ["最新の開発者向けツール組織のために、READMEの品質と開発者向けドキュメントを改善します。", "현대적인 개발자 도구 조직을 위해 README 품질과 개발자 문서를 개선합니다.", "为一家现代开发者工具组织改进 README 质量与开发者文档。"],
    "Writing": ["ライティング", "글쓰기", "写作"],
    "Docs": ["ドキュメント", "문서", "文档"],
    "Portfolio-first": ["ポートフォリオ重視", "포트폴리오 우선", "作品集优先"],
    "PART-TIME · DESIGN": ["パートタイム · デザイン", "파트타임 · 디자인", "兼职 · 设计"],
    "Scholarship content designer": ["奨学金コンテンツデザイナー", "장학금 콘텐츠 디자이너", "奖学金内容设计师"],
    "Turn complicated award criteria into simple, attractive one-page explainers.": ["複雑な奨学金の条件を、わかりやすく魅力的な1ページの解説資料にまとめます。", "복잡한 장학금 조건을 쉽고 매력적인 한 페이지 설명 자료로 만듭니다.", "把复杂的奖学金条件做成简单、美观的一页纸说明。"],
    "Design": ["デザイン", "디자인", "设计"],
    "Per article": ["記事ごと", "기사당", "按篇计酬"],
    "NO SIGNAL FOUND": ["該当なし", "검색 결과 없음", "未找到信号"],
    "Try another search or filter.": ["別の検索語やフィルターをお試しください。", "다른 검색어나 필터를 사용해 보세요.", "试试其他搜索词或筛选条件。"],
    "OPPORTUNITY DETECTED": ["求人を検出しました", "기회를 발견했어요", "发现机会"],
    "Role": ["職種", "직무", "职位"],
    "MATCH": ["マッチ度", "매칭률", "匹配度"],
    "TYPE": ["種類", "유형", "类型"],
    "PAY": ["報酬", "보수", "薪酬"],
    "EXPRESS INTEREST ↗": ["関心を伝える ↗", "관심 표현하기 ↗", "表达兴趣 ↗"],
    "APPLICATION COMMAND CENTER": ["出願コマンドセンター", "지원 커맨드 센터", "申请指挥中心"],
    "Eight milestones. One application journey.": ["8つのマイルストーン、ひとつの出願の旅。", "여덟 개의 마일스톤, 하나의 지원 여정.", "八个里程碑，一段申请之旅。"],
    "Make progress visible.": ["進捗を見える化しましょう。", "진행 상황을 눈에 보이게 하세요.", "让进度一目了然。"],
    "complete": ["完了", "완료", "已完成"],
    "YOUR PROGRESS": ["あなたの進捗", "나의 진행 상황", "你的进度"],
    "STARTING OUT": ["スタート", "시작 단계", "刚刚起步"],
    "Application journey": ["出願の道のり", "지원 여정", "申请旅程"],
    "8 milestones remaining": ["残り8つのマイルストーン", "남은 마일스톤 8개", "还剩 8 个里程碑"],
    "DISCOVERY": ["情報収集", "탐색", "探索"],
    "UP NEXT": ["次のステップ", "다음 단계", "下一步"],
    "Shortlist 8–12 universities": ["大学を8～12校に絞り込む", "대학 8~12곳 추리기", "筛选 8–12 所大学"],
    "Build your dream, target and safety university list.": ["挑戦校、実力相応校、安全校のリストを作りましょう。", "도전, 적정, 안정 지원 대학 목록을 만들어 보세요.", "建立你的冲刺、匹配与保底院校清单。"],
    "🎯 Strategy": ["🎯 戦略", "🎯 전략", "🎯 策略"],
    "PREP": ["準備", "준비", "准备"],
    "LOCK IN": ["確定する", "확정하기", "锁定"],
    "Book English test": ["英語試験を予約する", "영어 시험 예약하기", "预约英语考试"],
    "Schedule your IELTS, TOEFL or required language test.": ["IELTS、TOEFL、または必要な語学試験の日程を決めましょう。", "IELTS, TOEFL 또는 필요한 어학시험 일정을 잡으세요.", "安排你的雅思、托福或其他所需语言考试。"],
    "📝 Testing": ["📝 試験", "📝 시험", "📝 考试"],
    "Preparation": ["準備", "준비", "备考"],
    "STORY": ["ストーリー", "스토리", "故事"],
    "CREATE": ["作成", "작성", "创作"],
    "Draft SOP v1": ["SOP初稿を書く", "SOP 초안 작성하기", "撰写 SOP 初稿"],
    "Turn your experiences, goals and motivation into your first draft.": ["経験、目標、動機をまとめて、最初の下書きにしましょう。", "경험, 목표, 동기를 모아 첫 번째 초안으로 만들어 보세요.", "把你的经历、目标与动机整理成第一稿。"],
    "✦ Writing": ["✦ 執筆", "✦ 글쓰기", "✦ 写作"],
    "Personal story": ["自分のストーリー", "나만의 이야기", "个人故事"],
    "PEOPLE": ["人脈", "사람", "人脉"],
    "CONNECT": ["つながる", "연결하기", "联系"],
    "Request 2–3 LORs": ["推薦状を2～3通依頼する", "추천서 2~3통 요청하기", "请求 2–3 封推荐信"],
    "Reach out to the people who can genuinely speak about your work.": ["あなたの取り組みを本当によく知る人に依頼しましょう。", "당신의 활동을 진심으로 이야기해 줄 수 있는 분께 부탁하세요.", "联系那些真正了解你成果的人。"],
    "👥 References": ["👥 推薦者", "👥 추천인", "👥 推荐人"],
    "2–3 letters": ["推薦状2～3通", "추천서 2~3통", "2–3 封推荐信"],
    "GO TIME": ["いよいよ本番", "실전 돌입", "开始行动"],
    "Apply to 3 target schools": ["志望校3校に出願する", "목표 대학 3곳에 지원하기", "申请 3 所目标院校"],
    "Submit your strongest applications to your priority universities.": ["第一志望群の大学に、最も自信のある出願書類を提出しましょう。", "우선순위 대학에 가장 자신 있는 지원서를 제출하세요.", "向你的重点院校提交最有竞争力的申请。"],
    "🚀 Applications": ["🚀 出願", "🚀 지원", "🚀 申请"],
    "3 targets": ["志望校3校", "목표 대학 3곳", "3 所目标院校"],
    "SECURE IT": ["確保する", "확보하기", "争取到手"],
    "Submit 2 scholarship apps": ["奨学金に2件応募する", "장학금 2건 신청하기", "提交 2 项奖学金申请"],
    "Put your funding strategy into motion with focused applications.": ["的を絞った応募で、資金計画を実行に移しましょう。", "집중적인 신청으로 재정 지원 전략을 실행에 옮기세요.", "通过有针对性的申请，让你的资金计划动起来。"],
    "💎 Scholarships": ["💎 奨学金", "💎 장학금", "💎 奖学金"],
    "2 applications": ["応募2件", "신청 2건", "2 项申请"],
    "Prepare visa file": ["ビザ書類を準備する", "비자 서류 준비하기", "准备签证材料"],
    "Organize the documents and evidence you'll need for your visa process.": ["ビザ手続きに必要な書類と証拠書類を整理しましょう。", "비자 절차에 필요한 서류와 증빙 자료를 정리하세요.", "整理签证办理所需的材料与证明文件。"],
    "✈️ Visa": ["✈️ ビザ", "✈️ 비자", "✈️ 签证"],
    "LAUNCH": ["出発", "출발", "启程"],
    "FINAL STEP": ["最終ステップ", "마지막 단계", "最后一步"],
    "Housing + insurance": ["住居と保険", "주거 + 보험", "住宿 + 保险"],
    "Sort out your living arrangements and required coverage.": ["住まいの手配と、必要な補償の加入を済ませましょう。", "생활할 숙소와 필요한 보험 가입을 마무리하세요.", "安排好住处并办妥所需的保险保障。"],
    "🏠 Logistics": ["🏠 生活基盤", "🏠 생활 준비", "🏠 后勤安排"],
    "Ready to go": ["出発準備完了", "출발 준비 완료", "准备出发"],
    "FINAL DESTINATION": ["最終目的地", "최종 목적지", "最终目的地"],
    "Ready for takeoff?": ["出発の準備はできましたか？", "출발할 준비가 되셨나요?", "准备好起飞了吗？"],
    "Complete every milestone and finish your application journey.": ["すべてのマイルストーンを達成して、出願の旅を完走しましょう。", "모든 마일스톤을 달성하고 지원 여정을 완주하세요.", "完成每一个里程碑，走完你的申请之旅。"],
    "YOUR SHORTLIST": ["あなたの候補リスト", "나의 후보 목록", "你的备选清单"],
    "Keep your favourite universities, scholarships, and opportunities in one place.": ["お気に入りの大学、奨学金、チャンスをひとつの場所にまとめておきましょう。", "마음에 드는 대학, 장학금, 기회를 한곳에 모아 두세요.", "把你喜欢的大学、奖学金和机会集中保存在一个地方。"],
    "Total saved": ["保存の合計", "총 저장 수", "已保存总数"],
    "💼 Jobs": ["💼 求人", "💼 일자리", "💼 职位"],
    "Recently saved": ["最近保存した順", "최근 저장순", "最近保存"],
    "Name A–Z": ["名前 A–Z", "이름순 A–Z", "名称 A–Z"],
    "Country": ["国", "국가", "国家"],
    "Your shortlist": ["あなたの候補リスト", "나의 후보 목록", "你的备选清单"],
    "Showing all saved items": ["保存したすべてのアイテムを表示中", "저장한 항목을 모두 표시 중", "正在显示所有已保存项目"],
    "Your shortlist is empty": ["候補リストはまだ空です", "후보 목록이 비어 있어요", "你的备选清单还是空的"],
    "Start exploring universities and scholarships and save the ones you want to compare later.": ["大学や奨学金を探して、あとで比較したいものを保存しましょう。", "대학과 장학금을 둘러보고 나중에 비교하고 싶은 것을 저장해 보세요.", "开始探索大学和奖学金，把想稍后比较的保存下来。"],
    "Explore opportunities": ["チャンスを探す", "기회 둘러보기", "探索机会"],
    "No matches found": ["該当するものが見つかりません", "일치하는 항목이 없어요", "没有找到匹配项"],
    "Try a different university, scholarship, country, or keyword.": ["別の大学名、奨学金名、国、キーワードをお試しください。", "다른 대학, 장학금, 국가 또는 키워드로 검색해 보세요.", "试试其他大学、奖学金、国家或关键词。"],
    "YOUR IDENTITY": ["あなたのアイデンティティ", "나의 정체성", "你的身份"],
    "Your UniAI identity, role, and personal settings — all in one place.": ["UniAIでのあなたのアイデンティティ、役割、個人設定をひとつにまとめています。", "UniAI 정체성, 역할, 개인 설정을 한곳에 모았어요.", "你的 UniAI 身份、角色与个人设置，尽在此处。"],
    "Profile Active": ["プロフィール有効", "프로필 활성", "档案已启用"],
    "UNI.AI MEMBER": ["UNI.AI メンバー", "UNI.AI 멤버", "UNI.AI 会员"],
    "Your UniAI profile": ["あなたのUniAIプロフィール", "나의 UniAI 프로필", "你的 UniAI 档案"],
    "Connected to your Supabase account": ["Supabaseアカウントと連携済み", "Supabase 계정과 연결됨", "已连接到你的 Supabase 账户"],
    "Verified account": ["認証済みアカウント", "인증된 계정", "已验证账户"],
    "Your identity. Your learning journey. Your UniAI.": ["あなたらしさ。あなたの学びの旅。あなたのUniAI。", "나다움, 나의 배움의 여정, 나의 UniAI.", "你的身份，你的学习旅程，你的 UniAI。"],
    "Edit Profile": ["プロフィールを編集", "프로필 편집", "编辑档案"],
    "ACCOUNT TYPE": ["アカウントの種類", "계정 유형", "账户类型"],
    "Your current UniAI role": ["現在のUniAIでの役割", "현재 UniAI에서의 역할", "你当前在 UniAI 的角色"],
    "PROFILE STATUS": ["プロフィールの状態", "프로필 상태", "档案状态"],
    "Active": ["有効", "활성", "已启用"],
    "Your account is ready": ["アカウントの準備ができています", "계정이 준비되었어요", "你的账户已就绪"],
    "All systems operational": ["すべてのシステムが正常に稼働中", "모든 시스템 정상 작동 중", "所有系统运行正常"],
    "IDENTITY SYNC": ["ID同期", "정체성 동기화", "身份同步"],
    "Synced": ["同期済み", "동기화됨", "已同步"],
    "Powered by Supabase metadata": ["Supabaseのメタデータで動作", "Supabase 메타데이터 기반", "由 Supabase 元数据驱动"],
    "PERSONAL DATA": ["個人データ", "개인 정보", "个人数据"],
    "Profile Information": ["プロフィール情報", "프로필 정보", "档案信息"],
    "USERNAME": ["ユーザー名", "사용자 이름", "用户名"],
    "Your username": ["あなたのユーザー名", "내 사용자 이름", "你的用户名"],
    "ROLE": ["役割", "역할", "角色"],
    "AUTH PROVIDER": ["認証プロバイダー", "인증 제공자", "认证提供方"],
    "PROFILE SYNC": ["プロフィール同期", "프로필 동기화", "档案同步"],
    "Live": ["ライブ", "실시간", "实时"],
    "YOUR DIGITAL IDENTITY": ["あなたのデジタルアイデンティティ", "나의 디지털 정체성", "你的数字身份"],
    "Make your UniAI profile": ["UniAIプロフィールを", "UniAI 프로필을", "让你的 UniAI 档案"],
    "yours.": ["自分らしく。", "나답게 만드세요.", "更有你的风格。"],
    "Keep your username and role up to date so UniAI can personalize your experience.": ["ユーザー名と役割を最新に保つと、UniAIがあなたに合わせた体験を提供できます。", "사용자 이름과 역할을 최신으로 유지하면 UniAI가 더 맞춤화된 경험을 제공할 수 있어요.", "保持用户名和角色为最新，UniAI 就能为你提供更个性化的体验。"],
    "Customize": ["カスタマイズ", "맞춤 설정", "自定义"],
    "PREFERENCES": ["設定", "환경설정", "偏好设置"],
    "Customize your experience, account, appearance, and session preferences.": ["体験、アカウント、外観、セッションの設定をカスタマイズします。", "사용 환경, 계정, 화면 모양, 세션 설정을 내게 맞게 조정하세요.", "自定义你的使用体验、账户、外观与会话偏好。"],
    "All changes saved": ["変更はすべて保存されました", "모든 변경 사항이 저장되었어요", "所有更改已保存"],
    "Appearance": ["外観", "화면 설정", "外观"],
    "Theme & interface": ["テーマとインターフェース", "테마 및 인터페이스", "主题与界面"],
    "Account": ["アカウント", "계정", "账户"],
    "Profile & access": ["プロフィールとアクセス", "프로필 및 접근", "档案与访问"],
    "Alerts & updates": ["アラートと更新情報", "알림 및 업데이트", "提醒与更新"],
    "Preferences": ["環境設定", "환경설정", "偏好设置"],
    "General behavior": ["一般的な動作", "일반 동작", "通用行为"],
    "Session": ["セッション", "세션", "会话"],
    "Security & data": ["セキュリティとデータ", "보안 및 데이터", "安全与数据"],
    "Version 1.0.0": ["バージョン 1.0.0", "버전 1.0.0", "版本 1.0.0"],
    "INTERFACE": ["インターフェース", "인터페이스", "界面"],
    "Make the dashboard feel exactly the way you want.": ["ダッシュボードを思いどおりの見た目に整えましょう。", "대시보드를 원하는 모습으로 꾸며 보세요.", "把仪表盘调整成你喜欢的样子。"],
    "Theme": ["テーマ", "테마", "主题"],
    "Choose how the dashboard should look.": ["ダッシュボードの見た目を選択します。", "대시보드가 어떻게 보일지 선택하세요.", "选择仪表盘的外观。"],
    "Light": ["ライト", "라이트", "浅色"],
    "Clean & bright": ["すっきり明るい", "깔끔하고 밝게", "简洁明亮"],
    "Dark": ["ダーク", "다크", "深色"],
    "Easy on the eyes": ["目にやさしい", "눈이 편안해요", "护眼舒适"],
    "System": ["システム", "시스템", "跟随系统"],
    "Follow device settings": ["端末の設定に合わせる", "기기 설정 따르기", "跟随设备设置"],
    "Accent color": ["アクセントカラー", "강조 색상", "强调色"],
    "Choose the color used for highlights and actions.": ["ハイライトや操作に使う色を選びます。", "강조 표시와 버튼에 사용할 색상을 선택하세요.", "选择用于高亮和操作的颜色。"],
    "Interface": ["インターフェース", "인터페이스", "界面"],
    "Control how the dashboard behaves.": ["ダッシュボードの動作を調整します。", "대시보드의 동작 방식을 조정하세요.", "控制仪表盘的行为方式。"],
    "Compact layout": ["コンパクトレイアウト", "간결한 레이아웃", "紧凑布局"],
    "Reduce spacing to show more content at once.": ["余白を減らして、一度により多くの内容を表示します。", "여백을 줄여 한 번에 더 많은 내용을 보여줍니다.", "减少间距，一次显示更多内容。"],
    "Animations": ["アニメーション", "애니메이션", "动画效果"],
    "Enable interface transitions and subtle motion.": ["画面の切り替えやさりげない動きを有効にします。", "화면 전환과 은은한 모션을 사용합니다.", "启用界面过渡和细微动效。"],
    "ACCOUNT": ["アカウント", "계정", "账户"],
    "Manage your account and AI access.": ["アカウントとAIへのアクセスを管理します。", "계정과 AI 이용 권한을 관리하세요.", "管理你的账户与 AI 访问权限。"],
    "Signed out": ["サインアウトしました", "로그아웃됨", "已退出登录"],
    "Guest account": ["ゲストアカウント", "게스트 계정", "访客账户"],
    "Sign in to unlock personalized features and AI Chat.": ["サインインすると、パーソナライズ機能とAIチャットが利用できます。", "로그인하면 맞춤 기능과 AI 채팅을 이용할 수 있어요.", "登录后即可使用个性化功能和 AI 聊天。"],
    "Sign in": ["サインイン", "로그인", "登录"],
    "Sign out": ["サインアウト", "로그아웃", "退出登录"],
    "Delete account": ["アカウントを削除", "계정 삭제", "删除账户"],
    "AI Chat": ["AIチャット", "AI 채팅", "AI 聊天"],
    "Your AI assistant and personalized tools.": ["あなた専用のAIアシスタントとツールです。", "나를 위한 AI 어시스턴트와 맞춤 도구예요.", "你的 AI 助手与个性化工具。"],
    "Locked": ["ロック中", "잠김", "已锁定"],
    "Sign in to access AI Chat": ["AIチャットを使うにはサインインしてください", "AI 채팅을 이용하려면 로그인하세요", "登录后即可使用 AI 聊天"],
    "Your account is required before AI features can be used.": ["AI機能を利用するにはアカウントが必要です。", "AI 기능을 사용하려면 계정이 필요해요.", "使用 AI 功能需要先登录账户。"],
    "Workspace": ["ワークスペース", "워크스페이스", "工作区"],
    "Your personalized study and application workspace.": ["あなた専用の学習・出願ワークスペースです。", "나를 위한 학습·지원 워크스페이스예요.", "你的个性化学习与申请工作区。"],
    "Sign in to access Workspace": ["ワークスペースを使うにはサインインしてください", "워크스페이스를 이용하려면 로그인하세요", "登录后即可使用工作区"],
    "Your account is required before this feature can be used.": ["この機能を利用するにはアカウントが必要です。", "이 기능을 사용하려면 계정이 필요해요.", "使用此功能需要先登录账户。"],
    "Access visa guidance and personalized information.": ["ビザに関する案内と、あなたに合わせた情報を利用できます。", "비자 안내와 맞춤 정보를 이용할 수 있어요.", "获取签证指导与个性化信息。"],
    "Sign in to access the Visa Guide": ["ビザガイドを使うにはサインインしてください", "비자 가이드를 이용하려면 로그인하세요", "登录后即可使用签证指南"],
    "Create and manage your SOP and LOR tools.": ["SOPと推薦状のツールを作成・管理します。", "SOP와 추천서 도구를 만들고 관리하세요.", "创建并管理你的 SOP 与推荐信工具。"],
    "Sign in to access SOP & LOR Tools": ["SOP・推薦状ツールを使うにはサインインしてください", "SOP·추천서 도구를 이용하려면 로그인하세요", "登录后即可使用 SOP 与推荐信工具"],
    "Your personalized study-abroad roadmap.": ["あなた専用の留学ロードマップです。", "나를 위한 맞춤 유학 로드맵이에요.", "你的个性化留学路线图。"],
    "Sign in to access the Roadmap": ["ロードマップを使うにはサインインしてください", "로드맵을 이용하려면 로그인하세요", "登录后即可使用路线图"],
    "NOTIFICATIONS": ["通知", "알림", "通知"],
    "Choose which updates you want to receive.": ["受け取りたいお知らせを選択してください。", "받고 싶은 소식을 선택하세요.", "选择你想接收的更新。"],
    "Product updates": ["製品アップデート", "제품 업데이트", "产品更新"],
    "Get notified about new dashboard features.": ["ダッシュボードの新機能をお知らせします。", "대시보드의 새로운 기능을 알려드려요.", "新增仪表盘功能时通知你。"],
    "AI activity": ["AIアクティビティ", "AI 활동", "AI 动态"],
    "Receive important updates about AI features.": ["AI機能に関する重要なお知らせを受け取ります。", "AI 기능에 대한 중요한 소식을 받아보세요.", "接收有关 AI 功能的重要更新。"],
    "Tips & suggestions": ["ヒントと提案", "팁과 제안", "提示与建议"],
    "Show useful tips while using the dashboard.": ["ダッシュボードの使用中に役立つヒントを表示します。", "대시보드를 사용하는 동안 유용한 팁을 보여줍니다.", "在使用仪表盘时显示实用提示。"],
    "GENERAL": ["一般", "일반", "通用"],
    "Fine-tune your dashboard experience.": ["ダッシュボードの使い心地を細かく調整します。", "대시보드 사용 환경을 세밀하게 조정하세요.", "精细调整你的仪表盘体验。"],
    "Auto-save": ["自動保存", "자동 저장", "自动保存"],
    "Automatically save your dashboard preferences.": ["ダッシュボードの設定を自動的に保存します。", "대시보드 설정을 자동으로 저장합니다.", "自动保存你的仪表盘偏好设置。"],
    "Remember last page": ["最後のページを記憶", "마지막 페이지 기억", "记住上次页面"],
    "Reopen the dashboard where you left off.": ["前回開いていたページからダッシュボードを再開します。", "마지막으로 보던 곳에서 대시보드를 다시 엽니다.", "重新打开时回到上次离开的位置。"],
    "Confirm destructive actions": ["破壊的な操作を確認する", "삭제 등 중요한 작업 확인", "确认危险操作"],
    "Ask for confirmation before clearing data.": ["データを消去する前に確認を求めます。", "데이터를 지우기 전에 확인을 요청합니다.", "清除数据前先请求确认。"],
    "SECURITY": ["セキュリティ", "보안", "安全"],
    "Manage local session data and dashboard state.": ["ローカルのセッションデータとダッシュボードの状態を管理します。", "로컬 세션 데이터와 대시보드 상태를 관리하세요.", "管理本地会话数据与仪表盘状态。"],
    "Current session": ["現在のセッション", "현재 세션", "当前会话"],
    "Information about your current dashboard session.": ["現在のダッシュボードセッションに関する情報です。", "현재 대시보드 세션에 대한 정보입니다.", "有关当前仪表盘会话的信息。"],
    "Guest": ["ゲスト", "게스트", "访客"],
    "Local": ["ローカル", "로컬", "本地"],
    "Storage": ["ストレージ", "저장소", "存储"],
    "Browser": ["ブラウザ", "브라우저", "浏览器"],
    "Session data": ["セッションデータ", "세션 데이터", "会话数据"],
    "Clear locally stored preferences and session data.": ["ローカルに保存された設定とセッションデータを消去します。", "로컬에 저장된 설정과 세션 데이터를 지웁니다.", "清除本地保存的偏好设置与会话数据。"],
    "Reset dashboard settings": ["ダッシュボード設定をリセット", "대시보드 설정 초기화", "重置仪表盘设置"],
    "Restore all settings to their default values.": ["すべての設定を初期値に戻します。", "모든 설정을 기본값으로 되돌립니다.", "将所有设置恢复为默认值。"],
    "Reset settings": ["設定をリセット", "설정 초기화", "重置设置"],
    "Clear session": ["セッションを消去", "세션 지우기", "清除会话"],
    "Clear temporary dashboard session information.": ["一時的なダッシュボードのセッション情報を消去します。", "임시 대시보드 세션 정보를 지웁니다.", "清除临时的仪表盘会话信息。"],
    "Your preferences are stored locally on this device.": ["設定はこの端末にローカル保存されています。", "설정은 이 기기에 로컬로 저장돼요.", "你的偏好设置仅保存在此设备上。"],
    "Reset all settings": ["すべての設定をリセット", "모든 설정 초기화", "重置所有设置"],
    "Monthly rent and food, projected across a four-year degree.": ["毎月の家賃と食費を、4年間の学位期間に換算して見積もります。", "월 월세와 식비를 4년 학위 기간 기준으로 계산합니다.", "按月估算房租和餐饮，并推算整个四年学位期间的费用。"],
    "Monthly Rent ($)": ["月額家賃（$）", "월 월세 ($)", "每月房租（$）"],
    "Food & Lifestyle": ["食費・生活スタイル", "식비 및 생활 수준", "餐饮与生活方式"],
    "Budget — $250/mo": ["節約 — 月$250", "절약형 — 월 $250", "节俭 — 每月 $250"],
    "Standard — $400/mo": ["標準 — 月$400", "표준 — 월 $400", "标准 — 每月 $400"],
    "Comfortable — $600/mo": ["ゆとり — 月$600", "여유형 — 월 $600", "宽裕 — 每月 $600"],
    "Calculate": ["計算する", "계산하기", "计算"],
    "Live rates plus a quick purchasing-power snapshot.": ["最新レートと、購買力のスナップショットを手早く確認できます。", "실시간 환율과 간단한 구매력 비교를 확인하세요.", "实时汇率加上快速的购买力概览。"],
    "💱 Global Currency Exchange": ["💱 世界の通貨レート", "💱 글로벌 환율", "💱 全球汇率"],
    "Convert": ["換算する", "환산하기", "转换"],
    "Plan smarter. Go farther.": ["もっと賢く計画し、もっと遠くへ。", "더 똑똑하게 계획하고, 더 멀리 나아가세요.", "更聪明地规划，走得更远。"],
    "AI-guided support for every step of studying abroad — from shortlisting universities to landing on the right visa.": ["志望校の絞り込みから、ふさわしいビザの取得まで、留学のあらゆるステップをAIがサポートします。", "대학 선별부터 알맞은 비자 확보까지, 유학의 모든 단계를 AI가 안내해요.", "从筛选大学到拿到合适的签证，AI 为留学的每一步提供支持。"],
    "Part-Time Job Guide": ["アルバイトガイド", "아르바이트 가이드", "兼职指南"],
    "Tools": ["ツール", "도구", "工具"],
    "Popular destinations": ["人気の留学先", "인기 유학지", "热门目的地"],
    "🇺🇸 USA": ["🇺🇸 アメリカ", "🇺🇸 미국", "🇺🇸 美国"],
    "🇯🇵 Japan": ["🇯🇵 日本", "🇯🇵 일본", "🇯🇵 日本"],
    "GUIDES DIRECTORY": ["ガイド一覧", "가이드 모음", "指南目录"],
    "🇺🇸 USA Guide": ["🇺🇸 アメリカ留学ガイド", "🇺🇸 미국 가이드", "🇺🇸 美国留学指南"],
    "🇯🇵 Japan Guide": ["🇯🇵 日本留学ガイド", "🇯🇵 일본 가이드", "🇯🇵 日本留学指南"],
    "🇬🇧 UK Guide": ["🇬🇧 イギリス留学ガイド", "🇬🇧 영국 가이드", "🇬🇧 英国留学指南"],
    "🇩🇪 Germany Guide": ["🇩🇪 ドイツ留学ガイド", "🇩🇪 독일 가이드", "🇩🇪 德国留学指南"],
    "🇨🇦 Canada Guide": ["🇨🇦 カナダ留学ガイド", "🇨🇦 캐나다 가이드", "🇨🇦 加拿大留学指南"],
    "🇦🇺 Australia Guide": ["🇦🇺 オーストラリア留学ガイド", "🇦🇺 호주 가이드", "🇦🇺 澳大利亚留学指南"],
    "🇳🇱 Netherlands Guide": ["🇳🇱 オランダ留学ガイド", "🇳🇱 네덜란드 가이드", "🇳🇱 荷兰留学指南"],
    "🇫🇷 France Guide": ["🇫🇷 フランス留学ガイド", "🇫🇷 프랑스 가이드", "🇫🇷 法国留学指南"],
    "Tests & Language": ["試験・語学", "시험 및 어학", "考试与语言"],
    "📝 IELTS Guide": ["📝 IELTSガイド", "📝 IELTS 가이드", "📝 雅思（IELTS）指南"],
    "🎧 TOEFL Guide": ["🎧 TOEFLガイド", "🎧 TOEFL 가이드", "🎧 托福（TOEFL）指南"],
    "🇯🇵 JLPT Guide": ["🇯🇵 JLPTガイド", "🇯🇵 JLPT 가이드", "🇯🇵 日语能力考（JLPT）指南"],
    "📊 GRE Guide": ["📊 GREガイド", "📊 GRE 가이드", "📊 GRE 指南"],
    "📈 GMAT Guide": ["📈 GMATガイド", "📈 GMAT 가이드", "📈 GMAT 指南"],
    "🇩🇪 German Language Guide": ["🇩🇪 ドイツ語ガイド", "🇩🇪 독일어 가이드", "🇩🇪 德语学习指南"],
    "✍️ SOP Guide": ["✍️ SOPガイド", "✍️ SOP 가이드", "✍️ SOP 指南"],
    "💬 LOR Guide": ["💬 LORガイド", "💬 LOR 가이드", "💬 推荐信（LOR）指南"],
    "📄 Resume / CV Guide": ["📄 履歴書／CVガイド", "📄 이력서/CV 가이드", "📄 简历／CV 指南"],
    "🎓 Scholarship Guide": ["🎓 奨学金ガイド", "🎓 장학금 가이드", "🎓 奖学金指南"],
    "🏫 University Application Guide": ["🏫 大学出願ガイド", "🏫 대학 지원 가이드", "🏫 大学申请指南"],
    "Visa & Pre-Departure": ["ビザ・出発前", "비자 및 출국 전", "签证与行前准备"],
    "🛂 Student Visa Guide": ["🛂 学生ビザガイド", "🛂 학생 비자 가이드", "🛂 学生签证指南"],
    "🏠 Accommodation Guide": ["🏠 住まいガイド", "🏠 숙소 가이드", "🏠 住宿指南"],
    "💳 Finance Abroad Guide": ["💳 海外での資金管理ガイド", "💳 해외 재정 관리 가이드", "💳 海外理财指南"],
    "🩺 Health Insurance Guide": ["🩺 医療保険ガイド", "🩺 건강보험 가이드", "🩺 医疗保险指南"],
    "✈️ Pre-Departure Checklist": ["✈️ 出発前チェックリスト", "✈️ 출국 전 체크리스트", "✈️ 行前准备清单"],
    "Get study-abroad updates": ["留学の最新情報を受け取る", "유학 소식 받아보기", "获取留学资讯更新"],
    "Deadlines, scholarship alerts, and visa changes — sent when they matter.": ["締め切り、奨学金のお知らせ、ビザの変更を、必要なタイミングでお届けします。", "마감일, 장학금 알림, 비자 변경 사항을 꼭 필요한 때에 보내드려요.", "截止日期、奖学金提醒和签证变更，在关键时刻及时送达。"],
    "Get updates": ["最新情報を受け取る", "소식 받기", "获取更新"],
    "© 2026 UniAI. Built to help you plan smarter and go farther.": ["© 2026 UniAI. もっと賢く計画し、もっと遠くへ進むために。", "© 2026 UniAI. 더 똑똑하게 계획하고 더 멀리 나아가도록 돕습니다.", "© 2026 UniAI。助你更聪明地规划，走得更远。"],
    "Privacy": ["プライバシー", "개인정보처리방침", "隐私政策"],
    "Terms": ["利用規約", "이용약관", "服务条款"],
    "Sitemap": ["サイトマップ", "사이트맵", "网站地图"],
    "Unlock UniAI": ["UniAIを始める", "UniAI 시작하기", "解锁 UniAI"],
    "✨ Sign in to unlock your AI Chat University Assistant and start tracking your study abroad dreams!": ["✨ サインインして、AIチャット大学アシスタントを使い、留学の夢を管理し始めましょう！", "✨ 로그인하고 AI 채팅 대학 도우미를 이용하며 유학의 꿈을 관리해 보세요!", "✨ 登录即可解锁 AI 聊天大学助手，开始追踪你的留学梦想！"],
    "Counselor": ["カウンセラー", "상담사", "顾问"],
    "Sign In": ["サインイン", "로그인", "登录"],
    "Don't have an account?": ["アカウントをお持ちでないですか？", "계정이 없으신가요?", "还没有账户？"],
    "Sign Up for Free": ["無料で登録", "무료로 가입하기", "免费注册"],
    "Save Changes": ["変更を保存", "변경 사항 저장", "保存更改"],
    "Are you sure?": ["よろしいですか？", "정말 진행할까요?", "确定吗？"],
    "This action cannot be undone.": ["この操作は元に戻せません。", "이 작업은 되돌릴 수 없어요.", "此操作无法撤销。"],
    "Cancel": ["キャンセル", "취소", "取消"],
    "Confirm": ["確認", "확인", "确认"],
    "Switch to dark mode": ["ダークモードに切り替え", "다크 모드로 전환", "切换到深色模式"],
    "New York skyline": ["ニューヨークのスカイライン", "뉴욕 스카이라인", "纽约天际线"],
    "London skyline": ["ロンドンのスカイライン", "런던 스카이라인", "伦敦天际线"],
    "Tokyo street": ["東京の街並み", "도쿄 거리", "东京街景"],
    "Sydney Opera House": ["シドニー・オペラハウス", "시드니 오페라 하우스", "悉尼歌剧院"],
    "Type your question...": ["質問を入力してください...", "질문을 입력하세요...", "输入你的问题…"],
    "Country, field, scholarship name...": ["国、分野、奨学金名...", "국가, 분야, 장학금 이름...", "国家、专业领域、奖学金名称…"],
    "Chat history": ["チャット履歴", "채팅 기록", "聊天记录"],
    "Close chat history": ["チャット履歴を閉じる", "채팅 기록 닫기", "关闭聊天记录"],
    "Search chats": ["チャットを検索", "채팅 검색", "搜索对话"],
    "Your chats": ["あなたのチャット", "내 채팅", "你的对话"],
    "Toggle chat history": ["チャット履歴の表示切替", "채팅 기록 열기/닫기", "切换聊天记录"],
    "Attach file": ["ファイルを添付", "파일 첨부", "添加附件"],
    "Ask UniAI anything...": ["UniAIに何でも聞いてください...", "UniAI에게 무엇이든 물어보세요...", "向 UniAI 提任何问题…"],
    "Message UniAI": ["UniAIにメッセージ", "UniAI에게 메시지 보내기", "给 UniAI 发消息"],
    "Voice input": ["音声入力", "음성 입력", "语音输入"],
    "Send message": ["メッセージを送信", "메시지 보내기", "发送消息"],
    "Try Canada, UK, Australia...": ["カナダ、イギリス、オーストラリアなどで検索...", "캐나다, 영국, 호주 등으로 검색...", "试试搜索加拿大、英国、澳大利亚…"],
    "Close": ["閉じる", "닫기", "关闭"],
    "e.g. Aarav Sharma": ["例：Aarav Sharma", "예: Aarav Sharma", "例如：Aarav Sharma"],
    "e.g. MS Computer Science": ["例：コンピュータサイエンス修士（MS Computer Science）", "예: 컴퓨터공학 석사 (MS Computer Science)", "例如：计算机科学硕士（MS Computer Science）"],
    "e.g. University of Toronto": ["例：トロント大学", "예: 토론토 대학교", "例如：多伦多大学"],
    "Write your experience in your own words...": ["あなたの体験を、あなた自身の言葉で書いてください...", "당신의 경험을 당신의 말로 써 보세요...", "用你自己的话写下你的经历…"],
    "What do you want to learn, research, or work on after joining the program?": ["プログラムに入学した後、何を学び、研究し、取り組みたいですか？", "프로그램에 입학한 후 무엇을 배우고, 연구하고, 해 보고 싶나요?", "加入该项目后，你想学习、研究或从事哪些方面的工作？"],
    "Where do you see this degree taking you in the longer term?": ["この学位は、長期的にあなたをどこへ導くと考えていますか？", "이 학위가 장기적으로 당신을 어디로 이끌어 줄 것이라고 생각하나요?", "你认为这个学位在长远上会把你带向何处？"],
    "e.g. Dr. Priya Mehta": ["例：Priya Mehta博士", "예: Priya Mehta 박사", "例如：Priya Mehta 博士"],
    "e.g. Associate Professor": ["例：准教授", "예: 부교수", "例如：副教授"],
    "e.g. ABC University": ["例：ABC大学", "예: ABC 대학교", "例如：ABC 大学"],
    "e.g. Professor for Machine Learning": ["例：機械学習の担当教授", "예: 머신러닝 담당 교수", "例如：机器学习课程的教授"],
    "Applicant's full name": ["出願者のフルネーム", "지원자 전체 이름", "申请人全名"],
    "e.g. MS Data Science": ["例：データサイエンス修士（MS Data Science）", "예: 데이터사이언스 석사 (MS Data Science)", "例如：数据科学硕士（MS Data Science）"],
    "Which qualities does the applicant consistently demonstrate?": ["出願者が一貫して示している資質は何ですか？", "지원자가 꾸준히 보여주는 자질은 무엇인가요?", "申请人始终展现出哪些特质？"],
    "If appropriate, how does the applicant compare with other students or colleagues you have worked with?": ["差し支えなければ、これまで関わった他の学生や同僚と比べて、出願者はどのような位置づけですか？", "괜찮다면, 함께 일해 본 다른 학생이나 동료와 비교했을 때 지원자는 어느 정도 수준인가요?", "如合适，请说明申请人与你共事过的其他学生或同事相比处于什么水平。"],
    "University name": ["大学名", "대학 이름", "大学名称"],
    "Paste your SOP or LOR here...": ["SOPまたは推薦状をここに貼り付けてください...", "SOP 또는 추천서를 여기에 붙여넣으세요...", "在此粘贴你的 SOP 或推荐信…"],
    "Search roles, skills, locations...": ["職種、スキル、勤務地で検索...", "직무, 스킬, 근무지 검색...", "搜索职位、技能、地点…"],
    "Search your saved items...": ["保存したアイテムを検索...", "저장한 항목 검색...", "搜索你的已保存项目…"],
    "Default accent": ["デフォルトのアクセントカラー", "기본 강조 색상", "默认强调色"],
    "Blue accent": ["ブルーのアクセントカラー", "파란색 강조 색상", "蓝色强调色"],
    "Purple accent": ["パープルのアクセントカラー", "보라색 강조 색상", "紫色强调色"],
    "Green accent": ["グリーンのアクセントカラー", "초록색 강조 색상", "绿色强调色"],
    "Orange accent": ["オレンジのアクセントカラー", "주황색 강조 색상", "橙色强调色"],
    "Email address": ["メールアドレス", "이메일 주소", "电子邮件地址"],
    "Email": ["メールアドレス", "이메일", "电子邮件"],
    "Password": ["パスワード", "비밀번호", "密码"],
    "Username": ["ユーザー名", "사용자 이름", "用户名"],
    "SAVED TO YOUR SHORTLIST · APPLICATIONS AREN'T OPEN YET": ["候補リストに保存しました · 出願受付はまだ開始していません", "후보 목록에 저장했어요 · 지원 접수는 아직 열리지 않았어요", "已保存到你的备选清单 · 申请功能尚未开放"],
    "APPLICATIONS AREN'T OPEN YET · SIGN IN TO SAVE ROLES": ["出願受付はまだ開始していません · サインインして求人を保存しましょう", "지원 접수는 아직 열리지 않았어요 · 로그인해서 공고를 저장하세요", "申请功能尚未开放 · 登录即可保存职位"],
    "Show": ["表示", "보기", "显示"],
    "Email me a code": ["コードをメールで受け取る", "이메일로 코드 받기", "通过邮件获取验证码"],
    "Forgot password?": ["パスワードをお忘れですか？", "비밀번호를 잊으셨나요?", "忘记密码？"],
    "New to UniAI?": ["UniAIは初めてですか？", "UniAI가 처음이신가요?", "初次使用 UniAI？"],
    "Create an account": ["アカウントを作成", "계정 만들기", "创建账户"],
    "Phone": ["電話番号", "전화번호", "手机号码"],
    "optional": ["任意", "선택 사항", "可选"],
    "Adds a second way to secure your account. You can skip it.": ["アカウントを守る方法がもうひとつ増えます。スキップしても構いません。", "계정을 보호하는 두 번째 방법이 추가돼요. 건너뛰어도 괜찮아요.", "为你的账户增加第二重保护，也可以跳过。"],
    "Create account": ["アカウントを作成", "계정 만들기", "创建账户"],
    "Already have an account?": ["すでにアカウントをお持ちですか？", "이미 계정이 있으신가요?", "已有账户？"],
    "Send reset code": ["リセットコードを送信", "재설정 코드 보내기", "发送重置验证码"],
    "Back to sign in": ["サインインに戻る", "로그인으로 돌아가기", "返回登录"],
    "Verify": ["確認する", "인증하기", "验证"],
    "Resend code": ["コードを再送信", "코드 다시 보내기", "重新发送验证码"],
    "Update password": ["パスワードを更新", "비밀번호 업데이트", "更新密码"],
    "⚙️ Fine-tune your estimate": ["⚙️ 見積もりを細かく調整する", "⚙️ 예상 비용 세부 조정", "⚙️ 微调你的估算"],
    "Rent, food and transport come from the calculator above. Everything here is optional and saved on this device.": ["家賃、食費、交通費は上の計算ツールから反映されます。ここにある項目はすべて任意で、この端末に保存されます。", "월세, 식비, 교통비는 위 계산기에서 가져옵니다. 여기 있는 항목은 모두 선택 사항이며 이 기기에 저장돼요.", "房租、餐饮和交通费用取自上方的计算器。此处所有项目均为可选，并保存在此设备上。"],
    "per month": ["月あたり", "월", "每月"],
    "Enter your rent, food or other costs above to see deeper insights.": ["上の欄に家賃、食費、その他の費用を入力すると、より詳しい分析が表示されます。", "위에 월세, 식비 또는 다른 비용을 입력하면 더 자세한 분석을 볼 수 있어요.", "在上方输入房租、餐饮或其他费用，即可查看更深入的分析。"],
    "📊 Deep insights": ["📊 詳細分析", "📊 상세 분석", "📊 深度分析"],
    "Per day": ["1日あたり", "일별", "每天"],
    "Per week": ["1週間あたり", "주별", "每周"],
    "Per semester": ["1学期あたり", "학기별", "每学期"],
    "Per year": ["1年あたり", "연별", "每年"],
    "Funding picture": ["資金の全体像", "재정 현황", "资金概况"],
    "One-time costs": ["一時的な費用", "일회성 비용", "一次性费用"],
    "Total needed": ["必要総額", "필요 총액", "所需总额"],
    "Scholarship + part-time income + savings": ["奨学金 + アルバイト収入 + 貯金", "장학금 + 아르바이트 수입 + 저축", "奖学金 + 兼职收入 + 存款"],
    "Where the money goes": ["お金の使い道", "돈이 쓰이는 곳", "钱花在哪里"],
    "Difference": ["差額", "차액", "差额"],
    "Year-by-year projection": ["年ごとの推移予測", "연도별 예상 추이", "逐年预测"],
    "Living": ["生活費", "생활비", "生活费"],
    "What this means": ["この結果の意味", "결과가 의미하는 것", "这意味着什么"],
    "📋 Copy summary": ["📋 要約をコピー", "📋 요약 복사", "📋 复制摘要"],
    "⬇️ Download CSV": ["⬇️ CSVをダウンロード", "⬇️ CSV 다운로드", "⬇️ 下载 CSV"],
    "Planning estimates only. Benchmarks are rough averages, not official figures. Always check each university's own cost-of-attendance page.": ["あくまで計画用の目安です。基準値は概算の平均であり、公式の数値ではありません。必ず各大学の費用ページでご確認ください。", "계획용 추정치일 뿐이에요. 기준값은 대략적인 평균이며 공식 수치가 아닙니다. 반드시 각 대학의 비용 안내 페이지를 확인하세요.", "仅供规划参考。基准数据为粗略平均值，并非官方数据。请务必查看各大学自己的费用说明页面。"],
    "✅ Copied": ["✅ コピーしました", "✅ 복사됨", "✅ 已复制"],
    "📈 Currency insights": ["📈 通貨インサイト", "📈 환율 인사이트", "📈 汇率洞察"],
    "Rate history": ["レート推移", "환율 추이", "汇率走势"],
    "Pick two different currencies to see history.": ["2つの異なる通貨を選ぶと推移が表示されます。", "서로 다른 두 통화를 선택하면 추이를 볼 수 있어요.", "请选择两种不同的货币以查看走势。"],
    "Strong day.": ["強い日です。", "강세인 날이에요.", "汇率偏强的一天。"],
    "Weak day.": ["弱い日です。", "약세인 날이에요.", "汇率偏弱的一天。"],
    "Mid-range.": ["中間的な水準です。", "중간 수준이에요.", "处于中间水平。"],
    "Daily rate": ["日次レート", "일일 환율", "每日汇率"],
    "10-day average": ["10日間平均", "10일 평균", "10 日均值"],
    "Live rate": ["リアルタイムレート", "실시간 환율", "实时汇率"],
    "Average": ["平均", "평균", "平均"],
    "High": ["高値", "최고", "最高"],
    "Low": ["安値", "최저", "最低"],
    "Volatility": ["変動率", "변동성", "波动率"],
    "Vs average": ["平均との差", "평균 대비", "相对平均"],
    "Weakest in window": ["期間中の最安値", "기간 내 최저", "区间内最弱"],
    "Strongest in window": ["期間中の最高値", "기간 내 최고", "区间内最强"],
    "Transfer cost comparison": ["送金コストの比較", "송금 비용 비교", "汇款成本比较"],
    "Pick two different currencies to compare transfer costs.": ["2つの異なる通貨を選ぶと、送金コストを比較できます。", "서로 다른 두 통화를 선택하면 송금 비용을 비교할 수 있어요.", "请选择两种不同的货币以比较汇款成本。"],
    "Edit the markup and flat fee to match the quotes you actually get. The defaults are illustrative only.": ["実際に受け取った見積もりに合わせて、手数料率と固定手数料を編集してください。初期値は例示用です。", "실제로 받은 견적에 맞게 수수료율과 고정 수수료를 수정하세요. 기본값은 예시일 뿐입니다.", "请根据你实际拿到的报价修改加价率和固定手续费，默认值仅供示例。"],
    "I need the recipient to get": ["受取人に届けたい金額", "수취인이 받아야 할 금액", "我需要收款人收到"],
    "Provider": ["サービス提供元", "제공업체", "服务商"],
    "Markup %": ["手数料率 %", "마진율 %", "加价率 %"],
    "Recipient gets": ["受取額", "수취 금액", "收款人收到"],
    "Lost to costs": ["コストで失われる額", "비용으로 사라지는 금액", "损耗的费用"],
    "Send to deliver": ["送金に必要な額", "보내야 할 금액", "需汇出金额"],
    "Markup is the margin added on top of the mid-market rate shown above.": ["手数料率とは、上に表示した仲値レートに上乗せされるマージンのことです。", "마진율은 위에 표시된 중간 시장 환율에 더해지는 수수료 폭입니다.", "加价率是在上方显示的中间市场汇率之上额外加收的利润。"],
    "What if the rate moves?": ["レートが変動したらどうなる？", "환율이 변동되면 어떻게 될까요?", "如果汇率波动会怎样？"],
    "Pick two different currencies to see rate scenarios.": ["2つの異なる通貨を選ぶと、レートのシナリオが表示されます。", "서로 다른 두 통화를 선택하면 환율 시나리오를 볼 수 있어요.", "请选择两种不同的货币以查看汇率情景。"],
    "Useful for tuition: a 5% swing on a large payment can be a real amount, so consider paying in instalments or keeping a buffer.": ["学費の支払いでは、高額な支払いに対する5%の変動が大きな金額になることがあります。分割払いにするか、余裕資金を確保することを検討しましょう。", "학비 납부에서는 큰 금액에 대한 5% 변동도 상당한 금액이 될 수 있어요. 분할 납부하거나 여유 자금을 마련해 두는 것을 고려하세요.", "对于学费而言，大额支付中 5% 的波动也可能是一笔不小的金额，可考虑分期支付或预留缓冲资金。"],
    "Target rate": ["目標レート", "목표 환율", "目标汇率"],
    "Pick two different currencies to set a target.": ["2つの異なる通貨を選ぶと、目標レートを設定できます。", "서로 다른 두 통화를 선택하면 목표 환율을 설정할 수 있어요.", "请选择两种不同的货币以设定目标汇率。"],
    "Saved on this device for each currency pair. It is checked when you open or refresh this page, not in the background.": ["通貨ペアごとにこの端末に保存されます。このページを開いたとき、または更新したときに確認され、バックグラウンドでは確認されません。", "통화 쌍별로 이 기기에 저장됩니다. 이 페이지를 열거나 새로고침할 때만 확인하며, 백그라운드에서는 확인하지 않아요.", "按每个货币对保存在此设备上。仅在你打开或刷新此页面时检查，不会在后台检查。"],
    "Set a rate you'd be happy with to see how far away it is.": ["納得できるレートを設定すると、現在のレートとの差がわかります。", "만족스러운 환율을 설정하면 현재 환율과 얼마나 차이 나는지 볼 수 있어요.", "设定一个你满意的汇率，即可看到它与当前汇率的差距。"],
    "🎯 Target reached.": ["🎯 目標に到達しました。", "🎯 목표에 도달했어요.", "🎯 已达到目标。"],
    "Use": ["使う", "사용", "使用"],
    "Currency": ["通貨", "통화", "货币"],
    "Rate": ["レート", "환율", "汇率"],
    "Amount": ["金額", "금액", "金额"],
    "Loading UniAI": ["UniAIを読み込み中", "UniAI 불러오는 중", "正在加载 UniAI"],
    "Build your": ["あなたの", "나의", "打造你的"],
    "study future.": ["学びの未来を築こう。", "학습의 미래를 만들어 보세요.", "学习未来。"],
    "Edit Study Identity": ["スタディアイデンティティを編集", "스터디 아이덴티티 편집", "编辑学习身份"],
    "Saving… ✦": ["保存中… ✦", "저장 중… ✦", "保存中… ✦"],
    "Create my Study Identity ✦": ["スタディアイデンティティを作成 ✦", "스터디 아이덴티티 만들기 ✦", "创建我的学习身份 ✦"],
    "Could not save your profile. Please try again.": ["プロフィールを保存できませんでした。もう一度お試しください。", "프로필을 저장하지 못했어요. 다시 시도해 주세요.", "无法保存你的档案，请重试。"],
    "STUDY IDENTITY": ["スタディアイデンティティ", "스터디 아이덴티티", "学习身份"],
    "Study Identity created": ["スタディアイデンティティを作成しました", "스터디 아이덴티티가 만들어졌어요", "学习身份已创建"],
    "Your profile": ["あなたのプロフィール", "나의 프로필", "你的档案"],
    "Make it yours — level up as you go.": ["自分らしくカスタマイズして、進むほどにレベルアップしましょう。", "나답게 꾸미고, 진행할수록 레벨업하세요.", "打造属于你的风格，边前进边升级。"],
    "LEVEL": ["レベル", "레벨", "等级"],
    "DAY STREAK": ["連続日数", "연속 일수", "连续天数"],
    "COMPLETE": ["完了", "완료", "完成度"],
    "LVL 1": ["LVL 1", "LVL 1", "LV 1"],
    "🔥 DAY STREAK": ["🔥 連続日数", "🔥 연속 일수", "🔥 连续天数"],
    "⚡ TOTAL XP": ["⚡ 合計XP", "⚡ 총 XP", "⚡ 总经验值"],
    "DAILY QUESTS": ["デイリークエスト", "일일 퀘스트", "每日任务"],
    "PROFILE QUESTS": ["プロフィールクエスト", "프로필 퀘스트", "档案任务"],
    "BADGES": ["バッジ", "배지", "徽章"],
    "RECENT ACHIEVEMENTS": ["最近の実績", "최근 업적", "最近成就"],
    "PROFILE COMPLETION": ["プロフィール完成度", "프로필 완성도", "档案完成度"],
    "Choose your character": ["キャラクターを選ぶ", "캐릭터 선택", "选择你的角色"],
    "What should we call you?": ["何とお呼びしましょうか？", "어떻게 불러드릴까요?", "我们该怎么称呼你？"],
    "PHONE": ["電話番号", "전화번호", "手机号码"],
    "Saved on your account. Only the last 3 digits are shown here.": ["アカウントに保存されます。ここには下3桁のみ表示されます。", "계정에 저장돼요. 여기에는 마지막 3자리만 표시됩니다.", "已保存在你的账户中，此处仅显示末 3 位数字。"],
    "ABOUT YOU": ["あなたについて", "나에 대해", "关于你"],
    "Where are you headed?": ["どこへ向かいますか？", "어디로 향하고 있나요?", "你的目标是哪里？"],
    "Degree you're aiming for": ["目指している学位", "목표 학위", "你想攻读的学位"],
    "Save changes": ["変更を保存", "변경 사항 저장", "保存更改"],
    "LEVEL UP!": ["レベルアップ！", "레벨 업!", "升级啦！"],
    "NEW": ["NEW", "NEW", "新"],
    "e.g. Aarav": ["例：Aarav", "예: Aarav", "例如：Aarav"],
    "Dreaming of a CS masters in Berlin…": ["ベルリンでコンピュータサイエンスの修士を目指しています…", "베를린에서 컴퓨터공학 석사를 꿈꾸고 있어요…", "梦想在柏林攻读计算机科学硕士…"],
    "No phone added": ["電話番号は未登録です", "등록된 전화번호 없음", "未添加手机号"],
    "Optional": ["任意", "선택 사항", "可选"],
    "Tap a badge to see how to earn it.": ["バッジをタップすると獲得方法が確認できます。", "배지를 누르면 획득 방법을 볼 수 있어요.", "点击徽章即可查看获得方式。"],
    "Nothing here yet. Complete a profile quest or roadmap step to start your trail.": ["まだ何もありません。プロフィールクエストやロードマップのステップを完了して、軌跡を作りましょう。", "아직 아무것도 없어요. 프로필 퀘스트나 로드맵 단계를 완료해 기록을 시작하세요.", "这里还空着。完成一项档案任务或路线图步骤，开启你的成长轨迹。"],
    "Saving…": ["保存中…", "저장 중…", "保存中…"],
    "Saved ✓": ["保存しました ✓", "저장됨 ✓", "已保存 ✓"],
    "Please sign in to edit your profile.": ["プロフィールを編集するにはサインインしてください。", "프로필을 편집하려면 로그인해 주세요.", "请登录后再编辑档案。"],
    "Profile service is unavailable right now.": ["プロフィールサービスは現在利用できません。", "프로필 서비스를 지금은 이용할 수 없어요.", "档案服务暂时不可用。"],
    "PERSONAL IDENTITY": ["個人アイデンティティ", "개인 정체성", "个人身份"],
    "Save Profile": ["プロフィールを保存", "프로필 저장", "保存档案"],
    "Sign in to access your profile": ["プロフィールを見るにはサインインしてください", "프로필을 보려면 로그인하세요", "登录后即可查看你的档案"],
    "Enter your username": ["ユーザー名を入力", "사용자 이름 입력", "输入你的用户名"],
    "Save": ["保存", "저장", "保存"],
    "View": ["表示", "보기", "查看"],
    "Undo": ["元に戻す", "실행 취소", "撤销"],
    "Details": ["詳細", "상세", "详情"],
    "No scholarships match your search.": ["検索条件に一致する奨学金はありません。", "검색과 일치하는 장학금이 없어요.", "没有符合你搜索条件的奖学金。"],
    "Loading scholarships…": ["奨学金を読み込み中…", "장학금을 불러오는 중…", "正在加载奖学金…"],
    "Unable to load scholarships.": ["奨学金を読み込めません。", "장학금을 불러올 수 없어요.", "无法加载奖学金。"],
    "Try again": ["再試行", "다시 시도", "重试"],
    "No application link is available.": ["申請リンクはありません。", "신청 링크가 없어요.", "暂无申请链接。"],
    "Couldn't load scholarships": ["奨学金を読み込めませんでした", "장학금을 불러오지 못했어요", "无法加载奖学金"],
    "No scholarship ID was supplied in the page URL.": ["ページのURLに奨学金IDが指定されていません。", "페이지 URL에 장학금 ID가 지정되지 않았어요.", "页面网址中没有提供奖学金 ID。"],
    "Experience type": ["経験の種類", "경험 유형", "经历类型"],
    "Title / role": ["タイトル／役割", "제목 / 역할", "职位／角色"],
    "What did you actually do?": ["具体的に何をしましたか？", "구체적으로 무엇을 했나요?", "你具体做了什么？"],
    "What was the result?": ["その結果はどうでしたか？", "그 결과는 어땠나요?", "结果如何？"],
    "Context": ["背景", "배경", "背景"],
    "e.g. Computer Vision Intern": ["例：コンピュータビジョンのインターン", "예: 컴퓨터 비전 인턴", "例如：计算机视觉实习生"],
    "Describe your contribution, methods, tools, or responsibilities...": ["あなたの貢献、手法、使用したツール、担当した役割を説明してください...", "기여한 내용, 방법, 사용한 도구, 맡은 책임을 설명하세요...", "描述你的贡献、方法、使用的工具或所承担的职责…"],
    "Add a measurable result, outcome, finding, or lesson...": ["測定可能な成果、結果、発見、学びを追加してください...", "측정 가능한 성과, 결과, 발견 또는 배운 점을 추가하세요...", "补充可衡量的成果、结果、发现或收获…"],
    "e.g. Machine Learning course project": ["例：機械学習の授業プロジェクト", "예: 머신러닝 수업 프로젝트", "例如：机器学习课程项目"],
    "Describe the applicant's specific contribution...": ["出願者の具体的な貢献を説明してください...", "지원자의 구체적인 기여를 설명하세요...", "描述申请人的具体贡献…"],
    "What did this reveal about the applicant's ability or character?": ["この経験から、出願者の能力や人柄についてどんなことがわかりましたか？", "이 경험은 지원자의 능력이나 인성에 대해 무엇을 보여주었나요?", "这件事体现了申请人怎样的能力或品格？"],
    "Result, achievement, feedback, ranking, improvement, or other evidence...": ["成果、実績、フィードバック、順位、改善、その他の根拠...", "결과, 성과, 피드백, 순위, 개선 사항 또는 기타 근거...", "结果、成就、反馈、排名、进步或其他佐证…"],
    "Your UniAI guide": ["あなたのUniAIガイド", "나의 UniAI 가이드", "你的 UniAI 向导"],
    "Uni Buddy helps you get around UniAI. For deeper questions, use the AI Assistant.": ["Uni BuddyはUniAI内の案内役です。より詳しい質問にはAIアシスタントをご利用ください。", "Uni Buddy는 UniAI 안에서 길을 안내해 드려요. 더 깊은 질문은 AI 어시스턴트를 이용하세요.", "Uni Buddy 帮你在 UniAI 中找到所需内容；更深入的问题请使用 AI 助手。"],
    "Maybe later": ["また今度", "나중에", "以后再说"],
    "Open Uni Buddy, your UniAI guide": ["UniAIガイドのUni Buddyを開く", "UniAI 가이드 Uni Buddy 열기", "打开 Uni Buddy，你的 UniAI 向导"],
    "Ask where to find something…": ["探しているものを聞いてください…", "찾고 싶은 것을 물어보세요…", "问问我哪里能找到你需要的内容…"],
    "Uni Buddy guide": ["Uni Buddyガイド", "Uni Buddy 가이드", "Uni Buddy 向导"],
    "Message from Uni Buddy": ["Uni Buddyからのメッセージ", "Uni Buddy의 메시지", "来自 Uni Buddy 的消息"],
    "Unable to load visa guides.": ["ビザガイドを読み込めません。", "비자 가이드를 불러올 수 없어요.", "无法加载签证指南。"],
    "1 destination": ["1か所の留学先", "유학지 1곳", "1 个目的地"],
    "No destinations found": ["留学先が見つかりません", "유학지를 찾을 수 없어요", "未找到目的地"],
    "GPA fit": ["GPA適合度", "GPA 적합도", "GPA 匹配度"],
    "Add your GPA above to see how you compare.": ["上のGPA欄に入力すると、他の大学と比べた位置づけがわかります。", "위에 GPA를 입력하면 나와 어떻게 비교되는지 볼 수 있어요.", "在上方填写你的 GPA，即可看到你与各校的对比。"],
    "Not listed": ["掲載なし", "정보 없음", "未列出"],
    "Typical GPA": ["合格者の目安GPA", "합격자 평균 GPA", "录取者常见 GPA"],
    "Quick view": ["クイックビュー", "빠르게 보기", "快速查看"],
    "Website": ["ウェブサイト", "웹사이트", "官网"],
    "Explore →": ["詳しく見る →", "자세히 보기 →", "了解更多 →"],
    "Switch the filter back to “All” to see the other matches.": ["フィルターを「すべて」に戻すと、他のマッチも表示されます。", "필터를 '전체'로 되돌리면 다른 결과도 볼 수 있어요.", "将筛选条件切换回“全部”即可查看其他匹配项。"],
    "Searching universities…": ["大学を検索しています…", "대학을 검색하는 중…", "正在搜索大学…"],
    "Checking names, countries and budget": ["大学名、国、予算を確認しています", "대학 이름, 국가, 예산을 확인하는 중", "正在核对名称、国家与预算"],
    "Full profile →": ["プロフィールを見る →", "전체 프로필 →", "查看完整档案 →"],
    "Official website →": ["公式サイト →", "공식 웹사이트 →", "官方网站 →"],
    "remove": ["削除", "삭제", "移除"],
    "Nothing saved yet. Star a university in Finder to keep it here.": ["まだ何も保存されていません。大学検索で大学にスターを付けると、ここに保存されます。", "아직 저장된 항목이 없어요. 대학 찾기에서 대학에 별표를 누르면 여기에 저장돼요.", "还没有保存任何内容。在大学查找中给大学加星标，即可保存在这里。"],
    "Monthly budget": ["月間予算", "월 예산", "每月预算"],
    "Annual estimate": ["年間見積もり", "연간 예상 비용", "年度估算"],
    "4-year total": ["4年間の合計", "4년 합계", "四年总计"],
    "Budget health index": ["予算健全度指数", "예산 건전성 지수", "预算健康指数"],
    "Spending distribution": ["支出の内訳", "지출 분포", "支出分布"],
    "YOUR MONTHLY": ["あなたの月額", "나의 월 지출", "你的每月支出"],
    "AVERAGE STUDENT": ["平均的な学生", "평균적인 학생", "平均水平学生"],
    "DIFFERENCE": ["差額", "차이", "差额"],
    "● Live rate": ["● リアルタイムレート", "● 실시간 환율", "● 实时汇率"],
    "Tip:": ["ヒント：", "팁:", "提示："],
    "convert in larger blocks to reduce per-transaction fees, and compare your bank's markup against the mid-market rate shown here.": ["まとまった金額でまとめて換算すると取引ごとの手数料を抑えられます。また、ここに表示された仲値レートと比べて、利用中の銀行の手数料率を確認しましょう。", "큰 금액으로 나누지 않고 한꺼번에 환전하면 건당 수수료를 줄일 수 있어요. 또한 여기 표시된 중간 시장 환율과 이용 중인 은행의 마진율을 비교해 보세요.", "较大金额一次性兑换可以减少单笔手续费，并将你的银行加价与此处显示的中间市场汇率进行比较。"],
    "✎ Rename": ["✎ 名前を変更", "✎ 이름 바꾸기", "✎ 重命名"],
    "🗑 Delete": ["🗑 削除", "🗑 삭제", "🗑 删除"],
    "Free preview": ["無料プレビュー", "무료 미리보기", "免费预览"],
    "Signed in": ["サインイン済み", "로그인됨", "已登录"],
    "Unlocked": ["利用可能", "이용 가능", "已解锁"],
    "Authenticated": ["認証済み", "인증됨", "已验证"],
    "Cloud Sync": ["クラウド同期", "클라우드 동기화", "云同步"],
    "Auth service unavailable.": ["認証サービスは利用できません。", "인증 서비스를 이용할 수 없어요.", "认证服务不可用。"],
    "Username cannot be empty.": ["ユーザー名は空にできません。", "사용자 이름은 비워 둘 수 없어요.", "用户名不能为空。"],
    "QS World University Ranking": ["QS世界大学ランキング", "QS 세계 대학 순위", "QS 世界大学排名"],
    "Chat title": ["チャットのタイトル", "채팅 제목", "对话标题"],
    "Voice input isn't supported in this browser": ["このブラウザでは音声入力に対応していません", "이 브라우저는 음성 입력을 지원하지 않아요", "此浏览器不支持语音输入"],
    "Stop voice input": ["音声入力を停止", "음성 입력 중지", "停止语音输入"],
    "Back to top": ["ページの先頭へ", "맨 위로", "回到顶部"],
    "Deleting…": ["削除中…", "삭제 중…", "正在删除…"],
    "Voice input isn't supported in this browser.": ["このブラウザでは音声入力に対応していません。", "이 브라우저는 음성 입력을 지원하지 않아요.", "此浏览器不支持语音输入。"],
    "Authentication service is unavailable.": ["認証サービスは利用できません。", "인증 서비스를 이용할 수 없어요.", "认证服务不可用。"],
    "You must be signed in to delete your account.": ["アカウントを削除するにはサインインが必要です。", "계정을 삭제하려면 로그인해야 해요.", "删除账户前必须先登录。"],
    "Your UniAI account has been deleted.": ["UniAIアカウントを削除しました。", "UniAI 계정이 삭제되었어요.", "你的 UniAI 账户已被删除。"],
    "Showing {x} of {y} universities": ["{y}校中 {x}校を表示", "대학 {y}곳 중 {x}곳 표시", "共 {y} 所大学，显示 {x} 所"],
    "Showing {x} of {y} universities for “{z}”": ["「{z}」の検索結果：{y}校中 {x}校を表示", "“{z}” 검색 결과: 대학 {y}곳 중 {x}곳 표시", "“{z}”的搜索结果：共 {y} 所大学，显示 {x} 所"],
    "Sort by": ["並び替え", "정렬 기준", "排序方式"],
    "Best fit": ["適合度順", "적합도순", "最佳适配"],
    "QS rank": ["QSランキング順", "QS 순위순", "QS 排名"],
    "Tuition: low to high": ["学費の安い順", "학비 낮은 순", "学费从低到高"],
    "Filter by admission fit": ["合格の見込みで絞り込む", "합격 적합도로 필터링", "按录取适配度筛选"],
    "All ({x})": ["すべて ({x})", "전체 ({x})", "全部 ({x})"],
    "Target ({x})": ["実力相応校 ({x})", "적정 ({x})", "匹配 ({x})"],
    "Safe ({x})": ["安全校 ({x})", "안정 ({x})", "保底 ({x})"],
    "Dream ({x})": ["挑戦校 ({x})", "도전 ({x})", "冲刺 ({x})"],
    "Safe": ["安全校", "안정", "保底"],
    "Target": ["実力相応校", "적정", "匹配"],
    "Dream": ["挑戦校", "도전", "冲刺"],
    "Your GPA ≈ {x} · typical admit ≈ {y}": ["あなたのGPA ≈ {x} · 合格者の目安 ≈ {y}", "내 GPA ≈ {x} · 합격자 평균 ≈ {y}", "你的 GPA ≈ {x} · 录取者常见 ≈ {y}"],
    "Your GPA ≈ {x} · typical admit ≈ {y} (estimated)": ["あなたのGPA ≈ {x} · 合格者の目安 ≈ {y}（推定）", "내 GPA ≈ {x} · 합격자 평균 ≈ {y} (추정)", "你的 GPA ≈ {x} · 录取者常见 ≈ {y}（估算）"],
    "est.": ["推定", "추정", "估算"],
    "/yr": ["/年", "/년", "/年"],
    "☆ Save": ["☆ 保存", "☆ 저장", "☆ 保存"],
    "★ Saved": ["★ 保存済み", "★ 저장됨", "★ 已保存"],
    "Show {x} more": ["さらに{x}件表示", "{x}개 더 보기", "再显示 {x} 个"],
    "({x} left)": ["（残り{x}件）", "(남은 {x}개)", "（还剩 {x} 个）"],
    "University data isn't available right now": ["大学データは現在利用できません", "지금은 대학 데이터를 이용할 수 없어요", "目前无法获取大学数据"],
    "We couldn't reach the server. Check your connection and try again.": ["サーバーに接続できませんでした。接続を確認して、もう一度お試しください。", "서버에 연결하지 못했어요. 연결 상태를 확인하고 다시 시도해 주세요.", "无法连接服务器。请检查网络连接后重试。"],
    "Nothing matched {x}. Try fewer words, check the spelling, raise the budget, or clear the country.": ["{x} に一致するものはありませんでした。語数を減らす、スペルを確認する、予算を上げる、または国の指定を外してみてください。", "{x}와(과) 일치하는 결과가 없어요. 단어 수를 줄이거나 철자를 확인하거나 예산을 높이거나 국가 선택을 해제해 보세요.", "没有找到与 {x} 匹配的结果。请尝试减少关键词、检查拼写、提高预算或取消国家限定。"],
    "Try adding a country, a budget, or a university name.": ["国、予算、または大学名を追加してみてください。", "국가, 예산 또는 대학 이름을 추가해 보세요.", "试试添加国家、预算或大学名称。"],
    "No {x} universities in these results": ["この結果には「{x}」の大学がありません", "이 결과에는 '{x}' 대학이 없어요", "这些结果中没有“{x}”类大学"],
    "Read as a {x} / 10 CGPA ≈ {y} on the 4.0 scale (approximate).": ["{x} / 10 のCGPAとして解釈：4.0スケールで約 {y}（概算）。", "{x} / 10 CGPA로 해석: 4.0 만점 기준 약 {y} (근사치).", "按 {x} / 10 的 CGPA 解读：约合 4.0 制的 {y}（近似值）。"],
    "Read as {x}% ≈ {y} on the 4.0 scale (approximate).": ["{x}% として解釈：4.0スケールで約 {y}（概算）。", "{x}%로 해석: 4.0 만점 기준 약 {y} (근사치).", "按 {x}% 解读：约合 4.0 制的 {y}（近似值）。"],
    "That GPA looks out of range. Use 0–4, a 10-point CGPA, or a percentage.": ["そのGPAは範囲外のようです。0〜4、10段階のCGPA、またはパーセンテージで入力してください。", "해당 GPA가 범위를 벗어난 것 같아요. 0~4, 10점제 CGPA 또는 백분율로 입력하세요.", "该 GPA 似乎超出范围。请使用 0–4 分制、10 分制 CGPA 或百分制。"],
    "{x} universities have no tuition listed, so the budget filter can't check them.": ["{x}校は学費が掲載されていないため、予算フィルターで確認できません。", "대학 {x}곳은 학비 정보가 없어 예산 필터로 확인할 수 없어요.", "有 {x} 所大学未列出学费，预算筛选无法对其进行判断。"],
    "1 university has no tuition listed, so the budget filter can't check it.": ["1校は学費が掲載されていないため、予算フィルターで確認できません。", "대학 1곳은 학비 정보가 없어 예산 필터로 확인할 수 없어요.", "有 1 所大学未列出学费，预算筛选无法对其进行判断。"],
    "This is the first batch of your database. Search by name, country or budget to look through all universities.": ["これはデータベースの最初の一部です。大学名、国、予算で検索すると、すべての大学から探せます。", "데이터베이스의 첫 번째 묶음이에요. 이름, 국가, 예산으로 검색하면 모든 대학에서 찾아볼 수 있어요.", "这只是数据库中的第一批数据。按名称、国家或预算搜索，即可查看全部大学。"],
    "Where your database has no typical GPA, it is estimated from the QS rank. Treat Safe / Target / Dream as a guide, not a prediction.": ["データベースに合格者の目安GPAがない場合は、QSランキングから推定しています。安全校／実力相応校／挑戦校は予測ではなく目安として参考にしてください。", "데이터베이스에 합격자 평균 GPA가 없는 경우 QS 순위로 추정합니다. 안정/적정/도전 분류는 예측이 아닌 참고용으로 활용하세요.", "数据库中没有常见录取 GPA 的，系统会根据 QS 排名估算。保底／匹配／冲刺仅供参考，并非预测。"],
    "🏆 HIGHEST RANKED": ["🏆 最高ランキング", "🏆 최고 순위", "🏆 排名最高"],
    "💳 LOWEST TUITION": ["💳 最安の学費", "💳 최저 학비", "💳 学费最低"],
    "🌍 COUNTRIES": ["🌍 国の数", "🌍 국가 수", "🌍 国家数"],
    "🎓 UNIVERSITIES": ["🎓 大学数", "🎓 대학 수", "🎓 大学数"],
    "🎯 TARGET MATCH": ["🎯 実力相応校", "🎯 적정 대학", "🎯 匹配院校"],
    "🛡️ SAFE OPTION": ["🛡️ 安全校", "🛡️ 안정 대학", "🛡️ 保底院校"],
    "✨ DREAM REACH": ["✨ 挑戦校", "✨ 도전 대학", "✨ 冲刺院校"],
    "None in these results": ["この結果には該当なし", "이 결과에는 없음", "这些结果中没有"],
    "No ranking data": ["ランキングデータなし", "순위 데이터 없음", "暂无排名数据"],
    "in these results": ["この結果内", "이 결과 내", "在这些结果中"],
    "Add your GPA for Safe / Target / Dream": ["GPAを入力すると安全校／実力相応校／挑戦校が表示されます", "GPA를 입력하면 안정/적정/도전 분류를 볼 수 있어요", "填写 GPA 即可查看保底／匹配／冲刺分类"],
    "Location not listed": ["所在地は未掲載", "위치 정보 없음", "未列出所在地"],
    "Mark all read": ["すべて既読にする", "모두 읽음 표시", "全部标为已读"],
    "Notifications, {x} unread": ["通知（未読{x}件）", "알림 (읽지 않음 {x}개)", "通知（{x} 条未读）"],
    "Due today: {x}": ["本日締め切り：{x}", "오늘 마감: {x}", "今天截止：{x}"],
    "Due tomorrow: {x}": ["明日締め切り：{x}", "내일 마감: {x}", "明天截止：{x}"],
    "Due in {x} days: {y}": ["締め切りまであと{x}日：{y}", "마감까지 {x}일 남음: {y}", "{x} 天后截止：{y}"],
    "A scholarship on your Saved list is closing soon. Check the official page and submit in time.": ["保存済みリストにある奨学金の締め切りが近づいています。公式ページを確認し、期限内に提出しましょう。", "저장한 목록의 장학금이 곧 마감돼요. 공식 페이지를 확인하고 기한 내에 제출하세요.", "你收藏的一项奖学金即将截止，请查看官方页面并及时提交。"],
    "Roadmap complete": ["ロードマップ完了", "로드맵 완료", "路线图已完成"],
    "You finished every milestone. Time to book that flight.": ["すべてのマイルストーンを達成しました。航空券を予約しましょう。", "모든 마일스톤을 완료했어요. 이제 항공권을 예약할 시간이에요.", "你完成了所有里程碑，是时候订机票了。"],
    "Roadmap: 75% complete": ["ロードマップ：75%完了", "로드맵: 75% 완료", "路线图：已完成 75%"],
    "Final stretch — only a few milestones left.": ["ラストスパート — 残りのマイルストーンはあとわずかです。", "마지막 구간이에요 — 남은 마일스톤이 몇 개 안 돼요.", "冲刺阶段 — 只剩几个里程碑了。"],
    "Roadmap: halfway there": ["ロードマップ：折り返し地点", "로드맵: 절반 달성", "路线图：已完成一半"],
    "Half of your milestones are done. Keep the momentum.": ["マイルストーンの半分が完了しました。この調子で進みましょう。", "마일스톤의 절반을 마쳤어요. 이 기세를 이어가세요.", "一半的里程碑已完成，保持这股势头。"],
    "Roadmap: 25% complete": ["ロードマップ：25%完了", "로드맵: 25% 완료", "路线图：已完成 25%"],
    "Good start. The next milestones are waiting.": ["いいスタートです。次のマイルストーンが待っています。", "좋은 출발이에요. 다음 마일스톤이 기다리고 있어요.", "开局不错，下一批里程碑正等着你。"],
    "Your account data was updated": ["アカウントのデータが更新されました", "계정 데이터가 업데이트되었어요", "你的账户数据已更新"],
    "Saved items and settings from your other devices have been loaded here.": ["他の端末で保存した項目と設定がここに読み込まれました。", "다른 기기에서 저장한 항목과 설정을 불러왔어요.", "已加载你在其他设备上保存的项目与设置。"],
    "just now": ["たった今", "방금", "刚刚"],
    "BUILDING MOMENTUM": ["勢いをつけ中", "탄력 붙는 중", "积蓄动力"],
    "MAKING PROGRESS": ["順調に進行中", "착실히 진행 중", "稳步推进"],
    "HALFWAY THERE": ["折り返し地点", "절반 도달", "已过半程"],
    "FINAL STRETCH": ["ラストスパート", "마지막 구간", "最后冲刺"],
    "MISSION COMPLETE": ["ミッション完了", "미션 완료", "任务完成"],
    "{x} / {y} complete": ["{x} / {y} 完了", "{x} / {y} 완료", "已完成 {x} / {y}"],
    "All milestones complete 🎉": ["すべてのマイルストーンを達成 🎉", "모든 마일스톤 달성 🎉", "所有里程碑均已完成 🎉"],
    "{x} milestones remaining": ["残り{x}個のマイルストーン", "남은 마일스톤 {x}개", "还剩 {x} 个里程碑"],
    "1 milestone remaining": ["残り1個のマイルストーン", "남은 마일스톤 1개", "还剩 1 个里程碑"],
    "Still there?": ["まだご利用中ですか？", "아직 계신가요?", "还在吗？"],
    "Stay signed in": ["サインインを維持", "로그인 유지하기", "保持登录"],
    "You'll be signed out in": ["あと", "계정 보호를 위해", "为保护账户安全，将在"],
    "s to keep your account safe.": ["秒でサインアウトします（アカウント保護のため）。", "초 후 로그아웃됩니다.", "秒后退出登录。"],
    "You were signed out after {x} minutes of inactivity.": ["{x}分間操作がなかったためサインアウトしました。", "{x}분 동안 활동이 없어 로그아웃되었어요.", "由于 {x} 分钟无操作，你已被退出登录。"],
    "Switch to light mode": ["ライトモードに切り替え", "라이트 모드로 전환", "切换到浅色模式"],
    "United States": ["アメリカ合衆国", "미국", "美国"],
    "United Kingdom": ["イギリス", "영국", "英国"],
    "Canada": ["カナダ", "캐나다", "加拿大"],
    "Australia": ["オーストラリア", "호주", "澳大利亚"],
    "Germany": ["ドイツ", "독일", "德国"],
    "France": ["フランス", "프랑스", "法国"],
    "Japan": ["日本", "일본", "日本"],
    "China": ["中国", "중국", "中国"],
    "India": ["インド", "인도", "印度"],
    "Singapore": ["シンガポール", "싱가포르", "新加坡"],
    "South Korea": ["韓国", "대한민국", "韩国"],
    "Netherlands": ["オランダ", "네덜란드", "荷兰"],
    "Ireland": ["アイルランド", "아일랜드", "爱尔兰"],
    "New Zealand": ["ニュージーランド", "뉴질랜드", "新西兰"],
    "Switzerland": ["スイス", "스위스", "瑞士"],
    "Sweden": ["スウェーデン", "스웨덴", "瑞典"],
    "Norway": ["ノルウェー", "노르웨이", "挪威"],
    "Denmark": ["デンマーク", "덴마크", "丹麦"],
    "Finland": ["フィンランド", "핀란드", "芬兰"],
    "Italy": ["イタリア", "이탈리아", "意大利"],
    "Spain": ["スペイン", "스페인", "西班牙"],
    "Portugal": ["ポルトガル", "포르투갈", "葡萄牙"],
    "Belgium": ["ベルギー", "벨기에", "比利时"],
    "Austria": ["オーストリア", "오스트리아", "奥地利"],
    "Poland": ["ポーランド", "폴란드", "波兰"],
    "Czech Republic": ["チェコ", "체코", "捷克"],
    "Czechia": ["チェコ", "체코", "捷克"],
    "Hungary": ["ハンガリー", "헝가리", "匈牙利"],
    "Greece": ["ギリシャ", "그리스", "希腊"],
    "Turkey": ["トルコ", "튀르키예", "土耳其"],
    "Russia": ["ロシア", "러시아", "俄罗斯"],
    "United Arab Emirates": ["アラブ首長国連邦", "아랍에미리트", "阿拉伯联合酋长国"],
    "UAE": ["アラブ首長国連邦", "아랍에미리트", "阿联酋"],
    "Saudi Arabia": ["サウジアラビア", "사우디아라비아", "沙特阿拉伯"],
    "Qatar": ["カタール", "카타르", "卡塔尔"],
    "Israel": ["イスラエル", "이스라엘", "以色列"],
    "Egypt": ["エジプト", "이집트", "埃及"],
    "South Africa": ["南アフリカ", "남아프리카공화국", "南非"],
    "Nigeria": ["ナイジェリア", "나이지리아", "尼日利亚"],
    "Kenya": ["ケニア", "케냐", "肯尼亚"],
    "Ghana": ["ガーナ", "가나", "加纳"],
    "Ethiopia": ["エチオピア", "에티오피아", "埃塞俄比亚"],
    "Uganda": ["ウガンダ", "우간다", "乌干达"],
    "Tanzania": ["タンザニア", "탄자니아", "坦桑尼亚"],
    "Rwanda": ["ルワンダ", "르완다", "卢旺达"],
    "Zimbabwe": ["ジンバブエ", "짐바브웨", "津巴布韦"],
    "Zambia": ["ザンビア", "잠비아", "赞比亚"],
    "Botswana": ["ボツワナ", "보츠와나", "博茨瓦纳"],
    "Namibia": ["ナミビア", "나미비아", "纳米比亚"],
    "Mauritius": ["モーリシャス", "모리셔스", "毛里求斯"],
    "Morocco": ["モロッコ", "모로코", "摩洛哥"],
    "Tunisia": ["チュニジア", "튀니지", "突尼斯"],
    "Brazil": ["ブラジル", "브라질", "巴西"],
    "Argentina": ["アルゼンチン", "아르헨티나", "阿根廷"],
    "Chile": ["チリ", "칠레", "智利"],
    "Mexico": ["メキシコ", "멕시코", "墨西哥"],
    "Colombia": ["コロンビア", "콜롬비아", "哥伦比亚"],
    "Peru": ["ペルー", "페루", "秘鲁"],
    "Ecuador": ["エクアドル", "에콰도르", "厄瓜多尔"],
    "Uruguay": ["ウルグアイ", "우루과이", "乌拉圭"],
    "Cuba": ["キューバ", "쿠바", "古巴"],
    "Jamaica": ["ジャマイカ", "자메이카", "牙买加"],
    "Panama": ["パナマ", "파나마", "巴拿马"],
    "Costa Rica": ["コスタリカ", "코스타리카", "哥斯达黎加"],
    "Trinidad and Tobago": ["トリニダード・トバゴ", "트리니다드 토바고", "特立尼达和多巴哥"],
    "Puerto Rico": ["プエルトリコ", "푸에르토리코", "波多黎各"],
    "Malaysia": ["マレーシア", "말레이시아", "马来西亚"],
    "Thailand": ["タイ", "태국", "泰国"],
    "Vietnam": ["ベトナム", "베트남", "越南"],
    "Indonesia": ["インドネシア", "인도네시아", "印度尼西亚"],
    "Philippines": ["フィリピン", "필리핀", "菲律宾"],
    "Hong Kong": ["香港", "홍콩", "中国香港"],
    "Macau": ["マカオ", "마카오", "中国澳门"],
    "Taiwan": ["台湾", "대만", "中国台湾"],
    "Pakistan": ["パキスタン", "파키스탄", "巴基斯坦"],
    "Bangladesh": ["バングラデシュ", "방글라데시", "孟加拉国"],
    "Sri Lanka": ["スリランカ", "스리랑카", "斯里兰卡"],
    "Nepal": ["ネパール", "네팔", "尼泊尔"],
    "Cambodia": ["カンボジア", "캄보디아", "柬埔寨"],
    "Laos": ["ラオス", "라오스", "老挝"],
    "Myanmar": ["ミャンマー", "미얀마", "缅甸"],
    "Brunei": ["ブルネイ", "브루나이", "文莱"],
    "Mongolia": ["モンゴル", "몽골", "蒙古"],
    "Iran": ["イラン", "이란", "伊朗"],
    "Iraq": ["イラク", "이라크", "伊拉克"],
    "Lebanon": ["レバノン", "레바논", "黎巴嫩"],
    "Jordan": ["ヨルダン", "요르단", "约旦"],
    "Oman": ["オマーン", "오만", "阿曼"],
    "Kuwait": ["クウェート", "쿠웨이트", "科威特"],
    "Bahrain": ["バーレーン", "바레인", "巴林"],
    "Iceland": ["アイスランド", "아이슬란드", "冰岛"],
    "Luxembourg": ["ルクセンブルク", "룩셈부르크", "卢森堡"],
    "Malta": ["マルタ", "몰타", "马耳他"],
    "Cyprus": ["キプロス", "키프로스", "塞浦路斯"],
    "Estonia": ["エストニア", "에스토니아", "爱沙尼亚"],
    "Latvia": ["ラトビア", "라트비아", "拉脱维亚"],
    "Lithuania": ["リトアニア", "리투아니아", "立陶宛"],
    "Slovenia": ["スロベニア", "슬로베니아", "斯洛文尼亚"],
    "Slovakia": ["スロバキア", "슬로바키아", "斯洛伐克"],
    "Croatia": ["クロアチア", "크로아티아", "克罗地亚"],
    "Serbia": ["セルビア", "세르비아", "塞尔维亚"],
    "Romania": ["ルーマニア", "루마니아", "罗马尼亚"],
    "Bulgaria": ["ブルガリア", "불가리아", "保加利亚"],
    "Ukraine": ["ウクライナ", "우크라이나", "乌克兰"],
    "Belarus": ["ベラルーシ", "벨라루스", "白俄罗斯"],
    "Kazakhstan": ["カザフスタン", "카자흐스탄", "哈萨克斯坦"],
    "Uzbekistan": ["ウズベキスタン", "우즈베키스탄", "乌兹别克斯坦"],
    "Georgia": ["ジョージア", "조지아", "格鲁吉亚"],
    "Armenia": ["アルメニア", "아르메니아", "亚美尼亚"],
    "Azerbaijan": ["アゼルバイジャン", "아제르바이잔", "阿塞拜疆"]
  };

  /* ------------------------------------------------------------------------
     Lookup tables built from DICT
     ------------------------------------------------------------------------ */

  const norm = (s) => String(s).replace(/\s+/g, " ").trim();
  const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  const EXACT = new Map();
  const TEMPLATES = [];

  /**
   * A key may contain {x}, {y}, {z}: each captures whatever text sits there
   * ("Showing {x} of {y} universities"), and the translation can reorder them.
   */
  function addEntry(key, vals) {
    if (!Array.isArray(vals) || vals.length < 3) return;
    const k = norm(key);

    if (!/\{[xyz]\}/.test(k)) {
      EXACT.set(k, vals);
      return;
    }

    const names = [];
    const pattern = k
      .split(/(\{[xyz]\})/)
      .map((part) => {
        const m = /^\{([xyz])\}$/.exec(part);
        if (m) {
          names.push(m[1]);
          return "(.+?)";
        }
        return escapeRe(part);
      })
      .join("");

    TEMPLATES.push({ re: new RegExp("^" + pattern + "$"), names, vals, weight: k.replace(/\{[xyz]\}/g, "").length });
    TEMPLATES.sort((p, q) => q.weight - p.weight); // most specific template first
  }

  Object.keys(DICT).forEach((k) => addEntry(k, DICT[k]));
  Object.keys(DICT_MORE).forEach((k) => addEntry(k, DICT_MORE[k]));

  /** Exact match, then templates. Text captured by a template is translated too. */
  function lookupCore(key, col, depth) {
    const hit = EXACT.get(key);
    if (hit) return hit[col];

    for (const t of TEMPLATES) {
      const m = t.re.exec(key);
      if (!m) continue;

      const parts = {};
      t.names.forEach((n, i) => {
        const raw = m[i + 1];
        const inner = depth < 2 ? lookup(raw, COL_NAMES[col], depth + 1) : null;
        parts[n] = inner !== null ? inner : raw;
      });
      return t.vals[col].replace(/\{([xyz])\}/g, (_, n) => (parts[n] !== undefined ? parts[n] : ""));
    }
    return null;
  }

  const COL_NAMES = ["ja", "ko", "zh"];

  /**
   * Also handles text wrapped in symbols, so "📍 United Kingdom", "✓ Choose destination"
   * or "Explore →" translate even when only the plain words are in the dictionary.
   */
  function lookup(text, lang, depth) {
    const col = COL[lang];
    if (col === undefined) return null;

    const key = norm(text);
    if (!key) return null;
    depth = depth || 0;

    let out = lookupCore(key, col, depth);
    if (out !== null) return out;

    const lead = /^([^\p{L}\p{N}]+?)\s*(\S.*)$/u.exec(key);
    const trail = /^(.*?\S)\s*([→↗›»…]+)$/u.exec(key);

    if (lead && depth < 3) {
      const rest = lookup(lead[2], lang, depth + 1);
      if (rest !== null) return lead[1] + " " + rest;
    }
    if (trail && depth < 3) {
      const rest = lookup(trail[1], lang, depth + 1);
      if (rest !== null) return rest + " " + trail[2];
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

  /** Text inside <script>, <textarea>, <code>… or marked data-no-translate is left alone. */
  function skipped(el) {
    for (let n = el; n && n.nodeType === 1; n = n.parentNode) {
      if (SKIP_TAGS.has(n.tagName.toUpperCase())) return true;
      if (n.isContentEditable || n.hasAttribute("data-no-translate")) return true;
      if (n.hasAttribute("data-i18n-ui")) return true; // the switcher itself
    }
    return false;
  }

  /** Attributes (placeholder, title, aria-label, alt) are translated even on a <textarea>. */
  function skippedAttrs(el) {
    for (let n = el; n && n.nodeType === 1; n = n.parentNode) {
      const tag = n.tagName.toUpperCase();
      if (tag === "SCRIPT" || tag === "STYLE" || tag === "NOSCRIPT") return true;
      if (n.hasAttribute("data-no-translate") || n.hasAttribute("data-i18n-ui")) return true;
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
    if (root.nodeType !== 1 || skippedAttrs(root)) return;

    const visit = (el) => {
      ATTRS.forEach((a) => applyAttr(el, a));
    };

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, {
      acceptNode(n) {
        if (n.nodeType === 1) {
          const tag = n.tagName.toUpperCase();
          return tag === "SCRIPT" ||
            tag === "STYLE" ||
            tag === "NOSCRIPT" ||
            tag === "SVG" ||
            n.hasAttribute("data-no-translate") ||
            n.hasAttribute("data-i18n-ui")
            ? NodeFilter.FILTER_REJECT
            : NodeFilter.FILTER_ACCEPT;
        }
        return NodeFilter.FILTER_ACCEPT;
      }
    });

    visit(root);
    let n = walker.nextNode();
    while (n) {
      if (n.nodeType === 3) {
        if (!skipped(n.parentNode)) applyText(n);
      } else {
        visit(n);
      }
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