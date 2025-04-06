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
        for (let param in paramsMap.entries()) {
            const [key, attrs] = param;
            expect(attributeData.get(key!)).toBe(attrs!.length);
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
        for (let param in paramsMap.entries()) {
            const [key, attrs] = param;
            expect(attributeData.get(key!)).toBe(attrs!.length);
        }
    })

    test("箭头函数参数内单独解构匹配", () => {
        const origin = `const ${funName} = (${params.join(',')}) => {
            ${renderParamAttrs.join('')}
        }`;
        const attributeData = inferFunctionType(origin, funName).attributeData;
        for (let param in paramsMap.entries()) {
            const [key, attrs] = param;
            expect(attributeData.get(key!)).toBe(attrs!.length);
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
        for (let param in paramsMap.entries()) {
            const [key, attrs] = param;
            // 参数结构
            if (attrs?.length) {
                expect(resultParams[key!]?.origin?.length).toBe(attrs!.length);
            } else {
                expect(resultParams[key!]?.type).toBe(key!);
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
        for (let param in paramsMap.entries()) {
            const [key, attrs] = param;
            // 参数结构
            if (attrs?.length) {
                expect(resultParams[key!]?.origin?.length).toBe(attrs!.length);
            } else {
                expect(resultParams[key!]?.type).toBe(key!);
            }
        }
    })
});