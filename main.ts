import { inferFunctionType } from '@/inference.ts'

const body = inferFunctionType(
  `
            const fn = () => {
            const a1 = {
                        name: 1, 
                        age:'x'
                  }
            if (1) {
            return {
                        age: 'z',
                        name: 2,
                        obj: a1
                  }
            }
                  
              
                  
                  const a3 = {
                        obj: {
                           age: 'xx',name:22
                                                   },
                        name: 122, 
                        age:'x123'
                  }
                  
                  return a3
              };
        `,
  'fn',
)
console.log(body.getReturnType()?.toString(), 'return END')
