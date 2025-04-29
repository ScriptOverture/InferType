
import { ArrayType, NumberType, ObjectType, StringType, type BaseType } from "../../lib/NodeType";

export enum Parameter {
    // 解构参数
    DestructuredParameter,
    // 默认参数
    DefaultParameter,
    // 展开参数
    RestParameter
}

type MockParamsReturn = {
    kind: number,
    name: string,
    type: BaseType
}

export function mockParamsData(n: number = 2): MockParamsReturn[] {
    return Array.from<number, MockParamsReturn>({ length: n }, (_, ind) => {
        return {
            kind: ind % 2,
            name: `props_${ind}`,
            type: new ObjectType({
                ['name' + ind]: new StringType(),
                ['age' + ind]: new NumberType(),
                ['list' + ind]: new ArrayType(new StringType())
            })
        }
    }).concat({
        kind: Parameter.RestParameter,
        name: 'args',
        type: new ArrayType(new ObjectType({
            name: new StringType(),
            age: new NumberType(),
            list: new ArrayType(new StringType())
        }))
    })
}


export function getMockDataToParams(paramData: MockParamsReturn[]) {
    return paramData.map(res => {
        if (res.kind === Parameter.DestructuredParameter) {
            const types = res.type as ObjectType;
            return `{${Object.keys(types.properties).join(',')}}: ${res.type}`;
        } else if (res.kind === Parameter.RestParameter) {
            return `...${res.name}: ${res.type}`
        }
        return `${res.name}: ${res.type}`
    }).join(', ');
}


export function getMockDataToFunBody(paramData: MockParamsReturn[]) {
    return paramData.map(res => {
        const types = res.type;
        if (res.kind === Parameter.DestructuredParameter) {
            if (types instanceof ObjectType) {
                let s = '';
                for (const [k, v] of Object.entries(types.properties)) {
                    s += `${k} = ${mockBaseType(v)};`
                }
                return s;
            }
        }
        else if (res.kind === Parameter.DefaultParameter) {
            return `${res.name} = ${mockBaseType(res.type)};`
        }
    }).filter(l => l).join(';')
}


export function mockBaseType(types: BaseType) {
    if (types instanceof ObjectType) {
        let result = `{`
        for (const [k, v] of Object.entries(types.properties)) {
            result += `${k}: ${mockBaseType(v)},`;
        }
        return `${result}}`;
    }
    else if (types instanceof ArrayType) {
        const mock: any = mockBaseType(types.elementType);
        return `[${mock}, ${mock}]`
    }
    else if (types instanceof NumberType) {
        return `11`;
    } else if (types instanceof StringType) {
        return `'11'`;
    }
}