// ============================================================
//  Dizipal — Nuvio Provider (teşhis modlu)
//  Site adresi değişirse sadece PRIMARY_DOMAIN satırını güncelle.
//  DEBUG = true iken kaynak çıkmazsa listede "⚠ ..." satırı ile sebebi yazar.
// ============================================================

var PRIMARY_DOMAIN = 'https://dizipal2135.com';
var TMDB_KEY = '000316508321ce461cf81e7c6815eec7';
var DEBUG = true;
var STEP = '';
var ANDROID_UA = 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Mobile Safari/537.36';

var PAGE_HEADERS = {
  'User-Agent': ANDROID_UA,
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'tr-TR,tr;q=0.9',
  'Referer': PRIMARY_DOMAIN + '/'
};

function withTimeout(promise, ms) {
  return new Promise(function (resolve, reject) {
    var t = setTimeout(function () { reject(new Error('timeout')); }, ms);
    promise.then(function (v) { clearTimeout(t); resolve(v); },
                 function (e) { clearTimeout(t); reject(e); });
  });
}

function slugify(s) {
  var map = { 'ç': 'c', 'ğ': 'g', 'ı': 'i', 'ö': 'o', 'ş': 's', 'ü': 'u', 'â': 'a', 'î': 'i', 'û': 'u' };
  return String(s || '').replace(/İ/g, 'i').toLowerCase()
    .replace(/[çğıöşüâîû]/g, function (c) { return map[c]; })
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

// Durum kodu + metin döndürür (hata olsa da)
async function req(url, opts) {
  try {
    var res = await withTimeout(fetch(url, opts), 6000);
    var text = '';
    try { text = await withTimeout(res.text(), 6000); } catch (e) {}
    return { status: res.status, text: text || '' };
  } catch (e) {
    return { status: 0, text: '', err: String(e && e.message ? e.message : e) };
  }
}

function debugStream(msg) {
  console.log('[Dizipal] ' + msg);
  if (!DEBUG) return [];
  return [{
    name: 'Dizipal',
    title: '⚠ ' + msg,
    url: 'https://example.com/debug.m3u8',
    quality: 'Auto',
    type: 'hls',
    headers: {}
  }];
}

// Sayfadaki oynatıcı iframe'lerini bulur: https://HOST/video/32HANELİKİMLİK
function extractPlayers(html) {
  var text = String(html || '').replace(/\\\//g, '/').replace(/&amp;/g, '&');
  var out = [], seen = {};
  var re = /https?:\/\/([a-z0-9.\-]+)\/video\/([a-f0-9]{32})/gi, m;
  while ((m = re.exec(text)) !== null) {
    if (seen[m[2]]) continue;
    seen[m[2]] = true;
    out.push({ host: m[1], id: m[2] });
  }
  return out;
}

// Oynatıcının getVideo servisinden taze (süreli) HLS adresini alır
async function resolvePlayer(player, pageUrl) {
  var base = 'https://' + player.host;
  var r = await req(base + '/player/index.php?data=' + player.id + '&do=getVideo', {
    method: 'POST',
    headers: {
      'User-Agent': ANDROID_UA,
      'Accept': 'application/json, text/javascript, */*; q=0.01',
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'X-Requested-With': 'XMLHttpRequest',
      'Origin': base,
      'Referer': base + '/video/' + player.id
    },
    body: 'hash=' + player.id + '&r=' + encodeURIComponent(pageUrl)
  });

  var url = '';
  try {
    var j = JSON.parse(r.text);
    url = j.securedLink || j.videoSource || '';
  } catch (e) {}

  if (!url) {
    var clean = r.text.replace(/\\\//g, '/');
    var m = clean.match(/https?:\/\/[^"'\s\\]+?master\.(?:txt|m3u8)[^"'\s\\]*/);
    if (m) url = m[0];
  }
  if (!url) {
    return { error: 'getVideo HTTP ' + r.status + (r.err ? ' ' + r.err : '') + ' ' +
                    r.text.replace(/\s+/g, ' ').slice(0, 70) };
  }
  url = url.replace(/\\\//g, '/');
  if (url.indexOf('http') !== 0) url = base + (url.charAt(0) === '/' ? '' : '/') + url;

  return {
    url: url,
    type: 'hls',
    quality: 'Auto',
    headers: { 'User-Agent': ANDROID_UA, 'Referer': base + '/', 'Origin': base }
  };
}

async function run(tmdbId, mediaType, season, episode) {
  try {
    STEP = 'tmdb';
    var isTv = mediaType === 'tv';

    // 1) TMDB'den başlık
    var t = await req('https://api.themoviedb.org/3/' + (isTv ? 'tv' : 'movie') + '/' + tmdbId +
                      '?language=tr-TR&api_key=' + TMDB_KEY);
    var info = {};
    try { info = JSON.parse(t.text); } catch (e) {}
    var title = isTv ? info.name : info.title;
    var origTitle = isTv ? info.original_name : info.original_title;
    if (!title && !origTitle) return debugStream('TMDB boş, HTTP ' + t.status + (t.err ? ' ' + t.err : ''));

    var slugs = [];
    [title, origTitle].forEach(function (x) {
      var s = slugify(x);
      if (s && slugs.indexOf(s) === -1) slugs.push(s);
    });
    if (!slugs.length) return debugStream('başlıktan adres üretilemedi: ' + title);

    STEP = 'sayfa';
    // 2) Sayfa adresi: /bolum/{dizi}-{sezon}-sezon-{bolum}-bolum  veya  /film/{ad}
    var s = parseInt(season, 10) || 1;
    var e = parseInt(episode, 10) || 1;
    var paths = slugs.map(function (slug) {
      return isTv ? '/bolum/' + slug + '-' + s + '-sezon-' + e + '-bolum' : '/film/' + slug;
    });
    var pages = await Promise.all(paths.map(function (p) {
      return req(PRIMARY_DOMAIN + p, { headers: PAGE_HEADERS });
    }));

    var pageUrl = '', players = [];
    for (var i = 0; i < pages.length; i++) {
      var found = extractPlayers(pages[i].text);
      if (found.length) { players = found; pageUrl = PRIMARY_DOMAIN + paths[i]; break; }
    }
    if (!players.length) {
      var p0 = pages[0], tx = p0.text;
      return debugStream('sayfa ' + paths[0] + ' HTTP ' + p0.status + ', ' + tx.length + ' bayt, ' +
        'iframe:' + (tx.match(/<iframe/gi) || []).length +
        ', imagestoo:' + (/imagestoo/i.test(tx) ? 'var' : 'yok') +
        (/just a moment|cloudflare|cf-chl|attention required/i.test(tx) ? ', CF koruması' : '') +
        (p0.err ? ', ' + p0.err : ''));
    }

    STEP = 'getVideo';
    // 3) Tüm oynatıcıları aynı anda çöz
    var resolved = await Promise.all(players.map(function (p) { return resolvePlayer(p, pageUrl); }));
    var streams = [], errors = [];
    for (var k = 0; k < players.length; k++) {
      var r = resolved[k];
      if (!r || r.error) { errors.push(r ? r.error : 'boş'); continue; }
      streams.push({
        name: 'Dizipal',
        title: '⌜ DİZİPAL ⌟ | ' + (players.length > 1 ? 'Kaynak ' + (k + 1) : 'HLS'),
        url: r.url,
        quality: r.quality,
        type: r.type,
        headers: r.headers
      });
    }
    if (!streams.length) return debugStream(errors.join(' | '));
    return streams;
  } catch (err) {
    return debugStream('hata: ' + err);
  }
}

// Toplam süre sınırı: takılırsa hangi adımda kaldığını yazar
async function getStreams(tmdbId, mediaType, season, episode) {
  var timer;
  var timeout = new Promise(function (resolve) {
    timer = setTimeout(function () { resolve(debugStream('zaman aşımı, adım: ' + STEP)); }, 12000);
  });
  var out = await Promise.race([run(tmdbId, mediaType, season, episode), timeout]);
  clearTimeout(timer);
  return out;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { getStreams: getStreams };
} else {
  global.getStreams = getStreams;
}
