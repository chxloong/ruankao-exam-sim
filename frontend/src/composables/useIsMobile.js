import { ref, onMounted, onBeforeUnmount } from 'vue';

/** 窄屏（竖屏手机）判定：默认断点 768px，随窗口变化实时更新 */
export function useIsMobile(breakpoint = 768) {
  const isMobile = ref(window.innerWidth <= breakpoint);
  const mq = window.matchMedia(`(max-width: ${breakpoint}px)`);
  const update = (e) => {
    isMobile.value = e.matches;
  };
  onMounted(() => mq.addEventListener('change', update));
  onBeforeUnmount(() => mq.removeEventListener('change', update));
  return isMobile;
}
