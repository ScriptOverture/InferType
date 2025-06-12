import {Expression, type Node, ts, type Type, TypeFlags} from 'ts-morph'
import type {Variable} from '../types/variable.ts'
import {createVariable} from './variable.ts'
import {AnyType, BasicType, BooleanType, NumberType, StringType, TypeMatch, UndefinedType,} from './NodeType.ts'
import {isVariable} from '../utils'
import SyntaxKind = ts.SyntaxKind;

// ast node 转 BasicType
export function convertBasicAstNodeToBasicType(iType: Expression | Node<ts.Node>): BasicType {
  if (!iType) return new AnyType()
  let result
  switch (iType.getKind()) {
    case SyntaxKind.StringKeyword:
    case SyntaxKind.StringLiteral:
      result = new StringType()
      break
    case SyntaxKind.NumberKeyword:
    case SyntaxKind.NumericLiteral:
      result = new NumberType()
      break
    case SyntaxKind.BooleanKeyword:
    case SyntaxKind.TrueKeyword:
    case SyntaxKind.FalseKeyword:
      result = new BooleanType()
      break
    case SyntaxKind.UndefinedKeyword:
      result = new UndefinedType()
      break
    default:
      result = new AnyType()
      break
  }
  return result
}

// ts type 转 BasicType
export function tsTypeToBasicType(type: Type) {
  const types = type.getUnionTypes()
  switch (type.getFlags()) {
    case ts.TypeFlags.String:
      return new StringType()
    case TypeFlags.Boolean:
      return new BooleanType()
    case TypeFlags.Number:
      return new NumberType()
    case TypeFlags.Any:
      return new AnyType()
    case TypeFlags.Undefined:
      return new UndefinedType()
    default:
      if (types.every((t) => t.getFlags() === TypeFlags.BooleanLiteral)) {
        return new BooleanType()
      }
      return new AnyType()
  }
}

// BasicType 转 Variable
export function getBasicTypeToVariable(data: Variable | BasicType): Variable {
  if (isVariable(data)) {
    return data
  } else if (TypeMatch.isBasicType(data)) {
    return createVariable(data)
  }
  return createVariable()
}

// Variable 转 BasicType
export function getVariableToBasicType(data: Variable | BasicType): BasicType {
  if (isVariable(data)) {
    return data.currentType!
  } else if (TypeMatch.isBasicType(data)) {
    return data
  }
  return new AnyType()
}

// 合并 BasicType 类型
export function mergeBasicTypeList(list: BasicType[]): BasicType {
  return list.reduce((result, bType) => {
    return result.combine(bType)
  }, new AnyType())
}
