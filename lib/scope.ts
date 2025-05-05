import type { Variable } from "./variable";
import type { BaseType } from "./NodeType";
import { SyntaxKind, type ParameterDeclaration } from 'ts-morph';
import { createVariable } from "./variable"
import { isObjectType, ObjectType } from "./NodeType";
import {
    getAllParametersType,
    getBasicTypeToVariable,
    type ParasmsItem
} from "../utils";

export type Scope = {
    find(name: string): Variable | undefined;
    createLocalVariable(name: string, iType: BaseType): void;
    findParameter(paramName: string): TargetParamter | null;
    paramsMap: Record<string, Variable>,
    creatDestructured: (targetVariable: Variable, recordType: Record<string, Variable>) => void,
    getParasmsList: () => ParasmsItem[];
    getLocalVariables: () => Record<string, Variable>
};

type TargetParamter = {
    creatDestructured: (recordType: Record<string, Variable>) => void
};

export function createScope(
    parameters: ParameterDeclaration[] = [],
    localVariables: Record<string, Variable> = {},
    prototype?: Scope
) {
    const { paramsMap, parasmsList } = getAllParametersType(parameters);
    initialLocalVariables();

    const _resultSelf: Scope = {
        find,
        createLocalVariable,
        findParameter,
        paramsMap,
        creatDestructured,
        getParasmsList: () => parasmsList,
        getLocalVariables: () => localVariables
    }

    Promise.resolve().then(_ => {
        console.log(
            '<<<<',
            paramsMap['props']?.currentType?.toString(),
            localVariables['aa']?.currentType?.toString(),
            '>>>>'
        );
    })

    function initialLocalVariables() {
        parasmsList.forEach(item => {
            if (item.kind !== SyntaxKind.ObjectBindingPattern) return;
            // 如果是解构 需要赋值到 localVariables
            const origin = item.paramsType.currentType!;
            if (isObjectType(origin)) {
                const { properties } = origin;
                for (const k in properties) {
                    createLocalVariable(k, getBasicTypeToVariable(properties[k]!))
                }
            }
        });
    }

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

        if (!(isObjectType(currentType!))) {
            targetType.setTypeRef(new ObjectType())
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