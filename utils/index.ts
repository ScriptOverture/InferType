import {
    Expression,
    Identifier,
    Node,
    ParameterDeclaration,
    ts,
    Type,
    PropertyAccessExpression,
} from "ts-morph";
import { type Scope, AnyType, BooleanType, NumberType, StringType, ObjectType, UnionType, type BaseType, BasicType, createVariable, type Variable, ArrayType } from "../lib/NodeType.ts";
import TypeFlags = ts.TypeFlags;

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
            paramType: createVariable(paramType)
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
    //  parasms.map((paramsItem, index) => {
    //     const nameNode = paramsItem.getNameNode();
    //     const paramKey = paramsItem.getName();
    //     const paramType = paramsItem.getType();
    //     let result: Parameters = {
    //         index,
    //         kind: ParamsKind.Required,
    //         paramName: paramKey,
    //         paramType: convertTypeNode(paramType)
    //     };
    //     // 参数是否解构
    //     if (Node.isObjectBindingPattern(nameNode)) {
    //         const {params} = nameNode.getElements().reduce<{
    //             params: string[];
    //         }>((results, item) => {
    //             const localName = item.getName();
    //             const originalName = item.getPropertyNameNode()?.getText() || localName;
    //             const propSymbol = paramType.getProperty(originalName);
    //             const itype = propSymbol?.getTypeAtLocation(item);
    //             // if (!paramsItem.getTypeNode() && itype) {
    //             //     result.paramType.addType(originalName, new TsMorphTypeConverter().convertType(itype));
    //             // }
    //             return {
    //                 params: results.params.concat(originalName),
    //             }
    //         }, {params: []});

    //         result = {
    //             ...result,
    //             kind: ParamsKind.Destructured,
    //             paramName: params,
    //         };
    //     }
    //     return result;
    // })
}






export function getRootIdentifier(expr: Expression): Identifier | undefined {
    let cur: Expression = expr;
    while (Node.isPropertyAccessExpression(cur)) {
        cur = cur.getExpression();
    }
    return Node.isIdentifier(cur) ? cur : undefined;
}


export function convertTypeNode(iType: Type<ts.Type>): BaseType {
    if (!iType) return new AnyType();
    if (iType.isString()) return new BasicType(new StringType());
    if (iType.isNumber()) return new BasicType(new NumberType());
    if (iType.isBoolean()) return new BasicType(new BooleanType());
    if (iType.isUnion()) return convertUnionType(iType);
    if (iType.isArray()) return convertArrayType(iType);
    if (iType.isObject()) return convertObjectType(iType);
    return new AnyType();
}


function convertObjectType(iType: Type<ts.Type>): ObjectType {
    const properties: Record<string, any> = {};
    // 处理显式属性
    for (const property of iType.getProperties()) {
        const name = property.getName();
        const propertyDeclaration = property.getValueDeclaration();
        if (propertyDeclaration) {
            properties[name] = convertTypeNode(propertyDeclaration.getType());
        }
    }

    // // 处理索引签名
    // const indexSignatures = type.getIndexSignatures();
    // if (indexSignatures.length > 0) {
    //     const indexType = this.convertIndexSignature(indexSignatures[0]);
    //     return new EnhancedObjectType(properties, indexType);
    // }

    return new ObjectType(properties);
}


function convertUnionType(iType: Type<ts.Type>): UnionType {
    return new UnionType(
        iType.getUnionTypes().map(t => convertTypeNode(t))
    );
}


function convertArrayType(iType: Type<ts.Type>): ArrayType {
    const lhsType = convertTypeNode(iType.getArrayElementTypeOrThrow());
    return new ArrayType(lhsType);
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
    while (index < propertyAccess.length) {
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




/**
 * 右侧赋值不同情况
 * @param scope 
 * @param iType 
 * @returns 
 */
export function getPropertyAssignmentType(scope: Scope, iType: Expression<ts.Expression>): Variable | undefined {
    let result; // rhsType
    if (Node.isIdentifier(iType)) {
        const rhsName = iType.getText();
        result = scope.find(rhsName);
    } if (Node.isPropertyAccessExpression(iType)) {
        result = getVariablePropertyValue(scope, getPropertyAccessList(iType));
    } 

    return result;
}