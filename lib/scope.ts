import { SyntaxKind, type ParameterDeclaration } from 'ts-morph'
import { createVariable } from './variable'
import { AnyType, ObjectType, TypeMatch } from './NodeType'
import type { Scope } from '../types/scope.ts'
import type { Variable } from '../types/variable.ts'
import { getBasicTypeToVariable } from './typeCompatibility.ts'
import { getFuncAllParametersType } from '../utils/parameters.ts'

export function createScope(
  parameters: ParameterDeclaration[] = [],
  localVariables: Record<string, Variable> = {},
  prototype?: Scope,
): Scope {
  const { parameterMap, parameterList } = getFuncAllParametersType(parameters)
  initialLocalVariables()

  const _resultSelf: Scope = {
    find,
    createLocalVariable,
    findParameter,
    paramsMap: parameterMap,
    creatDestructured,
    getParamsList: () => parameterList,
    getLocalVariables: () => localVariables,
  }

  Promise.resolve().then(() => {
    console.log(
      '<<<<',
      parameterMap['props']?.currentType?.toString(),
      new ObjectType(localVariables)?.toString(),
      '>>>>',
    )
  })

  function initialLocalVariables() {
    parameterList.forEach((item) => {
      if (item.kind !== SyntaxKind.ObjectBindingPattern) return
      // 如果是解构 需要赋值到 localVariables
      const origin = item.paramsType.currentType!
      if (TypeMatch.isObjectType(origin)) {
        const { properties } = origin
        for (const k in properties) {
          createLocalVariable(k, getBasicTypeToVariable(properties[k]!))
        }
      }
    })
  }

  function creatDestructured(
    targetVariable: Variable,
    recordType: Record<string, Variable>,
  ) {
    const variable = createVariable(new ObjectType(recordType))
    targetVariable.combine(variable)

    for (const k in recordType) {
      if (Object.hasOwn(localVariables, k)) {
        // 有 同步bug
        localVariables[k] = localVariables[k]?.combine(variable.get(k)!)!
      } else {
        localVariables[k] = variable.get(k)!
      }
    }
  }

  function findParameter(paramName: string) {
    const targetType = find(paramName)
    if (!targetType) return null
    const { currentType } = targetType

    if (!TypeMatch.isObjectType(currentType!)) {
      targetType.setTypeRef(new ObjectType())
    }
    return {
      creatDestructured(recordType: Record<string, Variable>) {
        creatDestructured(targetType, recordType)
      },
    }
  }

  function find(name: string) {
    return localVariables[name] || parameterMap[name] || prototype?.find(name)
  }

  function createLocalVariable(
    name: string,
    variable: Variable = createVariable(new AnyType()),
  ) {
    return (localVariables[name] = variable)
  }

  return _resultSelf
}
