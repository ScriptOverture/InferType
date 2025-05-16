import type { ObjectVariable, Variable } from './variable.ts'
import type { ParameterItem } from './compatibility.ts'

export type Scope = {
  find(name: string): Variable | undefined
  createLocalVariable(name: string, iType?: Variable): Variable
  findParameter(paramName: string): TargetParams | null
  paramsMap: ObjectVariable
  creatDestructured: (
    targetVariable: Variable,
    recordType: ObjectVariable,
  ) => void
  getParamsList: () => ParameterItem[]
  getLocalVariables: () => ObjectVariable
}

export type TargetParams = {
  creatDestructured: (recordType: ObjectVariable) => void
}
