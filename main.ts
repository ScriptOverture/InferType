import { Project, SyntaxKind } from "ts-morph";

export function inferFunctionType(
    sourceStr: string,
    targetFuncName: string
) {
    const project = new Project();
    const sourceFile = project.createSourceFile("temp.ts", sourceStr);
    let iFunction = sourceFile.getFunction(targetFuncName)!;
    if (iFunction) {
        return iFunction.getParameters().length;
    } else {
        // 获取变量声明（即函数表达式所在的位置）
        const variableDeclaration = sourceFile.getVariableDeclaration(targetFuncName);
        const initializer = variableDeclaration?.getInitializer();

        const funParams = variableDeclaration?.getInitializerIfKind(initializer?.getKind()! as SyntaxKind.FunctionExpression);
        return funParams?.getParameters()?.length;
    }
}