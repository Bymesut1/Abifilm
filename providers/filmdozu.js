// ============================================================
//  FilmDozu — Nuvio Provider (Genel Arama & Dinamik Dağıtım Sürümü)
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
  var fallbackStream = {
    name: 'FilmDozu',
    title: '⌜ FILMDOZU ⌟ | Kaynak Bulunamadı',
    url: 'https://box-1097-y.vmbox.space/hls/xqx2o7ndpzokjiqbthkcpkqnuulsql4b3dgcr6d4z,y4ioiavo425vuaasaaa,q4ioiavo425elsjoxmq,.urlset/master.m3u8',
    quality: '1080p',
    type: 'hls',
    headers: {
      'User-Agent': ANDROID_UA,
      'Referer': PRIMARY_DOMAIN + '/'
    }
  };

  return fetchTmdbInfo(tmdbId, mediaType).then(function(info) {
    if (!info.title) {
      return [fallbackStream];
    }

    // Doğrudan sabit slug yerine sitenin kendi arama parametresini kullanıyoruz ki doğru sayfaya gitsin
    var searchUrl = PRIMARY_DOMAIN + '/?s=' + encodeURIComponent(info.title);

    return fetch(searchUrl, { headers: PAGE_HEADERS })
      .then(function(r) {
        if (!r.ok) {
          return [fallbackStream];
        }
        return r.text();
      })
      .then(function(searchHtml) {
        if (typeof searchHtml !== 'string' || !searchHtml) {
          return [fallbackStream];
        }

        // Arama sonuç sayfasından ilk film detay bağlantısını dinamik olarak çekiyoruz
        var linkMatch = searchHtml.match(/href="(https:\/\/filmdozu.com\/[^"'\s]+-izle\/)"/i)
                     || searchHtml.match(/href="(https:\/\/filmdozu.com\/[^"'\s]+)"/i);

        if (!linkMatch || !linkMatch[1]) {
          return [fallbackStream];
        }

        var detailPageUrl = linkMatch[1];

        // Şimdi bulduğumuz gerçek film detay sayfasına gidiyoruz
        return fetch(detailPageUrl, { headers: PAGE_HEADERS })
          .then(function(res) { return res.text(); })
          .then(function(detailHtml) {
            if (typeof detailHtml !== 'string' || !detailHtml) {
              return [fallbackStream];
            }

            // O sayfadaki gerçek video/oynatıcı kaynağını yakalıyoruz
            var videoMatch = detailHtml.match(/(https?:\/\/[^"'\s]+\.okcdn\.ru[^"'\s]*)/i)
                          || detailHtml.match(/(https?:\/\/[^"'\s]+\.m3u8[^"'\s]*)/i)
                          || detailHtml.match(/(https?:\/\/box-\d+-[^"'\s]+\/hls[^"'\s]+)/i)
                          || detailHtml.match(/src="(https?:\/\/[^"'\s]+embed[^"'\s]*)"/i);

            if (!videoMatch) {
              return [fallbackStream];
            }

            return [
              {
                name: 'FilmDozu',
                title: '⌜ FILMDOZU ⌟ | ' + info.title,
                url: videoMatch[1],
                quality: '1080p',
                type: 'hls',
                headers: {
                  'User-Agent': ANDROID_UA,
                  'Referer': detailPageUrl
                }
              }
            ];
          });
      })
      .catch(function() {
        return [fallbackStream];
      });
  });
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { getStreams: getStreams };
} else {
  global.getStreams = getStreams;
}
