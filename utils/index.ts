import {
    Expression,
    Node,
    ParameterDeclaration,
    PropertyAccessExpression,
    SyntaxKind,
    type SourceFile,
    type FunctionExpression,
    type FunctionDeclaration
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
        next = next.getExpression();
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
        // 兜底推断类型
        default:
            result = basicTypeToVariable(iType);
            break;
    }

    return result;
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