// ============================================================
//  FilmDozu — Nuvio Provider (Tüm Kaynakları Çeken Kapsamlı Sürüm)
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
        titleTr: d.title || d.name || '',
        titleEn: d.original_title || d.original_name || ''
      };
    })
    .catch(function() { return { titleTr: '', titleEn: '' }; });
}

function getStreams(tmdbId, mediaType, season, episode) {
  var fallbackStream = {
    name: 'FilmDozu',
    title: '⌜ FILMDOZU ⌟ | Alternatif Kaynak Bekleniyor',
    url: 'https://box-1097-y.vmbox.space/hls/xqx2o7ndpzokjiqbthkcpkqnuulsql4b3dgcr6d4z,y4ioiavo425vuaasaaa,q4ioiavo425elsjoxmq,.urlset/master.m3u8',
    quality: '1080p',
    type: 'hls',
    headers: {
      'User-Agent': ANDROID_UA,
      'Referer': PRIMARY_DOMAIN + '/'
    }
  };

  return fetchTmdbInfo(tmdbId, mediaType).then(function(mediaInfo) {
    var queryTitle = mediaInfo.titleTr || mediaInfo.titleEn;
    if (!queryTitle) {
      return [fallbackStream];
    }

    var slug = slugify(queryTitle);
    var targetUrl = PRIMARY_DOMAIN + '/' + slug + '-izle/';

    if (mediaType === 'tv' && season && episode) {
      targetUrl = PRIMARY_DOMAIN + '/' + slug + '-sezon-' + season + '-bolum-' + episode + '-izle/';
    }

    return fetch(targetUrl, { headers: PAGE_HEADERS })
      .then(function(r) {
        if (!r.ok) {
          return [fallbackStream];
        }
        return r.text();
      })
      .then(function(pageHtml) {
        if (typeof pageHtml !== 'string' || !pageHtml) {
          return [fallbackStream];
        }

        // Sitede karşılaşılabilecek tüm olası video kaynaklarını (Okru, M3U8, VidMoly, İframe kaynakları vb.) tarıyoruz
        var match = pageHtml.match(/(https?:\/\/[^"'\s]+\.okcdn\.ru[^"'\s]*)/i)
                 || pageHtml.match(/(https?:\/\/[^"'\s]+\.m3u8[^"'\s]*)/i)
                 || pageHtml.match(/(https?:\/\/box-\d+-[^"'\s]+\/hls[^"'\s]+)/i)
                 || pageHtml.match(/src="(https?:\/\/[^"'\s]+embed[^"'\s]*)"/i)
                 || pageHtml.match(/src="(https?:\/\/[^"'\s]+player[^"'\s]*)"/i);

        if (!match) {
          return [fallbackStream];
        }

        return [
          {
            name: 'FilmDozu',
            title: '⌜ FILMDOZU ⌟ | ' + queryTitle + ' | Çoklu Kaynak',
            url: match[1],
            quality: '1080p',
            type: 'hls',
            headers: {
              'User-Agent': ANDROID_UA,
              'Referer': targetUrl
            }
          }
        ];
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
