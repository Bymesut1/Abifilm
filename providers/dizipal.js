// ============================================================
//  Dizipal — Nuvio Provider
//  Site adresi değişirse sadece PRIMARY_DOMAIN satırını güncelle.
// ============================================================

var PRIMARY_DOMAIN = 'https://dizipal2135.com';
var TMDB_KEY = '000316508321ce461cf81e7c6815eec7';
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

async function getText(url, headers) {
  try {
    var res = await withTimeout(fetch(url, { headers: headers || PAGE_HEADERS }), 8000);
    if (!res.ok) return '';
    return await withTimeout(res.text(), 8000);
  } catch (e) {
    return '';
  }
}

async function postForm(url, body, headers) {
  try {
    var res = await withTimeout(fetch(url, { method: 'POST', headers: headers, body: body }), 8000);
    if (!res.ok) return '';
    return await withTimeout(res.text(), 8000);
  } catch (e) {
    return '';
  }
}

// Bölüm/film sayfasındaki oynatıcı iframe'lerini bulur: https://HOST/video/32HANELİKİMLİK
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
  var txt = await postForm(
    base + '/player/index.php?data=' + player.id + '&do=getVideo',
    'hash=' + player.id + '&r=' + encodeURIComponent(pageUrl),
    {
      'User-Agent': ANDROID_UA,
      'Accept': 'application/json, text/javascript, */*; q=0.01',
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'X-Requested-With': 'XMLHttpRequest',
      'Origin': base,
      'Referer': base + '/video/' + player.id
    }
  );
  if (!txt) return null;

  var url = '';
  try {
    var j = JSON.parse(txt);
    url = j.securedLink || j.videoSource || '';
  } catch (e) {}

  if (!url) {
    var clean = txt.replace(/\\\//g, '/');
    var m = clean.match(/https?:\/\/[^"'\s\\]+?master\.(?:txt|m3u8)[^"'\s\\]*/);
    if (m) url = m[0];
  }
  if (!url) return null;
  url = url.replace(/\\\//g, '/');
  if (url.indexOf('http') !== 0) url = base + (url.charAt(0) === '/' ? '' : '/') + url;

  return {
    url: url,
    type: 'hls',
    quality: 'Auto',
    headers: { 'User-Agent': ANDROID_UA, 'Referer': base + '/', 'Origin': base }
  };
}

async function getStreams(tmdbId, mediaType, season, episode) {
  try {
    var isTv = mediaType === 'tv';

    // 1) TMDB'den başlık
    var tmdbRes = await withTimeout(fetch(
      'https://api.themoviedb.org/3/' + (isTv ? 'tv' : 'movie') + '/' + tmdbId +
      '?language=tr-TR&api_key=' + TMDB_KEY
    ), 8000);
    var info = await tmdbRes.json();
    var title = isTv ? info.name : info.title;
    var origTitle = isTv ? info.original_name : info.original_title;

    var slugs = [];
    [title, origTitle].forEach(function (t) {
      var s = slugify(t);
      if (s && slugs.indexOf(s) === -1) slugs.push(s);
    });
    if (!slugs.length) return [];

    // 2) Sayfa adresi: /bolum/{dizi}-{sezon}-sezon-{bolum}-bolum  veya  /film/{ad}
    var s = parseInt(season, 10) || 1;
    var e = parseInt(episode, 10) || 1;
    var paths = slugs.map(function (slug) {
      return isTv ? '/bolum/' + slug + '-' + s + '-sezon-' + e + '-bolum' : '/film/' + slug;
    });
    var pages = await Promise.all(paths.map(function (p) { return getText(PRIMARY_DOMAIN + p); }));

    var pageUrl = '', players = [];
    for (var i = 0; i < pages.length; i++) {
      var found = pages[i] ? extractPlayers(pages[i]) : [];
      if (found.length) { players = found; pageUrl = PRIMARY_DOMAIN + paths[i]; break; }
    }
    if (!players.length) {
      console.log('[Dizipal] oynatıcı bulunamadı: ' + title);
      return [];
    }

    // 3) Tüm oynatıcıları aynı anda çöz
    var resolved = await Promise.all(players.map(function (p) { return resolvePlayer(p, pageUrl); }));
    var streams = [];
    for (var k = 0; k < players.length; k++) {
      var r = resolved[k];
      if (!r) continue;
      streams.push({
        name: 'Dizipal',
        title: '⌜ DİZİPAL ⌟ | ' + (players.length > 1 ? 'Kaynak ' + (k + 1) : 'HLS'),
        url: r.url,
        quality: r.quality,
        type: r.type,
        headers: r.headers
      });
    }
    return streams;
  } catch (err) {
    console.log('[Dizipal] hata: ' + err);
    return [];
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { getStreams: getStreams };
} else {
  global.getStreams = getStreams;
}
