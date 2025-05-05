import { expect, test, describe } from "bun:test";
import { Project } from "ts-morph";
import { parseFunctionBody } from "../main";
import { createScope } from "../lib/scope";
import { getFunction } from "../utils";

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
});