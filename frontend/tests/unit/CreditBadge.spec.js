import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/vue'
import { defineComponent, h } from 'vue'
import { calcCredit } from '@/utils/credit'

// 用 Testing Library 渲染一个最小组件，验证学分计算在组件层可正确集成
const CreditBadge = defineComponent({
  props: { creditValue: Number, type: String, status: String },
  setup(props) {
    const { credit } = calcCredit(props.creditValue, props.type, props.status)
    return () => h('span', { 'data-testid': 'credit' }, `学分:${credit}`)
  }
})

describe('组件集成（Vue Testing Library）', () => {
  it('按时完成渲染满分', () => {
    const { getByTestId } = render(CreditBadge, { props: { creditValue: 5, type: 'HOMEWORK', status: 'DONE_ONTIME' } })
    expect(getByTestId('credit').textContent).toBe('学分:5')
  })

  it('逾期完成渲染向下取整后的学分', () => {
    const { getByTestId } = render(CreditBadge, { props: { creditValue: 5, type: 'HOMEWORK', status: 'DONE_OVERDUE' } })
    expect(getByTestId('credit').textContent).toBe('学分:2')
  })
})
