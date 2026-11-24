<script setup>
import { ref } from 'vue'
import { api, time, validatePhoto } from '../api.js'
import { useRequest, useWait } from '../state.js'

const camera = ref(null), dialog = ref(null), busy = ref(false), result = ref(null)
const message = ref(''), retryable = ref(false)
const signal = useRequest()
const { remaining, wait } = useWait()
let attempt = null
function reset() {
  attempt = null
  retryable.value = false
  result.value = null
  message.value = ''
  wait()
}
function present() { if (!dialog.value.open) dialog.value.showModal() }
async function capture(event) {
  const file = event.target.files[0]
  event.target.value = ''
  if (!file || busy.value) return
  reset()
  present()
  message.value = validatePhoto(file)
  if (message.value) return
  if (!globalThis.crypto?.randomUUID) {
    message.value = '请使用 HTTPS 地址打开页面后重新拍摄。'
    return
  }
  attempt = new FormData()
  attempt.append('photo', file)
  attempt.append('requestId', crypto.randomUUID())
  await send()
}
async function send() {
  if (!attempt || busy.value || remaining.value) return
  busy.value = true
  retryable.value = false
  message.value = ''
  try {
    result.value = await api('/check-ins', { method: 'POST', body: attempt, signal, session: false })
    attempt = null
  } catch (err) {
    message.value = err.message
    retryable.value = !err.status || err.status >= 500 || ['RATE_LIMITED','CHECK_IN_PROCESSING'].includes(err.code)
    if (retryable.value) wait(err.retryAfter)
    else attempt = null
  } finally { busy.value = false }
}
</script>
<template>
  <button class="primary" @click="camera.click()"><svg aria-hidden="true"><use href="#camera"/></svg>拍照打卡</button>
  <input ref="camera" type="file" accept="image/jpeg,image/png" capture="user" hidden @change="capture">
  <dialog ref="dialog" aria-labelledby="check-title" @close="reset" @cancel="busy && $event.preventDefault()">
    <header class="dialog-head"><h2 id="check-title">{{ result ? '打卡成功' : '拍照打卡' }}</h2>
      <button class="close" :disabled="busy" aria-label="关闭" @click="dialog.close()"><svg aria-hidden="true"><use href="#cross"/></svg></button>
    </header>
    <p v-if="busy" role="status">正在识别，请稍候…</p>
    <template v-else-if="result">
      <h3 class="person">{{ result.maskedName }}</h3>
      <p>{{ result.day.date }} · 本次打卡 {{ time(result.receivedAt) }}</p>
      <dl class="times"><div><dt>签到</dt><dd>{{ time(result.day.firstCheckInAt) }}</dd></div>
        <div><dt>签退</dt><dd>{{ result.day.status === 'PENDING_CHECKOUT' ? '待签退' : time(result.day.lastCheckOutAt) }}</dd></div></dl>
      <button class="primary" @click="dialog.close()">完成</button>
    </template>
    <template v-else>
      <p class="message" role="alert">{{ message }}</p>
      <button v-if="retryable" class="primary" :disabled="remaining > 0" @click="send">{{ remaining ? remaining + ' 秒后重试' : '重试本次打卡' }}</button>
      <button class="alternate" @click="camera.click()">重新拍摄</button>
    </template>
  </dialog>
</template>
