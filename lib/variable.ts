import type { Ref } from '../utils'
import { AnyType, BasicType, ObjectType, TypeMatch } from './NodeType'
import { isRef, createRef } from '../utils'
import type { Variable } from '../types/variable.ts'
import {
  getBasicTypeToVariable,
  getVariableToBasicType,
} from './typeCompatibility.ts'

export function createVariable(
  iType: Ref<BasicType> | BasicType = new AnyType(),
): Variable {
  const [typeRef, setTypeRef] = createRef<BasicType>()
  if (isRef(iType)) {
    setTypeRef(iType.current!)
  } else if (TypeMatch.isBasicType(iType)) {
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
      const targetBasicType = typeRef.current!;
      if (TypeMatch.isObjectType(targetBasicType)) {
        setTypeRef(new ObjectType({ ...targetBasicType.properties }))
      }

      return self;
    }
  }

  return self
}
