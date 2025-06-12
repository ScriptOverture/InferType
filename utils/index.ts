import type { Variable } from '../types/variable.ts'

export type Ref<T> = {
  current?: T
}

type UpdateFn<M> = (prev: M) => M
type Update<M> = UpdateFn<M> | M
export type RefReturn<M> = [Ref<M>, (update: Update<M>) => void]

export function createRef<T>(defaultRef?: T): RefReturn<T> {
  const ref: Ref<T> = {
    current: defaultRef,
  }

  const setRef = (update: Update<T>) => {
    if (isUpdater(update)) {
      ref.current = update(ref.current) as T
    } else {
      ref.current = update as T
    }
  }

  return [ref, setRef]
}

function isUpdater<T>(value: unknown): value is (prev: T) => T {
  return typeof value === 'function'
}

export function isRef<T>(data: any): data is Ref<T> {
  return data && data.current
}

export function isVariable(data: any): data is Variable {
  return data && data.ref && data.currentType && data.setTypeRef
}

export function isString(n: any): n is string {
  return typeof n === 'string'
}

export function isNumber(n: any): n is number {
  return typeof n === 'number'
}

export function isObject(n: any): n is object {
  return typeof n === 'object'
}

// 获取关键字符 '"x"' => 'x'
export function getIdentifierStr(n: string): string {
  return n.replace(/['\\"]+/g, '')
}

type Uuid = string

export function getUuid(): Uuid {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0,
      v = c == 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}
