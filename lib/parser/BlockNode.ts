import {
  Node,
  SyntaxKind,
  ts,
  type ForEachDescendantTraversalControl,
} from 'ts-morph'
import { createVariable } from '@/variable.ts'
import {
  inferArrayBindingPattern,
  inferenceType,
  inferObjectBindingPatternType,
  inferIfStatement,
  inferPropertyAssignmentType,
  inferVariableDeclareType,
  inferCaseBlock,
} from '../inference.ts'
import type { Scope } from '@@types/scope'
import { getExpression } from '@utils/parameters.ts'
import { AnyType, UndefinedType } from '../NodeType.ts'
import { useGetReturnStatementType } from './hooks'
import type { ParseBlockResult } from '@@types/parser'
import { traverseSyntaxTree } from './utils.ts'
import type { ScopeReturnAnalysis } from '@@types/inference.ts'

type ParseScopeStatementFunc = (
  scope: Scope,
  node: Node<ts.Node>,
  traversal: ForEachDescendantTraversalControl,
) => ScopeReturnAnalysis | undefined

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

  if (blockNode) {
    traverseSyntaxTree(blockNode, {
      [SyntaxKind.VariableDeclaration]: toVariableDeclaration.bind(null, scope),
      [SyntaxKind.BinaryExpression]: toBinaryExpression.bind(null, scope),
      [SyntaxKind.ReturnStatement]: matchStatementReturnAnalysis.bind(
        null,
        toReturnStatement,
      ),
      [SyntaxKind.IfStatement]: matchStatementReturnAnalysis.bind(
        null,
        toIfStatement,
      ),
      [SyntaxKind.SwitchStatement]: matchStatementReturnAnalysis.bind(
        null,
        toSwitchStatement,
      ),
    })
  }

  return {
    getBlockReturnVariable: () => returnVariableRecords.getBlockReturnType()!,
    isAllReturnsReadyState: returnVariableRecords.isAllReturnsReadyState,
  }

  function matchStatementReturnAnalysis(
    cb: ParseScopeStatementFunc,
    node: Node<ts.Node>,
    traversal: ForEachDescendantTraversalControl,
  ) {
    const scopeReturnAnalysis = cb(scope, node, traversal)
    if (scopeReturnAnalysis) {
      returnVariableRecords.dispatchReturnType(
        scopeReturnAnalysis.returnTypeVariable,
        scopeReturnAnalysis.returnIsAllMatch,
      )
    }
  }
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
        newType.combine(rhsType, true)
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
): ScopeReturnAnalysis {
  traversal?.skip()
  return inferIfStatement(scope, node.asKindOrThrow(SyntaxKind.IfStatement))
}

function toSwitchStatement(
  scope: Scope,
  node: Node<ts.Node>,
  traversal: ForEachDescendantTraversalControl,
): ScopeReturnAnalysis {
  const switchStatement = node.asKindOrThrow(SyntaxKind.SwitchStatement)
  traversal?.skip()
  // switch 判断语句
  const expressionVariable = inferPropertyAssignmentType(
    scope,
    getExpression(switchStatement),
  )

  const { caseTypeVariable, ...scopeReturnAnalysis } = inferCaseBlock(
    scope,
    switchStatement.getCaseBlock(),
  )
  expressionVariable?.combine(caseTypeVariable)
  return scopeReturnAnalysis
}

// 同一个块只有一个 return 生效
function toReturnStatement(
  scope: Scope,
  node: Node<ts.Node>,
  traversal: ForEachDescendantTraversalControl,
): ScopeReturnAnalysis | undefined {
  const returnNode = node.asKindOrThrow(SyntaxKind.ReturnStatement)
  const returnVariable = inferenceType(
    scope,
    getExpression(returnNode),
    traversal,
  )
  if (returnVariable) {
    return {
      returnIsAllMatch: true,
      returnTypeVariable: returnVariable,
    }
  }
}
