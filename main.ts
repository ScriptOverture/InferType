import { ArrowFunction, FunctionDeclaration, FunctionExpression, Node, Project, SyntaxKind, ts } from "ts-morph";
import { getPropertyAccessList, getPropertyAssignmentType, getVariablePropertyValue, createRef } from './utils';
import { ArrayType } from "./lib/NodeType";
import { createScope } from "./lib/scope";
import { createVariable,  type Variable } from './lib/variable';

function parseFunctionBody(
    funNode: FunctionExpression | ArrowFunction | FunctionDeclaration,
    scopePrototype: any = {}
) {
    const iFunction = funNode as unknown as FunctionExpression | ArrowFunction | FunctionDeclaration;
    const { params, body, returnStatement } = getFunction();
    const scope = createScope(params, {}, scopePrototype);
    const [returnStatementType, setReturnStatementType] = createRef<Variable>();
    function getFunction() {
        return {
            body: iFunction!.getBody(),
            params: iFunction?.getParameters()!,
            returnStatement: iFunction?.getBody()?.asKind(SyntaxKind.Block)?.getStatement((node) => node.getKind() === SyntaxKind.ReturnStatement),
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
            case SyntaxKind.CallExpression:
                toCallExpression(node);
                break;
            case SyntaxKind.ReturnStatement:
                toReturnStatement(node);
                break;
            default: { };
        }
    });

    return {
        ...params,
        attributeData: {},
        getParamsType: () => scope.paramsMap,
        getReturnType: () => returnStatementType.current
    };

    function toVariableDeclaration(node: Node<ts.Node>) {
        const varDecl = node.asKindOrThrow(SyntaxKind.VariableDeclaration);
        const nameNode = varDecl.getNameNode();

        switch (nameNode.getKind()) {
            // 对象解构：例如 const { name, data } = props;
            case SyntaxKind.ObjectBindingPattern: {
                const bindingPattern = nameNode.asKindOrThrow(SyntaxKind.ObjectBindingPattern);
                const initializer = varDecl.getInitializerOrThrow();
                const rhsType = getPropertyAssignmentType(scope, initializer)!;
                bindingPattern.getElements().forEach(elem => {
                    const originName = elem.getName();
                    const propName = elem.getPropertyNameNode()?.getText();
                    const initializer = elem.getInitializer();
                    let attrType: Variable;
                    if (initializer) {
                        attrType = getPropertyAssignmentType(scope, initializer)!;
                    } else {
                        attrType = createVariable();
                    }
                    // 別名
                    if (propName) {
                        // 更新右侧标识
                        rhsType.combine(attrType);
                        // 创建词法变量
                        scope.createLocalVariable(propName, attrType);
                    } else {
                        // 非别名， 更新右侧标识的同时还会更新词法环境
                        scope.creatDestructured(rhsType, {
                            [originName]: attrType
                        });
                    }
                });
                break;
            } 
            // 简单别名赋值：例如 const copyProps = props;
            case SyntaxKind.Identifier:
                const initializer = varDecl.getInitializerOrThrow();
                const rhsType = getPropertyAssignmentType(scope, initializer);
                if (rhsType) {
                    scope.createLocalVariable(
                        nameNode.getText(),
                        rhsType
                    );
                }
                
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
                // 利用右侧表达式获取类型信息
                const localVar = getVariablePropertyValue(scope, getPropertyAccessList(propAccess));
                if (localVar) {
                    localVar.combine(getPropertyAssignmentType(scope, right)!)
                }
            }
        }
    }


    function toCallExpression(node: Node<ts.Node>) {
        const callExpression = node.asKindOrThrow(SyntaxKind.CallExpression);
        const expression  = callExpression.getExpression();
        const propertyAccessExpression = expression.asKindOrThrow(SyntaxKind.PropertyAccessExpression);
        const methodName = propertyAccessExpression.getName();
        switch (methodName) {
            case "map":
            case "forEach":
                const firstArrowFunction = callExpression.getArguments().at(0)?.asKindOrThrow(SyntaxKind.ArrowFunction);
                if (firstArrowFunction) {
                    const firstParamName = firstArrowFunction.getParameters()[0]?.getName();
                    const funParamsType = parseFunctionBody(firstArrowFunction, scope)?.getParamsType();
                    const arrowFunctionPropsType = funParamsType[firstParamName!];

                    getVariablePropertyValue(
                        scope,
                        getPropertyAccessList(expression.getExpression())
                    )?.combine(
                        createVariable(
                            new ArrayType(arrowFunctionPropsType?.currentType)
                        )
                    )
                }
                break
        }

    }

    function toReturnStatement(node: Node<ts.Node>) {
        const returnNode = node.asKindOrThrow(SyntaxKind.ReturnStatement);
        // 是当前函数的返回语句
        if (returnStatement === returnNode) {
            setReturnStatementType(getPropertyAssignmentType(scope, returnNode.getExpression()!)!);
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
        props.kl.forEach(() => {
            return 2
        })
        props.a.map(() => {
            return 1;
        });
        const jk = [1,2,3]
        return {
            data: [1, {w: 1}],
            jh: jk
        }
    }
    `, 'dd');



// console.log(s.get('d')?.get('a'), s.get('d')?.get('b'), s.get('d')?.get('c'));
// console.log(s.get('props')?.get('ll').get('l'), s.get('props')?.get('ll').get('a'));



