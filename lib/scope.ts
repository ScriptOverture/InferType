import type { Variable } from "./variable";
import type { BaseType } from "./NodeType";
import type { ParameterDeclaration } from 'ts-morph';
import { createVariable } from "./variable"
import { ObjectType } from "./NodeType";
import {
    getAllParametersType
} from "../utils";

export type Scope = {
    find(name: string): Variable | undefined;
    createLocalVariable(name: string, iType: BaseType): void;
    findParameter(paramName: string): TargetParamter | null;
    paramsMap: Record<string, Variable>,
    creatDestructured: (targetVariable: Variable, recordType: Record<string, Variable>) => void
};

type TargetParamter = {
    creatDestructured: (recordType: Record<string, Variable>) => void
};

export function createScope(
    parameters: ParameterDeclaration[] = [],
    localVariables: Record<string, Variable> = {},
    prototype?: Scope
) {
    const { paramsMap } = getAllParametersType(parameters);

    const _resultSelf: Scope = {
        find,
        createLocalVariable,
        findParameter,
        paramsMap,
        creatDestructured
    }

    Promise.resolve().then(_ => {
        console.log(
            '<<<<',
            paramsMap['props']?.currentType?.toString(),
            localVariables['jk']?.currentType?.toString(),
            '>>>>'
        );
    })

    function creatDestructured(targetVariable: Variable, recordType: Record<string, Variable>) {
        const variable = createVariable(new ObjectType(recordType));
        targetVariable.combine(variable);

        for (const k in recordType) {
            if (localVariables.hasOwnProperty(k)) {
                // 有 同步bug
                localVariables[k] = localVariables[k]?.combine(variable.get(k)!)!
            } else {
                localVariables[k] = variable.get(k)!;
            }
        }
    }

    function findParameter(paramName: string) {
        const targetType = find(paramName);
        if (!targetType) return null;
        const { currentType } = targetType;

        if (!(currentType instanceof ObjectType)) {
            targetType.setTypeRef(new ObjectType({}))
        }
        return {
            creatDestructured(recordType: Record<string, Variable>) {
                creatDestructured(targetType, recordType);
            }
        }
    }

    function find(name: string) {
        return localVariables[name]
            || paramsMap[name]
            || prototype?.find(name);
    }

    function createLocalVariable(name: string, variable: Variable) {
        localVariables[name] = variable;
    }

    return _resultSelf
}