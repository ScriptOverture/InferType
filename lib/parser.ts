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
import { AnyType } from './NodeType.ts'
import { useGetReturnStatementType } from '../hooks'

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
    hasAsyncToken: iFunction.getModifiers().at(0),
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
  const { params, body, returnStatement, hasAsyncToken } =
    getFunctionRecord(funNode)
  const scope = createScope(params, {}, scopePrototype)
  const returnVariableRecords = useGetReturnStatementType(createVariable())
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
      case SyntaxKind.SwitchStatement:
        toSwitchStatement(node)
        break
    }
  })

  return {
    getParamsType: () => scope.paramsMap,
    getReturnType: () =>
      returnVariableRecords.getFunctionReturnType(
        funNode,
        scope,
        !!hasAsyncToken,
      ),
    getParamsList: () => scope.getParamsList(),
    getLocalVariables: () => scope.getLocalVariables(),
  }

  function toVariableDeclaration(
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
    node: Node<ts.Node>,
    traversal: ForEachDescendantTraversalControl,
  ) {
    const binExp = node.asKindOrThrow(SyntaxKind.BinaryExpression)
    inferenceType(scope, binExp, traversal)
  }

  function toIfStatement(node: Node<ts.Node>) {
    if (bodyCacheRecord.current?.firstParseIfStatement) {
      const allReturn = inferIfStatement(
        scope,
        node.asKindOrThrow(SyntaxKind.IfStatement),
      )
      // 有问题哦
      returnVariableRecords.dispatchReturnType(allReturn, true)
      setBodyCacheRecord((el) => ({ ...el, firstParseIfStatement: false }))
    }
  }

  function toCallExpression() {}

  function toSwitchStatement(node: Node<ts.Node>) {
    const switchStatement = node.asKindOrThrow(SyntaxKind.SwitchStatement)
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

  function toReturnStatement(
    node: Node<ts.Node>,
    traversal: ForEachDescendantTraversalControl,
  ) {
    const returnNode = node.asKindOrThrow(SyntaxKind.ReturnStatement)
    // 是当前函数的返回语句
    if (returnStatement === returnNode) {
      const expression = getExpression(returnNode)
      returnVariableRecords.dispatchReturnType(
        inferenceType(scope, expression, traversal)!,
        true,
      )
    }
  }
}
