import { Node, ts } from 'ts-morph'

// 属性
export type Property = {
  name: string
  questionDotToken?: Node<ts.QuestionDotToken>
}
