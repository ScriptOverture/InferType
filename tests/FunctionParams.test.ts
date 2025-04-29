import { expect, test, describe } from "bun:test";
import { parseFunctionBody } from "../main";
import { Project, SyntaxKind } from "ts-morph";
import { createScope } from "../lib/scope";
import { getFunction } from "../utils";
import { getMockDataToFunBody, getMockDataToParams, mockParamsData, Parameter } from "./utils";
import type { ObjectType } from "../lib/NodeType";

// enum Function {
//     // 函数声明
//     FunctionDeclaration,
//     // 函数表达式
//     FunctionExpression,
//     // 箭头函数
//     ArrowFunction,
//     // 对象方法简写
//     MethodShorthand,
//     // 类方法
//     ClassMethods
// }


describe("检查函数参数名称 => FunctionParmas", () => {
    const project = new Project();
    const paramData = mockParamsData();
    const params = getMockDataToParams(paramData);

    const sourceFile = project.createSourceFile("test.ts", `
        // 函数声明
        function fn1(${params}) {}
        // 函数表达式
        var fn2 = function (${params}) {}
        // 箭头函数
        var fn3 = (${params}) => {}
        
        // 方法简写
        const obj = {
            fn4(${params}) {}
        }

        // 类方法
        class Fn4 {
            fn5(${params}) {}
            static fn6(${params}) {}
        }
    `);


    test("函数申明参数匹配  => FunctionDeclaration", () => {
        expectFunParamsKeyName(`fn1`);
    });

    test("函数表达式参数匹配  => FunctionExpression", () => {
        expectFunParamsKeyName(`fn2`);
    });

    test("箭头函数参数匹配  => ArrowFunction", () => {
        expectFunParamsKeyName(`fn3`);
    });

    test("对象方法简写参数匹配  => MethodShorthand", () => {
        const variableStatement = sourceFile.getVariableDeclarationOrThrow("obj");
        const initializer = variableStatement.getInitializerIfKindOrThrow(SyntaxKind.ObjectLiteralExpression);
        const fn4Method = initializer.getPropertyOrThrow("fn4");
        expectFunParamsKeyName(`fn4`, fn4Method);
    });

    test("类方法参数匹配  => ClassMethods", () => {
        const classDecl = sourceFile.getClassOrThrow("Fn4");
        const fn5Method = classDecl.getInstanceMethod("fn5");
        expectFunParamsKeyName(`fn5`, fn5Method);
        const fn6Method = classDecl.getStaticMethod("fn6");
        expectFunParamsKeyName(`fn6`, fn6Method);
    });

    function expectFunParamsKeyName(funName: string, targetFunction?: any) {
        const scope = createScope();
        targetFunction = targetFunction || getFunction(sourceFile, funName)!;   
        const parasmsList = parseFunctionBody(
            targetFunction!,
            scope
        ).getParasmsList();

        expect(parasmsList.length).toEqual(paramData.length);

        paramData.forEach((item, index) => {
            const res = parasmsList[index];
            if (item.kind === Parameter.DestructuredParameter) {
                const types = item.type as ObjectType;
                Object.keys(types.properties).forEach(a => {
                    expect(res?.paramsType.get(a)).not.toBeUndefined();
                })
            } else {
                expect(item.name).toEqual(res?.paramName!);
            }
        })
    }
});


describe("检查函数参数类型", () => {
    const project = new Project();
    const paramData = mockParamsData();
    const params = getMockDataToParams(paramData);
    const body = getMockDataToFunBody(paramData);
    
    const sourceFile = project.createSourceFile("test.ts", `
        // 函数声明
        function fn1(${params}) {
            ${body}
        }
        // 函数表达式
        var fn2 = function (${params}) {
            ${body}
        }
        // 箭头函数
        var fn3 = (${params}) => {${body}}
        
        // 方法简写
        const obj = {
            fn4(${params}) {${body}}
        }

        // 类方法
        class Fn4 {
            fn5(${params}) {${body}}
            static fn6(${params}) {${body}}
        }
    `);

    test("函数申明参数匹配  => FunctionDeclaration", () => {
        expectFunParamsType(`fn1`);
    });

    test("函数表达式参数匹配  => FunctionExpression", () => {
        expectFunParamsType(`fn2`);
    });

    test("箭头函数参数匹配  => ArrowFunction", () => {
        expectFunParamsType(`fn3`);
    });

    test("对象方法简写参数匹配  => MethodShorthand", () => {
        const variableStatement = sourceFile.getVariableDeclarationOrThrow("obj");
        const initializer = variableStatement.getInitializerIfKindOrThrow(SyntaxKind.ObjectLiteralExpression);
        const fn4Method = initializer.getPropertyOrThrow("fn4");
        expectFunParamsType(`fn4`, fn4Method);
    });

    test("类方法参数匹配  => ClassMethods", () => {
        const classDecl = sourceFile.getClassOrThrow("Fn4");
        const fn5Method = classDecl.getInstanceMethod("fn5");
        expectFunParamsType(`fn5`, fn5Method);
        const fn6Method = classDecl.getStaticMethod("fn6");
        expectFunParamsType(`fn6`, fn6Method);
    });

    function expectFunParamsType(funName: string, targetFunction?: any) {
        const scope = createScope();
        targetFunction = targetFunction || getFunction(sourceFile, funName)!;   
        const parasmsList = parseFunctionBody(
            targetFunction!,
            scope
        ).getParasmsList();
        paramData.forEach((item, index) => {
            const res = parasmsList[index];
            
            if (item.kind === Parameter.RestParameter) {
                // 开发中
            } else {
                expect(res?.paramsType.toString()).toEqual(item.type.toString());
            }
        })
    }
})