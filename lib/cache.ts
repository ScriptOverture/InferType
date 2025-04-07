type CacheValue<T> = T | undefined | ReturnType<typeof Cache<T>>;

type AddParam<T> = T extends { add: (key: string, val: infer U) => any } ? U : T;

export function Cache<T>() {
    const cache = new Map<string, CacheValue<T>>();
    const self = {
        initializerCache,
        has: (key: string) => cache.has(key),
        get: (key: string) => cache.get(key),
        add: function (key: string, val?: AddParam<T>) {
            const prev = cache.get(key);
            if (!prev) {
                cache.set(key, val as T)
            }
        },
        get size() {
            return cache.size;
        }
    };

    function initializerCache(data: object) {
        Object.keys(data).forEach(key => {
            cache.set(key, Cache<T>());
        })

        return self;
    }

    return self;
}