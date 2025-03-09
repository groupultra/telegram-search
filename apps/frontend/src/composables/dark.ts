import { useDark, useToggle } from '@vueuse/core'
import { defineStore } from 'pinia'

export const useDarkStore = defineStore('dark', () => {
// 使用 Bootstrap 风格的主题切换
  const isDark = useDark({
    selector: 'html',
    attribute: 'class',
    valueDark: 'dark',
    valueLight: '',
  })
  function toggleDark(event?: MouseEvent) {
    // 如果没有事件对象（比如通过其他方式触发），使用屏幕中心作为动画起点
    const x = event?.clientX ?? window.innerWidth / 2
    const y = event?.clientY ?? window.innerHeight / 2

    // 计算动画结束时圆的半径（使用勾股定理）
    const endRadius = Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y),
    )

    // 降级处理：不支持 View Transitions API 的浏览器
    if (!document.startViewTransition) {
      return useToggle(isDark)()
    }

    // 开始视图过渡
    const transition = document.startViewTransition(() => {
      useToggle(isDark)()
    })

    // 添加圆形扩散动画
    transition.ready.then(() => {
      // 定义圆形裁剪路径
      const clipPath = [
        `circle(0px at ${x}px ${y}px)`,
        `circle(${endRadius}px at ${x}px ${y}px)`,
      ]

      // 根据当前主题状态决定动画方向
      document.documentElement.animate(
        {
          clipPath: isDark.value ? [...clipPath].reverse() : clipPath,
        },
        {
          duration: 400,
          easing: 'ease-in',
          // 选择正确的伪元素
          pseudoElement: isDark.value
            ? '::view-transition-old(root)'
            : '::view-transition-new(root)',
        },
      )
    })
  }

  return { toggleDark, isDark }
})
