import {
    Expression,
    Node,
    ParameterDeclaration,
    PropertyAccessExpression,
    SyntaxKind
} from "ts-morph";
import { AnyType, BooleanType, NumberType, StringType, ObjectType, UnionType, ArrayType } from "../lib/NodeType.ts";
import { createVariable, type Variable } from "../lib/variable.ts";
import type { Scope } from "../lib/scope.ts";


export enum ParamsKind {
    // 必选参数
    Required,
    // 默认参数 
    Default,
    // 剩余参数
    Rest,
    // 解构参数
    Destructured
};


export type Parameters = any

type ParametersResultType = {
    paramsMap: Record<string, Variable>,
    parasmsList: any
};

export function getAllParametersType(parasms: ParameterDeclaration[]): ParametersResultType {
    const result = {
        parasmsList: [],
        paramsMap: {}
    }

    return parasms.reduce((newRes, paramsItem, index) => {
        const nameNode = paramsItem.getNameNode();
        const paramKey = paramsItem.getName();
        const paramType = paramsItem.getType();
        let result: Parameters = {
            index,
            // 默认必填参数类型
            kind: ParamsKind.Required,
            paramName: paramKey,
            paramType: createVariable()
        };
        // 参数是否解构
        if (Node.isObjectBindingPattern(nameNode)) {

        }

        return {
            ...newRes,
            paramsMap: {
                ...newRes.paramsMap,
                [paramKey]: result.paramType
            },
            parasmsList: newRes.parasmsList.concat(result)
        };
    }, result);
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