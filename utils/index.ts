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
    type ObjectBindingPattern,
    type ArrayBindingPattern,
    type ElementAccessExpression,
    type ObjectLiteralExpression,
} from "ts-morph";
import {
    AnyType,
    BooleanType,
    NumberType,
    StringType,
    ObjectType,
    UnionType,
    ArrayType,
    TupleType,
    BasicType,
    FunctionType,
    isBasicType,
    isTupleType,
    isArrayType,
    isObjectType
} from "../lib/NodeType.ts";
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
            result = inferObjectLiteralExpression(scope, iType.asKindOrThrow(SyntaxKind.ObjectLiteralExpression));
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

            // 收集每个位置的类型（保持顺序）
            const elementVars = arrayElements.map(elem => {
                const v = getPropertyAssignmentType(scope, elem);
                if (!v) throw new Error("无法推断元素类型");
                return v;
            });
            const elementTypes = elementVars.map(v => v.currentType!);

            // 判断是否所有元素类型都相同
            const firstType = elementTypes[0];
            const allSame = elementTypes.every(t => firstType?.constructor === t.constructor);

            if (allSame) {
                // 同质数组：T[]
                const unionType = new UnionType([firstType!]);
                result = createVariable(new ArrayType(unionType));
            } else {
                // 异构数组——元组
                // 直接用位置类型列表来构造 TupleType
                const tupleType = new TupleType(elementTypes);
                result = createVariable(tupleType);
            }
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
            result = getPropertyAssignmentType(scope, unwrapParentheses(iType));
            break;
        // 元素访问 | list[index]
        case SyntaxKind.ElementAccessExpression:
            result = inferElementAccessExpression(scope, iType.asKindOrThrow(SyntaxKind.ElementAccessExpression));
            break;
        // 兜底推断类型
        default:
            result = basicTypeToVariable(iType);
            break;
    }

    return result;
}


function inferObjectLiteralExpression(scope: Scope, node: ObjectLiteralExpression): Variable {
    const newObjType: Record<string, Variable> = {};
    for (const propertyNode of node.getProperties()) {
        const property = propertyNode?.asKindOrThrow(SyntaxKind.PropertyAssignment)!;
        const propertyName = property.getName();
        const initializer = property.getInitializer();
        newObjType[propertyName] = getPropertyAssignmentType(scope, initializer!)!;
    }
    return createVariable(
        new ObjectType(newObjType)
    );
}

/**
 * 推断原始数组及索引类型
 * @param scope
 * @param node
 */
function inferElementAccessExpression(scope: Scope, node: ElementAccessExpression): Variable | undefined {
    const targetExpressionToken = getExpression(node);
    const expressionVariable = getPropertyAssignmentType(scope, targetExpressionToken);
    if (!expressionVariable) return;
    let expressionType = expressionVariable.currentType!, result;
    // 数组类型
    if (isArrayType(expressionType)) {
        result = getBasicTypeToVariable(expressionType.elementType);
    }
    // 元组类型
    else if (isTupleType(expressionType)) {
        const argExprNode = node.getArgumentExpression()!;
        /**
         * 动态索引
         */
        let resultVariable;
        if (Node.isIdentifier(argExprNode)) {
            result = createVariable(new UnionType(expressionType.elementsType.map(getVariableToBasicType)));
        }
        else {
            const expressionTokenIndex = argExprNode.getText()!;
            resultVariable = expressionType.getIndexType(expressionTokenIndex);
        }

        if (resultVariable) {
            result = getBasicTypeToVariable(resultVariable);
        }
    }
    // 对象索引类型
    else if (isObjectType(expressionType)) {
        const argExprNode = node.getArgumentExpression()!;
        /**
         * 动态索引
         */
        let expressionTokenKey;
        if (Node.isIdentifier(argExprNode)) {
            expressionTokenKey = getIdentifierStr(argExprNode.getType().getText());
        }
        else {
            expressionTokenKey = getIdentifierStr(argExprNode.getText()!);
        }

        result = getBasicTypeToVariable(expressionType.get(expressionTokenKey)!);
    }

    return result;
}


/**
 * 推断解构对象
 * @param scope
 * @param node
 * @param initializerVariable
 * @param traversal
 */
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

/**
 * 推断解构数组
 * @param scope
 * @param node
 * @param initializerVariable
 * @param traversal
 */
export function inferArrayBindingPattern(
    scope: Scope,
    node: ArrayBindingPattern,
    initializerVariable: Variable,
    traversal: ForEachDescendantTraversalControl
) {
    if (!isTupleType(initializerVariable.currentType!)) return;
    const targetTuple = initializerVariable.currentType;
    node.getElements().forEach((elem, index) => {
        const originName = elem.getName();
        // 默认值
        const initializer = elem.getInitializer();
        let targetType = targetTuple.getIndexType(index)!;

        if (!targetType) {
            // 默认值
            if (initializer) {
                targetType = getInferenceType(scope, initializer, traversal)!;
            } else {
                targetType = createVariable();
            }
        }

        // 非别名， 更新右侧标识的同时还会更新词法环境
        scope.creatDestructured(initializerVariable, {
            [originName]: getBasicTypeToVariable(targetType)
        });
    });
}

// 操作符推断
function inferBinaryExpressionType(scope: Scope, node: BinaryExpression): Variable | undefined {
    const leftToken = node.getLeft();
    const rightToken = node.getRight();
    const operatorToken = node.getOperatorToken();

    switch (operatorToken.getKind()) {
        case SyntaxKind.EqualsEqualsEqualsToken: // ===
        case SyntaxKind.EqualsEqualsToken: // ==
        case SyntaxKind.EqualsToken: // =
            return assignment(
                scope,
                leftToken,
                rightToken,
            );
        case SyntaxKind.BarBarToken:  // ||
            const v = createVariable();
            v.combine(getPropertyAssignmentType(scope, leftToken)!)
            v.combine(getPropertyAssignmentType(scope, rightToken)!)
            return v;
    }
}

// 推断连续赋值情况类型
function assignment(scope: Scope, leftToken: Expression , rightToken: Expression): Variable {
    let leftVariable = getPropertyAssignmentType(scope, leftToken);
    // 未匹配则创建作用域变量
    if (!leftVariable) {
        leftVariable = scope.createLocalVariable(leftToken.getText());
    }

    /**
     * resultType 为最右侧原始类型
     */
    let resultType;
    if (Node.isBinaryExpression(rightToken)) {
        resultType = inferBinaryExpressionType(scope, rightToken)!;
        leftVariable.combine(resultType)
    }
    else {
        resultType = getPropertyAssignmentType(scope, rightToken)!
        leftVariable.combine(resultType);
    }

    return resultType!;
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

export function isString(n: any): n is string {
    return typeof n === 'string';
}

export function isNumber(n: any): n is number {
    return typeof n === 'number';
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
        iFunction = variableDeclaration?.getInitializerIfKind(initializer?.getKind()! as SyntaxKind.FunctionExpression)!;
    }
    return iFunction;
}


export function uniqueBaseType(types: BasicType[]): BasicType[] {
    const result: BasicType[] = [];
    types.forEach((item, index) => {
        const state = types.slice(index + 1).some(el => item.constructor === el.constructor);
        if (!state) {
            result.push(item)
        }
    })

    return result
}


// 获取关键字符 '"x"' => 'x'
export function getIdentifierStr(n: string): string {
    return n.replace(/['\\"]+/g, '')
}