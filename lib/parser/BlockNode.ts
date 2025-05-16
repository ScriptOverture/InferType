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
