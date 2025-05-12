import type { ObjectVariable, Variable } from './variable.ts'
import { ParameterDeclaration, SyntaxKind } from 'ts-morph'

export type ParameterItem = {
  current: ParameterDeclaration
  kind: SyntaxKind
  paramsType: Variable
  paramName?: string
}

export type FunctionParameters = {
  parameterMap: ObjectVariable
  parameterList: ParameterItem[]
}
