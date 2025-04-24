import { ArrowFunction, FunctionDeclaration, FunctionExpression, Node, Project, SyntaxKind, ts } from "ts-morph";
import { getPropertyAccessList, getPropertyAssignmentType, getVariablePropertyValue } from './utils';
import { createScope, createVariable, ObjectType } from "./lib/NodeType";



function parseFunctionBody(
    funNode: FunctionExpression | ArrowFunction | FunctionDeclaration,
    scopePrototype: any = {}
) {
    const iFunction = funNode as unknown as FunctionExpression | ArrowFunction | FunctionDeclaration;
    const { params, body, propertyAccesses } = getFunction();
    const scope = createScope(params, {}, scopePrototype);
    propertyAccesses?.forEach(expr => {
        const llAccess = expr.getExpression();
        let paramsKey = llAccess.getText();
        let attrName = expr.getName();
        let type = 'any';
        // if (attrName === 'forEach') {
        //     let callExpr = expr.getParentIfKindOrThrow(SyntaxKind.CallExpression);
        //     const cb = callExpr.getArguments()[0];

        //     if (!Node.isArrowFunction(cb) && !Node.isFunctionExpression(cb)) {
        //         throw new Error("forEach 的参数不是函数！");
        //     }

        //     if (Node.isPropertyAccessExpression(llAccess)) {
        //         const cbMap = Demo(cb).attributeData?.getOriginMap();
        //         attrName = llAccess.getName();
        //         paramsKey = getRootIdentifier(llAccess)?.getText()!;
        //         const params = cb.getParameters()[0]?.getName();
        //         type = cbMap.get(params!);
        //     }

        // }

        // if (funCache.has(paramsKey)) {
        //     funCache.get(paramsKey)?.add(attrName, type);
        // }
        // console.log(paramsKey, attrName, 'paramsKey');

    });

    function getFunction() {
        return {
            body: iFunction!.getBody(),
            params: iFunction?.getParameters()!,
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
        attributeData: {}
    };

    function toVariableDeclaration(node: Node<ts.Node>) {
        const varDecl = node.asKindOrThrow(SyntaxKind.VariableDeclaration);
        const initializer = varDecl.getInitializer();
        const paramKey = initializer?.getText()!;
        const nameNode = varDecl.getNameNode();

        switch (nameNode.getKind()) {
            // 对象解构：例如 const { name, data } = props;
            case SyntaxKind.ArrayBindingPattern:
                const bindingPattern = nameNode.asKindOrThrow(SyntaxKind.ObjectBindingPattern);
                const obj = bindingPattern.getElements().reduce((result, elem) => {
                    const propName = elem.getPropertyNameNode()?.getText() || elem.getName();
                    const initializer = elem.getInitializer();
                    const iType = initializer?.getType()?.getBaseTypeOfLiteralType();
                    return {
                        ...result,
                        [propName]: createVariable(iType!)
                    }
                }, {})

                scope.findParameter(paramKey)?.creatDestructured(obj);
                break;
            // 简单别名赋值：例如 const copyProps = props;
            case SyntaxKind.Identifier:
                const init = varDecl.getInitializerOrThrow();
                let rhsType = getPropertyAssignmentType(scope, init);
                if (!rhsType) {
                    rhsType = createVariable(varDecl.getType());
                }

                scope.createLocalVariable(
                    nameNode.getText(),
                    rhsType!
                );
                break;
        }
    }


    function toBinaryExpression(node: Node<ts.Node>) {
        const binExp = node.asKindOrThrow(SyntaxKind.BinaryExpression);
        if (binExp.getOperatorToken().getKind() === SyntaxKind.EqualsToken) {
            const left = binExp.getLeft();
            const right = binExp.getRight();

            if (left.getKind() === SyntaxKind.PropertyAccessExpression) {
                const propAccess = left.asKindOrThrow(SyntaxKind.PropertyAccessExpression);
                const propName = propAccess.getName();
                // 利用右侧表达式获取类型信息
                const localVar = getVariablePropertyValue(scope, getPropertyAccessList(propAccess));
                if (localVar) {
                    let rhsType = getPropertyAssignmentType(scope, right);
                    if (!rhsType) {
                        const aliasType = right.getType().getBaseTypeOfLiteralType();
                        rhsType = createVariable(aliasType);
                    }
                    localVar.combine(
                        createVariable(new ObjectType({
                            [propName]: rhsType!
                        }))
                    )
                }
            }
        }
    }
}

export async function inferFunctionType(
    sourceStr: string,
    targetFuncName: string
) {
    const project = new Project();
    const sourceFile = project.createSourceFile("temp.ts", sourceStr);
    const Global = createScope();

    return parseFunctionBody(
        getFunction(),
        Global
    );

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
        data: string;
        list: number;
        age: boolean
    };
    function dd(props) {
    const { a,b = '123',c = "2134234234" } = props;
    const { t1 } = a;
    const { g = [1,2,3], a } = t1;
    let aaa = 123;
    const w = {
        ww: 123,
        rr: aaa,
        ee: {
            c: props
        }
    };
    props.a.t1.a = w;
    w.a = props.a.t1.g;
    let y = props.a.t1.g;
    aaa = 4444;
    var ww = [];
        props.data = 1;
        // props.t.q.w.e = 1;
        props.name = "123";
        props.list = [1,2,3, "1"];
        data.name = 1;
        age.kk = 123;
        props.ll.forEach(item => {
            item.n = 1;
            item.a = 'asd';
            item.l = [1,2,3];
        })
        props.jk.map(item => ({...item, a: item.a, b: item.b}))
    }
    `, 'dd');



// console.log(s.get('d')?.get('a'), s.get('d')?.get('b'), s.get('d')?.get('c'));
// console.log(s.get('props')?.get('ll').get('l'), s.get('props')?.get('ll').get('a'));



