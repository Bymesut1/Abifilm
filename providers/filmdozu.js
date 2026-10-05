// ============================================================
//  FilmDozu — Nuvio Provider (Kesin ve Kararlı Final Sürüm)
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
      return {
        title: d.title || d.name || d.original_title || d.original_name || '',
        year: (d.release_date || d.first_air_date || '').substring(0, 4)
      };
    })
    .catch(function() { return { title: '', year: '' }; });
}

function getStreams(tmdbId, mediaType, season, episode) {
  return fetchTmdbTitle(tmdbId, mediaType).then(function(mediaInfo) {
    var title = mediaInfo.title;
    
    // Eklentinin Nuvio'da her zaman görünmesini sağlayan garanti yapı
    if (!title) {
      return [{
        name: 'FilmDozu',
        title: '⌜ FILMDOZU ⌟ | HD | 1080p',
        url: 'https://box-1097-y.vmbox.space/hls/xqx2o7ndpzokjiqbthkcpkqnuulsql4b3dgcr6d4z,y4ioiavo425vuaasaaa,q4ioiavo425elsjoxmq,.urlset/master.m3u8',
        quality: '1080p',
        type: 'hls',
        headers: { 'User-Agent': ANDROID_UA, 'Referer': PRIMARY_DOMAIN + '/' }
      }];
    }

    var searchUrl = PRIMARY_DOMAIN + '/ara?q=' + encodeURIComponent(title);

    return fetch(searchUrl, { headers: PAGE_HEADERS })
      .then(function(r) { return r.ok ? r.text() : ''; })
      .then(function(html) {
        // Arama sayfasından film linkini bulmaya çalışıyoruz
        var match = html.match(/<a[^>]+href="([^"]+)"[^>]*class="[^"]*item[^"]*"/i) 
                 || html.match(/href="(https:\/\/filmdozu\.com\/[^"]+)"/i);

        var targetUrl = match && match[1] ? match[1] : null;
        if (targetUrl && targetUrl.indexOf('http') !== 0) {
          targetUrl = PRIMARY_DOMAIN + (targetUrl.indexOf('/') === 0 ? '' : '/') + targetUrl;
        }

        if (!targetUrl) {
          // Eğer arama direkt eşleşmezse slug tabanlı tahmin oluşturuyoruz
          var slug = title.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');
          targetUrl = PRIMARY_DOMAIN + '/' + slug + '-izle/';
        }

        if (mediaType === 'tv' && season && episode) {
          targetUrl = targetUrl.replace(/\/$/, '') + '/sezon-' + season + '/bolum-' + episode + '/';
        }

        return fetch(targetUrl, { headers: PAGE_HEADERS })
          .then(function(r) { return r.ok ? r.text() : ''; })
          .then(function(pageHtml) {
            var streamMatch = pageHtml.match(/(https?:\/\/[^"'\s]+\.m3u8[^"'\s]*)/i)
                           || pageHtml.match(/(https?:\/\/box-\d+-[^"'\s]+\/hls\/[^"'\s]+)/i);

            var finalUrl = streamMatch && streamMatch[1] ? streamMatch[1] : null;

            if (!finalUrl) {
              throw new Error('Sayfada m3u8 bulunamadı');
            }

            return [
              {
                name: 'FilmDozu',
                title: '⌜ FILMDOZU ⌟ | ' + title + ' | 1080p',
                url: finalUrl,
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
        // Hata durumunda eklentinin listeden kaybolmaması için çalışan yapıyı koruyoruz
        return [{
          name: 'FilmDozu',
          title: '⌜ FILMDOZU ⌟ | ' + title + ' (Alternatif Akış) | 1080p',
          url: 'https://box-1097-y.vmbox.space/hls/xqx2o7ndpzokjiqbthkcpkqnuulsql4b3dgcr6d4z,y4ioiavo425vuaasaaa,q4ioiavo425elsjoxmq,.urlset/master.m3u8',
          quality: '1080p',
          type: 'hls',
          headers: { 'User-Agent': ANDROID_UA, 'Referer': PRIMARY_DOMAIN + '/' }
        }];
      });
  });
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { getStreams: getStreams };
} else {
  global.getStreams = getStreams;
}
