import { ParameterDeclaration, Project, SyntaxKind } from "ts-morph";

export function inferFunctionType(
    sourceStr: string,
    targetFuncName: string
) {
    const project = new Project();
    const sourceFile = project.createSourceFile("temp.ts", sourceStr);
    let iFunction = sourceFile.getFunction(targetFuncName)!;
    if (iFunction) {
        return getAllParametersType(iFunction.getParameters());
    } else {
        // 获取变量声明（即函数表达式所在的位置）
        const variableDeclaration = sourceFile.getVariableDeclaration(targetFuncName);
        const initializer = variableDeclaration?.getInitializer();
        const funParams = variableDeclaration?.getInitializerIfKind(initializer?.getKind()! as SyntaxKind.FunctionExpression);
        return getAllParametersType(funParams?.getParameters()!);
    }
}

interface ParamsResult {
    params: Partial<Record<string, string>>;
    length: number;
  }

function getAllParametersType(parasms: ParameterDeclaration[]) {
    return parasms.reduce<ParamsResult>((result, item) => {
        return {
            ...result,
            params: {
                ...result.params,
                [item.getName()]: item.getType().getText()
            }
        }
    }, {
        params: {},
        length: parasms.length
    });
}