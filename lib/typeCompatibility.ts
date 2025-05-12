import { Expression, SyntaxKind, ts, type Type, TypeFlags } from 'ts-morph'
import type { Variable } from '../types/variable.ts'
import { createVariable } from './variable.ts'
import {
  AnyType,
  BasicType,
  BooleanType,
  NumberType,
  StringType,
  TypeMatch,
} from './NodeType.ts'
import { isVariable } from '../utils'

// ast type 类型转 Variable
export function basicTypeToVariable(iType: Expression): Variable | undefined {
  if (!iType) return
  let result
  switch (iType.getKind()) {
    case SyntaxKind.StringLiteral:
      result = createVariable(new StringType())
      break
    case SyntaxKind.NumericLiteral:
      result = createVariable(new NumberType())
      break
    case SyntaxKind.TrueKeyword:
      result = createVariable(new BooleanType())
      break
    case SyntaxKind.FalseKeyword:
      result = createVariable(new BooleanType())
      break
    default:
      result = createVariable(new AnyType())
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
