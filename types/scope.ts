import type { Variable } from './variable.ts'
import type { BaseType } from '../lib/NodeType.ts'
import type { ParameterItem } from './typeCompatibility.ts'

export type Scope = {
  find(name: string): Variable | undefined
  createLocalVariable(name: string, iType?: BaseType): Variable
  findParameter(paramName: string): TargetParams | null
  paramsMap: Record<string, Variable>
  creatDestructured: (
    targetVariable: Variable,
    recordType: Record<string, Variable>,
  ) => void
  getParamsList: () => ParameterItem[]
  getLocalVariables: () => Record<string, Variable>
}

export type TargetParams = {
  creatDestructured: (recordType: Record<string, Variable>) => void
}
