import { expect, test, describe } from "bun:test";
import { Project } from "ts-morph";
import { parseFunctionBody } from "../main";
import { createScope } from "../lib/scope";
import { getFunction } from "../utils";
import { isNumberType, isObjectType, isStringType, type ObjectType } from "../lib/NodeType";

describe("函数返回值", () => {
    const project = new Project();

    test("箭头函数无return返回, 复杂类型", () => {
        const sourceFile = project.createSourceFile("test.ts", `
            const fn = () => ({
                name: 'name',
                age: 1,
                list: [1,2,3]
            });
        `);

        const GlobalScope = createScope();
        const fn = getFunction(sourceFile, "fn")!;
        const returnType = parseFunctionBody(fn, GlobalScope).getReturnType()!;

        expect(isObjectType(returnType)).toBeBoolean();
        expect(returnType.get('name')?.toString()).toBe('string');
        expect(returnType.get('age')?.toString()).toBe('number');
        expect(returnType.get('list')?.toString()).toBe('number[]');
    });


    test("箭头函数无return返回, 简单类型", () => {
        const sourceFile = project.createSourceFile("test1.ts", `
            const fn = () => "1";
            const fn1 = () => 1;
            const fn2 = () => [1,2,3];
        `);

        const GlobalScope = createScope();
        const returnType = parseFunctionBody(
            getFunction(sourceFile, "fn")!, GlobalScope
        ).getReturnType()!;

        expect(isStringType(returnType)).toBeBoolean();
        
        const returnType2 = parseFunctionBody(
            getFunction(sourceFile, "fn1")!, GlobalScope
        ).getReturnType()!;

        expect(isNumberType(returnType2)).toBeBoolean();

        const returnType3 = parseFunctionBody(
            getFunction(sourceFile, "fn2")!, GlobalScope
        ).getReturnType()!;

        expect(returnType3.currentType?.toString()).toBe("number[]");
    });
});