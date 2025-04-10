export type CacheValue<T> = T | undefined | CacheType<T>;

export type CacheType<T> = {
    initializerCache: (data: object) => CacheType<T>;
    has: (key: string) => boolean;
    get: (key: string) => CacheType<T>;
    add: (key: string, val?: T | CacheType<T>) => void;
    update: (key: string, val: T | CacheType<T>) => void;
    size: number;
    getValueStr: (key: string) => T;
    getOriginMap: () => Map<string, CacheValue<T>>;
  }


export function Cache<T>(): CacheType<T> {
    const cache = new Map<string, CacheValue<T>>();
    const self = {
        initializerCache,
        has: (key: string) => cache.has(key),
        get: (key: string) => cache.get(key) as CacheType<T>,
        getValueStr: (key: string) => cache.get(key) as T,
        add: function(key: string, val: T | CacheValue<T>) {
            if (!cache.has(key)) {
                cache.set(key, val as T)
            }
        },
        update: (key: string, val: T | CacheValue<T>) => {
            const prev = cache.get(key);
            if (prev && isCache(prev)) {
                prev.update(key, val);
            } else {
                cache.set(key, val as T);
            }
        },
        get size() {
            return cache.size;
        },
        getOriginMap: () => cache
    };

    function initializerCache(data: Partial<{ [K in keyof T]: T[K] }>) {
        Object.keys(data).forEach(key => {
            cache.set(key, Cache<T>());
        })

        return self;
    }

    return self;
}

function isCache<T>(value: any): value is CacheType<T> {
  return value && typeof value.update === 'function';
}