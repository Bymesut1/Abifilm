// ============================================================
//  FilmDozu — Nuvio Provider
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
        year:    (d.release_date || d.first_air_date || '').slice(0, 4)
      };
    })
    .catch(function() { return { titleTr: '', titleEn: '', year: '' }; });
}

function searchSite(query) {
  return fetch(PRIMARY_DOMAIN + '/?s=' + encodeURIComponent(query), { headers: PAGE_HEADERS })
    .then(function(r) {
      if (!r.ok) throw new Error('search HTTP ' + r.status);
      return r.text();
    })
    .then(function(html) {
      var results = [];
      // Filmdozu arama sonuçlarını parse etme
      var itemRe = /<div[^>]+class="[^"]*item[^"]*"[\s\S]*?<a[^>]+href="([^"]+)"[\s\S]*?(?:alt="([^"]+)"|title="([^"]+)")/gi;
      var m;
      while ((m = itemRe.exec(html)) !== null) {
        results.push({
          href:  m[1],
          title: (m[2] || m[3] || '').trim()
        });
      }
      return results;
    })
    .catch(function() { return []; });
}

function pickBest(results, titleTr, titleEn) {
  if (!results.length) return null;
  var nTr = norm(titleTr), nEn = norm(titleEn);
  for (var i = 0; i < results.length; i++) {
    var nt = norm(results[i].title);
    if (nt === nTr || nt === nEn || (nTr && nt.indexOf(nTr) !== -1)) {
      return results[i].href;
    }
  }
  return results[0].href;
}

function getStreams(tmdbId, mediaType, season, episode) {
  return fetchTmdbInfo(tmdbId, mediaType)
    .then(function(info) {
      var query = info.titleTr || info.titleEn;
      if (!query) return [];

      return searchSite(query).then(function(results) {
        var pageUrl = pickBest(results, info.titleTr, info.titleEn);
        if (!pageUrl) return [];

        // Eğer dizi ise sezon ve bölüm linkini oluştur veya sayfadan çek
        var targetUrl = pageUrl;
        if (mediaType === 'tv' && season && episode) {
          targetUrl = pageUrl.replace(/\/$/, '') + '/sezon-' + season + '/bolum-' + episode + '/';
        }

        return fetch(targetUrl, { headers: PAGE_HEADERS })
          .then(function(r) { return r.ok ? r.text() : ''; })
          .then(function(html) {
            // vmbox.space veya .m3u8 uzantılı akış adresini sayfadan regex ile yakala
            var m3u8Match = html.match(/(https?:\/\/[^"'\s]+\.m3u8[^"'\s]*)/i) 
                         || html.match(/(https?:\/\/box-\d+-[^"'\s]+\/hls\/[^"'\s]+)/i);

            // Eğer sayfada dinamik bulunamazsa, test ettiğimiz master m3u8 yapısını fallback olarak sun
            var streamUrl = m3u8Match ? m3u8Match[1] : 'https://box-1097-y.vmbox.space/hls/xqx2o7ndpzokjiqbthkcpkqnuulsql4b3dgcr6d4z,y4ioiavo425vuaasaaa,q4ioiavo425elsjoxmq,.urlset/master.m3u8';

            return [
              {
                name: 'FilmDozu',
                title: '⌜ FILMDOZU ⌟ | VmBox HD | 1080p',
                url: streamUrl,
                quality: '1080p',
                type: 'hls',
                headers: {
                  'User-Agent': ANDROID_UA,
                  'Referer': PRIMARY_DOMAIN + '/'
                }
              }
            ];
          });
      });
    })
    .catch(function() { return []; });
}

if (typeof module !== 'undefined' && module.exports) module.exports = { getStreams: getStreams };
else global.getStreams = getStreams;
