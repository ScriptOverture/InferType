import { type Node, type ts, SyntaxKind, type Type } from 'ts-morph'
import { ArrayType, BasicType, FunctionType, ObjectType } from '@/NodeType.ts'
import {
  convertBasicAstNodeToBasicType,
  mergeBasicTypeList,
} from '@/compatibility.ts'
import { getFuncAllParametersType } from '@utils/parameters.ts'
import { createVariable } from '@/variable.ts'

export const GlobalTypeMap = new WeakMap<Node<ts.Node>, BasicType>()

export const parseType = (targetType: Node<ts.Node>): BasicType => {
  // if (GlobalTypeMap.has(targetType)) return GlobalTypeMap.get(targetType)!;
  const kind = targetType.getKind()
  let result
  switch (kind) {
    /**
     * Type 右侧类型
     */
    case SyntaxKind.TypeLiteral:
    /**
     * interface 申明
     */
    case SyntaxKind.InterfaceDeclaration:
    /**
     * class 类型声明
     */
    case SyntaxKind.ClassDeclaration: {
      const node = targetType.asKindOrThrow(kind)
      const memberBasicTypes = node.getMembers().map(parseType)
      result = mergeBasicTypeList(memberBasicTypes)
      break
    }
    /**
     * Type 申明
     */
    case SyntaxKind.TypeAliasDeclaration: {
      const node = targetType.asKindOrThrow(SyntaxKind.TypeAliasDeclaration)
      const tType = node.getTypeNode()
      result = parseType(tType!)
      break
    }
    /**
     * class 内部属性申明
     */
    case SyntaxKind.PropertyDeclaration:
    /**
     * interface 内部属性对象
     */
    case SyntaxKind.PropertySignature: {
      const node = targetType.asKindOrThrow(kind)
      const hasQuestionToken = node.getQuestionTokenNode()
      const originExpression = node.getInitializer() || node.getTypeNode()!;
      result = new ObjectType({
        [node.getName()]: createVariable(parseType(originExpression), {
          questionDot: !!hasQuestionToken,
        }),
      })
      break
    }
    case SyntaxKind.ArrayType: {
      const node = targetType.asKindOrThrow(SyntaxKind.ArrayType)
      result = new ArrayType(parseType(node.getElementTypeNode()))
      break
    }
    case SyntaxKind.FunctionType: {
      const node = targetType.asKindOrThrow(SyntaxKind.FunctionType)
      result = new FunctionType(
        getFuncAllParametersType(node.getParameters()).parameterList,
        parseType(node.getReturnTypeNode()!),
      )
      break
    }
    // 兜底推断类型
    default:
      result = convertBasicAstNodeToBasicType(targetType)
      break
  }

  return result
}


/**
 * 推断显示标注类型
 * @param annotationType
 */
export function getInferredAnnotation(annotationType: Type<ts.Type>) {
  const aliasSymbol = annotationType.getAliasSymbol()
  const symbol = aliasSymbol ?? annotationType.getSymbol()
  const declarations = symbol?.getDeclarations();
  if (declarations) {
    const variable = createVariable()
    symbol?.getDeclarations()?.forEach((declNode) => {
      variable.combine(parseType(declNode))
    })

    return variable
  }
}
