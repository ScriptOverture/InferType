import {
  Node,
  SyntaxKind,
  ts,
  type ForEachDescendantTraversalControl,
} from 'ts-morph'
import { createRef } from '../utils'
import { createScope } from './scope.ts'
import { createVariable } from './variable.ts'
import {
  inferArrayBindingPattern,
  inferenceType,
  inferObjectBindingPatternType,
  inferIfStatement,
  inferPropertyAssignmentType,
} from './inference.ts'
import type {
  FunctionNode,
  ParseFunctionBodyResult,
  FunctionRecord,
} from '../types/parser.ts'
import type { Scope } from '../types/scope.ts'
import type { Variable } from '../types/variable.ts'
import { getExpression, unwrapParentheses } from '../utils/parameters.ts'

// 获取函数信息
function getFunctionRecord(iFunction: FunctionNode): FunctionRecord {
  return {
    body: iFunction!.getBody(),
    params: iFunction?.getParameters()!,
    returnStatement: iFunction
      ?.getBody()
      ?.asKind(SyntaxKind.Block)
      ?.getStatement((node) => node.getKind() === SyntaxKind.ReturnStatement),
    propertyAccesses: iFunction?.getDescendantsOfKind(
      SyntaxKind.PropertyAccessExpression,
    ),
  }
}

/**
 * 解析函数
 * @param funNode
 * @param scopePrototype
 */
export function parseFunctionBody(
  funNode: FunctionNode,
  scopePrototype?: Scope,
): ParseFunctionBodyResult {
  const { params, body, returnStatement } = getFunctionRecord(funNode)
  const scope = createScope(params, {}, scopePrototype)
  const [returnStatementType, setReturnStatementType] =
    createRef<Variable>(createVariable())
  const [bodyCacheRecord, setBodyCacheRecord] = createRef({
    firstParseIfStatement: true,
  })

  body?.forEachDescendant((node, traversal) => {
    switch (node.getKind()) {
      // 变量申明
      case SyntaxKind.VariableDeclaration:
        toVariableDeclaration(node, traversal)
        break
      case SyntaxKind.BinaryExpression:
        toBinaryExpression(node, traversal)
        break
      case SyntaxKind.CallExpression:
        toCallExpression()
        break
      case SyntaxKind.ReturnStatement:
        toReturnStatement(node, traversal)
        break
      case SyntaxKind.IfStatement:
        toIfStatement(node)
        break
    }
  })

  return {
    getParamsType: () => scope.paramsMap,
    getReturnType: getFunctionReturnType,
    getParamsList: () => scope.getParamsList(),
    getLocalVariables: () => scope.getLocalVariables(),
  }

  function toVariableDeclaration(
    node: Node<ts.Node>,
    traversal: ForEachDescendantTraversalControl,
  ) {
    const varDecl = node.asKindOrThrow(SyntaxKind.VariableDeclaration)
    const nameNode = varDecl.getNameNode()

    switch (nameNode.getKind()) {
      // 对象解构：例如 const { name, data } = props;
      case SyntaxKind.ObjectBindingPattern: {
        const bindingPattern = nameNode.asKindOrThrow(
          SyntaxKind.ObjectBindingPattern,
        )
        const initializer = varDecl.getInitializerOrThrow()
        inferObjectBindingPatternType(
          scope,
          bindingPattern,
          inferenceType(scope, initializer, traversal)!,
          traversal,
        )
        break
      }
      // 数组解构
      case SyntaxKind.ArrayBindingPattern: {
        const bindingPattern = nameNode.asKindOrThrow(
          SyntaxKind.ArrayBindingPattern,
        )
        const initializer = varDecl.getInitializerOrThrow()
        inferArrayBindingPattern(
          scope,
          bindingPattern,
          inferenceType(scope, initializer, traversal)!,
          traversal,
        )
        break
      }
      // 简单别名赋值：例如 const copyProps = props;
      case SyntaxKind.Identifier: {
        const initializer = varDecl.getInitializer()
        const newType = createVariable()
        scope.createLocalVariable(nameNode.getText(), newType)
        if (!initializer) return
        const rhsType = inferenceType(scope, initializer, traversal)
        if (rhsType) {
          // 循环引用
          newType.combine(rhsType)
        }

        break
      }
    }
  }

  function toBinaryExpression(
    node: Node<ts.Node>,
    traversal: ForEachDescendantTraversalControl,
  ) {
    const binExp = node.asKindOrThrow(SyntaxKind.BinaryExpression)
    if (binExp.getOperatorToken().getKind() === SyntaxKind.EqualsToken) {
      const leftType = inferenceType(scope, binExp.getLeft(), traversal)!
      const rightType = inferenceType(scope, binExp.getRight(), traversal)
      leftType.combine(rightType!)
    }
  }

  function toIfStatement(node: Node<ts.Node>) {
    if (bodyCacheRecord.current?.firstParseIfStatement) {
      const allReturn = inferIfStatement(
        scope,
        node.asKindOrThrow(SyntaxKind.IfStatement),
      )
      setReturnStatementType((prev) => prev.combine(allReturn))
      setBodyCacheRecord((el) => ({ ...el, firstParseIfStatement: false }))
    }
  }

  function toCallExpression() {
    // const callExpression = node.asKindOrThrow(SyntaxKind.CallExpression)
    // const expression = getExpression(callExpression)
    // const propertyAccessExpression = expression.asKindOrThrow(
    //   SyntaxKind.PropertyAccessExpression,
    // )
    // const methodName = propertyAccessExpression.getName()
    // switch (methodName) {
    //   case 'map':
    //   case 'forEach':
    //     const firstArrowFunction = callExpression
    //       .getArguments()
    //       .at(0)
    //       ?.asKindOrThrow(SyntaxKind.ArrowFunction)
    //     if (firstArrowFunction) {
    //       const firstParamName = firstArrowFunction
    //         .getParameters()[0]
    //         ?.getName()
    //       const funParamsType = parseFunctionBody(
    //         firstArrowFunction,
    //         scope,
    //       )?.getParamsType()
    //       const arrowFunctionPropsType = funParamsType[firstParamName!]
    //
    //       getVariablePropertyValue(
    //         scope,
    //         getPropertyAccessList(getExpression(expression)),
    //       )?.combine(
    //         createVariable(new ArrayType(arrowFunctionPropsType?.currentType)),
    //       )
    //     }
    //     break
    // }
  }

  function toReturnStatement(
    node: Node<ts.Node>,
    traversal: ForEachDescendantTraversalControl,
  ) {
    const returnNode = node.asKindOrThrow(SyntaxKind.ReturnStatement)
    // 是当前函数的返回语句
    if (returnStatement === returnNode) {
      const expression = getExpression(returnNode)
      setReturnStatementType((prev) =>
        prev.combine(inferenceType(scope, expression, traversal)!),
      )
    }
  }

  function getFunctionReturnType() {
    // 箭头函数
    if (Node.isArrowFunction(funNode)) {
      const eqGtToken = funNode.getEqualsGreaterThan()
      const nextNode = eqGtToken.getNextSibling()!
      // 函数显示返回类型
      if (Node.isBlock(nextNode)) {
        return returnStatementType.current
      }

      return inferPropertyAssignmentType(scope, unwrapParentheses(nextNode))
    }
    // 普通函数
    else {
      return returnStatementType.current
    }
  }
}
