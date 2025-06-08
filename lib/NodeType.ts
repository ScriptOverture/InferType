import type { ParameterItem } from '@@types/compatibility.ts'
import { SyntaxKind } from 'ts-morph'
import { getIdentifierStr, isString, isVariable } from '../utils'
import { getVariableToBasicType, mergeBasicTypeList } from './compatibility.ts'
import type { ObjectVariable } from '@@types/variable.ts'

// 基础类型抽象
export abstract class BasicType {
  abstract kind: number
  abstract toString(): string
  abstract combine(other: BasicType): BasicType
}

export type BaseType = BasicType

export enum AllTypes {
  Any = 'any',
  String = 'string',
  Boolean = 'boolean',
  Number = 'number',
  Undefined = 'undefined',
  Void = 'void',
  Promise = 'Promise',
}

export const enum TypeKind {
  AnyType = 1,
  UndefinedType = 2,
  StringType = 3,
  NumberType = 4,
  BooleanType = 5,
  ArrayType = 6,
  PromiseType = 7,
  TupleType = 8,
  ObjectType = 9,
  UnionType = 10,
  FunctionType = 11,
  /**
   * 引用类型
   */
  ReferenceType = ArrayType | TupleType | ObjectType | FunctionType,
}

// 任意类型（初始状态）
export class AnyType extends BasicType {
  kind = TypeKind.AnyType
  toString() {
    return AllTypes.Any
  }
  combine(other: BasicType): BasicType {
    return other
  }
}

export class UndefinedType extends BasicType {
  kind = TypeKind.UndefinedType
  toString() {
    return AllTypes.Undefined
  }
  combine(other: BasicType): BasicType {
    return other
  }
}

// 字符串类型
export class StringType extends BasicType {
  kind = TypeKind.StringType
  toString() {
    return AllTypes.String
  }
  combine(other: BasicType): BasicType {
    return other instanceof AnyType ? this : new UnionType([this, other])
  }
}

// 字符串类型
export class NumberType extends BasicType {
  kind = TypeKind.NumberType
  toString() {
    return AllTypes.Number
  }
  combine(other: BasicType): BasicType {
    return other instanceof AnyType ? this : new UnionType([this, other])
  }
}

export class BooleanType extends BasicType {
  kind = TypeKind.BooleanType
  toString() {
    return AllTypes.Boolean
  }
  combine(other: BasicType): BasicType {
    return other instanceof AnyType ? this : new UnionType([this, other])
  }
}

export class ArrayType extends BasicType {
  kind = TypeKind.ArrayType
  constructor(public elementType: BasicType = new AnyType()) {
    super()
    if (TypeMatch.isTupleType(elementType)) {
      this.elementType = mergeBasicTypeList(elementType.elementsType)
    } else if (TypeMatch.isArrayType(elementType)) {
      this.elementType = elementType.elementType
    }
  }

  toString() {
    if (TypeMatch.isUnionType(this.elementType)) {
      return `(${this.elementType})[]`
    }
    return `${this.elementType}[]`
  }

  combine(other: BasicType): BasicType {
    if (other instanceof AnyType) return this
    if (TypeMatch.isTupleType(other)) {
      this.elementType.combine(mergeBasicTypeList(other.elementsType))
      return this
    }
    if (other instanceof ArrayType) {
      return new ArrayType(this.elementType.combine(other.elementType))
    }
    return new UnionType([this, other])
  }
}

// promise
export class PromiseType extends BasicType {
  kind = TypeKind.PromiseType
  constructor(public elementType: BasicType = new AnyType()) {
    super()
  }

  toString(): string {
    return `Promise<${this.elementType}>`
  }

  combine(other: BasicType): BasicType {
    if (other instanceof AnyType) return this
    return new UnionType([this, other])
  }
}

/**
 * 元组类型
 */
export class TupleType extends BasicType {
  kind = TypeKind.TupleType
  constructor(public elementsType: BasicType[] = []) {
    super()
  }

  toString() {
    return `[${this.elementsType.join()}]`
  }

  combine(other: BasicType): BasicType {
    if (other instanceof AnyType) return this

    // if (other instanceof ArrayType) {
    //     return new ArrayType(this.elementsType.combine(other.elementType));
    // }
    return new UnionType([this, other])
  }

  getIndexType(n: number | string) {
    let index = n as number
    if (isString(n)) {
      index = Number(getIdentifierStr(n))
    }
    return this.elementsType[index]
  }
}

// 结构化对象类型（新增核心类型）
export class ObjectType extends BasicType {
  kind = TypeKind.ObjectType
  constructor(
    public readonly properties: Record<string, BasicType> | ObjectVariable = {},
  ) {
    super()
  }

  toString() {
    const props = Object.entries(this.properties)
      .map(([k, v]) => {
        if (isVariable(v)) {
          return `${k}${v?.hasQuestionDot() ? '?' : ''}: ${v}`
        }
        return `${k}: ${v}`
      })
      .join(', ')

    return `{ ${props} }`
  }

  combine(other: BasicType): BasicType {
    if (other instanceof AnyType) return this
    if (other instanceof ObjectType) {
      for (const k in other.properties) {
        if (Object.hasOwn(this.properties, k)) {
          this.properties[k] = new UnionType([
            getVariableToBasicType(this.properties[k]!),
            getVariableToBasicType(other.properties[k]!),
          ])
        } else {
          this.properties[k] = other.properties[k]!
        }
      }
      return this
    }
    return new UnionType([this, other])
  }

  get(key: string) {
    return this.properties[key]
  }
}

// 联合类型（增强版）
export class UnionType extends BasicType {
  kind = TypeKind.UnionType
  private types: BasicType[]

  constructor(initial: BasicType[]) {
    super()
    this.types = this.normalizeTypes(initial)
  }

  toString() {
    return this.types.map((t) => t.toString()).join(' | ')
  }

  combine(other: BasicType): BasicType {
    const newTypes =
      other instanceof UnionType
        ? this.normalizeTypes([...this.types, ...other.types])
        : this.normalizeTypes([...this.types, other])
    return new UnionType(newTypes)
  }

  removeType(targetType: BasicType | ((targetType: BasicType) => boolean)) {
    if (typeof targetType === 'function') {
      this.types = this.types.filter((x) => !targetType(x))
    } else {
      this.types = this.types.filter((x) => x !== targetType)
    }
  }

  private normalizeTypes(types: BasicType[]): BasicType[] {
    const seen = new Set<string>()
    return types
      .flatMap((item) => {
        if (TypeMatch.isUnionType(item)) {
          return item.types
        }
        return item
      })
      .reduce<BasicType[]>((acc, t) => {
        const key = t.toString()
        if (!seen.has(key) && key !== AllTypes.Any) {
          seen.add(key)
          acc.push(t)
        }
        return acc
      }, [])
  }
}

/**
 * 函数类型
 */
export class FunctionType extends BasicType {
  kind = TypeKind.FunctionType
  constructor(
    private readonly paramsType: ParameterItem[],
    private readonly returnType?: BaseType,
  ) {
    super()
  }

  toString() {
    const params = this.paramsType
      .map((item) => {
        const { kind, paramName, paramsType } = item
        if (kind === SyntaxKind.Identifier) {
          return `${paramName}: ${paramsType}`
        } else if (kind === SyntaxKind.ObjectBindingPattern) {
          const kv = paramsType.currentType as ObjectType
          return `{ ${Object.entries(kv.properties)
            .map(([k, v]) => `${k}: ${v}`)
            .join(', ')} }: ${paramsType}`
        } else if (kind === SyntaxKind.Parameter) {
          return `...${paramsType}: ${paramsType}`
        }
      })
      .join(', ')
    return `(${params}) => ${this.returnType}`
  }

  combine(other: BasicType): BasicType {
    if (other instanceof AnyType) return this
    return new UnionType([this, other])
  }
}

export const TypeMatch = {
  isBasicType: (type: unknown): type is BasicType => type instanceof BasicType,
  isObjectType: (type: unknown): type is ObjectType =>
    type instanceof ObjectType,
  isStringType: (type: unknown): type is StringType =>
    type instanceof StringType,
  isNumberType: (type: unknown): type is NumberType =>
    type instanceof NumberType,
  isTupleType: (type: unknown): type is TupleType => type instanceof TupleType,
  isArrayType: (type: unknown): type is ArrayType => type instanceof ArrayType,
  isUnionType: (type: unknown): type is UnionType => type instanceof UnionType,
  isUndefinedType: (type: unknown): type is UndefinedType =>
    type instanceof UndefinedType,
  isReferenceType: (type: BasicType) => {
    return (type.kind & TypeKind.ReferenceType) != 0
  },
}
