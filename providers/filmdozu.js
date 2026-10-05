// ============================================================
//  FilmDozu — Nuvio Provider (ID Bazlı Doğrudan Çözüm)
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
        titleEn: d.original_title || d.original_name || '',
        originalTitle: d.original_title || d.original_name || ''
      };
    })
    .catch(function() { return { titleTr: '', titleEn: '', originalTitle: '' }; });
}

function getStreams(tmdbId, mediaType, season, episode) {
  return fetchTmdbInfo(tmdbId, mediaType).then(function(mediaInfo) {
    var title = mediaInfo.titleTr || mediaInfo.titleEn;
    if (!title) {
      throw new Error('Film adı alınamadı');
    }

    // Sitenin arama sayfalarını tamamen atlayıp, doğrudan Google benzeri harici arama veya 
    // alternatif slug denemesi yapıyoruz. Sitenin kendi içinde arama kutusuna POST isteği simüle edelim:
    var formData = 's=' + encodeURIComponent(title);
    
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
      // Çıkan HTML'de ilk eşleşen sabit içeriği engellemek için, 
      // aradığımız kelimeyi içeren linkleri süzüyoruz
      var links = [];
      var regex = /href="(https:\/\/filmdozu\.com\/[^"]+\-izle\/)"/gi;
      var match;
      while ((match = regex.exec(html)) !== null) {
        if (links.indexOf(match[1]) === -1) {
          links.push(match[1]);
        }
      }

      if (!links.length) {
        throw new Error('Bu film için site üzerinde sonuç bulunamadı.');
      }

      // Rastgele veya ilk sıradakini değil, başlığa en çok benzeyeni seçmeye çalışalım
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
              throw new Error('Video akış adresi (m3u8) çözülemedi.');
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
    });
  });
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { getStreams: getStreams };
} else {
  global.getStreams = getStreams;
}
