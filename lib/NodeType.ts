
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

export class ArrayType extends Type {
    constructor(public elementType: Type = new AnyType()) {
      super();
    }
  
    toString() {
      return `${this.elementType}[]`;
    }
  
    combine(other: Type): Type {
      if (other instanceof AnyType) return this;
      if (other instanceof ArrayType) {
        return new ArrayType(this.elementType.combine(other.elementType));
      }
      return new UnionType([this, other]);
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
            
        return `{ ${props} }`;
    }

    combine(other: Type | Variable): Type {
        if (other instanceof AnyType) return this;
        if (other instanceof ObjectType) {
            for (let k in other.properties) {
                if (this.properties.hasOwnProperty(k)) {
                    this.properties[k] = new UnionType([this.properties[k]!, other.properties[k]!]);
                } else {
                    this.properties[k] = other.properties[k]!;
                }
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


export type Variable = {
    ref: VariableTypeRef,
    currentType: BaseType | undefined,
    setTypeRef: RefReturn<any>[1],
    get: (key: string) => Variable | undefined,
    combine: (data: Variable) => Variable;
    toString: () => string
}

type VariableTypeRef = Ref<BaseType>;


export function createVariable(iType: Ref<BaseType> | MorphType<ts.Type> | BaseType = new AnyType()): Variable {
    const [typeRef, setTypeRef] = createRef<BaseType>();
    if (isRef(iType)) {
        setTypeRef(iType.current!);
    } else if (iType instanceof Type) {
        setTypeRef(iType);
    } else {
        setTypeRef(convertTypeNode(iType));
    }
    // 内联缓存预留
    let references = new Set<VariableTypeRef>();

    const self = {
        setTypeRef,
        get ref(){ return typeRef },
        get currentType() { return typeRef.current },
        toString: () => typeRef.current?.toString()!,
        get: (key: string) => {
            const current = typeRef.current;
            if (current instanceof ObjectType) {
                const objType = current.properties[key];
                if (isVariable(objType)) {
                    return objType;
                }
                return createVariable(objType);
            }
        },
        combine: (c: Variable) => {
            const currenType = typeRef.current?.combine(c.currentType!);
            if (isVariable(currenType)) {
                setTypeRef(currenType);
            } else {
                setTypeRef(createVariable(currenType))
            }
            return self;
        }
    }

    return self;
}

import type { ParameterDeclaration, Type as MorphType, ts } from 'ts-morph';
import { getAllParametersType, convertTypeNode, createRef, isRef, type Ref, type RefReturn, isVariable } from '../utils/index';

export type Scope = {
    find(name: string): Variable | undefined;
    createLocalVariable(name: string, iType: BaseType): void;
    findParameter(paramName: string): TargetParamter | null;
    paramsMap: Record<string, Variable>,
    creatDestructured: (targetVariable: Variable, recordType: Record<string, Variable>) => void
};

type TargetParamter = {
    creatDestructured: (recordType: Record<string, Variable>) => void
};

export function createScope(
    parameters: ParameterDeclaration[] = [],
    localVariables: Record<string, Variable> = {},
    prototype?: Scope
) {
    const { paramsMap, parasmsList } = getAllParametersType(parameters);
    
    const _resultSelf: Scope = {
        find,
        createLocalVariable,
        findParameter,
        paramsMap,
        creatDestructured
    }

    Promise.resolve().then(_ => {
        console.log(
            '<<<<',
            paramsMap['props']?.currentType?.toString(),
            localVariables['res']?.currentType?.toString(),
            '>>>>'
        );
    })

    function creatDestructured(targetVariable: Variable, recordType: Record<string, Variable>) {
        const variable = createVariable(new ObjectType(recordType));
        targetVariable.combine(variable);
        
        for (const k in recordType) {
            if (localVariables.hasOwnProperty(k)) {
                // 有 同步bug
                localVariables[k] = localVariables[k]?.combine(variable.get(k)!)!
            } else {
                localVariables[k] = variable.get(k)!;
            }
        }
    }

    function findParameter(paramName: string) {
        const targetType = find(paramName);
        if (!targetType) return null;
        const { currentType } = targetType;
        
        if (!(currentType instanceof ObjectType)) {
            targetType.setTypeRef(new ObjectType({}))
        }
        return {
            creatDestructured(recordType: Record<string, Variable>) {
                creatDestructured(targetType, recordType);
            }
        }
    }
    
    function find(name: string) {
        return localVariables[name]
            || paramsMap[name]
            || prototype?.find(name);
    }

    function createLocalVariable(name: string, variable: Variable) {
        localVariables[name] = variable;
    }

    return _resultSelf
}