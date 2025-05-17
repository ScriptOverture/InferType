import { Node, SyntaxKind } from 'ts-morph'
import { createScope } from '../scope.ts'
import type {
  FunctionNode,
  ParseFunctionBodyResult,
  FunctionRecord,
} from '@@types/parser'
import type { Scope } from '@@types/scope'
import { getFunctionReturnType } from './hooks'
import { parseBlockNode } from './BlockNode.ts'

/**
 * 解析函数
 * @param funNode
 * @param scopePrototype
 */
export function parseFunctionBody(
  funNode: FunctionNode,
  scopePrototype?: Scope,
): ParseFunctionBodyResult {
  const { params, body, hasAsyncToken } = getFunctionRecord(funNode)
  if (!body) throw new Error('body must be a function')
  const scope = createScope(scopePrototype, params, {})
  const { getBlockReturnVariable } = parseBlockNode(scope, body)

  return {
    getParamsType: () => scope.paramsMap,
    getReturnType: () =>
      getFunctionReturnType(
        funNode,
        scope,
        getBlockReturnVariable(),
        !!hasAsyncToken,
      ),
    getParamsList: () => scope.getParamsList(),
    getLocalVariables: () => scope.getLocalVariables(),
  }
}

/**
 * 获取函数信息
 * @param iFunction
 */
function getFunctionRecord(iFunction: FunctionNode): FunctionRecord {
  return {
    body: iFunction.getBody(),
    params: iFunction.getParameters(),
    returnStatement: iFunction
      ?.getBody()
      ?.asKind(SyntaxKind.Block)
      ?.getStatement(Node.isReturnStatement),
    /**
     * 函数 async 标识
     */
    hasAsyncToken: iFunction.getModifiers().at(0),
  }
}
