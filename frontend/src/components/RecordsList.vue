<script setup>
import { ref, computed, onMounted } from 'vue'
import { api, time } from '../api.js'
import { useRequest, useWait } from '../state.js'
import PhotoPage from './PhotoPage.vue'
const props = defineProps(['directory','admin'])
const emit = defineEmits(['updated'])
const signal = useRequest()
const { remaining, wait } = useWait()
const from = ref(''), to = ref(''), studentNo = ref(''), selected = ref(null)
const items = ref([]), total = ref(0), page = ref(1), busy = ref(false), error = ref('')
const pages = computed(() => Math.max(1, Math.ceil(total.value/20)))
let filters = {}, latest = 0
async function load(number) {
  const version = ++latest
  busy.value = true
  error.value = ''
  items.value = []
  const query = new URLSearchParams({...filters,page:String(number),size:'20'})
  try {
    const data = await api((props.directory ? '/users?' : '/attendance-days?') + query, {signal})
    if (version !== latest || signal.aborted) return
    items.value = data.items
    total.value = data.total
    page.value = data.page
  } catch (err) { if (version === latest) { error.value = err.message; wait(err.retryAfter) } }
  finally { if (version === latest) busy.value = false }
}
function search() {
  if (remaining.value) return
  if (!props.directory && from.value && to.value && from.value > to.value) {
    latest++
    busy.value = false
    error.value = '开始日期不能晚于结束日期。'
    items.value = []
    return
  }
  filters = {}
  if (props.admin && studentNo.value) filters.studentNo = studentNo.value
  if (!props.directory && from.value) filters.from = from.value
  if (!props.directory && to.value) filters.to = to.value
  load(1)
}
function photoChanged(id, hasFacePhoto) {
  const person = items.value.find(item => item.id === id)
  if (person) person.hasFacePhoto = hasFacePhoto
  emit('updated', id, hasFacePhoto)
}
onMounted(search)
</script>
<template>
  <template v-if="selected">
    <button class="text-link" @click="selected=null">返回人员列表</button>
    <PhotoPage :key="selected.id" :person="selected" @updated="photoChanged" />
  </template>
  <template v-else>
    <h1>{{ directory ? '人员照片库' : '考勤记录' }}</h1>
    <form class="filters fields" @submit.prevent="search">
      <div v-if="!directory" class="date-pair">
        <label>开始日期<input type="date" v-model="from"></label>
        <label>结束日期<input type="date" v-model="to"></label>
      </div>
      <label v-if="admin">学号<input v-model="studentNo" inputmode="numeric" maxlength="32" pattern="[0-9]{1,32}" placeholder="输入完整学号，或留空查看全部"></label>
      <p class="hint" v-if="!directory && !from && !to">未选择日期时显示今天的记录。</p>
      <button class="alternate" type="submit" :disabled="busy || remaining > 0">{{ remaining ? remaining + ' 秒后重试' : '查询' }}</button>
    </form>
    <p v-if="busy" role="status">正在查询…</p>
    <p v-else-if="error" class="message" role="alert">{{ error }}</p>
    <template v-else>
      <p v-if="!items.length" class="empty">{{ directory ? '没有符合条件的学生。' : '所选日期没有考勤记录。' }}</p>
      <ul v-else class="rows">
        <li v-for="entry in items" :key="directory ? entry.id : entry.userId+'@'+entry.date">
          <button v-if="directory" class="person-row" @click="selected=entry"><span><b>{{ entry.name }}</b><small>{{ entry.studentNo }}</small></span><span>{{ entry.hasFacePhoto ? '已录入' : '待录入' }} ›</span></button>
          <article v-else>
            <header><b>{{ entry.date }}</b></header>
            <p v-if="admin">{{ entry.name }} · {{ entry.studentNo }}</p>
            <dl class="times"><div><dt>签到</dt><dd>{{ time(entry.firstCheckInAt) }}</dd></div><div><dt>签退</dt><dd>{{ entry.lastCheckOutAt ? time(entry.lastCheckOutAt) : '待签退' }}</dd></div></dl>
          </article>
        </li>
      </ul>
      <nav v-if="pages > 1 || page > 1" class="pager" aria-label="分页">
        <button class="alternate" :disabled="page <= 1" @click="load(page-1)">上一页</button>
        <span>{{ page }} / {{ pages }}</span>
        <button class="alternate" :disabled="page >= pages" @click="load(page+1)">下一页</button>
      </nav>
    </template>
  </template>
</template>
