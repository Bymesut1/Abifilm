// ============================================================
//  FilmDozu — Nuvio Provider (Saf & Sabit Linklerden Arındırılmış Sürüm)
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

function fetchTmdbTitle(tmdbId, mediaType) {
  var ep = mediaType === 'tv' ? 'tv' : 'movie';
  return fetch('https://api.themoviedb.org/3/' + ep + '/' + tmdbId + '?api_key=' + TMDB_API_KEY + '&language=tr-TR')
    .then(function(r) { return r.json(); })
    .then(function(d) {
      return d.title || d.name || d.original_title || d.original_name || '';
    })
    .catch(function() { return ''; });
}

function getStreams(tmdbId, mediaType, season, episode) {
  return fetchTmdbTitle(tmdbId, mediaType).then(function(title) {
    if (!title) {
      return []; // Sabit link yok, film adı alınamazsa boş döner
    }

    var searchUrl = PRIMARY_DOMAIN + '/?s=' + encodeURIComponent(title);
    return fetch(searchUrl, { headers: PAGE_HEADERS })
      .then(function(r) { return r.ok ? r.text() : ''; })
      .then(function(html) {
        // Sitedeki arama sonuçlarında film kartlarını yakalıyoruz
        var match = html.match(/<div[^>]+class="[^"]*item[^"]*"[\s\S]*?<a[^>]+href="([^"]+)"/i);
        if (!match || !match[1]) {
          return []; // Sabit linke düşmek yok! Bulamazsa boş dönecek.
        }

        var targetUrl = match[1];
        if (mediaType === 'tv' && season && episode) {
          targetUrl = targetUrl.replace(/\/$/, '') + '/sezon-' + season + '/bolum-' + episode + '/';
        }

        return fetch(targetUrl, { headers: PAGE_HEADERS })
          .then(function(r) { return r.ok ? r.text() : ''; })
          .then(function(pageHtml) {
            // Sadece sayfadan gerçek m3u8 bulursa oynatacak
            var streamMatch = pageHtml.match(/(https?:\/\/[^"'\s]+\.m3u8[^"'\s]*)/i) 
                           || pageHtml.match(/(https?:\/\/box-\d+-[^"'\s]+\/hls[^"'\s]+)/i);

            if (!streamMatch) {
              return []; // Yine sabit link yok, m3u8 çıkmazsa boş döner
            }

            return [
              {
                name: 'FilmDozu',
                title: '⌜ FILMDOZU ⌟ | ' + title + ' | 1080p',
                url: streamMatch[1],
                quality: '1080p',
                type: 'hls',
                headers: {
                  'User-Agent': ANDROID_UA,
                  'Referer': targetUrl
                }
              }
            ];
          });
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
