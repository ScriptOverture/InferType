import { Node, Project, SyntaxKind, ts } from "ts-morph";
import { getAllParametersType } from './utils';
import { Cache } from "./lib/cache";

export function inferFunctionType(
    sourceStr: string,
    targetFuncName: string
) {
    const project = new Project();
    const sourceFile = project.createSourceFile("temp.ts", sourceStr);
    const { params, body } = getFunction();
    const funCache = Cache().initializerCache(params.params);

    body.forEachDescendant((node) => {
        const lineKind = node.getKind();
        switch (lineKind) {
            // 变量申明
            case SyntaxKind.VariableDeclaration:
                toVariableDeclaration(node);
                break;
            default: {};
        }
    });

    return {
        ...params,
        attributeData: funCache
    };

    function getFunction() {
        let iFunction = sourceFile.getFunction(targetFuncName)!;
        let iFunctionBody, iFunctionParams;
        if (iFunction) {
            iFunctionBody = iFunction.getBodyOrThrow();
            iFunctionParams = getAllParametersType(iFunction.getParameters());
        } else {
            // 获取变量声明（即函数表达式所在的位置）
            const variableDeclaration = sourceFile.getVariableDeclaration(targetFuncName);
            const initializer = variableDeclaration?.getInitializer();
            const funParams = variableDeclaration?.getInitializerIfKind(initializer?.getKind()! as SyntaxKind.FunctionExpression);
            iFunctionBody = funParams!.getBody();
            iFunctionParams = getAllParametersType(funParams?.getParameters()!);
        }

        return {
            body: iFunctionBody,
            params: iFunctionParams
        };
    }


    function toVariableDeclaration(node: Node<ts.Node>) {
        const varDecl = node.asKindOrThrow(SyntaxKind.VariableDeclaration);
        const initializer = varDecl.getInitializer();
        const paramKey = initializer?.getText()!;
        if (!funCache.has(paramKey)) return;
        const iParamSet = funCache.get(paramKey)!;
        const nameNode = varDecl.getNameNode();
        // 对象解构：例如 const { name, data } = props;
        if (nameNode.getKind() === SyntaxKind.ObjectBindingPattern) {
            const bindingPattern = nameNode.asKindOrThrow(SyntaxKind.ObjectBindingPattern);
            bindingPattern.getElements().forEach(elem => {
                const propName = elem.getPropertyNameNode()?.getText() || elem.getName();
                iParamSet.add(propName);
            });
        }
        // 简单别名赋值：例如 const copyProps = props;
        else if (nameNode.getKind() === SyntaxKind.Identifier) {
            iParamSet.add(nameNode.getText());
        }
    }
}