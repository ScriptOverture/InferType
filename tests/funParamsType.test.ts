import { expect, test, describe } from "bun:test";
import { inferFunctionType } from '../main'


describe("检查函数参数类型是否正常", () => {
    const funName = 'test';
    const paramsMap = new Map([['a', 'string'], ['b', 'number[]'], ['c', 'any'], ['d', 'Record<string, any>']]);
    const params = Array.from(paramsMap, ([key, type]) => `${key}:${type}`);

    test("函数申明参数是否匹配", () => {
        const origin = `function ${funName}(${params.join(',')}) {}`;
        const resultParams = inferFunctionType(origin, funName).params;

        for (const param in paramsMap.entries()) {
            const [key, type] = param;
            expect(resultParams[key!]?.type).toBe(type!);
        }
    })

    test("箭头函数参数是否匹配", () => {
        const origin = `const ${funName} = (${params.join(',')}) => {}`;
        const resultParams = inferFunctionType(origin, funName).params;
        for (const param in paramsMap.entries()) {
            const [key, type] = param;
            expect(resultParams[key!]?.type).toBe(type!);
        }
    })

    test("函数表达式参数是否匹配", () => {
        const origin = `const ${funName} = function (${params.join(',')}) {}`;
        const resultParams = inferFunctionType(origin, funName).params;
        for (const param in paramsMap.entries()) {
            const [key, type] = param;
            expect(resultParams[key!]?.type).toBe(type!);
        }
    })
});