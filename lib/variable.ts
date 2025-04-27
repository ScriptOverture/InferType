import type { Ref, RefReturn } from "../utils";
import {
    AnyType,
    BasicType,
    ObjectType
} from "./NodeType";
import { 
    isRef, 
    createRef,
    isVariable
} from "../utils";


export type Variable = {
    ref: VariableTypeRef,
    currentType: BasicType | undefined,
    setTypeRef: RefReturn<any>[1],
    get: (key: string) => Variable | undefined,
    combine: (data: Variable) => Variable;
    toString: () => string
}

type VariableTypeRef = Ref<BasicType>;


export function createVariable(iType: Ref<BasicType> | BasicType = new AnyType()): Variable {
    const [typeRef, setTypeRef] = createRef<BasicType>();
    if (isRef(iType)) {
        setTypeRef(iType.current!);
    } else if (iType instanceof BasicType) {
        setTypeRef(iType);
    }
    // 内联缓存预留
    let _references = new Set<VariableTypeRef>();

    const self = {
        setTypeRef,
        get ref() { return typeRef },
        get currentType() { return typeRef.current },
        toString: () => typeRef.current?.toString()!,
        get: (key: string) => {
            const current = typeRef.current;
            if (current instanceof ObjectType) {
                const objType: any = current.properties[key];
                if (objType) {
                    if (isVariable(objType)) {
                        return objType;
                    }
                    return createVariable(objType);
                }
            }
        },
        combine: (c: Variable) => {
            const currenType = typeRef.current?.combine(c.currentType!);
            if (currenType instanceof BasicType) {
                setTypeRef(currenType!);
            } else {
                setTypeRef(new AnyType());
            }
            return self;
        }
    }

    return self;
}