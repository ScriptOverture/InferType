import { ParameterDeclaration, SyntaxKind, Node, BindingElement } from "ts-morph";
type ParamType = {
    type: string;
    origin: string | BindingElement[]
}

interface ParamsResult {
    params: Partial<Record<string, ParamType>>;
    length: number;
}

export function getAllParametersType(parasms: ParameterDeclaration[]) {
    return parasms.reduce<ParamsResult>((result, item) => {

        const nameNode = item.getNameNode();
        const paramKey = item.getName();
        let resultParams: ParamType = {
            type: item.getType().getText(),
            origin: paramKey
        };

        if (Node.isObjectBindingPattern(nameNode)) {
            const bindingElements = nameNode.getElements();
            // 如果是参数结构类型， 存储原始数组
            resultParams.origin = bindingElements;
        }

        return {
            ...result,
            params: {
                ...result.params,
                [paramKey]: resultParams
            }
        }
    }, {
        params: {},
        length: parasms.length
    });
}