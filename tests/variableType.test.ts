import { expect, test, describe } from 'bun:test'
import { Project } from 'ts-morph'
import { parseFunctionBody } from '../lib/parser.ts'
import { createScope } from '../lib/scope'
import { getUuid } from '../utils'
import { getFunctionExpression } from '../utils/parameters.ts'
import { inferFunctionType } from '../lib/inference.ts'

describe('函数scope变量类型', () => {
  const project = new Project()

  test('函数scope变量类型隔了判断', () => {
    const sourceFile = project.createSourceFile(
      'test.ts',
      `
            const test = () => {
                const num = 123;
                const test2 = () => {
                    const data = [1,2,3,4];
                    const num = "123";
                }
            }
        `,
    )

    const GlobalScope = createScope()
    const fn = getFunctionExpression(sourceFile, 'test')!
    const { getLocalVariables } = parseFunctionBody(fn, GlobalScope)
    const localVar = getLocalVariables()
    expect(localVar['data']).toBeUndefined()
    expect(localVar['num']?.currentType?.toString()).toBe('number')
  })

  test('三元运算符', () => {
    const sourceFile = project.createSourceFile(
      'test1.ts',
      `
            const test = () => {
                const dd = true? 1: "2";
            }
        `,
    )

    const GlobalScope = createScope()
    const fn = getFunctionExpression(sourceFile, 'test')!
    const { getLocalVariables } = parseFunctionBody(fn, GlobalScope)
    const localVar = getLocalVariables()
    expect(localVar['dd']?.currentType?.toString()).toBe('number | string')
  })

  test('n元运算符', () => {
    const sourceFile = project.createSourceFile(
      'test2.ts',
      `
            const test = () => {
                const dd = true? (
                    true? ({b: 1}): { a: 1 }
                ): (
                    false? ({ e: "1" }): ({r: [1,2,3]})
                );
            }
        `,
    )

    const GlobalScope = createScope()
    const fn = getFunctionExpression(sourceFile, 'test')!
    const { getLocalVariables } = parseFunctionBody(fn, GlobalScope)
    const localVar = getLocalVariables()
    expect(localVar['dd']?.currentType?.toString()).toBe(
      '{ b: number } | { a: number } | { e: string } | { r: number[] }',
    )
  })

  test('三元运算符- 重复类型', () => {
    const sourceFile = project.createSourceFile(
      'test3.ts',
      `
            const test = () => {
                const dd = true? "1": "xxx"
            }
        `,
    )

    const GlobalScope = createScope()
    const fn = getFunctionExpression(sourceFile, 'test')!
    const { getLocalVariables } = parseFunctionBody(fn, GlobalScope)
    const localVar = getLocalVariables()
    expect(localVar['dd']?.currentType?.toString()).toBe('string')
  })

  test('n元运算符- m层括号', () => {
    const sourceFile = project.createSourceFile(
      'test4.ts',
      `
            const test = () => {
                const dd = true? (
                    true? ((({b: 1}))): { a: 1 }
                ): (
                    false? ({ e: "1" }): (((({r: [1,2,3]}))))
                );
            }
        `,
    )

    const GlobalScope = createScope()
    const fn = getFunctionExpression(sourceFile, 'test')!
    const { getLocalVariables } = parseFunctionBody(fn, GlobalScope)
    const localVar = getLocalVariables()
    expect(localVar['dd']?.currentType?.toString()).toBe(
      '{ b: number } | { a: number } | { e: string } | { r: number[] }',
    )
  })

  test('连续赋值类型', () => {
    const sourceFile = project.createSourceFile(
      'test5.ts',
      `
            const test = () => {
                let a;
                let b;
                let c = a = b = 1;
                let f = (q = r = t = [1,2,3])
            }
        `,
    )

    const GlobalScope = createScope()
    const fn = getFunctionExpression(sourceFile, 'test')!
    const { getLocalVariables } = parseFunctionBody(fn, GlobalScope)
    const localVar = getLocalVariables()
    expect(localVar['a']?.currentType?.toString()).toBe('number')
    expect(localVar['b']?.currentType?.toString()).toBe('number')
    expect(localVar['c']?.currentType?.toString()).toBe('number')

    expect(localVar['f']?.currentType?.toString()).toBe('number[]')
    expect(localVar['q']?.currentType?.toString()).toBe('number[]')
    expect(localVar['r']?.currentType?.toString()).toBe('number[]')
    expect(localVar['t']?.currentType?.toString()).toBe('number[]')
  })

  test('连续赋值类型-多个属性x.c.z', () => {
    const sourceFile = project.createSourceFile(
      `${getUuid()}.ts`,
      `
            const test = () => {
                const obj = {}
                obj.kl = 123;
                let c = obj.kl = obj.ui = "123";
            }
        `,
    )

    const GlobalScope = createScope()
    const fn = getFunctionExpression(sourceFile, 'test')!
    const { getLocalVariables } = parseFunctionBody(fn, GlobalScope)
    const localVar = getLocalVariables()
    const objType = localVar['obj']!
    expect(objType.get('kl')?.toString()).toBe('number | string')
    expect(objType.get('ui')?.toString()).toBe('string')
    expect(localVar['c']?.currentType?.toString()).toBe('string')
  })

  test('数据对象解构', () => {
    const sourceFile = project.createSourceFile(
      `${getUuid()}.ts`,
      `
            const test = () => {
                const {
                    a,
                    b,
                    c
                } = {
                    a: 1,
                    b: "xx",
                    c: [1,2,3]
                };
            }
        `,
    )

    const GlobalScope = createScope()
    const fn = getFunctionExpression(sourceFile, 'test')!
    const { getLocalVariables } = parseFunctionBody(fn, GlobalScope)
    const localVar = getLocalVariables()
    expect(localVar['a']?.currentType?.toString()).toBe('number')
    expect(localVar['b']?.currentType?.toString()).toBe('string')
    expect(localVar['c']?.currentType?.toString()).toBe('number[]')
  })

  test('数据数组解构', () => {
    const sourceFile = project.createSourceFile(
      `${getUuid()}.ts`,
      `
            const test = () => {
                const [
                    a,
                    b,
                    c
     ] = [
        1,
        "asd",
        () => [1,2,3],
     ]
        `,
    )

    const GlobalScope = createScope()
    const fn = getFunctionExpression(sourceFile, 'test')!
    const { getLocalVariables } = parseFunctionBody(fn, GlobalScope)
    const localVar = getLocalVariables()
    expect(localVar['a']?.currentType?.toString()).toBe('number')
    expect(localVar['b']?.currentType?.toString()).toBe('string')
    expect(localVar['c']?.currentType?.toString()).toBe('() => number[]')
  })

  test('元组类型', () => {
    const sourceFile = project.createSourceFile(
      `${getUuid()}.ts`,
      `
            const test = () => {
                const target = [
        1,
        "asd",
        () => [1,2,3],
     ];
        let l1 = target[0];
        let l2 = target[1];
        let l3 = target[2];
        
        let q1 = target['0'];
        let q2 = target['1'];
        let q3 = target['2'];
        `,
    )

    const GlobalScope = createScope()
    const fn = getFunctionExpression(sourceFile, 'test')!
    const { getLocalVariables } = parseFunctionBody(fn, GlobalScope)
    const localVar = getLocalVariables()
    expect(localVar['target']?.currentType?.toString()).toBe(
      '[number,string,() => number[]]',
    )
    expect(localVar['l1']?.currentType?.toString()).toBe('number')
    expect(localVar['l2']?.currentType?.toString()).toBe('string')
    expect(localVar['l3']?.currentType?.toString()).toBe('() => number[]')

    expect(localVar['q1']?.currentType?.toString()).toBe('number')
    expect(localVar['q2']?.currentType?.toString()).toBe('string')
    expect(localVar['q3']?.currentType?.toString()).toBe('() => number[]')
  })

  test('动态数组索引类型', () => {
    const sourceFile = project.createSourceFile(
      `${getUuid()}.ts`,
      `
            const test = () => {
                const target = [1,2,3,4];
                let index = 0;
                let l1 = target[index];
                const target2 = [
        1,
        "asd",
        () => [1,2,3],
     ];
        let l2 = target2[index];
        `,
    )

    const GlobalScope = createScope()
    const fn = getFunctionExpression(sourceFile, 'test')!
    const { getLocalVariables } = parseFunctionBody(fn, GlobalScope)
    const localVar = getLocalVariables()
    expect(localVar['l1']?.currentType?.toString()).toBe('number')
    expect(localVar['l2']?.currentType?.toString()).toBe(
      'number | string | () => number[]',
    )
  })

  test('if 判断类型推断', () => {
    const sourceFile = project.createSourceFile(
      `${getUuid()}.ts`,
      `
            const test = () => {
                let a, jk = 1;
                if (a === 2) {
                    jk = "999"
                }
                else if (a === "ss") {}
            }
        `,
    )

    const GlobalScope = createScope()
    const fn = getFunctionExpression(sourceFile, 'test')!
    const { getLocalVariables } = parseFunctionBody(fn, GlobalScope)
    const localVar = getLocalVariables()
    expect(localVar['jk']?.currentType?.toString()).toBe('number | string')
    expect(localVar['a']?.currentType?.toString()).toBe('number | string')
  })

  test('对象类型索引key推断', () => {
    const sourceFile = project.createSourceFile(
      `${getUuid()}.ts`,
      `
            const test = () => {
                let oo = [1,2,3,4]; 
                const obj = {
                    a: 'xxx',
                    h: oo
                }
                obj.bb = 1;
                const i = 'h';
                let a1 = obj['bb'];
                let a2 = obj['a'];
                let a3 = obj[i];
            }
        `,
    )

    const GlobalScope = createScope()
    const fn = getFunctionExpression(sourceFile, 'test')!
    const { getLocalVariables } = parseFunctionBody(fn, GlobalScope)
    const localVar = getLocalVariables()
    expect(localVar['a1']?.currentType?.toString()).toBe('number')
    expect(localVar['a2']?.currentType?.toString()).toBe('string')
    expect(localVar['a3']?.currentType?.toString()).toBe('number[]')
  })

  test('操作符或 ||', () => {
    const sourceFile = project.createSourceFile(
      `${getUuid()}.ts`,
      `
            const test = () => {
                let oo = [1,2,3,4];
                let b = oo || true; 
            }
        `,
    )

    const GlobalScope = createScope()
    const fn = getFunctionExpression(sourceFile, 'test')!
    const { getLocalVariables } = parseFunctionBody(fn, GlobalScope)
    const localVar = getLocalVariables()
    expect(localVar['b']?.currentType?.toString()).toBe('number[] | boolean')
  })

  test('操作符+', () => {
    const sourceFile = project.createSourceFile(
      `${getUuid()}.ts`,
      `
            const test = () => {
                let oo = [1,2,3,4];
                let b = true + oo;
                let b1 = 1 + '123'; 
                let b2 = 1 + 123;
            }
        `,
    )

    const GlobalScope = createScope()
    const fn = getFunctionExpression(sourceFile, 'test')!
    const { getLocalVariables } = parseFunctionBody(fn, GlobalScope)
    const localVar = getLocalVariables()
    expect(localVar['b']?.currentType?.toString()).toBe('any')
    expect(localVar['b1']?.currentType?.toString()).toBe('string')
    expect(localVar['b2']?.currentType?.toString()).toBe('number')
  })

  test('操作符等于以及全等推断', () => {
    const sourceFile = project.createSourceFile(
      `${getUuid()}.ts`,
      `
            const test = () => {
                const data = 1;
                const d = data == '1';
                const d1 = data === '1';
            }
        `,
    )

    const GlobalScope = createScope()
    const fn = getFunctionExpression(sourceFile, 'test')!
    const { getLocalVariables } = parseFunctionBody(fn, GlobalScope)
    const localVar = getLocalVariables()
    expect(localVar['d']?.currentType?.toString()).toBe('boolean')
    expect(localVar['d1']?.currentType?.toString()).toBe('boolean')
    // 待后续 const 补充
    expect(localVar['data']?.currentType?.toString()).toBe('number')
  })

  test('对象展开语法拷贝类型推断', () => {
    const sourceFile = project.createSourceFile(
      `${getUuid()}.ts`,
      `
            const test = () => {
                const obj = {
                  a: 1,
                  name: 'string',
                  other: [1,2,3]
                }
                const obj2 = { ...obj };
            }
        `,
    )

    const GlobalScope = createScope()
    const fn = getFunctionExpression(sourceFile, 'test')!
    const { getLocalVariables } = parseFunctionBody(fn, GlobalScope)
    const localVar = getLocalVariables()
    expect(localVar['obj']?.toString()).toBe(
      '{ a: number, name: string, other: number[] }',
    )
    expect(localVar['obj2']?.toString()).toBe(
      '{ a: number, name: string, other: number[] }',
    )
  })

  test('对象展开语法深层共享类型推断', () => {
    const sourceFile = project.createSourceFile(
      `${getUuid()}.ts`,
      `
            const test = () => {
                const obj = {
                  to1: {
                    to2: 1
                  }
                }
                const obj2 = { ...obj };
                obj.to1.to2 = "xxx"
            }
        `,
    )

    const GlobalScope = createScope()
    const fn = getFunctionExpression(sourceFile, 'test')!
    const { getLocalVariables } = parseFunctionBody(fn, GlobalScope)
    const localVar = getLocalVariables()
    expect(localVar['obj']?.toString()).toBe(
      '{ to1: { to2: number | string } }',
    )
    expect(localVar['obj2']?.toString()).toBe(
      '{ to1: { to2: number | string } }',
    )
  })

  test('对象剩余参数类型推断', () => {
    const sourceFile = project.createSourceFile(
      `${getUuid()}.ts`,
      `
            const test = () => {
                const obj = {
                  a1: 1,
                  a2: 1,
                  a3: 3,
                  a4: [1,2,3]
                }
                const { a1, a2, ...other } = obj;
            }
        `,
    )

    const GlobalScope = createScope()
    const fn = getFunctionExpression(sourceFile, 'test')!
    const { getLocalVariables } = parseFunctionBody(fn, GlobalScope)
    const localVar = getLocalVariables()
    expect(localVar['a1']?.toString()).toBe('number')
    expect(localVar['a2']?.toString()).toBe('number')
    expect(localVar['other']?.toString()).toBe('{ a3: number, a4: number[] }')
  })

  test('对象剩余参数复用类型推断', () => {
    const sourceFile = project.createSourceFile(
      `${getUuid()}.ts`,
      `
            const test = () => {
                const obj = {
                  a1: 1,
                  a2: 1,
                  a3: 3,
                  a4: [1,2,3]
                }
                const { a1, a2, ...other } = obj;
                obj.a3 = "xxxx";
                const obj2 = {
                  a: other,
                  a2: other.a3,
                }
            }
        `,
    )

    const GlobalScope = createScope()
    const fn = getFunctionExpression(sourceFile, 'test')!
    const { getLocalVariables } = parseFunctionBody(fn, GlobalScope)
    const localVar = getLocalVariables()
    expect(localVar['a1']?.toString()).toBe('number')
    expect(localVar['a2']?.toString()).toBe('number')
    expect(localVar['other']?.toString()).toBe(
      '{ a3: number | string, a4: number[] }',
    )
    expect(localVar['obj2']?.toString()).toBe(
      '{ a: { a3: number | string, a4: number[] }, a2: number | string }',
    )
  })

  test('数组剩余参数[TupleType]类型推断', () => {
    const sourceFile = project.createSourceFile(
      `${getUuid()}.ts`,
      `
            const test = () => {
                const fn = () => [1,2,3];
                const list = [1, "2", fn];
                const [a, ...other] = list;
            }
        `,
    )

    const GlobalScope = createScope()
    const fn = getFunctionExpression(sourceFile, 'test')!
    const { getLocalVariables } = parseFunctionBody(fn, GlobalScope)
    const localVar = getLocalVariables()
    expect(localVar['a']?.toString()).toBe('number')
    expect(localVar['other']?.toString()).toBe('[string,() => number[]]')
  })

  test('同质类型数组展开语法拷贝类型推断', () => {
    const sourceFile = project.createSourceFile(
      `${getUuid()}.ts`,
      `
            const test = () => {
                const l = [1,2,3];
                const list = [...l];
            }
        `,
    )

    const GlobalScope = createScope()
    const fn = getFunctionExpression(sourceFile, 'test')!
    const { getLocalVariables } = parseFunctionBody(fn, GlobalScope)
    const localVar = getLocalVariables()
    expect(localVar['l']?.toString()).toBe('number[]')
    expect(localVar['list']?.toString()).toBe('number[]')
  })

  test('元组数组展开语法拷贝类型推断', () => {
    const sourceFile = project.createSourceFile(
      `${getUuid()}.ts`,
      `
            const test = () => {
                const fn = () => [1,2,3];
                const l = [1, "2", fn];
                const list = [...l];
            }
        `,
    )

    const GlobalScope = createScope()
    const fn = getFunctionExpression(sourceFile, 'test')!
    const { getLocalVariables } = parseFunctionBody(fn, GlobalScope)
    const localVar = getLocalVariables()
    expect(localVar['list']?.toString()).toBe(
      '(number | string | () => number[])[]',
    )
  })

  test('元组数组展开语法深层共享类型推断', () => {
    const sourceFile = project.createSourceFile(
      `${getUuid()}.ts`,
      `
            const test = () => {
                const obj = {
                  to1: {
                    to2: 1
                  }
                }
                const l = [obj, obj, obj];
                let l2 = [...l]
                obj.to1.to2 = "xxx"
            }
        `,
    )

    const GlobalScope = createScope()
    const fn = getFunctionExpression(sourceFile, 'test')!
    const { getLocalVariables } = parseFunctionBody(fn, GlobalScope)
    const localVar = getLocalVariables()
    expect(localVar['l2']?.toString()).toBe(
      '{ to1: { to2: number | string } }[]',
    )
  })

  test('const对象解构简单类型是否可更改', () => {
    const { getLocalVariables } = inferFunctionType(
      `const test = () => {
                const obj = {
                  to1: {
                    to2: 1
                  },
                  a: 1,
                  b: 2,
                  c: [1,2,3]
                }
                const { a, b, to1 } = obj;
                if (a === '1') {}
                if (b === '1') {}
                if (to1.to2 === 'xxx') {}
            }
        `,
      'test',
    )
    const localVar = getLocalVariables()
    expect(localVar['a']?.toString()).toBe('number')
    expect(localVar['b']?.toString()).toBe('number')
    expect(localVar['to1']?.toString()).toBe('{ to2: number | string }')
  })

  test('const数组解构简单类型是否可更改', () => {
    const { getLocalVariables } = inferFunctionType(
      `const test = () => {
                const list = [1,2,3,4]
                const [ a, b, ...args ] = list;
                if (a === '1') {}
                if (b === '1') {}
            }
        `,
      'test',
    )
    const localVar = getLocalVariables()
    expect(localVar['a']?.toString()).toBe('number')
    expect(localVar['b']?.toString()).toBe('number')
    expect(localVar['args']?.toString()).toBe('number[]')
  })
})

describe('对象属性可选', () => {
  test('变量赋值，rhs可选类型推断', () => {
    const localVariables = inferFunctionType(
      `const test = () => {
                const obj = {}
                let x = obj?.a?.b?.c;
            }
        `,
      'test',
    ).getLocalVariables()
    expect(localVariables['x']?.toString()).toBe('any')
    expect(localVariables['obj']?.toString()).toBe(
      '{ a?: { b?: { c?: any } } }',
    )
  })
})
