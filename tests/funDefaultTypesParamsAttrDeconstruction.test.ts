import { expect, test, describe } from "bun:test";
import { inferFunctionType } from '../main'


describe("检查函数结构后参数类型是否正常", () => {
    const funName = 'test';
    const paramsMap = new Map([
        ['a', ['name = "123"', 'age = 1', 'total', 'data = [1,2,3]']], 
        ['b', ['a1', 'a2', 'a3']], 
        ['c', []], 
        ['d', []]
    ]);
    const defaultType = {
        name: 'string',
        age: 'number',
        data: 'number[]'
    };
    const params = Array.from(paramsMap, (([key, _]) => key));
    const renderParamAttrs = Array.from(paramsMap, (([key, attrs]) => `const {${attrs.join(',')}} = ${key};`)); 
    test("函数参数解构默认赋值参数类型是否匹配", () => {
        const origin = `function ${funName}(${params.join(',')}) {
            ${renderParamAttrs.join('')}
        }`;
        const attributeData = inferFunctionType(origin, funName).attributeData;

        for (const [key, types] of paramsMap.entries()) {
            const allKeyType = attributeData.get(key!);
            types?.forEach(item => {
                let type = item;
                if (item.includes('=')) {
                    type = item.split('=')[0]?.trim()!;
                    expect(allKeyType?.get(type)).toBe(defaultType[type as keyof typeof defaultType]);
                } else {
                    expect(allKeyType?.get(type)).toBe('any');
                }
            })
            
        }
    })
});