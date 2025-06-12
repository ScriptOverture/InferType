import { type ts, type Node } from 'ts-morph'
import { SyntaxKind } from 'ts-morph'
import {
  AnyType,
  ArrayType,
  BasicType,
  FunctionType,
  ObjectType,
} from '@/NodeType.ts'
import { convertBasicAstNodeToBasicType } from '@/compatibility.ts'
import { getFuncAllParametersType } from '@utils/parameters.ts'

export const GlobalTypeMap = new WeakMap<Node<ts.Node>, BasicType>()

export const parseType = (targetType: Node<ts.Node>): BasicType => {
  // if (GlobalTypeMap.has(targetType)) return GlobalTypeMap.get(targetType)!;
  switch (targetType.getKind()) {
    /**
     * Type 右侧类型
     */
    case SyntaxKind.TypeLiteral: {
      const node = targetType.asKindOrThrow(SyntaxKind.TypeLiteral)
      const members = node.getMembers()
      let newType: BasicType = new AnyType()
      members.forEach((item) => {
        newType = newType.combine(parseType(item))
      })
      GlobalTypeMap.set(targetType, newType)
      return newType
    }
    /**
     * Type 申明
     */
    case SyntaxKind.TypeAliasDeclaration: {
      const node = targetType.asKindOrThrow(SyntaxKind.TypeAliasDeclaration)
      // const name: Identifier = node.getName()
      const tType = node.getTypeNode()
      return parseType(tType!)
    }
    case SyntaxKind.PropertySignature: {
      const node = targetType.asKindOrThrow(SyntaxKind.PropertySignature)
      return new ObjectType({
        [node.getName()]: parseType(node.getTypeNode()!),
      })
    }
    case SyntaxKind.ArrayType: {
      const node = targetType.asKindOrThrow(SyntaxKind.ArrayType)
      return new ArrayType(parseType(node.getElementTypeNode()))
    }
    case SyntaxKind.FunctionType: {
      const node = targetType.asKindOrThrow(SyntaxKind.FunctionType)
      return new FunctionType(
        getFuncAllParametersType(node.getParameters()).parameterList,
        parseType(node.getReturnTypeNode()!),
      )
    }
    // 兜底推断类型
    default:
      return convertBasicAstNodeToBasicType(targetType)
  }
}

// SyntaxKind.TypeAliasDeclaration
