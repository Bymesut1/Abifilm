import {
    TvType,
    BaseProvider,
    loadHtml,
} from '@nativeseeker/plugin-sdk';

export default class FilmDozuProvider extends BaseProvider {
    name = 'FilmDozu';
    logo = 'https://www.google.com/s2/favicons?domain=filmdozu.com&sz=64';
    supportedTypes = [TvType.Movie, TvType.TvSeries];
    mainUrl = 'https://filmdozu.com';

    async search(query) {
        try {
            const res = await this.client.get(`${this.mainUrl}/?s=${encodeURIComponent(query)}`);
            const $ = loadHtml(res.data);
            const results = [];

            // Güvenli seçici yapısı
            $('article, .item, .film-item').each((i, el) => {
                const titleNode = $(el).find('h2, .title, a').first();
                const title = titleNode.text().trim();
                const url = $(el).find('a').attr('href');
                const posterUrl = $(el).find('img').attr('data-src') \vert{}\vert{}$(el).find('img').attr('src');

                if (url && title) {
                    results.push({
                        title: title,
                        url: url,
                        posterUrl: posterUrl || '',
                        type: TvType.Movie
                    });
                }
            });

            return results;
        } catch (e) {
            return [];
        }
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
