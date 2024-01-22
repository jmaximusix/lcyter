import { createApp } from 'https://unpkg.com/petite-vue?module';

createApp({

    shareModal: false,
    my_subscriptions: {},

    hasValidToken() {
        const token = localStorage.getItem('access_token');
        const expiration = localStorage.getItem('expires_at');
        // Check if token expires within the next minute
        if (Date.now() + 60000 > expiration) {
            console.log('Previously stored token has expired')
            localStorage.removeItem('access_token');
            localStorage.removeItem('expires_at');
            return false;
        }
        return token !== null;
    },
    async getSubscriptions() {
        const token = localStorage.getItem('access_token');
        let url = new URL('https://www.googleapis.com/youtube/v3/subscriptions');
        let stats_url = new URL('https://www.googleapis.com/youtube/v3/channels');
        let params = {
            part: 'snippet',
            mine: true,
            maxResults: 50,
            access_token: token
        };
        Object.keys(params).forEach(key => url.searchParams.append(key, params[key]));
        stats_url.searchParams.set('part', 'statistics');
        stats_url.searchParams.set('access_token', token);
        let nextPageToken = '';
        let youtubers = {};
        while (nextPageToken !== undefined) {
            url.searchParams.set('pageToken', nextPageToken);
            const response = await (await fetch(url)).json();
            nextPageToken = response.nextPageToken;
            // nextPageToken = undefined;
            let yters_on_page = {}
            for (let item of response.items) {
                const channel_id = item.snippet.resourceId.channelId;
                const name = item.snippet.title;
                const thumbnail = item.snippet.thumbnails.default.url;
                yters_on_page[channel_id] = { name, thumbnail };
            }
            stats_url.searchParams.set('id', Object.keys(yters_on_page).join(','));
            const stats = await (await fetch(stats_url)).json();
            for (let item of stats.items) {
                const channel_id = item.id;
                const sub_count = item.statistics.subscriberCount;
                yters_on_page[channel_id].subs = sub_count;
            }
            youtubers = { ...youtubers, ...yters_on_page };
        }
        this.my_subscriptions = Object.values(youtubers).sort((a, b) => b.subs - a.subs);
    },

    async oauthSignIn() {
        const oauth2Endpoint = 'https://accounts.google.com/o/oauth2/v2/auth';
        let form = document.createElement('form');
        form.setAttribute('method', 'GET');
        form.setAttribute('action', oauth2Endpoint);
        const response = await fetch('/client-info');
        let params = await response.json();
        params['response_type'] = 'token';
        params['scope'] = 'https://www.googleapis.com/auth/youtube.readonly';
        for (let p in params) {
            let input = document.createElement('input');
            input.setAttribute('type', 'hidden');
            input.setAttribute('name', p);
            input.setAttribute('value', params[p]);
            form.appendChild(input);
        }
        document.body.appendChild(form);
        form.submit();
    },

    displaySubs(yter) {
        return formatNumber(yter.subs);
    },

    share() {
        console.log("sharing....")
    },

    getModal() {
        return this.shareModal;
    },

    toggleShareModal() {
        console.log("toggling share modal to " + !this.shareModal);
        this.shareModal = !this.shareModal;
    }

}).mount("#example");

function formatNumber(num) {
    if (num >= 1000000) {
        return (num / 1000000).toPrecision(3) + ' M';
    } else if (num >= 10000) {
        return (num / 1000).toPrecision(3) + ' K';
    } else {
        return num.toString();
    }
}