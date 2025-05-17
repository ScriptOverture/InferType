import type { Variable } from './variable.ts'

/**
 * 块级作用域内声明返回类型
 */
export interface ScopeReturnAnalysis {
  returnTypeVariable: Variable
  /**
   * 所有 case return 是否都命中； 命中 true, 否则 false
   */
  returnIsAllMatch: boolean
}

// switch - 推断 CaseBlock 的返回类型
export interface CaseBlockResult extends ScopeReturnAnalysis {
  /**
   * 所有 case 类型
   */
  caseTypeVariable: Variable
}
