import { expect, test, describe } from 'bun:test'
import { Project } from 'ts-morph'
import { parseFunctionBody } from '../lib/parser'
import { createScope } from '../lib/scope'
import { TypeMatch } from '../lib/NodeType'
import { inferFunctionType } from '../lib/inference'
import { getFunctionExpression } from '../utils/parameters.ts'

describe('函数返回值', () => {
  const project = new Project()

  test('箭头函数无return返回, 复杂类型', () => {
    const sourceFile = project.createSourceFile(
      'test.ts',
      `
            const fn = () => ({
                name: 'name',
                age: 1,
                list: [1,2,3]
            });
        `,
    )

    const GlobalScope = createScope()
    const fn = getFunctionExpression(sourceFile, 'fn')!
    const returnType = parseFunctionBody(fn, GlobalScope).getReturnType()!

    expect(TypeMatch.isObjectType(returnType)).toBeBoolean()
    expect(returnType.get('name')?.toString()).toBe('string')
    expect(returnType.get('age')?.toString()).toBe('number')
    expect(returnType.get('list')?.toString()).toBe('number[]')
  })

  test('箭头函数无return返回, 简单类型', () => {
    const sourceFile = project.createSourceFile(
      'test1.ts',
      `
            const fn = () => "1";
            const fn1 = () => 1;
            const fn2 = () => [1,2,3];
        `,
    )

    const GlobalScope = createScope()
    const returnType = parseFunctionBody(
      getFunctionExpression(sourceFile, 'fn')!,
      GlobalScope,
    ).getReturnType()!

    expect(TypeMatch.isStringType(returnType)).toBeBoolean()

    const returnType2 = parseFunctionBody(
      getFunctionExpression(sourceFile, 'fn1')!,
      GlobalScope,
    ).getReturnType()!

    expect(TypeMatch.isNumberType(returnType2)).toBeBoolean()

    const returnType3 = parseFunctionBody(
      getFunctionExpression(sourceFile, 'fn2')!,
      GlobalScope,
    ).getReturnType()!

    expect(returnType3.currentType?.toString()).toBe('number[]')
  })

  test('箭头函数return返回, 简单类型', () => {
    const sourceFile = project.createSourceFile(
      'test2.ts',
      `
            const fn = () => {
                return "1"
            };
            const fn1 = () => {
                return 1
            };
            const fn2 = () => {
                return [1,2,3]
            };
        `,
    )

    const GlobalScope = createScope()
    const returnType = parseFunctionBody(
      getFunctionExpression(sourceFile, 'fn')!,
      GlobalScope,
    ).getReturnType()!

    expect(TypeMatch.isStringType(returnType)).toBeBoolean()

    const returnType2 = parseFunctionBody(
      getFunctionExpression(sourceFile, 'fn1')!,
      GlobalScope,
    ).getReturnType()!

    expect(TypeMatch.isNumberType(returnType2)).toBeBoolean()

    const returnType3 = parseFunctionBody(
      getFunctionExpression(sourceFile, 'fn2')!,
      GlobalScope,
    ).getReturnType()!

    expect(returnType3.currentType?.toString()).toBe('number[]')
  })

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
