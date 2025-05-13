import type { Variable } from './variable.ts'

// switch - 推断 CaseBlock 的返回类型
export type CaseBlockResult = {
  /**
   * 所有 case 类型
   */
  caseTypeVariable: Variable
  /**
   * 所有 case return 类型
   */
  caseReturnTypeVariable: Variable
  /**
   * 所有 case return 是否都命中； 命中 true, 否则 false
   */
  returnIsAllMatch: boolean
}
