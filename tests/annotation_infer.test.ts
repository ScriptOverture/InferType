import { expect, test, describe } from 'bun:test'
import { inferFunctionType } from '@/inference.ts'


describe('标注类型和推断类型意图识别', () => {

    test('标注Type获取', () => {
        const local = inferFunctionType(
            `
              type TestType = {
                name: string,
                age?: number
              }
              const fn = () => {
                  const obj: TestType;
              };
          `,
            'fn',
        ).getLocalVariables()!

        expect(local['obj']?.toString()).toBe('{ name: string, age?: number }')
    })

    test('标注Class获取', () => {
        const local = inferFunctionType(
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
        ).getLocalVariables()!

        expect(local['obj']?.toString()).toBe('{ name: string, age?: number }')
    })

    test('标注interface获取', () => {
        const local = inferFunctionType(
            `
              interface TestClass {
                name: string,
                age?: number
            }
            const fn = () => {
                const obj: TestClass;
            };
          `,
            'fn',
        ).getLocalVariables()!

        expect(local['obj']?.toString()).toBe('{ name: string, age?: number }')
    })

    test('标注type与推断取舍', () => {
        const local = inferFunctionType(
            `
              interface TestClass {
                name: string
                age?: number
            }
            const fn = () => {
                const obj: TestClass = {
                    name: 'xxx'
                };
                const obj2: TestClass = {
                    name: 'xxx',
                    jk: 123
                };
            };
          `,
            'fn',
        ).getLocalVariables()!

        expect(local['obj']?.toString()).toBe('{ name: string, age?: number }')
        expect(local['obj2']?.toString()).toBe('{ name: string, jk: number }')
    })
})