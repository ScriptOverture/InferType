import type { Ref, RefReturn } from '../utils'
import { AnyType, BasicType, isBasicType, isObjectType } from './NodeType'
import {
  isRef,
  createRef,
  getVariableToBasicType,
  getBasicTypeToVariable,
} from '../utils'

export type Variable = {
  ref: VariableTypeRef
  currentType: BasicType | undefined
  setTypeRef: RefReturn<unknown>[1]
  get: (key: string) => Variable | undefined
  combine: (data: Variable | BasicType) => Variable
  toString: () => string
}

type VariableTypeRef = Ref<BasicType>

export function createVariable(
  iType: Ref<BasicType> | BasicType = new AnyType(),
): Variable {
  const [typeRef, setTypeRef] = createRef<BasicType>()
  if (isRef(iType)) {
    setTypeRef(iType.current!)
  } else if (isBasicType(iType)) {
    setTypeRef(iType)
  }
  // 内联缓存预留
  // let _references = new Set<VariableTypeRef>()

  const self = {
    setTypeRef,
    get ref() {
      return typeRef
    },
    get currentType() {
      return typeRef.current
    },
    toString: () => typeRef.current?.toString()!,
    get: (key: string) => {
      const current = typeRef.current
      if (isObjectType(current!)) {
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
  }

  return self
}
