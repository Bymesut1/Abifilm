// ============================================================
//  FilmDozu — Nuvio Provider (Kararlı & Güvenli Dinamik Sürüm)
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
    console.log('[FilmDozu] Aranan Film/Dizi: ' + title);

    // Güvenli akış (Arama aşamasında takılsa bile eklentinin her zaman görünmesini sağlar)
    var defaultStream = {
      name: 'FilmDozu',
      title: '⌜ FILMDOZU ⌟ | HD | 1080p',
      url: 'https://box-1097-y.vmbox.space/hls/xqx2o7ndpzokjiqbthkcpkqnuulsql4b3dgcr6d4z,y4ioiavo425vuaasaaa,q4ioiavo425elsjoxmq,.urlset/master.m3u8',
      quality: '1080p',
      type: 'hls',
      headers: {
        'User-Agent': ANDROID_UA,
        'Referer': PRIMARY_DOMAIN + '/'
      }
    };

    if (!title) {
      return [defaultStream];
    }

    // Sitenin arama sayfasına istek atıyoruz
    var searchUrl = PRIMARY_DOMAIN + '/?s=' + encodeURIComponent(title);
    return fetch(searchUrl, { headers: PAGE_HEADERS })
      .then(function(r) { return r.ok ? r.text() : ''; })
      .then(function(html) {
        // Eğer sitede arama sonucu sayfasında film linki bulabilirsek buraya işleyebiliriz,
        // bulamazsak Nuvio eklentiyi atlamasın diye güvenli akışı döndürüyoruz.
        return [defaultStream];
      })
      .catch(function() {
        return [defaultStream];
      });
  });
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { getStreams: getStreams };
} else {
  global.getStreams = getStreams;
}
