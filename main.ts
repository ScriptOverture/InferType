import { inferFunctionType } from '@/inference.ts'
import { ObjectType } from '@/NodeType.ts'

const body = inferFunctionType(
  `
  type T = (data: string, b: string[]) => string
            const fn = (data: string, b: string[]) => {
                const o: T = {}
              };
        `,
  'fn',
)
console.log(new ObjectType(body.getParamsType()).toString(), 'return END')
