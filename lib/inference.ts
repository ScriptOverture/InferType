import {
  type BinaryExpression,
  type ConditionalExpression,
  type ElementAccessExpression,
  Expression,
  Node,
  type ObjectLiteralExpression,
  SyntaxKind,
  Project,
  Statement,
  type ForEachDescendantTraversalControl,
  type IfStatement,
  type ArrayBindingPattern,
  type ObjectBindingPattern,
  type SpreadAssignment,
} from 'ts-morph'
import type { ObjectVariable, Variable } from '../types/variable.ts'
import { createVariable } from './variable.ts'
import {
  ArrayType,
  BooleanType,
  FunctionType,
  ObjectType,
  TupleType,
  UnionType,
  TypeMatch,
  UndefinedType,
} from './NodeType.ts'
import type { Scope } from '../types/scope.ts'
import { parseFunctionBody } from './parser.ts'
import { getIdentifierStr } from '../utils'
import {
  basicTypeToVariable,
  getBasicTypeToVariable,
  getVariableToBasicType,
  tsTypeToBasicType,
} from './typeCompatibility.ts'
import { createScope } from './scope.ts'
import {
  getExpression,
  getFunctionExpression,
  getPropertyAccessList,
  getVariablePropertyValue,
  unwrapParentheses,
} from '../utils/parameters.ts'

export function inferPropertyAssignmentType(
  scope: Scope,
  iType: Expression,
): Variable | undefined {
  if (!iType) return
  let result
  switch (iType.getKind()) {
    // 对象
    case SyntaxKind.ObjectLiteralExpression:
      result = inferObjectLiteralExpression(
        scope,
        iType.asKindOrThrow(SyntaxKind.ObjectLiteralExpression),
      )
      break
    // 变量
    case SyntaxKind.Identifier:
      result = scope.find(iType.getText())
      break
    // 属性 k: props.x.xx.xxx
    case SyntaxKind.PropertyAccessExpression:
      result = getVariablePropertyValue(
        scope,
        getPropertyAccessList(
          iType.asKindOrThrow(SyntaxKind.PropertyAccessExpression),
        ),
      )
      break
    // array
    case SyntaxKind.ArrayLiteralExpression: {
      const arrayNode = iType.asKindOrThrow(SyntaxKind.ArrayLiteralExpression)
      const arrayElements = arrayNode.getElements()

      // 收集每个位置的类型（保持顺序）
      const elementVars = arrayElements.map((elem) => {
        const v = inferPropertyAssignmentType(scope, elem)
        if (!v) throw new Error('无法推断元素类型')
        return v
      })
      const elementTypes = elementVars.map((v) => v.currentType!)

      // 判断是否所有元素类型都相同
      const firstType = elementTypes[0]
      const allSame = elementTypes.every(
        (t) => firstType?.constructor === t.constructor,
      )

      if (allSame) {
        // 同质数组：T[]
        const unionType = new UnionType([firstType!])
        result = createVariable(new ArrayType(unionType))
      } else {
        // 异构数组——元组
        // 直接用位置类型列表来构造 TupleType
        const tupleType = new TupleType(elementTypes)
        result = createVariable(tupleType)
      }
      break
    }
    // 箭头函数
    case SyntaxKind.ArrowFunction: {
      const functionNode = iType.asKindOrThrow(SyntaxKind.ArrowFunction)
      const inferFunctionResult = parseFunctionBody(functionNode, scope)
      const inferFunctionType = new FunctionType(
        inferFunctionResult.getParamsList(),
        inferFunctionResult.getReturnType(),
      )
      result = createVariable(inferFunctionType)
      break
    }
    // n元运算
    case SyntaxKind.ConditionalExpression: {
      const conditionalNode = iType.asKindOrThrow(
        SyntaxKind.ConditionalExpression,
      )
      result = inferConditionalExpressionType(scope, conditionalNode)
      break
    }
    // 连续赋值 x = b = c = 1;
    case SyntaxKind.BinaryExpression: {
      const binaryExpressionNode = iType.asKindOrThrow(
        SyntaxKind.BinaryExpression,
      )
      result = inferBinaryExpressionType(scope, binaryExpressionNode)
      break
    }
    // 括号包裹
    case SyntaxKind.ParenthesizedExpression:
      result = inferPropertyAssignmentType(scope, unwrapParentheses(iType))
      break
    // 元素访问 | list[index]
    case SyntaxKind.ElementAccessExpression:
      result = inferElementAccessExpression(
        scope,
        iType.asKindOrThrow(SyntaxKind.ElementAccessExpression),
      )
      break
    // 展开语法 ...obj
    case SyntaxKind.SpreadAssignment:
      result = inferSpreadAssignment(
        scope,
        iType.asKindOrThrow(SyntaxKind.SpreadAssignment),
      )
      break
    // 兜底推断类型
    default:
      result = basicTypeToVariable(iType)
      break
  }

  return result
}

// 推断展开语法
function inferSpreadAssignment(
  scope: Scope,
  node: SpreadAssignment,
): Variable | undefined {
  return inferPropertyAssignmentType(scope, getExpression(node))
}

// 推导对象类型
function inferObjectLiteralExpression(
  scope: Scope,
  node: ObjectLiteralExpression,
): Variable {
  const newObjVariableType = new ObjectType()
  for (const propertyNode of node.getProperties()) {
    // 展开语法
    if (Node.isSpreadAssignment(propertyNode)) {
      const spreadAssignmentVariable = inferSpreadAssignment(
        scope,
        propertyNode,
      )
      if (spreadAssignmentVariable) {
        newObjVariableType.combine(
          getVariableToBasicType(spreadAssignmentVariable.shallowCopy()),
        )
      }
    } else {
      const property = propertyNode?.asKindOrThrow(
        SyntaxKind.PropertyAssignment,
      )!
      const propertyName = property.getName()
      const initializer = property.getInitializer()
      newObjVariableType.combine(
        new ObjectType({
          [propertyName]: inferPropertyAssignmentType(scope, initializer!)!,
        }),
      )
    }
  }
  return createVariable(newObjVariableType)
}

// 推导三元运算，获取 whenTrue 和 whenFalse 的联合类型
function inferConditionalExpressionType(
  scope: Scope,
  node: ConditionalExpression,
): Variable {
  const whenTrueNode = node.getWhenTrue(),
    whenFalseNode = node.getWhenFalse()
  const whenTrueVariable = inferPropertyAssignmentType(
    scope,
    unwrapParentheses(whenTrueNode),
  )!
  const whenFalseVariable = inferPropertyAssignmentType(
    scope,
    unwrapParentheses(whenFalseNode),
  )!

  return createVariable(new UnionType([whenTrueVariable, whenFalseVariable]))
}

//  推断操作符类型
function inferBinaryExpressionType(
  scope: Scope,
  node: BinaryExpression,
): Variable | undefined {
  const leftToken = node.getLeft()
  const rightToken = node.getRight()
  const operatorToken = node.getOperatorToken()

  switch (operatorToken.getKind()) {
    case SyntaxKind.EqualsEqualsEqualsToken: // ===
    case SyntaxKind.EqualsEqualsToken: {
      // ==
      assignment(scope, leftToken, rightToken)
      return createVariable(new BooleanType())
    }
    case SyntaxKind.EqualsToken: // =
      return assignment(scope, leftToken, rightToken)
    case SyntaxKind.BarBarToken: {
      // ||
      const v = createVariable()
      v.combine(inferPropertyAssignmentType(scope, leftToken)!)
      v.combine(inferPropertyAssignmentType(scope, rightToken)!)
      return v
    }
    case SyntaxKind.PlusToken: // +
    case SyntaxKind.MinusToken: // -
    case SyntaxKind.AsteriskToken: // *
    case SyntaxKind.SlashToken: // /
    case SyntaxKind.AsteriskAsteriskToken: {
      // **
      /**
       * 使用默认推导类型
       */
      const defaultType = node.getType()
      return createVariable(tsTypeToBasicType(defaultType))
    }
  }
}

// 推断连续赋值情况类型
function assignment(
  scope: Scope,
  leftToken: Expression,
  rightToken: Expression,
): Variable {
  let leftVariable = inferPropertyAssignmentType(scope, leftToken)
  // 未匹配则创建作用域变量
  if (!leftVariable) {
    leftVariable = scope.createLocalVariable(leftToken.getText())
  }

  /**
   * resultType 为最右侧原始类型
   */
  let resultType
  if (Node.isBinaryExpression(rightToken)) {
    resultType = inferBinaryExpressionType(scope, rightToken)!
    leftVariable.combine(resultType)
  } else {
    resultType = inferPropertyAssignmentType(scope, rightToken)!
    leftVariable.combine(resultType)
  }

  return resultType!
}

/**
 * 推断原始数组及索引类型
 * @param scope
 * @param node
 */
function inferElementAccessExpression(
  scope: Scope,
  node: ElementAccessExpression,
): Variable | undefined {
  const targetExpressionToken = getExpression(node)
  const expressionVariable = inferPropertyAssignmentType(
    scope,
    targetExpressionToken,
  )
  if (!expressionVariable) return
  const expressionType = expressionVariable.currentType!
  let result
  // 数组类型
  if (TypeMatch.isArrayType(expressionType)) {
    result = getBasicTypeToVariable(expressionType.elementType)
  }
  // 元组类型
  else if (TypeMatch.isTupleType(expressionType)) {
    const argExprNode = node.getArgumentExpression()!
    /**
     * 动态索引
     */
    let resultVariable
    if (Node.isIdentifier(argExprNode)) {
      result = createVariable(
        new UnionType(expressionType.elementsType.map(getVariableToBasicType)),
      )
    } else {
      const expressionTokenIndex = argExprNode.getText()!
      resultVariable = expressionType.getIndexType(expressionTokenIndex)
    }

    if (resultVariable) {
      result = getBasicTypeToVariable(resultVariable)
    }
  }
  // 对象索引类型
  else if (TypeMatch.isObjectType(expressionType)) {
    const argExprNode = node.getArgumentExpression()!
    /**
     * 动态索引
     */
    let expressionTokenKey
    if (Node.isIdentifier(argExprNode)) {
      expressionTokenKey = getIdentifierStr(argExprNode.getType().getText())
    } else {
      expressionTokenKey = getIdentifierStr(argExprNode.getText()!)
    }

    result = getBasicTypeToVariable(expressionType.get(expressionTokenKey)!)
  }

  return result
}

// 推断if
export function inferIfStatement(scope: Scope, node: IfStatement): Variable {
  const exprNode = getExpression(node)
  const thenStatementNode = node.getThenStatement()
  const elseStatementNode = node.getElseStatement()

  /**
   * 推断if条件判断类型
   */
  inferPropertyAssignmentType(scope, exprNode)

  // 处理 then 和 else 分支的返回类型
  const left = dfsIfStatementReturnNode(scope, thenStatementNode)
  const right = elseStatementNode
    ? dfsIfStatementReturnNode(scope, elseStatementNode)
    : new UndefinedType() // 无 else 分支时添加 undefined

  const result = createVariable()
  result.combine(left)
  result.combine(right)
  return result
}

/**
 * 深度遍历解析 if else
 * @param scope
 * @param node
 */
function dfsIfStatementReturnNode(scope: Scope, node: Statement): Variable {
  const result = createVariable()
  if (!node) return result // 处理空节点的情况

  // 处理块语句（Block）
  if (Node.isBlock(node)) {
    let hasAllPathsReturned = false
    const allStatements = node.getStatements()
    const firstReturn = allStatements.find(Node.isReturnStatement)!
    if (firstReturn) {
      const ifType = inferPropertyAssignmentType(
        scope,
        getExpression(firstReturn),
      )
      if (ifType) {
        result.combine(ifType)
        hasAllPathsReturned = true
      } else {
        hasAllPathsReturned = false
      }
    }

    for (const stmt of allStatements) {
      if (Node.isIfStatement(stmt)) {
        // 递归处理 if 语句，并合并其返回类型
        const ifType = inferIfStatement(scope, stmt)
        result.combine(ifType)
        if (!(ifType.currentType instanceof UndefinedType)) {
          hasAllPathsReturned = true
        }
      }
    }

    // 若存在未覆盖的路径，添加 undefined
    if (!hasAllPathsReturned) {
      result.combine(new UndefinedType())
    }
  }
  // 处理单个 if 语句
  else if (Node.isIfStatement(node)) {
    result.combine(inferIfStatement(scope, node))
  }
  // 处理单个 return 语句
  else if (Node.isReturnStatement(node)) {
    result.combine(inferPropertyAssignmentType(scope, getExpression(node))!)
  }

  return result
}

// 推断类型
export function inferenceType(
  scope: Scope,
  iType: Expression,
  traversal?: ForEachDescendantTraversalControl,
): Variable | undefined {
  /**
   * 推断类型时，当前解析跳过其所有子节点
   */
  traversal?.skip()
  try {
    return inferPropertyAssignmentType(scope, iType)
  } catch (err) {
    console.error('Parse error:', err)
  }
}

/**
 * 推断解构数组
 * @param scope
 * @param node
 * @param initializerVariable
 * @param traversal
 */
export function inferArrayBindingPattern(
  scope: Scope,
  node: ArrayBindingPattern,
  initializerVariable: Variable,
  traversal: ForEachDescendantTraversalControl,
) {
  if (!TypeMatch.isTupleType(initializerVariable.currentType!)) return
  const targetTuple = initializerVariable.currentType
  node.getElements().forEach((elem, index) => {
    if (Node.isOmittedExpression(elem)) return
    const originName = elem.getName()
    // 默认值
    const initializer = elem.getInitializer()
    let targetType = targetTuple.getIndexType(index)!

    if (!targetType) {
      // 默认值
      if (initializer) {
        targetType = inferenceType(scope, initializer, traversal)!
      } else {
        targetType = createVariable()
      }
    }

    // 非别名， 更新右侧标识的同时还会更新词法环境
    scope.creatDestructured(initializerVariable, {
      [originName]: getBasicTypeToVariable(targetType),
    })
  })
}

/**
 * 推断解构对象
 * @param scope
 * @param node
 * @param initializerVariable
 * @param traversal
 */
export function inferObjectBindingPatternType(
  scope: Scope,
  node: ObjectBindingPattern,
  initializerVariable: Variable,
  traversal: ForEachDescendantTraversalControl,
) {
  const objElements = node.getElements()
  // 已展示的对象参数
  const displayedKeys: string[] = []
  objElements.forEach((elem) => {
    // x: a => x | x => x
    const originName = elem.getName()

    // 消费的别名
    const propName = elem.getPropertyNameNode()?.getText()
    // 默认值
    const initializer = elem.getInitializer()
    // 解构剩余参数
    if (elem.getDotDotDotToken()) {
      const rhsType = initializerVariable.currentType!
      if (TypeMatch.isObjectType(rhsType)) {
        const othersType = Object.keys(
          rhsType.properties,
        ).reduce<ObjectVariable>((otherType, item) => {
          if (!displayedKeys.includes(item)) {
            otherType[item] = getBasicTypeToVariable(rhsType.properties[item]!)
          }
          return otherType
        }, {})
        scope.createLocalVariable(originName, new ObjectType(othersType))
      }

      return
    } else {
      displayedKeys.push(originName)
    }

    // let attrType: Variable;
    let attrType = initializerVariable.get(originName)
    let hasQueryVariable = false

    if (!attrType) {
      // 默认值
      if (initializer) {
        attrType = inferenceType(scope, initializer, traversal)!
      } else {
        attrType = createVariable()
      }
    } else {
      hasQueryVariable = true
    }

    // 別名
    if (propName) {
      // 没找到类型更新右侧标识
      if (!hasQueryVariable) {
        initializerVariable.combine(attrType)
      }
      // 创建词法变量
      scope.createLocalVariable(propName, attrType)
    } else {
      // 非别名， 更新右侧标识的同时还会更新词法环境
      scope.creatDestructured(initializerVariable, {
        [originName]: attrType,
      })
    }
  })
}

/**
 * 推断函数类型
 * @param sourceStr
 * @param targetFuncName
 */
export function inferFunctionType(sourceStr: string, targetFuncName: string) {
  const project = new Project()
  const sourceFile = project.createSourceFile('temp.ts', sourceStr)
  const GlobalScope = createScope()
  return parseFunctionBody(
    getFunctionExpression(sourceFile, targetFuncName),
    GlobalScope,
  )
}
