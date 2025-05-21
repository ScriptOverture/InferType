import { SyntaxKind, type ParameterDeclaration } from 'ts-morph'
import { createVariable } from './variable'
import { ObjectType, TypeMatch } from './NodeType'
import type { Scope } from '../types/scope.ts'
import type { ObjectVariable, Variable } from '../types/variable.ts'
import { getBasicTypeToVariable } from './compatibility.ts'
import { getFuncAllParametersType } from '../utils/parameters.ts'

export function createScope(
  prototype?: Scope,
  parameters: ParameterDeclaration[] = [],
  localVariables: ObjectVariable = {},
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
      new ObjectType(localVariables as any)?.toString(),
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
    recordType: ObjectVariable,
  ) {
    const variable = createVariable(new ObjectType(recordType))
    targetVariable.combine(variable)

    for (const k in recordType) {
      if (Object.hasOwn(localVariables, k)) {
        localVariables[k] = getBasicTypeToVariable(
          localVariables[k]?.combine(variable.get(k)!)!,
        )
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
      creatDestructured(recordType: ObjectVariable) {
        creatDestructured(targetType, recordType)
      },
    }
  }

  function find(name: string) {
    return localVariables[name] || parameterMap[name] || prototype?.find(name)
  }

  function createLocalVariable(
    name: string,
    variable: Variable = createVariable(),
  ) {
    return (localVariables[name] = variable)
  }

  return _resultSelf
}
