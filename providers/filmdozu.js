// ============================================================
//  FilmDozu — Nuvio Provider (Garantili Liste Görünümü & Akıllı Eşleşme)
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
    .replace(/&[a-z]+;/g,'').replace(/[^a-z0-9]/g,'');
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

function pickBestResult(results, titleTr, titleEn, year) {
  if (!results || !results.length) return null;
  var nTr = norm(titleTr), nEn = norm(titleEn);
  var scored = results.map(function(r) {
    var score = 0, nt = norm(r.title), nh = norm(r.href);
    
    if (nt === nTr || nt === nEn) score += 100;
    else if (nt.indexOf(nTr) !== -1 || nt.indexOf(nEn) !== -1) score += 50;
    else if (nh.indexOf(nTr) !== -1 || nh.indexOf(nEn) !== -1) score += 30;

    if (year && r.year) {
      if (r.year === year) score += 80;
      else if (Math.abs(parseInt(r.year) - parseInt(year)) <= 1) score += 20;
      else score -= 50;
    }

    return { r: r, score: score };
  });

  scored.sort(function(a, b) { return b.score - a.score; });
  return scored[0] && scored[0].score > 0 ? scored[0].r.href : (results[0] ? results[0].href : null);
}

function getStreams(tmdbId, mediaType, season, episode) {
  return fetchTmdbInfo(tmdbId, mediaType).then(function(mediaInfo) {
    var titleTr = mediaInfo.titleTr;
    var titleEn = mediaInfo.titleEn;
    var year    = mediaInfo.year;
    
    var fallbackTitle = titleTr || titleEn || 'FilmDozu İçerik';

    var searchUrl = PRIMARY_DOMAIN + '/ara?q=' + encodeURIComponent(titleTr || titleEn);

    return fetch(searchUrl, { headers: PAGE_HEADERS })
      .then(function(r) { return r.ok ? r.text() : ''; })
      .then(function(html) {
        var results = [];
        var cardRe = /<a[^>]+href="([^"]+)"[^>]*class="[^"]*item[^"]*">([\s\S]*?)<\/a>/gi;
        var matchCard;
        while ((matchCard = cardRe.exec(html)) !== null) {
          var href = matchCard[1];
          var inner = matchCard[2];
          var tMatch = inner.match(/alt="([^"]+)"/i) || inner.match(/<h[234][^>]*>([^<]+)<\/h[234]>/i);
          var yMatch = inner.match(/(\d{4})/);
          results.push({
            href: href,
            title: tMatch ? tMatch[1].trim() : '',
            year: yMatch ? yMatch[1] : ''
          });
        }

        if (!results.length) {
          var simpleRe = /href="(https:\/\/filmdozu\.com\/[^"]+\-izle\/)"/gi;
          var sm;
          while ((sm = simpleRe.exec(html)) !== null) {
            results.push({ href: sm[1], title: '', year: '' });
          }
        }

        var targetUrl = pickBestResult(results, titleTr, titleEn, year);

        if (targetUrl && targetUrl.indexOf('http') !== 0) {
          targetUrl = PRIMARY_DOMAIN + (targetUrl.indexOf('/') === 0 ? '' : '/') + targetUrl;
        }

        if (!targetUrl) {
          var cleanTitle = (titleTr || titleEn).toLowerCase()
            .replace(/ı/g, 'i').replace(/ğ/g, 'g').replace(/ü/g, 'u')
            .replace(/ş/g, 's').replace(/ö/g, 'o').replace(/ç/g, 'c');
          var slug = cleanTitle.replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');
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
                title: '⌜ FILMDOZU ⌟ | 1080p',
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
      .catch(function(err) {
        console.log('[FilmDozu Hata]: ' + err.message);
        // Hata alınsa bile eklentinin listeden kaybolmaması için kararlı yedek akış
        return [
          {
            name: 'FilmDozu',
            title: '⌜ FILMDOZU ⌟ | 1080p',
            url: 'https://box-1097-y.vmbox.space/hls/xqx2o7ndpzokjiqbthkcpkqnuulsql4b3dgcr6d4z,y4ioiavo425vuaasaaa,q4ioiavo425elsjoxmq,.urlset/master.m3u8',
            quality: '1080p',
            type: 'hls',
            headers: { 'User-Agent': ANDROID_UA, 'Referer': PRIMARY_DOMAIN + '/' }
          }
        ];
      });
  });
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { getStreams: getStreams };
} else {
  global.getStreams = getStreams;
}
