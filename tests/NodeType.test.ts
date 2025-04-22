import { expect, test, describe } from "bun:test";
import {
    createScope,
    createVariable,
    NumberType,
    StringType
} from '../lib/NodeType';
import { Project, ts } from "ts-morph";



describe("检查函数参数类型是否正常", () => {
    const project = new Project();
    const sourceFile = project.createSourceFile("test.ts", `
        function test(props) {}
    `);
    let iFunction = sourceFile.getFunction('test')!;
    const parameterDeclaration = iFunction?.getParameters()!;

    test("函数申明参数是否匹配", () => {
        const scope = createScope(parameterDeclaration);
        const propsParam = scope.findParameter('props');
        propsParam?.creatDestructured({
            name: createVariable(new StringType())
        });

        console.log(scope.paramsMap['props']?.currentType?.toString(), 'wwwwwwww');
        propsParam?.creatDestructured({
            name: createVariable(new NumberType())
        });
        expect(1).toBe(2);
    })
});