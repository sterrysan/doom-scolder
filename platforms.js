// platforms.js - Shared platform registry & DOM-agnostic URL scoping for Doom Scolder

(function (root) {
    const BUILTIN_PLATFORMS = [
        {
            id: 'youtube',
            name: 'YouTube',
            note: 'Default: Home, Shorts & Feeds only',
            hosts: ['youtube.com', 'www.youtube.com', 'm.youtube.com'],
            defaultEnabled: true,
            supportsScope: true,
            scopeLabel: 'Shorts',
            defaultScope: 'full',
            shortFormRegex: /^\/shorts\/([a-zA-Z0-9_-]+)/,
            isFeedRoute(pathname) {
                if (pathname === '/' || pathname === '') return true;
                if (/^\/shorts(\/|$)/.test(pathname)) return true;
                if (/^\/feed(\/|$)/.test(pathname)) return true;
                return false;
            }
        },
        {
            id: 'facebook',
            name: 'Facebook',
            note: 'Reels, Feed, Groups & Marketplace',
            hosts: ['facebook.com', 'www.facebook.com', 'm.facebook.com', 'web.facebook.com'],
            defaultEnabled: true,
            supportsScope: true,
            scopeLabel: 'Reels',
            defaultScope: 'full',
            shortFormRegex: /^\/reel\/([a-zA-Z0-9_-]+)/,
            isFeedRoute(pathname) {
                if (/^\/(reel|reels|watch)(\/|$)/i.test(pathname)) return true;
                return false;
            }
        },
        {
            id: 'instagram',
            name: 'Instagram',
            note: 'Feed, Explore & Reels',
            hosts: ['instagram.com', 'www.instagram.com'],
            defaultEnabled: true,
            supportsScope: true,
            scopeLabel: 'Reels',
            defaultScope: 'full',
            shortFormRegex: /^\/(reels|reel)\/([a-zA-Z0-9_-]+)/,
            isFeedRoute(pathname) {
                if (/^\/(reels|reel|explore)(\/|$)/i.test(pathname)) return true;
                return false;
            }
        },
        {
            id: 'reddit',
            name: 'Reddit',
            note: 'Default: Front page & subreddit feeds (keeps /comments/ open)',
            hosts: ['reddit.com', 'www.reddit.com', 'old.reddit.com', 'new.reddit.com'],
            defaultEnabled: true,
            supportsScope: true,
            scopeLabel: 'Feeds',
            defaultScope: 'feeds',
            shortFormRegex: null,
            isFeedRoute(pathname) {
                const clean = pathname.replace(/\/+$/, '') || '/';
                // Always keep individual post comment threads accessible in Feeds mode
                if (/\/comments(\/|$)/i.test(clean)) return false;
                if (clean === '/') return true;
                if (/^\/(hot|new|rising|top|best|controversial)(\/|$)/i.test(clean)) return true;
                if (/^\/r\/(popular|all)(\/|$)/i.test(clean)) return true;
                // Match subreddit listing pages (/r/memes, /r/gaming/top) without /comments/
                if (/^\/r\/[^/]+(\/(hot|new|rising|top|best|controversial))?(\/|$)/i.test(clean)) {
                    return true;
                }
                return false;
            }
        },
        {
            id: 'twitter',
            name: 'X / Twitter',
            note: 'Real-time infinite feed',
            hosts: ['x.com', 'www.x.com', 'twitter.com', 'www.twitter.com', 'mobile.twitter.com'],
            defaultEnabled: true,
            supportsScope: false,
            defaultScope: 'full',
            shortFormRegex: null
        },
        {
            id: 'tiktok',
            name: 'TikTok',
            note: 'For You & short-form video feed',
            hosts: ['tiktok.com', 'www.tiktok.com'],
            defaultEnabled: true,
            supportsScope: false,
            defaultScope: 'full',
            shortFormRegex: /^\/@[^/]+\/video\/([0-9]+)/
        },
        {
            id: 'linkedin',
            name: 'LinkedIn',
            note: 'Default: Home feed only (keeps Jobs & Messages open)',
            hosts: ['linkedin.com', 'www.linkedin.com'],
            defaultEnabled: true,
            supportsScope: true,
            scopeLabel: 'Feed',
            defaultScope: 'feeds',
            shortFormRegex: null,
            isFeedRoute(pathname) {
                const clean = pathname.replace(/\/+$/, '') || '/';
                if (clean === '/') return true;
                if (/^\/feed(\/|$)/i.test(clean)) return true;
                return false;
            }
        },
        {
            id: 'pinterest',
            name: 'Pinterest',
            note: 'Infinite visual grid',
            hosts: ['pinterest.com', 'www.pinterest.com'],
            hostSuffix: '.pinterest.com',
            defaultEnabled: true,
            supportsScope: false,
            defaultScope: 'full',
            shortFormRegex: null
        },
        {
            id: 'threads',
            name: 'Threads',
            note: 'Infinite text & media feed',
            hosts: ['threads.net', 'www.threads.net', 'threads.com', 'www.threads.com'],
            defaultEnabled: true,
            supportsScope: false,
            defaultScope: 'full',
            shortFormRegex: null
        },
        {
            id: 'bluesky',
            name: 'Bluesky',
            note: 'Infinite social feed',
            hosts: ['bsky.app', 'www.bsky.app'],
            defaultEnabled: true,
            supportsScope: false,
            defaultScope: 'full',
            shortFormRegex: null
        },
        {
            id: 'discord',
            name: 'Discord (Web)',
            note: 'Browser version only (off by default)',
            hosts: ['discord.com', 'www.discord.com', 'ptb.discord.com', 'canary.discord.com'],
            defaultEnabled: false,
            supportsScope: false,
            defaultScope: 'full',
            shortFormRegex: null
        }
    ];

    function getDefaultPlatformSettings() {
        const map = {};
        BUILTIN_PLATFORMS.forEach((p) => {
            map[p.id] = {
                enabled: p.defaultEnabled,
                scope: p.defaultScope
            };
        });
        return map;
    }

    function mergePlatformSettings(saved) {
        const defaults = getDefaultPlatformSettings();
        if (!saved || typeof saved !== 'object') return defaults;
        Object.keys(defaults).forEach((id) => {
            if (saved[id] && typeof saved[id] === 'object') {
                defaults[id] = {
                    enabled: typeof saved[id].enabled === 'boolean' ? saved[id].enabled : defaults[id].enabled,
                    scope: saved[id].scope === 'full' || saved[id].scope === 'feeds'
                        ? saved[id].scope
                        : defaults[id].scope
                };
            }
        });
        return defaults;
    }

    function normalizeDomain(input) {
        if (!input || typeof input !== 'string') return '';
        let val = input.trim().toLowerCase();
        val = val.replace(/^https?:\/\//, '');
        val = val.split('/')[0].split('?')[0].split('#')[0];
        val = val.split(':')[0];
        val = val.replace(/^www\./, '');
        if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(val)) return '';
        return val;
    }

    function hostMatches(hostname, domain) {
        return hostname === domain || hostname.endsWith('.' + domain);
    }

    function evaluateUrl(urlString, platformSettings, customSites) {
        let parsed;
        try {
            parsed = new URL(urlString);
        } catch (e) {
            return { matched: false };
        }

        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
            return { matched: false };
        }

        const hostname = parsed.hostname.toLowerCase();
        const pathname = parsed.pathname || '/';
        const settings = mergePlatformSettings(platformSettings);

        for (const platform of BUILTIN_PLATFORMS) {
            const isHostMatch = platform.hosts.includes(hostname) ||
                (platform.hostSuffix && hostname.endsWith(platform.hostSuffix));

            if (!isHostMatch) continue;

            const cfg = settings[platform.id];
            if (!cfg || !cfg.enabled) {
                return { matched: false, platformId: platform.id, platformName: platform.name };
            }

            const scope = platform.supportsScope ? cfg.scope : 'full';
            const routeMatched = scope === 'full'
                ? true
                : (typeof platform.isFeedRoute === 'function' ? platform.isFeedRoute(pathname) : true);

            let isShortForm = false;
            let shortFormId = null;
            if (platform.shortFormRegex) {
                const m = pathname.match(platform.shortFormRegex);
                if (m) {
                    isShortForm = true;
                    shortFormId = m[m.length - 1];
                }
            }

            return {
                matched: routeMatched,
                platformId: platform.id,
                platformName: platform.name,
                scope,
                isShortForm,
                shortFormId
            };
        }

        if (Array.isArray(customSites)) {
            for (const site of customSites) {
                if (!site || !site.enabled || !site.domain) continue;
                if (hostMatches(hostname, site.domain)) {
                    return {
                        matched: true,
                        platformId: site.id,
                        platformName: site.domain,
                        scope: 'full',
                        isCustom: true,
                        isShortForm: false,
                        shortFormId: null
                    };
                }
            }
        }

        return { matched: false };
    }

    root.DoomPlatforms = {
        BUILTIN_PLATFORMS,
        getDefaultPlatformSettings,
        mergePlatformSettings,
        normalizeDomain,
        evaluateUrl
    };
})(typeof self !== 'undefined' ? self : window);
