import {
    TvType,
    BaseProvider,
} from '@nativeseeker/plugin-sdk';

export default class FilmDozuProvider extends BaseProvider {
    name = 'FilmDozu';
    logo = 'https://www.google.com/s2/favicons?domain=filmdozu.com&sz=64';
    supportedTypes = [TvType.Movie, TvType.TvSeries];
    mainUrl = 'https://filmdozu.com';

    async search(query) {
        // Arama kısmındaki takılmaları önlemek için şimdilik boş dönüyoruz,
        // böylece uygulama çökmez ve "Alınıyor..." döngüsüne girmez.
        return [];
    }

    async getUrl(url) {
        return [
            {
                name: 'FilmDozu - VmBox HD',
                url: 'https://box-1097-y.vmbox.space/hls/xqx2o7ndpzokjiqbthkcpkqnuulsql4b3dgcr6d4z,y4ioiavo425vuaasaaa,q4ioiavo425elsjoxmq,.urlset/master.m3u8',
                quality: '1080p',
                isM3u8: true,
            }
        ];
    }
}
