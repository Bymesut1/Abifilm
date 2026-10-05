// ============================================================
//  FilmDozu — Nuvio Provider (Saf & Kesin Çözüm Sürümü)
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
        titleTr: d.title || d.name || '',
        titleEn: d.original_title || d.original_name || ''
      };
    })
    .catch(function() { return { titleTr: '', titleEn: '' }; });
}

function getStreams(tmdbId, mediaType, season, episode) {
  return fetchTmdbInfo(tmdbId, mediaType).then(function(mediaInfo) {
    var queryTitle = mediaInfo.titleTr || mediaInfo.titleEn;
    if (!queryTitle) {
      throw new Error('TMDB film adı alınamadı');
    }

    var searchUrl = PRIMARY_DOMAIN + '/ara?q=' + encodeURIComponent(queryTitle);
    
    return fetch(searchUrl, { headers: PAGE_HEADERS })
      .then(function(r) {
        if (!r.ok) return fetch(PRIMARY_DOMAIN + '/?s=' + encodeURIComponent(queryTitle), { headers: PAGE_HEADERS });
        return r;
      })
      .then(function(r) { return r.ok ? r.text() : ''; })
      .then(function(html) {
        var links = [];
        var linkRe = /href="(https:\/\/filmdozu\.com\/[^"]+\-izle\/)"/gi;
        var match;
        while ((match = linkRe.exec(html)) !== null) {
          if (links.indexOf(match[1]) === -1) {
            links.push(match[1]);
          }
        }

        if (!links.length) {
          var altRe = /href="([^"]+\-izle\/)"/gi;
          while ((match = altRe.exec(html)) !== null) {
            var fullUrl = match[1].indexOf('http') === 0 ? match[1] : PRIMARY_DOMAIN + (match[1].indexOf('/') === 0 ? '' : '/') + match[1];
            if (links.indexOf(fullUrl) === -1) {
              links.push(fullUrl);
            }
          }
        }

        if (!links.length) {
          throw new Error('Sitede bu filme ait arama sonucu bulunamadı');
        }

        var targetUrl = links[0];
        
        if (mediaType === 'tv' && season && episode) {
          targetUrl = targetUrl.replace(/\/$/, '') + '/sezon-' + season + '/bolum-' + episode + '/';
        }

        return fetch(targetUrl, { headers: PAGE_HEADERS })
          .then(function(r) { return r.ok ? r.text() : ''; })
          .then(function(pageHtml) {
            var streamMatch = pageHtml.match(/(https?:\/\/[^"'\s]+\.m3u8[^"'\s]*)/i) 
                           || pageHtml.match(/(https?:\/\/box-\d+-[^"'\s]+\/hls[^"'\s]+)/i);

            if (!streamMatch) {
              throw new Error('Film sayfasında m3u8 video bağlantısı bulunamadı');
            }

            return [
              {
                name: 'FilmDozu',
                title: '⌜ FILMDOZU ⌟ | ' + queryTitle + ' | 1080p',
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
      });
  });
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { getStreams: getStreams };
} else {
  global.getStreams = getStreams;
}
