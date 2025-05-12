import {
  Expression,
  type ExpressionedNode,
  Node,
  ParameterDeclaration,
  PropertyAccessExpression,
  type SourceFile,
  SyntaxKind,
  ts,
} from 'ts-morph'
import type {
  FunctionParameters,
  ParameterItem,
  ParameterMap,
} from '../types/typeCompatibility.ts'
import { createVariable } from '../lib/variable.ts'
import { AnyType, ArrayType, ObjectType } from '../lib/NodeType.ts'
import type { Scope } from '../types/scope.ts'
import type { Variable } from '../types/variable.ts'
import type { FunctionNode } from '../types/parser.ts'
import type { Property } from '../types/parameters.ts'

// 获取函数所有参数
export function getFuncAllParametersType(
  params: ParameterDeclaration[],
): FunctionParameters {
  const parameterList: ParameterItem[] = Array(params.length)
  const paramsMap: ParameterMap = {}

  params.forEach((paramsItem, index) => {
    const paramName = paramsItem.getName()
    const paramNode = paramsItem.getNameNode()
    const currentItem: ParameterItem = {
      current: paramsItem,
      kind: paramNode.getKind(),
      paramsType: createVariable(),
    }

    if (Node.isIdentifier(paramNode)) {
      paramsMap[paramName] = currentItem.paramsType
      currentItem.paramName = paramName
    }
    // 参数解构
    else if (Node.isObjectBindingPattern(paramNode)) {
      const elements = paramNode.getElements()
      const paramObjs: ParameterMap = {}
      elements.forEach((item) => {
        const name = item.getText()
        paramObjs[name] = createVariable()
      })
      currentItem.paramsType.combine(new ObjectType(paramObjs))
    }
    // 剩余参数
    else if (Node.isParametered(paramNode)) {
      const originType = new ArrayType()
      currentItem.paramsType.combine(originType)
      paramsMap[paramName] = currentItem.paramsType
    }
    parameterList[index] = currentItem
  })

  return {
    parameterList,
    parameterMap: paramsMap,
  }
}

/**
 * 获取参选链路
 * ->input:  x.a1.a2.a3
 * ->output: [x,a1,a2,a3]
 * @param expr
 */
export function getPropertyAccessList(
  expr: PropertyAccessExpression,
): Property[] {
  const result: Property[] = []
  let next: Node = expr
  while (Node.isPropertyAccessExpression(next)) {
    result.unshift({
      name: next.getName(),
      questionDotToken: next.getQuestionDotTokenNode(),
    })
    next = getExpression(next)
  }
  if (Node.isIdentifier(next)) {
    result.unshift({
      name: next.getText(),
      questionDotToken: undefined,
    })
  }
  return result
}

// 根据参选链路，作用域遍历查询类型
export function getVariablePropertyValue(
  scope: Scope,
  propertyAccess: Property[],
): Variable | undefined {
  const { name: root } = propertyAccess[0]!
  const rootVariable = scope.find(root!)
  if (propertyAccess.length === 1) {
    return rootVariable
  }
  let index = 1,
    next = rootVariable!
  while (index < propertyAccess.length && next) {
    const { name: attrKey } = propertyAccess[index]!
    const current = next?.get(attrKey)
    if (!current) {
      /**
       * 未查询到属性类型，推导属性可选
       */
      const attrKeyType = createVariable(new AnyType(), {
        questionDot: true,
      })
      next.combine(
        createVariable(
          new ObjectType({
            [attrKey]: attrKeyType,
          }),
        ),
      )

      next = attrKeyType
    } else {
      next = current
    }
    index += 1
  }
  return next
}

// 获取表达式， 跳过空括号
export function getExpression(node: Node<ts.Node>) {
  return (
    unwrapParentheses(node) as unknown as ExpressionedNode
  ).getExpression()
}

// 获取括号内层节点
export function unwrapParentheses(node: Node): Expression {
  let current = node
  // 可能存在n个括号包裹表达式
  while (Node.isParenthesizedExpression(current)) {
    current = current.getExpression()
  }
  return current as Expression
}

export function getFunctionExpression(
  sourceFile: SourceFile,
  targetFuncName: string,
) {
  let iFunction: FunctionNode = sourceFile.getFunction(targetFuncName)!
  if (!iFunction) {
    // 获取变量声明（即函数表达式所在的位置）
    const variableDeclaration =
      sourceFile.getVariableDeclaration(targetFuncName)
    const initializer = variableDeclaration?.getInitializer()
    iFunction = variableDeclaration?.getInitializerIfKind(
      initializer?.getKind()! as SyntaxKind.FunctionExpression,
    )!
  }
  return iFunction
}
