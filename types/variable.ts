import { BasicType } from '../lib/NodeType.ts'
import type { Ref, RefReturn } from '../utils'

export type Variable = {
  ref: VariableTypeRef
  currentType: BasicType | undefined
  setTypeRef: RefReturn<any>[1]
  get: (key: string) => Variable | undefined
  combine: (data: Variable | BasicType) => Variable
  toString: () => string
  // 浅拷贝
  shallowCopy: () => Variable
  // 申明是否可变
  isVariableMutable: () => boolean
}

export type ObjectVariable<T extends string = string> = Record<T, Variable>

export type VariableTypeRef = Ref<BasicType>
