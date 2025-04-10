import { ParameterDeclaration, Expression, Node, Identifier } from "ts-morph";
type ParamType = {
    type: string;
    origin: Record<string, string>,
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
            origin: {
                [paramKey]: paramKey
            }
        };
        const paramType = item.getType();
        if (Node.isObjectBindingPattern(nameNode)) {
            const bindingElements = nameNode.getElements().reduce((result, item) => {
                const localName = item.getName();
                const originalName = item.getPropertyNameNode()?.getText() || localName;
                const propSymbol = paramType.getProperty(originalName);
                const typeText = propSymbol?.getTypeAtLocation(item)?.getText();

                return {
                    ...result,
                    [originalName]: typeText || 'any'
                };
            }, {});

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




export function getRootIdentifier(expr: Expression): Identifier | undefined {
    let cur: Expression = expr;
    while (Node.isPropertyAccessExpression(cur)) {
        cur = cur.getExpression();
    }
    return Node.isIdentifier(cur) ? cur : undefined;
}