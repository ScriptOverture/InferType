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
            });
        }
    })
});


describe("检查参数解构属性的类型", () => {
    const funName = 'test';
    
    const defaultType = {
        name: 'string',
        age: 'string',
        a1: 'number',
    };

    const paramsMap = [
        [`{name,age,a1}: {name:${defaultType.name},age:${defaultType.age},a1:${defaultType.a1}}`],
        [`{age,a2}:DataType}`]
    ];

    test("检查参数解构属性的类型是否正常", () => {
        const origin = `
        type DataType = {
            name: string,
            age: string,
            a1: number,
        }
        function ${funName}(${paramsMap.join(',')}) {
        }`;
        const paramsData = inferFunctionType(origin, funName).params;
        const params_0 = paramsData[`{name,age,a1}`];
        expect(params_0?.origin['name']).toBe(defaultType['name']);
        expect(params_0?.origin['age']).toBe(defaultType['age']);
        expect(params_0?.origin['a1']).toBe(defaultType['a1']);

        const params_1 = paramsData[`{age,a2}`];
        expect(params_1?.origin['age']).toBe(defaultType['age']);
        expect(params_1?.origin['a2']).toBe('any');
    })
})