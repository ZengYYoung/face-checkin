<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { api } from '../api.js'
import { useRequest, useWait } from '../state.js'
import PhotoInput from './PhotoInput.vue'
const props = defineProps(['person'])
const emit = defineEmits(['updated'])
const signal = useRequest()
const { remaining, wait } = useWait()
const path = '/users/' + encodeURIComponent(props.person.id) + '/face-photo'
const current = ref(''), selected = ref(null), busy = ref(false), state = ref('loading')
const error = ref(''), notice = ref(''), deleting = ref(false)
function clearCurrent() {
  if (current.value) URL.revokeObjectURL(current.value)
  current.value = ''
}
onUnmounted(clearCurrent)
async function load() {
  state.value = 'loading'
  error.value = ''
  try {
    const image = await api(path, { image:true,signal })
    if (signal.aborted) return
    clearCurrent()
    current.value = URL.createObjectURL(image)
    state.value = 'ready'
  } catch (err) {
    if (err.code === 'PHOTO_NOT_FOUND') { clearCurrent(); state.value = 'empty' }
    else { error.value = err.message; state.value = 'error' }
  }
}
onMounted(load)
async function save(remove = false) {
  if (busy.value || remaining.value || (!remove && !selected.value)) return
  busy.value = true
  notice.value = error.value = ''
  try {
    const body = new FormData()
    if (!remove) body.append('photo', selected.value)
    await api(path, { method:remove ? 'DELETE' : 'PUT',body:remove ? undefined : body,signal })
    if (signal.aborted) return
    selected.value = null
    deleting.value = false
    clearCurrent()
    emit('updated', props.person.id, !remove)
    if (remove) state.value = 'empty'
    else await load()
    notice.value = remove ? '标准照已删除，历史考勤记录已保留。' : '标准照已保存。'
  } catch (err) { error.value = err.message; wait(err.retryAfter) }
  finally { busy.value = false }
}
</script>
<template>
  <h1>标准照</h1>
  <p class="identity">{{ person.name }} · {{ person.studentNo }}</p>
  <section class="photo-box" aria-label="当前标准照">
    <p v-if="state === 'loading'" role="status">正在读取标准照…</p>
    <img v-else-if="state === 'ready'" :src="current" alt="当前标准照">
    <p v-else-if="state === 'empty'">尚未录入标准照</p>
    <button v-else class="alternate" @click="load">重新读取标准照</button>
  </section>
  <p v-if="notice" role="status">{{ notice }}</p>
  <p v-if="error" class="message" role="alert">{{ error }}</p>
  <template v-if="state === 'ready' || state === 'empty'">
    <PhotoInput v-model="selected" :disabled="busy || deleting" @change="error = notice = ''" />
    <button class="primary" :disabled="busy || deleting || !selected || remaining > 0" @click="save()">{{ remaining ? remaining + ' 秒后重试' : state === 'empty' ? '录入标准照' : '保存新标准照' }}</button>
    <button v-if="state === 'ready' && !deleting" class="text-link" :disabled="busy" @click="deleting=true">删除标准照</button>
    <section v-if="deleting" class="confirmation" aria-label="确认删除">
      <p>删除后需重新录入才能打卡，已有考勤记录会保留。</p>
      <div class="photo-tools"><button class="alternate" :disabled="busy" @click="deleting=false">取消</button>
        <button class="primary" :disabled="busy || remaining > 0" @click="save(true)">确认删除</button></div>
    </section>
  </template>
</template>
