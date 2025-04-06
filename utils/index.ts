import { ParameterDeclaration } from "ts-morph";
interface ParamsResult {
    params: Partial<Record<string, string>>;
    length: number;
}

export function getAllParametersType(parasms: ParameterDeclaration[]) {
    return parasms.reduce<ParamsResult>((result, item) => {
        return {
            ...result,
            params: {
                ...result.params,
                [item.getName()]: item.getType().getText()
            }
        }
    }, {
        params: {},
        length: parasms.length
    });
}