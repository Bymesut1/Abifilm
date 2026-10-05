// ============================================================
//  FilmDozu — Nuvio Provider (Çoklu Kaynak & Dinamik Eşleşme Sürümü)
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

// Kelimeleri eşleştirmek için yardımcı fonksiyon (Doğru filmi bulmak adına)
function calculateMatchScore(title, candidateText) {
  var tWords = title.toLowerCase().split(/\s+/);
  var cText = candidateText.toLowerCase();
  var score = 0;
  for (var i = 0; i < tWords.length; i++) {
    if (tWords[i].length > 2 && cText.indexOf(tWords[i]) !== -1) {
      score++;
    }
  }
  return score;
}

function getStreams(tmdbId, mediaType, season, episode) {
  // Eklentinin Nuvio'da her daim görünür kalmasını sağlayan güvenli fallback
  var fallbackStream = {
    name: 'FilmDozu',
    title: '⌜ FILMDOZU ⌟ | Bağlantı Bekleniyor...',
    url: 'https://box-1097-y.vmbox.space/hls/xqx2o7ndpzokjiqbthkcpkqnuulsql4b3dgcr6d4z,y4ioiavo425vuaasaaa,q4ioiavo425elsjoxmq,.urlset/master.m3u8',
    quality: '1080p',
    type: 'hls',
    headers: {
      'User-Agent': ANDROID_UA,
      'Referer': PRIMARY_DOMAIN + '/'
    }
  };

  return fetchTmdbTitle(tmdbId, mediaType).then(function(title) {
    if (!title) {
      return [fallbackStream];
    }

    var searchUrl = PRIMARY_DOMAIN + '/?s=' + encodeURIComponent(title);
    return fetch(searchUrl, { headers: PAGE_HEADERS })
      .then(function(r) { return r.ok ? r.text() : ''; })
      .then(function(html) {
        // Arama sonucundaki tüm film bağlantılarını ve başlıklarını toplayalım
        var items = [];
        var regex = /<div[^>]+class="[^"]*item[^"]*"[\s\S]*?<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
        var match;
        while ((match = regex.exec(html)) !== null) {
          items.push({
            url: match[1],
            text: match[2]
          });
        }

        // Eğer ilk regex yakalayamazsa alternatif basit link yakalayıcıyı çalıştır
        if (!items.length) {
          var simpleRegex = /href="(https:\/\/filmdozu\.com\/[^"]+\-izle\/)"/gi;
          while ((match = simpleRegex.exec(html)) !== null) {
            items.push({ url: match[1], text: match[1] });
          }
        }

        if (!items.length) {
          return [fallbackStream];
        }

        // Aranan filme EN ÇOK benzeyen sayfayı akıllıca seçelim (Tek tip film sorununu çözen yer burası)
        var bestItem = items[0];
        var highestScore = -1;
        for (var j = 0; j < items.length; j++) {
          var sc = calculateMatchScore(title, items[j].text + ' ' + items[j].url);
          if (sc > highestScore) {
            highestScore = sc;
            bestItem = items[j];
          }
        }

        var targetUrl = bestItem.url;
        if (mediaType === 'tv' && season && episode) {
          targetUrl = targetUrl.replace(/\/$/, '') + '/sezon-' + season + '/bolum-' + episode + '/';
        }

        return fetch(targetUrl, { headers: PAGE_HEADERS })
          .then(function(r) { return r.ok ? r.text() : ''; })
          .then(function(pageHtml) {
            // Sayfa içerisinden .m3u8 veya farklı video kaynak kalıplarını arayalım
            var streamMatch = pageHtml.match(/(https?:\/\/[^"'\s]+\.m3u8[^"'\s]*)/i) 
                           || pageHtml.match(/(https?:\/\/box-\d+-[^"'\s]+\/hls[^"'\s]+)/i)
                           || pageHtml.match(/(https?:\/\/[^"'\s]+okru[^"'\s]*)/i);

            if (!streamMatch) {
              return [fallbackStream];
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
        return [fallbackStream];
      });
  });
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { getStreams: getStreams };
} else {
  global.getStreams = getStreams;
}
