import { createApp } from 'https://unpkg.com/petite-vue?module';

createApp({
    request: {},
    submit: {
        queryParams: {
            id: '',
            password: '',
        },
        endpoint: '',
        options: ''
    },

    other: [],
    my_subscriptions: [],

    displayData() {
        if (this.other.length === 0) {
            if (this.my_subscriptions.length === 0) {
                return [];
            }
            return [{
                title: 'My Subscriptions',
                style: 'normal',
                yters: this.my_subscriptions
            }];
        }
        let common = {
            title: 'Common Subscriptions',
            style: 'normal',
            yters: []
        };

        let mineOnly = {
            title: "Youtubers only you're subscribed to",
            style: 'greyed-out',
            yters: []
        };
        for (const yter of this.my_subscriptions) {
            if (this.other.includes(yter.hash)) {
                common.yters.push(yter)
            } else {
                mineOnly.yters.push(yter)
            }
        }
        let lcyter = common.yters.reduce((min, current) => {
            return (current.subs < min.subs) ? current : min;
        });
        return [{
            title: 'Your Least Common Youtuber',
            style: 'lcyter',
            yters: [lcyter]
        }, common, mineOnly];
    },

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
            let yters_on_page = {}
            for (let item of response.items) {
                const id = item.snippet.resourceId.channelId;
                const hash = await sha256_digest(id);
                const name = item.snippet.title;
                const thumbnail = item.snippet.thumbnails.default.url;
                yters_on_page[id] = { name, thumbnail, id, hash };
            }
            stats_url.searchParams.set('id', Object.keys(yters_on_page).join(','));
            const stats = await (await fetch(stats_url)).json();
            for (let item of stats.items) {
                const channel_id = item.id;
                const sub_count = item.statistics.subscriberCount;
                yters_on_page[channel_id].subs = parseInt(sub_count);
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

    hashes() {
        return this.my_subscriptions.map(yter => yter.hash).join('\n');
    },

    displaySubs(yter) {
        return formatNumber(yter.subs);
    },

    async uploadOrDelete() {
        const url = new URL(this.submit.endpoint, window.location.origin);
        url.searchParams.set('identifier', this.submit.queryParams.id);
        url.searchParams.set('password', this.submit.queryParams.password);
        const response = await fetch(url, this.submit.options);
        console.log(response);
    },

    deleteData() {
        this.submit.endpoint = '/delete';
        this.submit.options = { method: 'PATCH' };
    },

    uploadData() {
        this.submit.endpoint = '/upload';
        this.submit.options = {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain' },
            body: this.hashes()
        };
    },

    deleteAccount() {
        this.submit.endpoint = '/delete';
        this.submit.options = { method: 'DELETE' };
    },

    async fetchComparison() {
        const url = new URL('/compare/' + this.submit.queryParams.id, window.location.origin);
        const response = await (await fetch(url)).text();
        this.other = response.split('\n');
    },

    localUpload() {
        console.log('local upload');
    },

    localDownload() {
        const data = this.hashes();
        const blob = new Blob([data], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'my_lcyter_hashes.txt';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    },

    Modal,
    FillSlot

}).mount();

function Modal(showbutton, body, id, password, actions, handler) {
    return {
        $template: '#modal',
        handleSubmit: handler,
        isVis: false,
        toggleVis() {
            this.isVis = !this.isVis;
        },
        showbutton,
        body,
        id,
        password,
        actions

    }
}

function FillSlot(inner) {
    return {
        $template: inner
    }
}

function formatNumber(num) {
    if (num >= 1000000) {
        return (num / 1000000).toPrecision(3) + ' M';
    } else if (num >= 10000) {
        return (num / 1000).toPrecision(3) + ' K';
    } else {
        return num.toString();
    }
}

async function sha256_digest(id) {
    const msgUint8 = new TextEncoder().encode(id);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex;
}