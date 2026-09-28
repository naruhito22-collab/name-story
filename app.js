// 苗字由来ストーリー — フロントエンド
// API は claude-api 中継の専用窓口 /api/name-story を使う（APIキーはフロントに置かない）。

const API_BASE = 'https://claude-api-production-07fb.up.railway.app';
const DAILY_LIMIT = 3;
const LIMIT_KEY = 'name-story-usage';

const PREFECTURES = [
  '北海道', '青森県', '岩手県', '宮城県', '秋田県', '山形県', '福島県',
  '茨城県', '栃木県', '群馬県', '埼玉県', '千葉県', '東京都', '神奈川県',
  '新潟県', '富山県', '石川県', '福井県', '山梨県', '長野県', '岐阜県',
  '静岡県', '愛知県', '三重県', '滋賀県', '京都府', '大阪府', '兵庫県',
  '奈良県', '和歌山県', '鳥取県', '島根県', '岡山県', '広島県', '山口県',
  '徳島県', '香川県', '愛媛県', '高知県', '福岡県', '佐賀県', '長崎県',
  '熊本県', '大分県', '宮崎県', '鹿児島県', '沖縄県',
];

const LOADING_MESSAGES = [
  '資料を調べています…',
  '苗字の由来をたどっています…',
  'ゆかりの人物を探しています…',
  '物語を書いています…',
];

const $ = (id) => document.getElementById(id);
let current = null; // { id, surname, prefecture, result, createdAt }

// ---------- 画面切り替え ----------
function show(view) {
  for (const v of document.querySelectorAll('.view')) v.hidden = v.id !== `view-${view}`;
  window.scrollTo(0, 0);
}

// ---------- 回数制限（この端末・この日付で3回） ----------
function today() {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}
function readUsage() {
  try {
    const u = JSON.parse(localStorage.getItem(LIMIT_KEY) || '{}');
    return u.date === today() ? u.count || 0 : 0;
  } catch {
    return 0;
  }
}
function addUsage() {
  try {
    localStorage.setItem(LIMIT_KEY, JSON.stringify({ date: today(), count: readUsage() + 1 }));
  } catch {
    // storage unavailable — limit can't be enforced on this device
  }
}
function renderRemaining() {
  const left = Math.max(0, DAILY_LIMIT - readUsage());
  $('remaining').textContent = `今日はあと ${left} 回つくれます`;
  $('form').querySelector('button').disabled = left === 0;
  if (left === 0) $('form-error').textContent = '今日の上限（3回）に達しました。また明日お試しください。';
}

// ---------- 描画 ----------
function li(text) {
  const el = document.createElement('li');
  el.textContent = text;
  return el;
}
function fill(listId, items, empty = '（なし）') {
  const ul = $(listId);
  ul.replaceChildren(...(items && items.length ? items.map(li) : [li(empty)]));
}

function renderStory(rec) {
  const { story } = rec.result;
  $('story-meta').textContent = `${rec.surname}（${rec.prefecture}）`;
  $('story-title').textContent = story.title;
  $('story-sub').textContent = `主人公：${story.protagonist}　／　時代：${story.era}`;
  const paras = story.body.split(/\n\s*\n|\n/).map((s) => s.trim()).filter(Boolean);
  $('story-body').replaceChildren(...paras.map((t) => {
    const p = document.createElement('p');
    p.textContent = t;
    return p;
  }));
}

function renderInfo(rec) {
  const r = rec.result;
  $('info-title').textContent = `「${rec.surname}」について`;
  $('info-notfound').hidden = r.found;
  $('info-reading').textContent = r.reading || '不明';
  $('info-population').textContent = `全国 ${r.population.estimate}　／　順位 ${r.population.rank}（推計）`;
  $('info-population-note').textContent = r.population.note;

  const origins = $('info-origins');
  if (r.origins.length) {
    origins.replaceChildren(...r.origins.map((o) => {
      const el = li(o.theory);
      const badge = document.createElement('span');
      badge.className = 'badge';
      badge.textContent = `確度：${o.confidence}`;
      el.append(badge);
      return el;
    }));
  } else {
    origins.replaceChildren(li('資料が見つかりませんでした'));
  }

  fill('info-top3', r.prefecture_top3, '資料が見つかりませんでした');
  fill('info-historical', r.story_basis.historical);
  fill('info-fictional', r.story_basis.fictional);

  const sources = $('info-sources');
  if (r.sources.length) {
    sources.replaceChildren(...r.sources.map((s) => {
      const el = document.createElement('li');
      const a = document.createElement('a');
      a.href = s.url;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.textContent = s.title || s.url;
      el.append(a);
      return el;
    }));
  } else {
    sources.replaceChildren(li('参照できるページが見つかりませんでした'));
  }

  $('share').hidden = !rec.id;
}

function display(rec) {
  current = rec;
  renderStory(rec);
  renderInfo(rec);
  document.title = `${rec.result.story.title}｜苗字由来ストーリー`;
  show('story');
}

// ---------- テキスト保存 ----------
function toText(rec) {
  const r = rec.result;
  const lines = [
    r.story.title,
    `${rec.surname}（${rec.prefecture}）`,
    `主人公：${r.story.protagonist}　時代：${r.story.era}`,
    '',
    r.story.body,
    '',
    '※ この物語は資料をもとにした創作です。',
    '',
    '――――――――――',
    `読み：${r.reading}`,
    `全国：${r.population.estimate}　順位：${r.population.rank}（推計）`,
    r.population.note,
    '',
    '【由来】',
    ...(r.origins.length ? r.origins.map((o) => `・${o.theory}（確度：${o.confidence}）`) : ['・資料が見つかりませんでした']),
    '',
    '【多い都道府県】',
    ...r.prefecture_top3.map((p, i) => `${i + 1}. ${p}`),
    '',
    '【下敷きにした史実】',
    ...r.story_basis.historical.map((s) => `・${s}`),
    '【創作した部分】',
    ...r.story_basis.fictional.map((s) => `・${s}`),
    '',
    '【参照したページ】',
    ...r.sources.map((s) => `・${s.title}\n  ${s.url}`),
  ];
  if (rec.id) lines.push('', `共有URL：${shareUrl(rec.id)}`);
  return lines.join('\n');
}

function download() {
  const blob = new Blob([toText(current)], { type: 'text/plain;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${current.surname}_苗字ストーリー.txt`;
  a.click();
  URL.revokeObjectURL(a.href);
}

// ---------- 共有 ----------
function shareUrl(id) {
  return `${location.origin}${location.pathname}?s=${encodeURIComponent(id)}`;
}
async function share() {
  const url = shareUrl(current.id);
  try {
    await navigator.clipboard.writeText(url);
    $('share-msg').textContent = 'URLをコピーしました（90日間有効）';
  } catch {
    $('share-msg').textContent = url;
  }
}

// ---------- API ----------
async function generate(surname, prefecture) {
  const res = await fetch(`${API_BASE}/api/name-story`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ surname, prefecture }),
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 429) {
    // 全体の1日上限（日本語メッセージ）か、中継の1分あたり制限（英語メッセージ）
    throw new Error(/[ぁ-ん]/.test(data.error || '')
      ? data.error
      : '混み合っています。1分ほどおいてから、もう一度お試しください。');
  }
  if (!res.ok) throw new Error(data.error || '物語の生成に失敗しました。');
  return data;
}

async function loadShared(id) {
  show('loading');
  $('loading-msg').textContent = '物語を読み込んでいます…';
  try {
    const res = await fetch(`${API_BASE}/api/name-story/${encodeURIComponent(id)}`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || '物語を読み込めませんでした。');
    display(data);
  } catch (err) {
    $('error-msg').textContent = err.message;
    show('error');
  }
}

// ---------- 起動 ----------
function init() {
  const sel = $('prefecture');
  for (const p of PREFECTURES) sel.add(new Option(p, p));

  $('form').addEventListener('submit', async (e) => {
    e.preventDefault();
    $('form-error').textContent = '';
    if (readUsage() >= DAILY_LIMIT) return renderRemaining();

    const surname = $('surname').value.trim();
    const prefecture = sel.value;

    show('loading');
    let i = 0;
    $('loading-msg').textContent = LOADING_MESSAGES[0];
    const timer = setInterval(() => {
      i = Math.min(i + 1, LOADING_MESSAGES.length - 1);
      $('loading-msg').textContent = LOADING_MESSAGES[i];
    }, 20000);

    try {
      const rec = await generate(surname, prefecture);
      addUsage();
      if (rec.id) history.replaceState(null, '', `?s=${encodeURIComponent(rec.id)}`);
      display(rec);
    } catch (err) {
      $('form-error').textContent = err.message;
      show('input');
    } finally {
      clearInterval(timer);
      renderRemaining();
    }
  });

  $('to-info').addEventListener('click', () => show('info'));
  $('to-story').addEventListener('click', () => show('story'));
  $('download').addEventListener('click', download);
  $('share').addEventListener('click', share);

  renderRemaining();
  const id = new URLSearchParams(location.search).get('s');
  if (id) loadShared(id);
}

init();
