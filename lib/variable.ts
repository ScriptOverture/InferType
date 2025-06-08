import { createRef, isRef, isVariable, type Ref } from '../utils'
import { AnyType, BasicType, ObjectType, TypeMatch } from './NodeType'
import type { Variable, VariableOptions } from '../types/variable.ts'
import {
  getBasicTypeToVariable,
  getVariableToBasicType,
} from './compatibility.ts'
import { VariableDeclarationKind } from 'ts-morph'

export function createVariable(
  iType: Ref<BasicType> | BasicType = new AnyType(),
  variableOptions: VariableOptions = {},
): Variable {
  const { declarationKind = VariableDeclarationKind.Let, questionDot } =
    variableOptions || {}
  const [typeRef, setTypeRef] = createRef<BasicType>()
  if (isRef(iType)) {
    setTypeRef(iType.current!)
  } else if (TypeMatch.isBasicType(iType)) {
    setTypeRef(iType)
  }

  const self = {
    setTypeRef,
    getVariableFlag: () => variableOptions.cacheFlags,
    isVariableMutable: () => isVariableMutable(typeRef, declarationKind),
    hasQuestionDot: () => !!questionDot,
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
    combine: (c: Variable | BasicType, syncFlag: boolean = false) => {
      const currenType = typeRef.current?.combine(getVariableToBasicType(c))
      setTypeRef(getVariableToBasicType(currenType!))
      if (syncFlag && isVariable(c)) {
        Object.assign(variableOptions, {
          cacheFlags: c.getVariableFlag(),
        })
      }
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
  const basicType = basicTypeRef.current!
  /**
   * 引用类型
   */
  if (TypeMatch.isReferenceType(basicType)) {
    if (declarationKind === VariableDeclarationKind.Const) {
      return false
    }
  }
  return true
}
