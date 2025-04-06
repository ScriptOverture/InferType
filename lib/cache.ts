export function Cache() {
    const cache = new Map<string, any>();

    const self = {
        initializerCache,
        has: (key: string) => cache.has(key),
        get: (key: string) => cache.get(key),
    };

    function initializerCache(data: object) {
        Object.keys(data).forEach(key => {
            cache.set(key, new Set());
        })

        return self;
    }

    return self;
}

