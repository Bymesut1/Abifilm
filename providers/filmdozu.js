// ============================================================
//  FilmDozu — Nuvio Provider
// ============================================================

var PRIMARY_DOMAIN = 'https://filmdozu.com';
var TMDB_KEY = '000316508321ce461cf81e7c6815eec7';
var ANDROID_UA = 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Mobile Safari/537.36';

var PAGE_HEADERS = {
  'User-Agent': ANDROID_UA,
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'tr-TR,tr;q=0.9',
  'Referer': PRIMARY_DOMAIN + '/'
};

function decodeHtml(s) {
  return String(s || '').replace(/&quot;/g, '"').replace(/&#0?39;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
}

function norm(s) {
  return String(s || '').replace(/İ/g, 'i').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function slugify(s) {
  var map = { 'ç': 'c', 'ğ': 'g', 'ı': 'i', 'ö': 'o', 'ş': 's', 'ü': 'u', 'â': 'a', 'î': 'i', 'û': 'u' };
  return String(s || '').replace(/İ/g, 'i').toLowerCase()
    .replace(/[çğıöşüâîû]/g, function (c) { return map[c]; })
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

async function getText(url, headers) {
  try {
    var res = await fetch(url, { headers: headers || PAGE_HEADERS });
    if (!res.ok) return '';
    return await res.text();
  } catch (e) {
    return '';
  }
}

// Sayfadaki "House at the End of the Street (2012)" satırına bakıp doğru film mi kontrol eder
function isRightMovie(html, title, origTitle, year) {
  var sub = (html.match(/class="hero-sub"[^>]*>\s*([^<]+)/) || [])[1] || '';
  var h1 = (html.match(/class="hero-title"[^>]*>\s*([^<]+)/) || [])[1] || '';
  var y = parseInt(year, 10);
  var yearOk = false;
  for (var d = -1; d <= 1; d++) {
    if (sub.indexOf('(' + (y + d) + ')') > -1) yearOk = true;
  }
  var titleOk = (origTitle && norm(sub).indexOf(norm(origTitle)) > -1) ||
                (title && norm(h1) === norm(title));
  return yearOk && titleOk;
}

async function findMoviePage(title, origTitle, year) {
  var paths = [];
  function add(p) { if (p && paths.indexOf(p) === -1) paths.push(p); }

  // 1) Doğrudan tahmin: /film/turkce-baslik
  add('/film/' + slugify(title));
  add('/film/' + slugify(origTitle));

  // 2) Site içi arama: /ara?q=...
  var queries = [origTitle, title];
  for (var q = 0; q < queries.length; q++) {
    if (!queries[q]) continue;
    var html = await getText(PRIMARY_DOMAIN + '/ara?q=' + encodeURIComponent(queries[q]));
    var re = /href="(\/film\/[a-z0-9-]+)"/g, m;
    while ((m = re.exec(html)) !== null) add(m[1]);
  }

  // Adayları sırayla aç, yıl + başlık tutanı seç
  for (var i = 0; i < paths.length && i < 8; i++) {
    var page = await getText(PRIMARY_DOMAIN + paths[i]);
    if (page && isRightMovie(page, title, origTitle, year)) {
      return { url: PRIMARY_DOMAIN + paths[i], html: page };
    }
  }
  return null;
}

// Sayfadaki kaynak butonlarından (loadSource) video adreslerini çeker
function extractSources(html) {
  var list = [];
  var re = /loadSource\('([^']+)'\s*,\s*this\)[^>]*>([\s\S]*?)<\/button>/g, m;
  while ((m = re.exec(html)) !== null) {
    var url = decodeHtml(m[1]);
    var label = decodeHtml(m[2].replace(/<[^>]*>/g, '')).replace(/\s+/g, ' ').trim();
    if (/youtube\.com|youtu\.be/.test(url) || /fragman/i.test(label)) continue;
    list.push({ url: url, label: label });
  }
  if (!list.length) {
    var d = html.match(/data-src="([^"]+)"/);
    if (d && /ok\.ru/.test(d[1])) list.push({ url: decodeHtml(d[1]), label: 'Varsayılan' });
  }
  return list;
}

// ok.ru embed sayfasından gerçek yayın adresini çıkarır
async function resolveOk(embedUrl) {
  var clean = embedUrl.split('?')[0];
  var html = await getText(clean, {
    'User-Agent': ANDROID_UA,
    'Referer': PRIMARY_DOMAIN + '/'
  });
  if (!html) return null;
  var m = html.match(/data-options="([^"]+)"/);
  if (!m) return null;
  try {
    var opts = JSON.parse(decodeHtml(m[1]));
    var meta = opts.flashvars && opts.flashvars.metadata;
    if (typeof meta === 'string') meta = JSON.parse(meta);
    if (!meta) return null;

    var hls = meta.hlsManifestUrl || meta.ondemandHls || meta.hlsMasterPlaylistUrl;
    if (hls) return { url: hls, type: 'hls', quality: 'Auto' };

    var order = ['full', 'hd', 'sd', 'low', 'lowest', 'mobile'];
    var q = { full: '1080p', hd: '720p', sd: '480p', low: '360p', lowest: '240p', mobile: '144p' };
    var vids = meta.videos || [];
    for (var i = 0; i < order.length; i++) {
      for (var j = 0; j < vids.length; j++) {
        if (vids[j].name === order[i] && vids[j].url) {
          return { url: vids[j].url, type: 'mp4', quality: q[order[i]] };
        }
      }
    }
  } catch (e) {}
  return null;
}

async function getStreams(tmdbId, mediaType, season, episode) {
  try {
    // Site sadece film içeriyor
    if (mediaType !== 'movie') return [];

    // 1) TMDB'den başlık ve yıl
    var info = await (await fetch(
      'https://api.themoviedb.org/3/movie/' + tmdbId + '?language=tr-TR&api_key=' + TMDB_KEY
    )).json();
    var title = info.title;
    var origTitle = info.original_title;
    var year = (info.release_date || '').slice(0, 4);
    if (!title || !year) return [];

    // 2) Doğru film sayfasını bul
    var found = await findMoviePage(title, origTitle, year);
    if (!found) {
      console.log('[FilmDozu] film bulunamadı: ' + title);
      return [];
    }

    // 3) Sayfadaki kaynakları al, 4) her birini çöz
    var sources = extractSources(found.html);
    var streams = [];
    for (var i = 0; i < sources.length; i++) {
      var r = await resolveOk(sources[i].url);
      if (!r) continue;
      streams.push({
        name: 'FilmDozu',
        title: '⌜ FILMDOZU ⌟ | ' + sources[i].label,
        url: r.url,
        quality: r.quality,
        type: r.type,
        headers: { 'User-Agent': ANDROID_UA, 'Referer': 'https://ok.ru/' }
      });
    }
    return streams;
  } catch (e) {
    console.log('[FilmDozu] hata: ' + e);
    return [];
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { getStreams: getStreams };
} else {
  global.getStreams = getStreams;
}
