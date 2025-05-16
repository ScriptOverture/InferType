import {
  Node,
  SyntaxKind,
  ts,
  type ForEachDescendantTraversalControl,
} from 'ts-morph'
import { createScope } from './scope.ts'
import { createVariable } from './variable.ts'
import {
  inferArrayBindingPattern,
  inferenceType,
  inferObjectBindingPatternType,
  inferIfStatement,
  inferPropertyAssignmentType,
  inferVariableDeclareType,
  inferCaseBlock,
} from './inference.ts'
import type {
  FunctionNode,
  ParseFunctionBodyResult,
  FunctionRecord,
} from '../types/parser.ts'
import type { Scope } from '../types/scope.ts'
import { getExpression } from '../utils/parameters.ts'
import { AnyType, UndefinedType } from './NodeType.ts'
import { getFunctionReturnType, useGetReturnStatementType } from '../hooks'
import type { Variable } from '../types/variable.ts'

// 获取函数信息
function getFunctionRecord(iFunction: FunctionNode): FunctionRecord {
  return {
    body: iFunction.getBody(),
    params: iFunction.getParameters(),
    returnStatement: iFunction
      ?.getBody()
      ?.asKind(SyntaxKind.Block)
      ?.getStatement(Node.isReturnStatement),
    propertyAccesses: iFunction.getDescendantsOfKind(
      SyntaxKind.PropertyAccessExpression,
    ),
    hasAsyncToken: iFunction.getModifiers().at(0),
  }
}

type NodeVisitor = (
  node: Node<ts.Node>,
  traversal: ForEachDescendantTraversalControl,
) => void

type SyntaxVisitorMap = Partial<Record<SyntaxKind, NodeVisitor>>

export function traverseSyntaxTree(
  node: Node<ts.Node>,
  visitors: SyntaxVisitorMap,
) {
  node.forEachDescendant((child, traversal) => {
    const kind = child.getKind()
    const visitor = visitors[kind]
    if (visitor) {
      visitor(child, traversal)
    }
  })
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

type ParseBlockResult = {
  getBlockReturnVariable: () => Variable
  isAllReturnsReadyState: () => boolean
}

/**
 * 解析块级作用域
 * @param scope
 * @param blockNode
 */
export function parseBlockNode(
  scope: Scope,
  blockNode: Node<ts.Node>,
): ParseBlockResult {
  const defaultReturnVariable = createVariable(new UndefinedType())
  const returnVariableRecords = useGetReturnStatementType(defaultReturnVariable)
  function createVisitors(scope: Scope) {
    return {
      [SyntaxKind.VariableDeclaration]: toVariableDeclaration.bind(null, scope),
      [SyntaxKind.BinaryExpression]: toBinaryExpression.bind(null, scope),
      // [SyntaxKind.CallExpression]: toCallExpression.bind(null, scope),
      [SyntaxKind.ReturnStatement]: toReturnStatement.bind(null, scope),
      [SyntaxKind.IfStatement]: toIfStatement.bind(null, scope),
      [SyntaxKind.SwitchStatement]: toSwitchStatement.bind(null, scope),
    }
  }

  if (blockNode) {
    traverseSyntaxTree(blockNode, createVisitors(scope))
  }

  return {
    getBlockReturnVariable: () => returnVariableRecords.getBlockReturnType()!,
    // getFunctionReturnType: returnVariableRecords.getFunctionReturnType,
    isAllReturnsReadyState: returnVariableRecords.isAllReturnsReadyState,
  }

  function toVariableDeclaration(
    scope: Scope,
    node: Node<ts.Node>,
    traversal: ForEachDescendantTraversalControl,
  ) {
    const varDecl = node.asKindOrThrow(SyntaxKind.VariableDeclaration)
    const nameNode = varDecl.getNameNode()
    const varDeclKind = inferVariableDeclareType(varDecl)
    const initializer = varDecl.getInitializer()!

    switch (nameNode.getKind()) {
      // 对象解构：例如 const { name, data } = props;
      case SyntaxKind.ObjectBindingPattern: {
        const bindingPattern = nameNode.asKindOrThrow(
          SyntaxKind.ObjectBindingPattern,
        )
        inferObjectBindingPatternType(
          scope,
          bindingPattern,
          inferenceType(scope, initializer, traversal)!,
          traversal,
          varDeclKind,
        )
        break
      }
      // 数组解构
      case SyntaxKind.ArrayBindingPattern: {
        const bindingPattern = nameNode.asKindOrThrow(
          SyntaxKind.ArrayBindingPattern,
        )
        inferArrayBindingPattern(
          scope,
          bindingPattern,
          inferenceType(scope, initializer, traversal)!,
          traversal,
          varDeclKind,
        )
        break
      }
      // 简单别名赋值：例如 const copyProps = props;
      case SyntaxKind.Identifier: {
        const newType = createVariable(new AnyType(), {
          declarationKind: varDeclKind,
        })
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
  // 值修改 n = 1 | a.b.c = 2
  function toBinaryExpression(
    scope: Scope,
    node: Node<ts.Node>,
    traversal: ForEachDescendantTraversalControl,
  ) {
    const binExp = node.asKindOrThrow(SyntaxKind.BinaryExpression)
    inferenceType(scope, binExp, traversal)
  }

  function toIfStatement(
    scope: Scope,
    node: Node<ts.Node>,
    traversal: ForEachDescendantTraversalControl,
  ) {
    traversal?.skip()
    const { returnTypeVariable, returnIsAllMatch } = inferIfStatement(
      scope,
      node.asKindOrThrow(SyntaxKind.IfStatement),
    )
    returnVariableRecords.dispatchReturnType(
      returnTypeVariable,
      returnIsAllMatch,
    )
  }

  function toSwitchStatement(
    scope: Scope,
    node: Node<ts.Node>,
    traversal: ForEachDescendantTraversalControl,
  ) {
    const switchStatement = node.asKindOrThrow(SyntaxKind.SwitchStatement)
    traversal?.skip()
    // switch 判断语句
    const expressionVariable = inferPropertyAssignmentType(
      scope,
      getExpression(switchStatement),
    )

    const { caseTypeVariable, caseReturnTypeVariable, returnIsAllMatch } =
      inferCaseBlock(scope, switchStatement.getCaseBlock())
    expressionVariable?.combine(caseTypeVariable)
    returnVariableRecords.dispatchReturnType(
      caseReturnTypeVariable,
      returnIsAllMatch,
    )
  }

  // 同一个块只有一个 return 生效
  function toReturnStatement(
    scope: Scope,
    node: Node<ts.Node>,
    traversal: ForEachDescendantTraversalControl,
  ) {
    const returnNode = node.asKindOrThrow(SyntaxKind.ReturnStatement)
    const returnVariable = inferenceType(
      scope,
      getExpression(returnNode),
      traversal,
    )
    if (returnVariable) {
      returnVariableRecords.dispatchReturnType(returnVariable, true)
    }
  }
}
