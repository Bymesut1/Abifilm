// ============================================================
//  FilmDozu — Nuvio Provider (Buffering & Kaynak Hatası Giderici Sürüm)
// ============================================================

var PRIMARY_DOMAIN = 'https://filmdozu.com';
var ANDROID_UA = 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Mobile Safari/537.36';

var PAGE_HEADERS = {
  'User-Agent':      ANDROID_UA,
  'Accept':          'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'tr-TR,tr;q=0.9',
  'Upgrade-Insecure-Requests': '1'
};

var TMDB_API_KEY = '500330721680edb6d5f7f12ba7cd9023';

var trMap = {
  'ç': 'c', 'Ç': 'c', 'ğ': 'g', 'Ğ': 'g', 'ş': 's', 'Ş': 's',
  'ü': 'u', 'Ü': 'u', 'ı': 'i', 'İ': 'i', 'ö': 'o', 'Ö': 'o'
};

function slugify(text) {
  if (!text) return '';
  var str = text.toString();
  for (var k in trMap) {
    str = str.replace(new RegExp(k, 'g'), trMap[k]);
  }
  return str.toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

function fetchTmdbInfo(tmdbId, mediaType) {
  var ep = mediaType === 'tv' ? 'tv' : 'movie';
  return fetch('https://api.themoviedb.org/3/' + ep + '/' + tmdbId + '?api_key=' + TMDB_API_KEY + '&language=tr-TR')
    .then(function(r) { return r.json(); })
    .then(function(d) {
      return {
        title: d.title || d.name || d.original_title || d.original_name || ''
      };
    })
    .catch(function() { return { title: '' }; });
}

function getStreams(tmdbId, mediaType, season, episode) {
  return fetchTmdbInfo(tmdbId, mediaType).then(function(info) {
    if (!info.title) {
      return [];
    }

    var cleanSlug = slugify(info.title);
    var targetUrl = PRIMARY_DOMAIN + '/' + cleanSlug + '-izle/';

    if (mediaType === 'tv' && season && episode) {
      targetUrl = PRIMARY_DOMAIN + '/' + cleanSlug + '-sezon-' + season + '-bolum-' + episode + '-izle/';
    }

    return fetch(targetUrl, { headers: PAGE_HEADERS })
      .then(function(r) {
        if (!r.ok) {
          return [];
        }
        return r.text();
      })
      .then(function(html) {
        if (typeof html !== 'string' || !html) {
          return [];
        }

        var videoMatch = html.match(/(https?:\/\/[^"'\s]+\.okcdn\.ru[^"'\s]*)/i)
                      || html.match(/(https?:\/\/[^"'\s]+\.m3u8[^"'\s]*)/i)
                      || html.match(/(https?:\/\/box-\d+-[^"'\s]+\/hls[^"'\s]+)/i);

        if (!videoMatch) {
          return [];
        }

        var streamUrl = videoMatch[1];
        
        // Okru veya harici CDN linklerinin buffering yapmasını engellemek için
        // oynatıcının istek yaparken kullanacağı referer ve headers yapılandırmasını optimize ediyoruz.
        var refererTarget = streamUrl.indexOf('okcdn.ru') !== -1 ? 'https://ok.ru/' : targetUrl;

        return [
          {
            name: 'FilmDozu',
            title: '⌜ FILMDOZU ⌟ | ' + info.title + ' | 1080p',
            url: streamUrl,
            quality: '1080p',
            type: 'hls',
            headers: {
              'User-Agent': ANDROID_UA,
              'Referer': refererTarget,
              'Origin': refererTarget.replace(/\/$/, '')
            }
          }
        ];
      })
      .catch(function() {
        return [];
      });
  });
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { getStreams: getStreams };
} else {
  global.getStreams = getStreams;
}
