import {type Parameters, ParamsKind} from "../utils";
import {PropertyAccessExpression, ts} from "ts-morph";

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

function createMap() {
    let map = {};
    return {
        add(params: ToFunction) {
            if (!params) return;

            const newV = toFunction(params)(map);
            map = {
                ...map,
                ...newV
            }
            
        },
        has(key: string) {
            return map.hasOwnProperty(key);
        },
        get map() {
            return map;
        }
    }
}

function isFunction<T>(params: T) {
    return typeof params === 'function';
}

type ToFunction = object | ((data: object) => object);
function toFunction(params: ToFunction) {
    if (isFunction(params)) {
        return params;
    }
    return (data: object) => ({
        ...params,
        ...data,
    });
}


export function getFunctionMetadata(targetParams:  Parameters[]) {

    const contentVO =  {
        parameters: targetParams,
        localVariables: createMap(),
        prototype: {}
    }

    const { paramsMap } = targetParams.reduce((records, item, index) => {
        if (item.kind === ParamsKind.A_2) {
            const map = {}
            item.paramName.forEach(param => {
                contentVO.localVariables.add({
                    [param]: {}
                });
                records.paramsMap[param] = {
                    index,
                    attr: createMap()
                }
            })
        } else if (item.kind === ParamsKind.A_1) {
            records.paramsMap[item.paramName] = {
                index,
                attr: createMap()
            }
            contentVO.localVariables.add({
                [item.paramName]: {}
            })
        }
        return records;
    }, {
        paramsMap: {},
    });

    function get(key) {
        if (paramsMap.hasOwnProperty(key)) {

        }
    }

    const self =  {
        initializer,
        contentVO,
        propsHas(key: string) {
            return key in paramsMap;
        },
        getPropsAttrs(key: string, kind: ParamsKind = ParamsKind.A_1) {
            if (!key || !self.propsHas(key)) return null;
            return paramsMap[key]
        },
        addPropsAttr(attrName: string, val: any) {
            const attrs = self.getPropsAttrs(attrName);
        },
        localVariables: contentVO.localVariables

    }
    return self

    function initializer(paramsVariables:  PropertyAccessExpression<ts.PropertyAccessExpression>[]) {
        paramsVariables?.forEach(expr => {
            const llAccess = expr.getExpression();
            let paramsKey = llAccess.getText();
            let attrName = expr.getName();
            let type: CacheValue<any> | string = 'any';

            // if (paramsMap.hasOwnProperty(paramsKey)) {
            //     paramsMap[paramsKey]['attr'] = {
            //         ...paramsMap[paramsKey]['attr'],
            //         [attrName]: type
            //     };
            //     // funCache.get(paramsKey)?.add(attrName, type);
            // }
        });
        Promise.resolve().then(() => {
            console.log(paramsMap, contentVO.localVariables);
        })

    }
}

