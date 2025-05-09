import {
  ArrowFunction,
  FunctionDeclaration,
  FunctionExpression,
} from 'ts-morph'
import type { Scope } from './scope.ts'
import type { Variable } from './variable.ts'

export type FunctionNode =
  | FunctionExpression
  | ArrowFunction
  | FunctionDeclaration

export type ParseFunctionBodyResult = {
  getParamsType: () => Scope['paramsMap']
  getReturnType: () => Variable | undefined
  getParamsList: () => ReturnType<Scope['getParamsList']>
  getLocalVariables: () => ReturnType<Scope['getLocalVariables']>
}
