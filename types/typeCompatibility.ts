import type { Variable } from './variable.ts'
import { ParameterDeclaration, SyntaxKind } from 'ts-morph'

export type ParameterMap = Record<string, Variable>
export type ParameterItem = {
  current: ParameterDeclaration
  kind: SyntaxKind
  paramsType: Variable
  paramName?: string
}

export type FunctionParameters = {
  parameterMap: ParameterMap
  parameterList: ParameterItem[]
}
