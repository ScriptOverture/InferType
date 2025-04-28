import type { Variable } from "./variable";
import { SyntaxKind } from 'ts-morph';
import type { ParasmsItem } from "../utils";

// 基础类型抽象
export abstract class BasicType {
    abstract toString(): string;
    abstract combine(other: BasicType): BasicType;
}

export type BaseType = BasicType;

export enum AllTypes {
    Any = 'any',
    String = 'string',
    Boolean = 'boolean',
    Number = 'number',
    Void = 'void'
}

// 任意类型（初始状态）
export class AnyType extends BasicType {
    toString() { return AllTypes.Any; }
    combine(other: BasicType): BasicType { return other; }
}

// 字符串类型
export class StringType extends BasicType {
    toString() { return AllTypes.String; }
    combine(other: BasicType): BasicType {
        return other instanceof AnyType ? this : new UnionType([this, other]);
    }
}

// 字符串类型
export class NumberType extends BasicType {
    toString() { return AllTypes.Number; }
    combine(other: BasicType): BasicType {
        return other instanceof AnyType ? this : new UnionType([this, other]);
    }
}

export class BooleanType extends BasicType {
    toString() { return AllTypes.Boolean; }
    combine(other: BasicType): BasicType {
        return other instanceof AnyType ? this : new UnionType([this, other]);
    }
}

export class ArrayType extends BasicType {
    constructor(public elementType: BasicType = new AnyType()) {
        super();
    }

    toString() {
        return `${this.elementType}[]`;
    }

    combine(other: BasicType): BasicType {
        if (other instanceof AnyType) return this;
        if (other instanceof ArrayType) {
            return new ArrayType(this.elementType.combine(other.elementType));
        }
        return new UnionType([this, other]);
    }
}


// 索引类型（保持原设计）
export class IndexType extends BasicType {
    constructor(
        public readonly keyType: BasicType,
        public readonly valueType: BasicType
    ) { super(); }

    toString() {
        return `{ [key: ${this.keyType}]: ${this.valueType} }`;
    }

    combine(other: BasicType): BasicType {
        if (other instanceof AnyType) return this;
        return this.isSameType(other) ? this : new UnionType([this, other]);
    }

    private isSameType(other: BasicType): boolean {
        return other instanceof IndexType &&
            this.keyType.toString() === other.keyType.toString() &&
            this.valueType.toString() === other.valueType.toString();
    }
}

// 结构化对象类型（新增核心类型）
export class ObjectType extends BasicType {
    constructor(
        public readonly properties: Record<string, BasicType>
    ) { super(); }

    toString() {
        const props = Object.entries(this.properties)
            .map(([k, v]) => `${k}: ${v}`)
            .join(', ');

        return `{ ${props} }`;
    }

    combine(other: BasicType | Variable): BasicType {
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
export class UnionType extends BasicType {
    private types: BasicType[];

    constructor(initial: BasicType[]) {
        super();
        this.types = this.normalizeTypes(initial);
    }

    toString() {
        return this.types.map(t => t.toString()).join(' | ');
    }

    combine(other: BasicType): BasicType {
        const newTypes = other instanceof UnionType
            ? [...this.types, ...other.types]
            : [...this.types, other];
        return new UnionType(newTypes);
    }

    private normalizeTypes(types: BasicType[]): BasicType[] {
        const seen = new Set<string>();
        return types.reduce<BasicType[]>((acc, t) => {
            const key = t.toString();
            if (!seen.has(key) && key !== AllTypes.Any) {
                seen.add(key);
                acc.push(t);
            }
            return acc;
        }, []);
    }
}

/**
 * 函数类型
 */
export class FunctionType extends BasicType {
    constructor(
        private readonly paramsType: ParasmsItem[],
        private readonly returnType?: BaseType
    ) { super(); }

    toString() {
        const params = this.paramsType.map(item => {
            const { kind, paramName, paramsType } = item;
            if (kind === SyntaxKind.Identifier) {
                return `${paramName}: ${paramsType}`;
            } else if (kind === SyntaxKind.ObjectBindingPattern) {
                const kv = paramsType.currentType as ObjectType;
                return `{ ${Object.entries(kv.properties).map(([k, v]) => `${k}: ${v}`).join(', ')} }: ${paramsType}`;
            } else if (kind === SyntaxKind.Parameter) {
                return `...${paramsType}: ${paramsType}`;
            }
        }).join(', ');
        return `(${params}) => ${this.returnType}`
    }

    combine(other: BasicType): BasicType {
        if (other instanceof AnyType) return this;
        return new UnionType([this, other]);
    }
}