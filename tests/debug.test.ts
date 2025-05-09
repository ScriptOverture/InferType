import { describe, expect, test } from 'bun:test'
import { inferFunctionType } from '../lib/inference'

describe('函数条件判断返回值', () => {
  test('箭头函数if 判断 return返回类型推断', () => {
    const returnType = inferFunctionType(
      `
              const fn = () => {
                  if (1) {
                    return 1;
                  }
              };
          `,
      'fn',
    ).getReturnType()!

    expect(returnType.toString()).toBe('number | undefined')
  })
})

describe('函数条件判断返回值2', () => {
  test('箭头函数if 判断 return返回简单类型', () => {
    const returnType = inferFunctionType(
      `
            const fn = () => {
                if (1) {
                  return 1;
                } else {
                  return '1'
                }
            };
        `,
      'fn',
    ).getReturnType()!

    expect(returnType.toString()).toBe('number | string')
  })
})
