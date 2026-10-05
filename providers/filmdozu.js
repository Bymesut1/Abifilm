// ============================================================
//  FilmDozu — Nuvio Provider (Görüntü Garantili & Akıllı Eşleşme)
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
  // Eklentinin Nuvio listesinden ASLA kaybolmaması için garanti boş dizi (fallback) yapısı
  var emptyStream = [];

  return fetchTmdbInfo(tmdbId, mediaType).then(function(mediaInfo) {
    var titleTr = mediaInfo.titleTr;
    var titleEn = mediaInfo.titleEn;
    var queryTitle = titleTr || titleEn;

    if (!queryTitle) {
      return emptyStream;
    }

    var formData = 's=' + encodeURIComponent(queryTitle);
    
    return fetch(PRIMARY_DOMAIN + '/', {
      method: 'POST',
      headers: {
        'User-Agent': ANDROID_UA,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'text/html,application/xhtml+xml'
      },
      body: formData
    })
    .then(function(r) { return r.ok ? r.text() : ''; })
    .then(function(html) {
      var links = [];
      // Sitedeki film kartlarını ve bağlantılarını daha detaylı ayıklıyoruz
      var cardRe = /<div[^>]+class="[^"]*item[^"]*"[\s\S]*?<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
      var matchCard;
      while ((matchCard = cardRe.exec(html)) !== null) {
        var href = matchCard[1];
        var inner = matchCard[2];
        var titleMatch = inner.match(/alt="([^"]+)"/i) || inner.match(/title="([^"]+)"/i);
        links.push({
          href: href,
          title: titleMatch ? titleMatch[1] : ''
        });
      }

      if (!links.length) {
        var linkRe = /href="(https:\/\/filmdozu\.com\/[^"]+\-izle\/)"/gi;
        var match;
        while ((match = linkRe.exec(html)) !== null) {
          if (links.map(function(l){ return l.href; }).indexOf(match[1]) === -1) {
            links.push({ href: match[1], title: '' });
          }
        }
      }

      if (!links.length) {
        return emptyStream;
      }

      // Aranan kelimeye en yakın olan bağlantıyı seçmeye çalışalım
      var targetUrl = links[0].href;
      var targetTitle = queryTitle;

      for (var i = 0; i < links.length; i++) {
        if (links[i].title && norm(links[i].title).indexOf(norm(queryTitle)) !== -1) {
          targetUrl = links[i].href;
          targetTitle = links[i].title;
          break;
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
            return emptyStream;
          }

          return [
            {
              name: 'FilmDozu',
              title: '⌜ FILMDOZU ⌟ | ' + (targetTitle || queryTitle) + ' | 1080p',
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
      return emptyStream;
    });
  });
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { getStreams: getStreams };
} else {
  global.getStreams = getStreams;
}
