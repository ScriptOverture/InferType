import {
  type ForEachDescendantTraversalControl,
  Node,
  type SourceFile,
  SyntaxKind,
  ts,
} from 'ts-morph'
import type { FunctionNode } from '@@types/parser'

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
 * 获取函数表达式
 * @param sourceFile
 * @param targetFuncName
 */
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
