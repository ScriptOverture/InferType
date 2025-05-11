import {
  ArrowFunction,
  FunctionDeclaration,
  FunctionExpression,
  Node,
  ts,
  type ParameterDeclaration,
  type PropertyAccessExpression,
  type Statement,
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

export type FunctionRecord = {
  body: Node | undefined
  params: ParameterDeclaration[]
  returnStatement: Statement | undefined
  propertyAccesses: PropertyAccessExpression[]
  hasAsyncToken: Node<ts.Modifier> | undefined
}
