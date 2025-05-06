import {
    Expression,
    Node,
    ParameterDeclaration,
    PropertyAccessExpression,
    SyntaxKind,
    type SourceFile,
    type FunctionExpression,
    type FunctionDeclaration,
    type ForEachDescendantTraversalControl,
    type ConditionalExpression,
    type ts,
    type ExpressionedNode,
    type BinaryExpression,
    type ObjectBindingPattern
} from "ts-morph";
import { AnyType, BooleanType, NumberType, StringType, ObjectType, UnionType, ArrayType, BasicType, FunctionType, isBasicType } from "../lib/NodeType.ts";
import { createVariable, type Variable } from "../lib/variable.ts";
import type { Scope } from "../lib/scope.ts";
import { parseFunctionBody } from "../main.ts"


type Paramter = Record<string, Variable>;
export type ParasmsItem = {
    current: ParameterDeclaration,
    kind: SyntaxKind,
    paramsType: Variable,
    paramName?: string
};

type ParametersResultType = {
    paramsMap: Paramter,
    parasmsList: ParasmsItem[]
};
export function getAllParametersType(parasms: ParameterDeclaration[]): ParametersResultType {
    const parasmsList: ParasmsItem[] = Array(parasms.length)
    const paramsMap: Paramter = {}

    parasms.forEach((paramsItem, index) => {
        const paramName = paramsItem.getName();
        const paramNode = paramsItem.getNameNode();
        const currentItem: ParasmsItem = {
            current: paramsItem,
            kind: paramNode.getKind(),
            paramsType: createVariable()
        };

        if (Node.isIdentifier(paramNode)) {
            paramsMap[paramName] = currentItem.paramsType;
            currentItem.paramName = paramName;
        }
        // 参数解构 
        else if (Node.isObjectBindingPattern(paramNode)) {
            const elements = paramNode.getElements();
            const paramObjs: Paramter = {}
            elements.forEach(item => {
                const name = item.getText();
                paramObjs[name] = createVariable();
            })
            currentItem.paramsType.combine(
                new ObjectType(paramObjs)
            )
        }
        // 剩余参数
        else if (Node.isParametered(paramNode)) {
            const originType = new ArrayType();
            currentItem.paramsType.combine(originType);
            paramsMap[paramName] = currentItem.paramsType;
        }
        parasmsList[index] = currentItem
    })

    return {
        parasmsList,
        paramsMap
    }
}



export function getPropertyAccessList(expr: PropertyAccessExpression) {
    const result = [];
    let next: Node = expr;
    while (Node.isPropertyAccessExpression(next)) {
        const attrKey = next.getName();
        result.unshift(attrKey);
        next = getExpression(next);
    }
    if (Node.isIdentifier(next)) {
        result.unshift(next.getText());
    }

    return result;
}



export function getVariablePropertyValue(scope: Scope, propertyAccess: string[]): Variable | undefined {
    const root = propertyAccess[0];
    const rootVariable = scope.find(root!);
    if (propertyAccess.length === 1) {
        return rootVariable;
    }
    let index = 1, next = rootVariable!;
    while (index < propertyAccess.length && next) {
        const attrKey = propertyAccess[index]!;
        const current = next?.get(attrKey);
        if (!current) {
            const attrKeyType = createVariable();
            next.combine(createVariable(new ObjectType({
                [attrKey]: attrKeyType
            })));

            next = attrKeyType;
        } else {
            next = current;
        }
        index += 1;
    }
    return next;
}



function basicTypeToVariable(iType: Expression): Variable | undefined {
    if (!iType) return;
    let result;
    switch (iType.getKind()) {
        case SyntaxKind.StringLiteral:
            result = createVariable(new StringType());
            break;
        case SyntaxKind.NumericLiteral:
            result = createVariable(new NumberType());
            break;
        case SyntaxKind.TrueKeyword:
            result = createVariable(new BooleanType());
            break;
        case SyntaxKind.FalseKeyword:
            result = createVariable(new BooleanType());
            break;
        default:
            result = createVariable(new AnyType());
            break;
    }
    return result;
}


/**
 * 右侧赋值不同情况
 * @param scope 
 * @param iType 
 * @returns 
 */
export function getPropertyAssignmentType(scope: Scope, iType: Expression): Variable | undefined {
    if (!iType) return;
    let result;
    switch (iType.getKind()) {
        // 对象
        case SyntaxKind.ObjectLiteralExpression:
            const node = iType.asKindOrThrow(SyntaxKind.ObjectLiteralExpression);
            const newObjType: Record<string, Variable> = {};
            for (const propertyNode of node.getProperties()) {
                const property = propertyNode?.asKindOrThrow(SyntaxKind.PropertyAssignment)!;
                const propertyName = property.getName();
                const initializer = property.getInitializer();
                newObjType[propertyName] = getPropertyAssignmentType(scope, initializer!)!;
            }
            result = createVariable(
                new ObjectType(newObjType)
            );
            break;
        // 变量
        case SyntaxKind.Identifier:
            result = scope.find(iType.getText());
            break;
        // 属性 k: props.x.xx.xxx
        case SyntaxKind.PropertyAccessExpression:
            result = getVariablePropertyValue(
                scope,
                getPropertyAccessList(iType.asKindOrThrow(SyntaxKind.PropertyAccessExpression))
            )
            break;
        // array
        case SyntaxKind.ArrayLiteralExpression:
            const arrayNode = iType.asKindOrThrow(SyntaxKind.ArrayLiteralExpression);
            const arrayElements = arrayNode.getElements();
            const arrayType = new Set<Variable>();
            for (const element of arrayElements) {
                arrayType.add(getPropertyAssignmentType(scope, element)!);
            }
            const itemType = new UnionType([...arrayType].map(item => item.currentType!));
            const newArrayType = new ArrayType(itemType);
            result = createVariable(newArrayType);
            break;
        // 箭头函数
        case SyntaxKind.ArrowFunction:
            const functionNode = iType.asKindOrThrow(SyntaxKind.ArrowFunction);
            const inferFunctionResult = parseFunctionBody(functionNode, scope);
            const inferFunctionType = new FunctionType(
                inferFunctionResult.getParasmsList(),
                inferFunctionResult.getReturnType()
            );
            result = createVariable(inferFunctionType);
            break;
        // n元运算
        case SyntaxKind.ConditionalExpression:
            const conditionalNode = iType.asKindOrThrow(SyntaxKind.ConditionalExpression);
            result = inferConditionalExpressionType(scope, conditionalNode);
            break;
        // 连续赋值 x = b = c = 1;
        case SyntaxKind.BinaryExpression:
            const binaryExpressionNode = iType.asKindOrThrow(SyntaxKind.BinaryExpression);
            result = inferBinaryExpressionType(scope, binaryExpressionNode);
            break;
        // 括号包裹
        case SyntaxKind.ParenthesizedExpression:
            return getPropertyAssignmentType(scope, unwrapParentheses(iType));
        // 兜底推断类型
        default:
            result = basicTypeToVariable(iType);
            break;
    }

    return result;
}

// 推断解构对象
export function inferObjectBindingPatternType(
    scope: Scope, 
    node: ObjectBindingPattern,
    initializerVariable: Variable,
    traversal: ForEachDescendantTraversalControl
) {
    node.getElements().forEach(elem => {
        // x: a => x | x => x
        const originName = elem.getName();
        // 消费的别名
        const propName = elem.getPropertyNameNode()?.getText();
        // 默认值
        const initializer = elem.getInitializer();
        // let attrType: Variable;
        let attrType = initializerVariable.get(originName);
        let hasQueryVariable = false;

        if (!attrType) {
            // 默认值
            if (initializer) {
                attrType = getInferenceType(scope, initializer, traversal)!;
            } else {
                attrType = createVariable();
            }
        }
        else {
            hasQueryVariable = true;
        }
        
        // 別名
        if (propName) {
            // 没找到类型更新右侧标识
            if (!hasQueryVariable) {
                initializerVariable.combine(attrType);
            }
            // 创建词法变量
            scope.createLocalVariable(propName, attrType);
        } else {
            // 非别名， 更新右侧标识的同时还会更新词法环境
            scope.creatDestructured(initializerVariable, {
                [originName]: attrType
            });
        }
    });
}

// 推断连续赋值情况类型
function inferBinaryExpressionType(scope: Scope, node: BinaryExpression): Variable {
    const leftToken = node.getLeft();
    const rightToken = node.getRight();
    const leftVariable = scope.find(leftToken.getText()) || scope.createLocalVariable(leftToken.getText());

    //
    if (Node.isBinaryExpression(rightToken)) {
        const rightVariableType = inferBinaryExpressionType(scope, rightToken);
        leftVariable.combine(rightVariableType)
    }
    else {
        leftVariable.combine(getPropertyAssignmentType(scope, rightToken)!);
    }

    return leftVariable!;
}


// 获取 whenTrue 和 whenFalse 的联合类型
function inferConditionalExpressionType(scope: Scope, node: ConditionalExpression): Variable {
    const whenTrueNode = node.getWhenTrue(), whenFalseNode = node.getWhenFalse();
    const whenTrueVariable = getPropertyAssignmentType(scope, unwrapParentheses(whenTrueNode))!;
    const whenFalseVariable = getPropertyAssignmentType(scope, unwrapParentheses(whenFalseNode))!;

    return createVariable(
        new UnionType([
            whenTrueVariable,
            whenFalseVariable
        ])
    )
}


// 推断类型
export function getInferenceType(
    scope: Scope,
    iType: Expression,
    traversal?: ForEachDescendantTraversalControl
): Variable | undefined {
    /**
     * 推断类型时，当前解析跳过其所有子节点
     */
    traversal?.skip();
    try {
        return getPropertyAssignmentType(scope, iType);
    } catch (err) {
        console.error("Parse error:", err);
    }
}


// 获取表达式
export function getExpression(node: Node<ts.Node>) {
    return (unwrapParentheses(node) as unknown as ExpressionedNode).getExpression();
}


// 获取括号内层节点
export function unwrapParentheses(node: Node): Expression {
    let current = node;
    // 可能存在n个括号包裹表达式
    while (Node.isParenthesizedExpression(current)) {
        current = current.getExpression();
    }
    return current as Expression;
}


export type Ref<T> = {
    current?: T
};

type UpdateFn<M> = (prev: M) => M;
type Update<M> = UpdateFn<M> | M;
export type RefReturn<M> = [Ref<M>, (update: Update<M>) => void];

export function createRef<T>(defaultRef?: T): RefReturn<T> {
    const ref: Ref<T> = {
        current: defaultRef
    };

    const setRef = (update: Update<T>) => {
        if (isUpdater(update)) {
            ref.current = update(ref.current) as T;
        } else {
            ref.current = update as T;
        }
    };

    return [ref, setRef];
}

function isUpdater<T>(value: unknown): value is (prev: T) => T {
    return typeof value === 'function';
}


export function isRef<T>(data: any): data is Ref<T> {
    return data && data.current;
}

export function isVariable(data: any): data is Variable {
    return data && data.ref && data.currentType && data.setTypeRef;
}


export function getBasicTypeToVariable(data: Variable | BasicType): Variable {
    if (isVariable(data)) {
        return data;
    } else if (isBasicType(data)) {
        return createVariable(data);
    }
    return createVariable();
}


export function getVariableToBasicType(data: Variable | BasicType): BasicType {
    if (isVariable(data)) {
        return data.currentType!;
    } else if (isBasicType(data)) {
        return data;
    }
    return new AnyType();
}



export function getFunction(sourceFile: SourceFile, targetFuncName: string) {
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