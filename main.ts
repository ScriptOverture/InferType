import { ArrowFunction, FunctionDeclaration, FunctionExpression, Node, Project, SyntaxKind, ts, Expression, Identifier } from "ts-morph";
import { getAllParametersType, getRootIdentifier } from './utils';
import { Cache, type CacheValue } from "./lib/cache";


function Demo(funNode: FunctionExpression | ArrowFunction | FunctionDeclaration) {
    const iFunction = funNode as unknown as FunctionExpression | ArrowFunction | FunctionDeclaration;
    const { params, body, propertyAccesses } = getFunction();
    const funCache = Cache<string>().initializerCache(params.params);
    propertyAccesses?.forEach(expr => {
        const llAccess = expr.getExpression();
        let paramsKey = llAccess.getText();
        let attrName = expr.getName();
        let type: CacheValue<any> | string = 'any';
        if (attrName === 'forEach') {
            let callExpr = expr.getParentIfKindOrThrow(SyntaxKind.CallExpression);
            const cb = callExpr.getArguments()[0];

            if (!Node.isArrowFunction(cb) && !Node.isFunctionExpression(cb)) {
                throw new Error("forEach 的参数不是函数！");
            }

            if (Node.isPropertyAccessExpression(llAccess)) {
                const cbMap = Demo(cb).attributeData?.getOriginMap();
                attrName = llAccess.getName();
                paramsKey = getRootIdentifier(llAccess)?.getText()!;
                const params = cb.getParameters()[0]?.getName();
                type = cbMap.get(params!);
            }

        }

        if (funCache.has(paramsKey)) {
            funCache.get(paramsKey)?.add(attrName, type);
        }
    });

    function getFunction() {
        return {
            body: iFunction!.getBody(),
            params: getAllParametersType(iFunction?.getParameters()!),
            propertyAccesses: iFunction?.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression)
        };
    }

    body?.forEachDescendant((node) => {
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
                const defaultType = initializer?.getType()?.getBaseTypeOfLiteralType().getText() || 'any'
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
                iParamSet.update(propName, rightType);
            }
        }
    }
}

export function inferFunctionType(
    sourceStr: string,
    targetFuncName: string
) {
    const project = new Project();
    const sourceFile = project.createSourceFile("temp.ts", sourceStr);

    return Demo(getFunction());

    function getFunction() {
        let iFunction: FunctionExpression | FunctionDeclaration = sourceFile.getFunction(targetFuncName)!;
        if (!iFunction) {
            // 获取变量声明（即函数表达式所在的位置）
            const variableDeclaration = sourceFile.getVariableDeclaration(targetFuncName);
            const initializer = variableDeclaration?.getInitializer();
            const funParams = variableDeclaration?.getInitializerIfKind(initializer?.getKind()! as SyntaxKind.FunctionExpression)!;
            iFunction = funParams;
        }

        return iFunction;
    }
}


const {
    attributeData: s,
    params
} = inferFunctionType(`
    type Data = {
        data: string
    };
    function dd(props, { data, age }: Data) {
        props.data = 1;
        props.name = "123";
        props.list = [1,2,3];
        props.ll.forEach(item => {
            item.n = 1;
            item.a = 'asd';
            item.l = [1,2,3];
        })
        props.jk.map(item => ({...item, a: item.a, b: item.b}))
    }
    `, 'dd');
console.log(s.get('d')?.get('a'), s.get('d')?.get('b'), s.get('d')?.get('c'));
console.log(s.get('props')?.get('ll').get('l'), s.get('props')?.get('ll').get('a'));



