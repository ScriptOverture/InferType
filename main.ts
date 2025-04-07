import { Node, Project, SyntaxKind, ts } from "ts-morph";
import { getAllParametersType } from './utils';
import { Cache } from "./lib/cache";

export function inferFunctionType(
    sourceStr: string,
    targetFuncName: string
) {
    const project = new Project();
    const sourceFile = project.createSourceFile("temp.ts", sourceStr);
    const { params, body, propertyAccesses } = getFunction();
    const funCache = Cache<ReturnType<typeof Cache<string | null>>>().initializerCache(params.params);
    propertyAccesses?.forEach(expr => {
        const paramsKey = expr.getExpression().getText();
        if (funCache.has(paramsKey)) {
            funCache.get(paramsKey)?.add(expr.getName());
        }
    });

    body.forEachDescendant((node) => {
        const lineKind = node.getKind();
        switch (lineKind) {
            // 变量申明
            case SyntaxKind.VariableDeclaration:
                toVariableDeclaration(node);
                break;
            case SyntaxKind.BinaryExpression:
                toBinaryExpression(node);
                break;
            default: { };
        }
    });

    return {
        ...params,
        attributeData: funCache
    };

    function getFunction() {
        let iFunction = sourceFile.getFunction(targetFuncName)!;
        let iFunctionBody, iFunctionParams, iPropertyAccesses;
        if (iFunction) {
            iFunctionBody = iFunction.getBodyOrThrow();
            iFunctionParams = getAllParametersType(iFunction.getParameters());
            iPropertyAccesses = iFunction?.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression)
        } else {
            // 获取变量声明（即函数表达式所在的位置）
            const variableDeclaration = sourceFile.getVariableDeclaration(targetFuncName);
            const initializer = variableDeclaration?.getInitializer();
            const funParams = variableDeclaration?.getInitializerIfKind(initializer?.getKind()! as SyntaxKind.FunctionExpression);
            iFunctionBody = funParams!.getBody();
            iPropertyAccesses = funParams?.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression)
            iFunctionParams = getAllParametersType(funParams?.getParameters()!);
        }

        return {
            body: iFunctionBody,
            params: iFunctionParams,
            propertyAccesses: iPropertyAccesses
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
                const initializer = elem.getInitializer();
                const defaultType = initializer?.getType()?.getBaseTypeOfLiteralType().getText()
                iParamSet.add(propName, defaultType);
            });
        }
        // 简单别名赋值：例如 const copyProps = props;
        else if (nameNode.getKind() === SyntaxKind.Identifier) {
            iParamSet.add(nameNode.getText());
        }
    }


    function toBinaryExpression(node: Node<ts.Node>) {
        const binExp = node.asKindOrThrow(SyntaxKind.BinaryExpression);
        if (binExp.getOperatorToken().getKind() === SyntaxKind.EqualsToken) {
            const left = binExp.getLeft();
            const right = binExp.getRight();

            if (left.getKind() === SyntaxKind.PropertyAccessExpression) {
                const propAccess = left.asKindOrThrow(SyntaxKind.PropertyAccessExpression);
                const paramKey = propAccess.getExpression().getText();

                if (!funCache.has(paramKey)) return;
                const iParamSet = funCache.get(paramKey)!;
                const propName = propAccess.getName();
                // 利用右侧表达式获取类型信息
                const rightType = right.getType().getBaseTypeOfLiteralType().getText();
                iParamSet.add(propName, rightType);
            }
        }
    }
}


const s = inferFunctionType(`function dd(d) {
        d.dd = 1;
    }`, 'dd').attributeData;
    console.log(s.get('d')?.get('a'), s.get('d')?.get('b'), s.get('d')?.get('c'));
    