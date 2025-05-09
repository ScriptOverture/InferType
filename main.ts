import { inferFunctionType } from './lib/inference.ts'

const body = inferFunctionType(
  `
            const fn = () => {
                  if (1) {
                    return 1;
                  }
              };
        `,
  'fn',
)
console.log(body.getReturnType()?.toString(), 'return END')
