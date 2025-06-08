import { describe, expect, test } from 'bun:test'
import { inferFunctionType } from '@/inference.ts'
import { preTree } from "@/TypeStruct.ts";
import {NumberType, ObjectType, StringType} from "@/NodeType.ts";

describe('比较类型', () => {
    test('对象key不同顺序对象比较', () => {
        const obj1 = new ObjectType({
            a1: new StringType(),
            a2: new NumberType(),
        })
        const obj2 = new ObjectType({
            a2: new NumberType(),
            a1: new StringType(),
        })
        const f1 = preTree.registerType(obj1.properties)
        const f2 = preTree.registerType(obj2.properties)
        expect(f1).toBe(f2)
    })

    test('深度嵌套对象类型比较', () => {
        const localVariables = inferFunctionType(
            `
            const fn = () => {
                const a1 = {
                        name: 1, 
                        age:'x'
                  }
                  const a2 = {
                        age: 'z',
                        name: 2,
                        obj: a1
                  }
                  
                  const a3 = {
                        obj: {
                           age: 'xx',name:22
                          },
                        name: 122, 
                        age:'x123'
                  }
            };
        `,
            'fn',
        ).getLocalVariables();
        expect(localVariables['a2']?.getVariableFlag()).toBe(localVariables['a3']?.getVariableFlag()!)
    })
})
