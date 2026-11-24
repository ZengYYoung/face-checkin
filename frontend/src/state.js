import { ref, onScopeDispose } from 'vue'

export function useRequest() {
  const lifetime = new AbortController()
  onScopeDispose(() => lifetime.abort())
  return lifetime.signal
}

export function useWait() {
  const remaining = ref(0)
  let timer
  function wait(seconds = 0) {
    clearInterval(timer)
    const until = Date.now() + Math.max(0, seconds) * 1000
    function tick() {
      remaining.value = Math.max(0, Math.ceil((until - Date.now()) / 1000))
      if (!remaining.value) clearInterval(timer)
    }
    tick()
    if (remaining.value) timer = setInterval(tick, 250)
  }
  onScopeDispose(() => clearInterval(timer))
  return { remaining, wait }
}
