import { BasicType } from '../lib/NodeType.ts'
import type { Ref, RefReturn } from '../utils'
import { VariableDeclarationKind } from 'ts-morph'

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
  // 申明属性是否可选
  hasQuestionDot: () => boolean
}

export type ObjectVariable<T extends string = string> = Record<T, Variable>

export type VariableTypeRef = Ref<BasicType>

export type VariableOptions = {
  // 申明标识
  declarationKind?: VariableDeclarationKind
  // 可选
  questionDot?: boolean
}
