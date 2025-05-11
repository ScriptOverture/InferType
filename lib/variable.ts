import type { Ref } from '../utils'
import { createRef, isRef } from '../utils'
import { AnyType, BasicType, ObjectType, TypeMatch } from './NodeType'
import { type Variable } from '../types/variable.ts'
import {
  getBasicTypeToVariable,
  getVariableToBasicType,
} from './typeCompatibility.ts'
import { VariableDeclarationKind } from 'ts-morph'

export function createVariable(
  iType: Ref<BasicType> | BasicType = new AnyType(),
  declarationKind: VariableDeclarationKind = VariableDeclarationKind.Let,
): Variable {
  const [typeRef, setTypeRef] = createRef<BasicType>()
  if (isRef(iType)) {
    setTypeRef(iType.current!)
  } else if (TypeMatch.isBasicType(iType)) {
    setTypeRef(iType)
  }

  const self = {
    setTypeRef,
    isVariableMutable: () => isVariableMutable(typeRef, declarationKind),
    get ref() {
      return typeRef
    },
    get currentType() {
      return typeRef.current
    },
    toString: () => typeRef.current?.toString()!,
    get: (key: string) => {
      const current = typeRef.current
      if (TypeMatch.isObjectType(current!)) {
        const objType = current.properties[key]
        if (objType) {
          return getBasicTypeToVariable(objType)
        }
      }
    },
    combine: (c: Variable | BasicType) => {
      const currenType = typeRef.current?.combine(getVariableToBasicType(c))
      setTypeRef(getVariableToBasicType(currenType!))
      return self
    },
    shallowCopy: () => {
      const targetBasicType = typeRef.current!
      if (TypeMatch.isObjectType(targetBasicType)) {
        setTypeRef(new ObjectType({ ...targetBasicType.properties }))
      }

      return self
    },
  }

  return self
}

// 判断申明及 BasicType 是否可变
function isVariableMutable(
  basicTypeRef: Ref<BasicType>,
  declarationKind: VariableDeclarationKind,
): boolean {
  const basicType = basicTypeRef.current
  /**
   * 引用类型
   */
  const referenceType =
    TypeMatch.isArrayType(basicType) ||
    TypeMatch.isObjectType(basicType) ||
    TypeMatch.isTupleType(basicType)
  if (!referenceType) {
    if (declarationKind === VariableDeclarationKind.Const) {
      return false
    }
  }
  return true
}
