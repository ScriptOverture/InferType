import { expect, test, describe } from "bun:test";
import {inferFunctionType} from '../main'
import {Project} from "ts-morph";


describe("检查函数参数是否正常", () => {
    const funName = 'test';
    const params = ['a', 'b', 'c', 'd'];

    test("函数申明参数", () => {
        const origin = `function ${funName}(${params.join(',')}) {}`;
        const paramsLen = inferFunctionType(origin, funName);
        expect(paramsLen).toBe(params.length);
    })

    test("箭头函数参数[const]", () => {
        const origin = `const ${funName} = (${params.join(',')}) => {}`;
        const paramsLen = inferFunctionType(origin, funName);
        expect(paramsLen).toBe(params.length);
    })

    test("箭头函数参数[var]", () => {
        const origin = `var ${funName} = (${params.join(',')}) => {}`;
        const paramsLen = inferFunctionType(origin, funName);
        expect(paramsLen).toBe(params.length);
    })

    test("箭头函数参数[let]", () => {
        const origin = `let ${funName} = (${params.join(',')}) => {}`;
        const paramsLen = inferFunctionType(origin, funName);
        expect(paramsLen).toBe(params.length);
    })

    test("函数表达式参数[const]", () => {
        const origin = `const ${funName} = function (${params.join(',')}) {}`;
        const paramsLen = inferFunctionType(origin, funName);
        expect(paramsLen).toBe(params.length);
    })

    test("函数表达式参数[var]", () => {
        const origin = `var ${funName} = function (${params.join(',')}) {}`;
        const paramsLen = inferFunctionType(origin, funName);
        expect(paramsLen).toBe(params.length);
    })

    test("函数表达式参数[let]", () => {
        const origin = `let ${funName} = function (${params.join(',')}) {}`;
        const paramsLen = inferFunctionType(origin, funName);
        expect(paramsLen).toBe(params.length);
    })
});