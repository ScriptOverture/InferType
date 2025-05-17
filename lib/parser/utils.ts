import {
  type ForEachDescendantTraversalControl,
  Node,
  type SourceFile,
  SyntaxKind,
  ts,
} from 'ts-morph'
import type { FunctionNode } from '@@types/parser'

export type NodeVisitor = (
  node: Node<ts.Node>,
  traversal: ForEachDescendantTraversalControl,
) => void

type SyntaxVisitorMap = Partial<Record<SyntaxKind, NodeVisitor>>

export function traverseSyntaxTree(
  node: Node<ts.Node>,
  visitors: SyntaxVisitorMap,
) {
  if (Node.isBlock(node)) {
    node.forEachDescendant(parseChild)
  } else {
    /**
     * 对于非 Block 节点，先检查它本身是否有对应的解析器
     */
    const matchKind = Object.keys(visitors).find(
      (pKind) => node.getKind() === Number(pKind),
    )
    /**
     * 情况 A：当前节点类型在 visitors 中有对应的解析函数
     *
     *     此时“命中”解析器希望：
     *      1) 直接对当前节点执行一次 parseChild
     *      2) 停止对当前节点后代的进一步自动解析（traversal.stop()），
     *         以避免重复或不必要的二次解析
     *
     *     通过 forEachDescendant 的第二个参数 traversal，
     *     在 parseChild 内部可以调用 traversal.stop()
     *     来中断对其后代的自动遍历
     */
    if (matchKind) {
      node.forEachDescendant((_, traversal) => parseChild(node, traversal))
    } else {
      node.forEachDescendant(parseChild)
    }
  }

  function parseChild(
    child: Node<ts.Node>,
    traversal: ForEachDescendantTraversalControl,
  ) {
    const kind = child.getKind()
    const visitor = visitors[kind]
    if (visitor) {
      visitor(child, traversal)
    }
  }
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
