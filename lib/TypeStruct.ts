import { BasicType, TypeKind, TypeMatch } from './NodeType.ts'
import type { ObjectVariable } from '@@types/variable.ts'

export type FlagId = number

let nextFlagId: FlagId = 1
class TrieNode {
  children: Map<string, TrieNode> = new Map<string, TrieNode>()
  fieldId: number
  kind: TypeKind
  flagId: FlagId | null = null

  constructor(fieldId: number, kind: TypeKind) {
    this.fieldId = fieldId
    this.kind = kind
  }

  findChild(fieldId: number, kind: TypeKind): TrieNode | undefined {
    return this.children.get(this.getId(fieldId, kind))
  }

  addChild(fieldId: number, kind: TypeKind): TrieNode {
    const node = new TrieNode(fieldId, kind)
    node.flagId = nextFlagId++
    this.children.set(this.getId(fieldId, kind), node)
    return node
  }

  private getId(fieldId: number, kind: TypeKind) {
    return `${fieldId}-${kind}`
  }
}

export class TypeStructRegistry {
  private fieldMap = new Map<string, number>()
  private nextFieldId = 1
  /**
   * root
   * @private
   */
  private root = new TrieNode(-1, TypeKind.AnyType)

  getFieldId(fieldName: string) {
    if (!this.hasFieldNameToFieldMap(fieldName)) {
      this.fieldMap.set(fieldName, this.nextFieldId++)
    }
    return this.fieldMap.get(fieldName)!
  }

  hasFieldNameToFieldMap(fieldName: string) {
    return this.fieldMap.has(fieldName)
  }

  registerType(def: Record<string, BasicType> | ObjectVariable): FlagId {
    const entries = []

    for (const [key, value] of Object.entries(def)) {
      const fieldId = this.getFieldId(key)
      const variableType = value.currentType
      let kind: TypeKind

      if (TypeMatch.isObjectType(variableType)) {
        kind = value.getVariableFlag()!
      } else {
        kind = variableType?.kind!
      }
      entries.push({ fieldId, kind })
    }

    /**
     * sort by fieldId to normalize
     */
    entries.sort((a, b) => a.fieldId - b.fieldId)

    /**
     * insert into Trie
     */
    let node = this.root
    for (const { fieldId, kind } of entries) {
      node = node.findChild(fieldId, kind) ?? node.addChild(fieldId, kind)
    }

    return node.flagId!
  }
}

export const preTree = new TypeStructRegistry()
