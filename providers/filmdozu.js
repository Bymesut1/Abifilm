import {
    TvType,
    BaseProvider,
    loadHtml,
    sourcer,
} from '@nativeseeker/plugin-sdk'; // Nuvio/Cloudstream SDK yapısına göre

export default class VmBoxProvider extends BaseProvider {
    name = 'FilmDozu / VmBox';
    logo = 'https://i.hizliresim.com/ornek.png';
    supportedTypes = [TvType.Movie, TvType.TvSeries];
    mainUrl = 'https://filmdozu.com';

    async search(query) {
        // Arama mantığı veya film sayfasına yönlendirme
        const res = await this.client.get(`${this.mainUrl}/arama?q=${encodeURIComponent(query)}`);
        const $ = loadHtml(res.data);
        const results = [];

        $('.film-item').each((i, el) => {
            results.push({
                title: $(el).find('.title').text().trim(),
                url: $(el).find('a').attr('href'),
                posterUrl: $(el).find('img').attr('data-src'),
                type: TvType.Movie
            });
        });

        return results;
    }

    async getUrl(url) {
        // Film detay sayfasından iframe veya kaynak kodunu çekme
        const res = await this.client.get(url);
        const html = res.data;
        
        // Vbox veya hedef m3u8 adresini regex ile yakalama veya döndürme
        // Yakaladığın direkt m3u8 bağlantısını buraya entegre edebiliriz:
        const streamUrl = "https://box-1097-y.vmbox.space/hls/xqx2o7ndpzokjiqbthkcpkqnuulsql4b3dgcr6d4zy4ioiavo425tvyasaaa/index-v1-a1.m3u8";

        return [
            {
                name: 'VmBox HD',
                url: streamUrl,
                quality: '1080p',
                isM3u8: true,
            }
        ];
    }
}
