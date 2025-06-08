import { inferFunctionType } from '@/inference.ts'

const body = inferFunctionType(
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
)
console.log(body.getReturnType()?.toString(), 'return END')
