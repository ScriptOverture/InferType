import {
  ArrowFunction,
  FunctionDeclaration,
  FunctionExpression,
  Node,
  ts,
  type ParameterDeclaration,
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
  hasAsyncToken: Node<ts.Modifier> | undefined
}

/**
 * 解析 BlockNode 返回类型
 */
export type ParseBlockResult = {
  getBlockReturnVariable: () => Variable
  /**
   * block 内 return 所有边界是否都命中
   */
  isAllReturnsReadyState: () => boolean
}
