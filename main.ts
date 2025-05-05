import { ArrowFunction, Expression, FunctionDeclaration, FunctionExpression, Node, Project, SyntaxKind, ts, type ForEachDescendantTraversalControl } from "ts-morph";
import { getPropertyAccessList, getPropertyAssignmentType, getVariablePropertyValue, createRef, getFunction, getInferenceType } from './utils';
import { ArrayType } from "./lib/NodeType";
import { createScope, type Scope } from "./lib/scope";
import { createVariable,  type Variable } from './lib/variable';

export function parseFunctionBody(
    funNode: FunctionExpression | ArrowFunction | FunctionDeclaration,
    scopePrototype?: Scope
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
    
    body?.forEachDescendant((node, traversal) => {
        switch (node.getKind()) {
            // 变量申明
            case SyntaxKind.VariableDeclaration:
                toVariableDeclaration(node, traversal);
                break;
            case SyntaxKind.BinaryExpression:
                toBinaryExpression(node, traversal);
                break;
            case SyntaxKind.CallExpression:
                toCallExpression(node, traversal);
                break;
            case SyntaxKind.ReturnStatement:
                toReturnStatement(node, traversal);
                break;
            default: { };
        }
    });

    return {
        ...params,
        attributeData: {},
        getParamsType: () => scope.paramsMap,
        getReturnType: getFunctionReturnType,
        getParasmsList: () => scope.getParasmsList(),
        getLocalVariables: () => scope.getLocalVariables()
    };

    function toVariableDeclaration(node: Node<ts.Node>, traversal: ForEachDescendantTraversalControl) {
        const varDecl = node.asKindOrThrow(SyntaxKind.VariableDeclaration);
        const nameNode = varDecl.getNameNode();

        switch (nameNode.getKind()) {
            // 对象解构：例如 const { name, data } = props;
            case SyntaxKind.ObjectBindingPattern: {
                const bindingPattern = nameNode.asKindOrThrow(SyntaxKind.ObjectBindingPattern);
                const initializer = varDecl.getInitializerOrThrow();
                const rhsType = getInferenceType(scope, initializer, traversal)!;
                bindingPattern.getElements().forEach(elem => {
                    const originName = elem.getName();
                    const propName = elem.getPropertyNameNode()?.getText();
                    const initializer = elem.getInitializer();
                    let attrType: Variable;
                    if (initializer) {
                        attrType = getInferenceType(scope, initializer, traversal)!;
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
                const newType = createVariable();
                scope.createLocalVariable(nameNode.getText(), newType);
                const rhsType = getInferenceType(scope, initializer, traversal);
                if (rhsType) {
                    // 循环引用
                    newType.combine(rhsType);
                }
                
                break;
        }
    }


    function toBinaryExpression(node: Node<ts.Node>, traversal: ForEachDescendantTraversalControl) {
        const binExp = node.asKindOrThrow(SyntaxKind.BinaryExpression);
        if (binExp.getOperatorToken().getKind() === SyntaxKind.EqualsToken) {
            const leftType = getInferenceType(scope, binExp.getLeft(), traversal);
            const rightType = getInferenceType(scope, binExp.getRight(), traversal);
            leftType?.combine(rightType!);
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

    function toReturnStatement(node: Node<ts.Node>, traversal: ForEachDescendantTraversalControl) {
        const returnNode = node.asKindOrThrow(SyntaxKind.ReturnStatement);
        // 是当前函数的返回语句
        if (returnStatement === returnNode) {
            setReturnStatementType(getInferenceType(scope, returnNode.getExpression()!, traversal)!);
        }
    }
    
    function getFunctionReturnType() {
        // 箭头函数
        if (Node.isArrowFunction(funNode)) {
            const eqGtToken = funNode.getEqualsGreaterThan();
            const nextNode = eqGtToken.getNextSibling()!;
            const nextKind = nextNode.getKind();
            // 函数显示返回类型
            if (nextKind === SyntaxKind.Block) {
                return returnStatementType.current;
            }
            let expressions;
            // 函数返回缩写带括号 _ => (returnType)
            if (nextKind === SyntaxKind.ParenthesizedExpression) {
                const expressionNode = nextNode.asKindOrThrow(SyntaxKind.ParenthesizedExpression);
                expressions = expressionNode.getExpression();
            }
            // 函数返回缩写 _ => returnType
            else {
                expressions = nextNode as Expression;
            }
            return getPropertyAssignmentType(scope, expressions);
        }
        // 普通函数
        else {
            return returnStatementType.current;
        }
    }
}

export async function inferFunctionType(
    sourceStr: string,
    targetFuncName: string
) {
    const project = new Project();
    const sourceFile = project.createSourceFile("temp.ts", sourceStr);
    const GlobalScope = createScope();
    return parseFunctionBody(
        getFunction(sourceFile, targetFuncName),
        GlobalScope
    );
}


const data = inferFunctionType(`
    function dd(props) {

        const ww = () => {
            const aa = 11;
            return 1;
        };
        
    }
    `, 'dd');

    function dd(props) {
        const d = () => ({
            name: '1',
            age: 1
        });

        const dd = () => 1;
    }