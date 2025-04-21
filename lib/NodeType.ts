
// 基础类型抽象
abstract class Type {
    abstract toString(): string;
    abstract combine(other: Type): Type;
}

export type BaseType = Type;

export enum AllTypes {
    Any = 'any',
    String = 'string',
    Boolean = 'boolean',
    Number = 'number'
}

// 任意类型（初始状态）
export class AnyType extends Type {
    toString() { return AllTypes.Any; }
    combine(other: Type): Type { return other; }
}

// 字符串类型
export class StringType extends Type {
    toString() { return AllTypes.String; }
    combine(other: Type): Type {
        return other instanceof AnyType ? this : new UnionType([this, other]);
    }
}

// 字符串类型
export class NumberType extends Type {
    toString() { return AllTypes.Number; }
    combine(other: Type): Type {
        return other instanceof AnyType ? this : new UnionType([this, other]);
    }
}

export class BooleanType extends Type {
    toString() { return AllTypes.Boolean; }
    combine(other: Type): Type {
        return other instanceof AnyType ? this : new UnionType([this, other]);
    }
}


export class BasicType extends Type {
    constructor(public targetType: Type) {
        super()
    }
    toString() { return this.targetType.toString(); }
    combine(other: Type): Type {
        return other instanceof AnyType ? this.targetType : new UnionType([this.targetType, other]);
    }
}

// 索引类型（保持原设计）
class IndexType extends Type {
    constructor(
        public readonly keyType: Type,
        public readonly valueType: Type
    ) { super(); }

    toString() {
        return `{ [key: ${this.keyType}]: ${this.valueType} }`;
    }

    combine(other: Type): Type {
        if (other instanceof AnyType) return this;
        return this.isSameType(other) ? this : new UnionType([this, other]);
    }

    private isSameType(other: Type): boolean {
        return other instanceof IndexType &&
            this.keyType.toString() === other.keyType.toString() &&
            this.valueType.toString() === other.valueType.toString();
    }
}

// 结构化对象类型（新增核心类型）
export class ObjectType extends Type {
    constructor(
        public readonly properties: Record<string, Type>
    ) { super(); }

    toString() {
        const props = Object.entries(this.properties)
            .map(([k, v]) => `${k}: ${v}`)
            .join(', ');
            console.log(props);
            
        return `{ ${props} }`;
    }

    combine(other: Type): Type {
        if (other instanceof AnyType) return this;
        if (other instanceof ObjectType) {
            for (let k in other.properties) {
                this.properties[k] = other.properties[k];
            }
            return this;
        }
        return new UnionType([this, other]);
    }
}

// 联合类型（增强版）
export class UnionType extends Type {
    private types: Type[];

    constructor(initial: Type[]) {
        super();
        this.types = this.normalizeTypes(initial);
    }

    toString() {
        return this.types.map(t => t.toString()).join(' | ');
    }

    combine(other: Type): Type {
        const newTypes = other instanceof UnionType
            ? [...this.types, ...other.types]
            : [...this.types, other];
        return new UnionType(newTypes);
    }

    private normalizeTypes(types: Type[]): Type[] {
        const seen = new Set<string>();
        return types.reduce<Type[]>((acc, t) => {
            const key = t.toString();
            if (!seen.has(key) && key !== AllTypes.Any) {
                seen.add(key);
                acc.push(t);
            }
            return acc;
        }, []);
    }
}

export class DynamicType {
    private currentType: Type = new AnyType();

    addType(newType: Type): void {
        this.currentType = this.currentType.combine(newType);
    }

    getType(): string {
        return this.currentType.toString();
    }
}


type Variable = {
    ref: VariableTypeRef,
    currentType: BaseType,
    setTypeRef: (ref: BaseType) => void,
    get: (key: string) => BaseType | undefined,
    combine: (data: Variable) => BaseType;
    toString: () => string
}

type VariableTypeRef = {
    current: BaseType
};

function isVariableTypeRef(data: any): data is VariableTypeRef {
    return data && data.current;
}

export function createVariable(iType: VariableTypeRef | MorphType<ts.Type> | BaseType): Variable {
    let typeRef;
    if (isVariableTypeRef(iType)) {
        typeRef = iType;
    } else if (iType instanceof Type) {
        typeRef = { current: iType }
    } else {
        typeRef = { current: convertTypeNode(iType) };
    }
    // 内联缓存预留
    let references = new Set<VariableRef>();

    return {
        get ref(){ return typeRef },
        get currentType() { return typeRef.current },
        setTypeRef(ref: BaseType) {
            typeRef.current = ref
        },
        get: (key: string) => {
            const current = typeRef.current;
            if (current instanceof ObjectType) {
                return current.properties[key]
            }
        },
        combine: (c: Variable) => {
            return typeRef.current.combine(c.currentType)
        },
        toString: () => {
            return typeRef.current.toString()
        }
    }
}

import type { ParameterDeclaration, Type as MorphType, ts } from 'ts-morph';
import { getAllParametersType, convertTypeNode } from '../utils/index';

type Scope = {
    find(name: string): BaseType | undefined;
    createParameterDestructured(name: string): void;
    createLocalVariable(name: string, iType: BaseType): void;
    findParameter(paramName: string): void;
};

export function createScope(
    parameters: ParameterDeclaration[] = [],
    localVariables: Record<string, BaseType> = {},
    prototype?: Scope
) {
    const { paramsMap, parasmsList } = getAllParametersType(parameters);
    
    const _resultSelf: Scope = {
        find,
        createParameterDestructured,
        createLocalVariable,
        findParameter
    }

    Promise.resolve().then(_ => {
        console.log( paramsMap['props'].currentType.toString(), '>>>>');
    })
    function findParameter(paramName: string) {
        const targetType = find(paramName);
        if (!targetType) return false;
        const { currentType } = targetType;
        
        if (!(currentType instanceof ObjectType)) {
            targetType.setTypeRef(new ObjectType({}))
        }
        return {
            creatDestructured(recordType: Record<string, BaseType>) {
                // const t = new ObjectType(recordType);
                const variable = createVariable(new ObjectType(recordType));
                targetType.combine(variable);
                for (const k in recordType) {
                    if (localVariables.hasOwnProperty(k)) {
                        // 有 同步bug
                        localVariables[k] = localVariables[k]?.combine(variable.get(k)!)!;
                    } else {
                        localVariables[k] = variable.get(k)!;
                    }
                }
            }
        }
    }
    
    function find(name: string) {
        return localVariables[name]
            || paramsMap[name]
            || prototype?.find(name);
    }

    function createParameterDestructured(name: string, iType: BaseType) {
        const prevType = paramsMap[name];

    }

    function createLocalVariable(name: string) {
        localVariables[name] = createVariable(name, _resultSelf);;
    }

    return _resultSelf
}