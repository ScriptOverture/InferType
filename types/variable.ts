import { BasicType } from '../lib/NodeType.ts'
import type { Ref, RefReturn } from '../utils'

export type Variable = {
  ref: VariableTypeRef
  currentType: BasicType | undefined
  setTypeRef: RefReturn<any>[1]
  get: (key: string) => Variable | undefined
  combine: (data: Variable | BasicType) => Variable
  toString: () => string
}

export type VariableTypeRef = Ref<BasicType>
