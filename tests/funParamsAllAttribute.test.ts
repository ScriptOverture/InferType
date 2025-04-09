import { expect, test, describe } from "bun:test";
import { inferFunctionType } from '../main'

describe("检查函数参数所有属性是否匹配", () => {
    const funName = 'test';
    const paramsMap = new Map([
        ['a', ['name', 'age', 'total', 'data']], 
        ['b', ['a1', 'a2', 'a3']], 
        ['c', []], 
        ['d', []]
    ]);
    const params = Array.from(paramsMap, (([key, _]) => key));
    const renderParamAttrs = Array.from(paramsMap, (([key, attrs]) => `const {${attrs.join(',')}} = ${key};`)); 

    test("函数申明参数函数内单独解构匹配", () => {
        const origin = `function ${funName}(${params.join(',')}) {
            ${renderParamAttrs.join('')}
        }`;
        const attributeData = inferFunctionType(origin, funName).attributeData;
        for (let [key, attrs] of paramsMap.entries()) {
            expect(attributeData.get(key!)?.size).toBe(attrs!.length);
        }
    })


    test("函数申明参数函数内重复解构匹配", () => {
        const origin = `function ${funName}(${params.join(',')}) {
            ${renderParamAttrs.join('')};
            ${renderParamAttrs.join('')};
            ${renderParamAttrs.join('')};
            ${renderParamAttrs.join('')};
        }`;
        const attributeData = inferFunctionType(origin, funName).attributeData;
        for (let [key, attrs] of paramsMap.entries()) {
            expect(attributeData.get(key!)?.size).toBe(attrs!.length);
        }
    })

    test("箭头函数参数内单独解构匹配", () => {
        const origin = `const ${funName} = (${params.join(',')}) => {
            ${renderParamAttrs.join('')}
        }`;
        const attributeData = inferFunctionType(origin, funName).attributeData;
        for (let [key, attrs] of paramsMap.entries()) {
            expect(attributeData.get(key!)?.size).toBe(attrs!.length);
        }
    })

    
    test("函数申明函数参数位解构匹配", () => {
        const params = Array.from(paramsMap, (([key, attr]) => {
            if (attr.length) {
                return `{${attr.join(',')}}`
            }
            return key;
        }));
        const origin = `function ${funName}(${params.join(',')}) {}`;
        const resultParams = inferFunctionType(origin, funName).params;
        let ind = 0;
        for (let [key, attrs] of paramsMap.entries()) {
            // 参数结构
            if (attrs?.length) {
                const origin = resultParams[params[ind]!]?.origin!;
                ind += 1;
                expect(Object.keys(origin).length).toBe(attrs!.length);
            } else {
                expect(resultParams[key!]?.type).toBe('any');
            }
        }
    })


    test("函数申明函数参数位解构匹配+函数内其他解构干扰", () => {
        const params = Array.from(paramsMap, (([key, attr]) => {
            if (attr.length) {
                return `{${attr.join(',')}}`
            }
            return key;
        }));
        const origin = `function ${funName}(${params.join(',')}) {
            ${renderParamAttrs.join('')};
            ${renderParamAttrs.join('')};
            ${renderParamAttrs.join('')};
            ${renderParamAttrs.join('')};
        }`;
        const resultParams = inferFunctionType(origin, funName).params;
        let ind = 0;
        for (let [key, attrs] of paramsMap.entries()) {
            // 参数结构
            if (attrs?.length) {
                const origin = resultParams[params[ind]!]?.origin!;
                ind += 1;
                expect(Object.keys(origin).length).toBe(attrs!.length);
            } else {
                expect(resultParams[key!]?.type).toBe('any');
            }
        }
    })
});


/**
 * fun body {
 * p0 data = params.data
 * p1 params.data = ??
 * p2 params.list.forEach()
 * p3 {...params.allList}
 * p4 Object.assign({}, params.allList)
 * 
 * all attr -> (data, list, allList)
 * }
 */
describe("检查函数内部参数隐式所有属性是否匹配", () => {
    const funName = 'test';
    const params = ['a', 'b', 'c', 'd'];
    test('检查表达式赋值，属性是否匹配', () => {
        const origin = `function ${funName}(${params.join(',')}) {
            ${params[0]}.data = 1;
            ${params[0]}.list = 1;
            ${params[1]}.list = [];
        }`;
        const resultAttributeData = inferFunctionType(origin, funName).attributeData;
        expect(resultAttributeData.get(params[0]!)?.size).toBe(2);
        expect(resultAttributeData.get(params[0]!)?.has('data')).toBe(true);
        expect(resultAttributeData.get(params[0]!)?.has('list')).toBe(true);
        expect(resultAttributeData.get(params[1]!)?.size).toBe(1);
        expect(resultAttributeData.get(params[1]!)?.has('list')).toBe(true);
    })

    test('检查表达式引用属性访问修改匹配', () => {
        const origin = `function ${funName}(${params.join(',')}) {
            ${params[0]}.data += 1;
            let e2e = ${params[0]}.list[0];
        }`;
        const resultAttributeData = inferFunctionType(origin, funName).attributeData;
        expect(resultAttributeData.get(params[0]!)?.size).toBe(2);
        expect(resultAttributeData.get(params[0]!)?.has('data')).toBe(true);
        expect(resultAttributeData.get(params[0]!)?.has('list')).toBe(true);
    })

    test('检查表达式引用属性解构，属性是否匹配', () => {
        const origin = `function ${funName}(${params.join(',')}) {
            {...${params[0]}.allList};
        }`;
        const resultAttributeData = inferFunctionType(origin, funName).attributeData;
        expect(resultAttributeData.get(params[0]!)?.size).toBe(1);
        expect(resultAttributeData.get(params[0]!)?.has('allList')).toBe(true);
    })

    test('检查表达式Object.assign，属性是否匹配', () => {
        const origin = `function ${funName}(${params.join(',')}) {
            Object.assign({}, ${params[0]}.allList);
        }`;
        const resultAttributeData = inferFunctionType(origin, funName).attributeData;
        expect(resultAttributeData.get(params[0]!)?.size).toBe(1);
        expect(resultAttributeData.get(params[0]!)?.has('allList')).toBe(true);
    })
});