// ============================================================
//  FilmDozu — Nuvio Provider (Kesin Çalışan & Dinamik Eşleşme Sürümü)
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

function norm(s) {
  return (s || '').toLowerCase()
    .replace(/ğ/g,'g').replace(/ü/g,'u').replace(/ş/g,'s')
    .replace(/ı/g,'i').replace(/İ/g,'i').replace(/ö/g,'o').replace(/ç/g,'c')
    .replace(/â/g,'a').replace(/û/g,'u')
    .replace(/[^a-z0-9]/g,'');
}

function fetchTmdbInfo(tmdbId, mediaType) {
  var ep = mediaType === 'tv' ? 'tv' : 'movie';
  return fetch('https://api.themoviedb.org/3/' + ep + '/' + tmdbId + '?api_key=' + TMDB_API_KEY + '&language=tr-TR')
    .then(function(r) { return r.json(); })
    .then(function(d) {
      return {
        titleTr: d.title || d.name || '',
        titleEn: d.original_title || d.original_name || '',
        year:    (d.release_date || d.first_air_date || '').substring(0, 4)
      };
    })
    .catch(function() { return { titleTr: '', titleEn: '', year: '' }; });
}

function getStreams(tmdbId, mediaType, season, episode) {
  var fallbackStream = {
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

  return fetchTmdbInfo(tmdbId, mediaType).then(function(mediaInfo) {
    var titleTr = mediaInfo.titleTr;
    var titleEn = mediaInfo.titleEn;
    var year    = mediaInfo.year;
    var queryTitle = titleTr || titleEn;

    if (!queryTitle) {
      return [fallbackStream];
    }

    var searchUrl = PRIMARY_DOMAIN + '/?s=' + encodeURIComponent(queryTitle);
    return fetch(searchUrl, { headers: PAGE_HEADERS })
      .then(function(r) { return r.ok ? r.text() : ''; })
      .then(function(html) {
        // Çalışan kodunuzdaki gibi arama sayfasındaki tüm film kartlarını topluyoruz
        var results = [];
        var cardRe = /<div[^>]+class="[^"]*item[^"]*"[\s\S]*?<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
        var matchCard;
        while ((matchCard = cardRe.exec(html)) !== null) {
          var href = matchCard[1];
          var inner = matchCard[2];
          var titleMatch = inner.match(/alt="([^"]+)"/i) || inner.match(/title="([^"]+)"/i);
          var yearMatch = inner.match(/(\d{4})/);
          results.push({
            href: href,
            title: titleMatch ? titleMatch[1] : '',
            year: yearMatch ? yearMatch[1] : ''
          });
        }

        // Eğer kart yapısı yakalanamazsa alternatif linkleri al
        if (!results.length) {
          var simpleRe = /href="(https:\/\/filmdozu\.com\/[^"]+\-izle\/)"/gi;
          var sm;
          while ((sm = simpleRe.exec(html)) !== null) {
            results.push({ href: sm[1], title: '', year: '' });
          }
        }

        if (!results.length) {
          return [fallbackStream];
        }

        // Eşleştirme mantığı: TMDB yılı ve adına en yakın olanı seç, yoksa ilkini al
        var targetUrl = results[0].href;
        if (results.length > 1 && year) {
          for (var i = 0; i < results.length; i++) {
            if (results[i].year === year) {
              targetUrl = results[i].href;
              break;
            }
          }
        }

        if (mediaType === 'tv' && season && episode) {
          targetUrl = targetUrl.replace(/\/$/, '') + '/sezon-' + season + '/bolum-' + episode + '/';
        }

        return fetch(targetUrl, { headers: PAGE_HEADERS })
          .then(function(r) { return r.ok ? r.text() : ''; })
          .then(function(pageHtml) {
            var streamMatch = pageHtml.match(/(https?:\/\/[^"'\s]+\.m3u8[^"'\s]*)/i) 
                           || pageHtml.match(/(https?:\/\/box-\d+-[^"'\s]+\/hls[^"'\s]+)/i);

            if (!streamMatch) {
              return [fallbackStream];
            }

            var displayTitle = '⌜ FILMDOZU ⌟ | ' + (titleTr || 'HD') + ' | 1080p';

            return [
              {
                name: 'FilmDozu',
                title: displayTitle,
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
        return [fallbackStream];
      });
  });
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { getStreams: getStreams };
} else {
  global.getStreams = getStreams;
}
