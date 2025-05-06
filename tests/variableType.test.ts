import { expect, test, describe } from "bun:test";
import { Project } from "ts-morph";
import { parseFunctionBody } from "../main";
import { createScope } from "../lib/scope";
import { getFunction } from "../utils";
import { getUuid } from "./utils";

describe("函数scope变量类型", () => {
    const project = new Project();
    

    test("函数scope变量类型隔了判断", () => {
        const sourceFile = project.createSourceFile("test.ts", `
            const test = () => {
                const num = 123;
                const test2 = () => {
                    const data = [1,2,3,4];
                    const num = "123";
                }
            }
        `);

        const GlobalScope = createScope();
        const fn = getFunction(sourceFile, "test")!;
        const {
            getLocalVariables
        } = parseFunctionBody(fn, GlobalScope);
        const localVar = getLocalVariables();
        expect(localVar['data']).toBeUndefined();
        expect(localVar['num']?.currentType?.toString()).toBe('number');
    });

    test("三元运算符", () => {
        const sourceFile = project.createSourceFile("test1.ts", `
            const test = () => {
                const dd = true? 1: "2";
            }
        `);

        const GlobalScope = createScope();
        const fn = getFunction(sourceFile, "test")!;
        const {
            getLocalVariables
        } = parseFunctionBody(fn, GlobalScope);
        const localVar = getLocalVariables();
        expect(localVar['dd']?.currentType?.toString()).toBe('number | string');
    });

    test("n元运算符", () => {
        const sourceFile = project.createSourceFile("test2.ts", `
            const test = () => {
                const dd = true? (
                    true? ({b: 1}): { a: 1 }
                ): (
                    false? ({ e: "1" }): ({r: [1,2,3]})
                );
            }
        `);

        const GlobalScope = createScope();
        const fn = getFunction(sourceFile, "test")!;
        const {
            getLocalVariables
        } = parseFunctionBody(fn, GlobalScope);
        const localVar = getLocalVariables();
        expect(localVar['dd']?.currentType?.toString()).toBe('{ b: number } | { a: number } | { e: string } | { r: number[] }');
    });


    test("三元运算符- 重复类型", () => {
        const sourceFile = project.createSourceFile("test3.ts", `
            const test = () => {
                const dd = true? "1": "xxx"
            }
        `);

        const GlobalScope = createScope();
        const fn = getFunction(sourceFile, "test")!;
        const {
            getLocalVariables
        } = parseFunctionBody(fn, GlobalScope);
        const localVar = getLocalVariables();
        expect(localVar['dd']?.currentType?.toString()).toBe('string');
    });

    test("n元运算符- m层括号", () => {
        const sourceFile = project.createSourceFile("test4.ts", `
            const test = () => {
                const dd = true? (
                    true? ((({b: 1}))): { a: 1 }
                ): (
                    false? ({ e: "1" }): (((({r: [1,2,3]}))))
                );
            }
        `);

        const GlobalScope = createScope();
        const fn = getFunction(sourceFile, "test")!;
        const {
            getLocalVariables
        } = parseFunctionBody(fn, GlobalScope);
        const localVar = getLocalVariables();
        expect(localVar['dd']?.currentType?.toString()).toBe('{ b: number } | { a: number } | { e: string } | { r: number[] }');
    });

    test("连续赋值类型", () => {
        const sourceFile = project.createSourceFile("test5.ts", `
            const test = () => {
                let a;
                let b;
                let c = a = b = 1;
                let f = (q = r = t = [1,2,3])
            }
        `);

        const GlobalScope = createScope();
        const fn = getFunction(sourceFile, "test")!;
        const {
            getLocalVariables
        } = parseFunctionBody(fn, GlobalScope);
        const localVar = getLocalVariables();
        expect(localVar['a']?.currentType?.toString()).toBe('number');
        expect(localVar['b']?.currentType?.toString()).toBe('number');
        expect(localVar['c']?.currentType?.toString()).toBe('number');

        expect(localVar['f']?.currentType?.toString()).toBe('number[]');
        expect(localVar['q']?.currentType?.toString()).toBe('number[]');
        expect(localVar['r']?.currentType?.toString()).toBe('number[]');
        expect(localVar['t']?.currentType?.toString()).toBe('number[]');
    });


    test("数据对象解构", () => {
        const sourceFile = project.createSourceFile(`${getUuid()}.ts`, `
            const test = () => {
                const {
                    a,
                    b,
                    c
                } = {
                    a: 1,
                    b: "xx",
                    c: [1,2,3]
                };
            }
        `);

        const GlobalScope = createScope();
        const fn = getFunction(sourceFile, "test")!;
        const {
            getLocalVariables
        } = parseFunctionBody(fn, GlobalScope);
        const localVar = getLocalVariables();
        expect(localVar['a']?.currentType?.toString()).toBe('number');
        expect(localVar['b']?.currentType?.toString()).toBe('string');
        expect(localVar['c']?.currentType?.toString()).toBe('number[]');
    });

    test("数据数组解构", () => {
        const sourceFile = project.createSourceFile(`${getUuid()}.ts`, `
            const test = () => {
                const [
                    a,
                    b,
                    c
     ] = [
        1,
        "asd",
        () => [1,2,3],
     ]
        `);

        const GlobalScope = createScope();
        const fn = getFunction(sourceFile, "test")!;
        const {
            getLocalVariables
        } = parseFunctionBody(fn, GlobalScope);
        const localVar = getLocalVariables();
        expect(localVar['a']?.currentType?.toString()).toBe('number');
        expect(localVar['b']?.currentType?.toString()).toBe('string');
        expect(localVar['c']?.currentType?.toString()).toBe('() => number[]');
    });

    test("元组类型", () => {
        const sourceFile = project.createSourceFile(`${getUuid()}.ts`, `
            const test = () => {
                const target = [
        1,
        "asd",
        () => [1,2,3],
     ];
        let l1 = target[0];
        let l2 = target[1];
        let l3 = target[2];
        `);

        const GlobalScope = createScope();
        const fn = getFunction(sourceFile, "test")!;
        const {
            getLocalVariables
        } = parseFunctionBody(fn, GlobalScope);
        const localVar = getLocalVariables();
        expect(localVar['target']?.currentType?.toString()).toBe('[number,string,() => number[]]');
        expect(localVar['l1']?.currentType?.toString()).toBe('number');
        expect(localVar['l2']?.currentType?.toString()).toBe('string');
        expect(localVar['l3']?.currentType?.toString()).toBe('() => number[]');
    });
});