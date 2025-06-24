import { inferFunctionType } from '@/inference.ts'
import { ObjectType } from '@/NodeType.ts'

const body = inferFunctionType(
  `
  class TestClass {
                name = "xx"
                age?: number
            }
            const fn = () => {
                const obj: TestClass;
            };
        `,
  'fn',
)
console.log(new ObjectType(body.getLocalVariables()).toString(), 'return END')
