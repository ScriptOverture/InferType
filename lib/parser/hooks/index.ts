import type { Variable } from '@@types/variable.ts'
import { createRef } from '@utils/index'
import { PromiseType, TypeMatch, UndefinedType } from '@/NodeType.ts'
import type { FunctionNode } from '@@types/parser.ts'
import type { Scope } from '@@types/scope.ts'
import { Node } from 'ts-morph'
import { inferPropertyAssignmentType } from '@/inference.ts'
import { unwrapParentheses } from '@utils/parameters.ts'
import { createVariable } from '@/variable.ts'

/**
 * 函数返回类型逻辑处理
 * @param defaultVal
 */
export function useGetReturnStatementType<T extends Variable = Variable>(
  defaultVal: T,
) {
  const [returnStatementType, setReturnStatementType] = createRef<T>(defaultVal)
  let isAllReturnsReadyState = false

  return {
    dispatchReturnType,
    getBlockReturnType,
    isAllReturnsReadyState: () => isAllReturnsReadyState,
  }

  function dispatchReturnType(
    targetReturnType: Variable,
    allReturnsReadyState: boolean = false,
  ) {
    isAllReturnsReadyState = allReturnsReadyState
    setReturnStatementType((prev) => {
      /**
       * 所有 case 都有 return
       * 过滤掉前置的 UndefinedType
       */
      if (allReturnsReadyState) {
        const basicType = prev.currentType
        if (TypeMatch.isUnionType(basicType)) {
          basicType?.removeType(TypeMatch.isUndefinedType)
        }
        return prev.combine(targetReturnType) as T
      } else {
        return prev.combine(targetReturnType).combine(new UndefinedType()) as T
      }
    })
  }

  function getBlockReturnType() {
    return returnStatementType.current
  }
}

/**
 * 获取函数返回类型
 * @param funNode
 * @param scope
 * @param displayReturnType
 * @param hasAsyncToken
 */
export function getFunctionReturnType(
  funNode: FunctionNode,
  scope: Scope,
  displayReturnType: Variable,
  hasAsyncToken: boolean = false,
) {
  let result
  // 箭头函数
  if (Node.isArrowFunction(funNode)) {
    const eqGtToken = funNode.getEqualsGreaterThan()
    const nextNode = eqGtToken.getNextSibling()!
    // 函数显示返回类型
    if (Node.isBlock(nextNode)) {
      result = displayReturnType
    } else {
      result = inferPropertyAssignmentType(scope, unwrapParentheses(nextNode))
    }
  }
  // 普通函数
  else {
    result = displayReturnType
  }

  if (hasAsyncToken) {
    return createVariable(new PromiseType(result?.currentType))
  }

  return result
}
