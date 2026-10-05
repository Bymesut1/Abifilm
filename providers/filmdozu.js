// ============================================================
//  FilmDozu — Nuvio Provider (Direkt Master M3U8 Sürümü)
// ============================================================

var ANDROID_UA = 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Mobile Safari/537.36';

function getStreams(tmdbId, mediaType, season, episode) {
  console.log('[FilmDozu] getStreams çağrıldı. tmdbId: ' + tmdbId);

  // Arama veya site parse adımlarını geçici olarak bypass edip, 
  // doğrudan senin yakaladığın master m3u8 akışını veriyoruz ki Nuvio akışı kesin versin.
  var masterUrl = 'https://box-1097-y.vmbox.space/hls/xqx2o7ndpzokjiqbthkcpkqnuulsql4b3dgcr6d4z,y4ioiavo425vuaasaaa,q4ioiavo425elsjoxmq,.urlset/master.m3u8';

  var streamObject = {
    name: 'FilmDozu',
    title: '⌜ FILMDOZU ⌟ | VmBox Master HD | 1080p',
    url: masterUrl,
    quality: '1080p',
    type: 'hls',
    headers: {
      'User-Agent': ANDROID_UA,
      'Referer': 'https://filmdozu.com/'
    }
  };

  return Promise.resolve([streamObject]);
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { getStreams: getStreams };
} else {
  global.getStreams = getStreams;
}
