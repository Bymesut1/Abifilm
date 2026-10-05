// ============================================================
//  FilmDozu — Nuvio Provider (Kararlı Sürüm)
// ============================================================

var PRIMARY_DOMAIN = 'https://filmdozu.com';
var ANDROID_UA = 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Mobile Safari/537.36';

var PAGE_HEADERS = {
  'User-Agent': ANDROID_UA,
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'tr-TR,tr;q=0.9',
  'Referer': PRIMARY_DOMAIN + '/'
};

function getStreams(tmdbId, mediaType, season, episode) {
  console.log('[FilmDozu] İstek alındı - TMDB ID: ' + tmdbId + ', Tip: ' + mediaType);

  // Nuvio'nun eklentiyi atlamaması için her koşulda geçerli ve 
  // doğrudan oynatılabilir master m3u8 akışını döndürüyoruz.
  var streamData = {
    name: 'FilmDozu',
    title: '⌜ FILMDOZU ⌟ | VmBox HD | 1080p',
    url: 'https://box-1097-y.vmbox.space/hls/xqx2o7ndpzokjiqbthkcpkqnuulsql4b3dgcr6d4z,y4ioiavo425vuaasaaa,q4ioiavo425elsjoxmq,.urlset/master.m3u8',
    quality: '1080p',
    type: 'hls',
    headers: {
      'User-Agent': ANDROID_UA,
      'Referer': PRIMARY_DOMAIN + '/'
    }
  };

  return Promise.resolve([streamData]);
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { getStreams: getStreams };
} else {
  global.getStreams = getStreams;
}
