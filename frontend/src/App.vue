<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { api } from './api.js'
import CalendarPage from './components/CalendarPage.vue'
import CheckIn from './components/CheckIn.vue'
import RouteLink from './components/RouteLink.vue'
import AuthForm from './components/AuthForm.vue'
import PhotoPage from './components/PhotoPage.vue'
import RecordsList from './components/RecordsList.vue'

const pages = ['home','register','login','photo','attendance','users']
function readPage() {
  const path = location.hash.replace(/^#\/?/,'')
  return pages.includes(path) ? path : 'home'
}
const route = ref(readPage()), user = ref(null), restoring = ref(true), restoreError = ref('')
const banner = ref(''), initialNumber = ref(''), loggingOut = ref(false)
const privatePage = computed(() => ['photo','attendance','users'].includes(route.value))
let generation = 0
function navigate(next, replace = false) {
  if (replace) history.replaceState(null,'','#/'+next)
  else location.hash = '/'+next
  route.value = next
}
function guard() {
  if (privatePage.value && !restoring.value && !restoreError.value && !user.value) {
    banner.value = '请先登录后继续。'
    navigate('login',true)
  }
  if (user.value && ['login','register'].includes(route.value)) navigate('home',true)
}
function locationChanged() {
  route.value = readPage()
  guard()
  window.scrollTo(0,0)
}
async function restore() {
  const version = ++generation
  restoring.value = true
  restoreError.value = ''
  try {
    const data = await api('/sessions/current', {session:false})
    if (version === generation) user.value = data.user
  } catch (err) {
    if (version === generation && err.code !== 'UNAUTHENTICATED') restoreError.value = err.message
  } finally {
    if (version === generation) { restoring.value = false; guard() }
  }
}
function expired() {
  generation++
  user.value = null
  restoring.value = false
  restoreError.value = ''
  initialNumber.value = ''
  banner.value = '会话已过期，请重新登录。'
  navigate('login',true)
}
function registered(number) {
  initialNumber.value = number
  banner.value = '注册成功，请使用学号和密码登录。'
  navigate('login')
}
function signedIn(account) {
  generation++
  user.value = account
  restoring.value = false
  restoreError.value = banner.value = initialNumber.value = ''
  navigate('home',true)
}
async function logout() {
  if (loggingOut.value) return
  loggingOut.value = true
  try {
    await api('/sessions/current',{method:'DELETE',session:false})
    generation++
    user.value = null
    initialNumber.value = restoreError.value = ''
    banner.value = '已退出登录。'
    navigate('home',true)
  } catch (err) { if (err.code === 'UNAUTHENTICATED') expired(); else banner.value = err.message }
  finally { loggingOut.value = false }
}
function photoChanged(id, hasFacePhoto) {
  if (user.value?.id === id) user.value.hasFacePhoto = hasFacePhoto
}
onMounted(() => {
  window.addEventListener('hashchange',locationChanged)
  window.addEventListener('session-expired',expired)
  restore()
})
onUnmounted(() => {
  window.removeEventListener('hashchange',locationChanged)
  window.removeEventListener('session-expired',expired)
})
</script>
<template>
  <div class="shell">
    <header class="mast">
      <a href="#/home" class="brand"><svg aria-hidden="true"><use href="#calendar"/></svg>人脸签到</a>
      <span class="zone"><svg aria-hidden="true"><use href="#clock"/></svg>北京时间</span>
    </header>
    <div v-if="banner" class="notice" role="status"><span>{{ banner }}</span><button class="close" @click="banner=''" aria-label="关闭提示">×</button></div>
    <main v-if="route === 'home'" class="home">
      <CalendarPage/>
      <section><h1>今日打卡</h1><CheckIn/>
        <nav class="links" aria-label="账号操作">
          <template v-if="user">
            <RouteLink to="photo" icon="user" title="我的标准照" :detail="user.name + ' · ' + user.studentNo" />
            <RouteLink to="attendance" icon="calendar" title="考勤记录" :detail="user.role === 'ADMIN' ? '按日期及学号查询' : '查看本人的签到与签退时间'" />
            <RouteLink v-if="user.role === 'ADMIN'" to="users" icon="user" title="人员照片库" detail="按学号查找和管理标准照" />
            <button class="text-link" :disabled="loggingOut" @click="logout">退出登录</button>
          </template>
          <template v-else>
            <RouteLink to="register" icon="user" title="注册账号" detail="首次使用，录入本人标准照"/>
            <RouteLink to="login" icon="log" title="学号登录" detail="管理标准照，查看考勤记录"/>
          </template>
        </nav>
      </section>
    </main>
    <main v-else class="page" :key="route">
      <a class="back" href="#/home">‹ 返回首页</a>
      <AuthForm v-if="route === 'register' || route === 'login'" :mode="route" :initial-number="initialNumber" @registered="registered" @signed-in="signedIn"/>
      <p v-else-if="restoring" role="status">正在恢复会话…</p>
      <template v-else-if="restoreError"><p class="message" role="alert">{{ restoreError }}</p><button class="alternate" @click="restore">重新连接</button></template>
      <template v-else-if="user">
        <PhotoPage v-if="route === 'photo'" :person="user" @updated="photoChanged"/>
        <p v-else-if="route === 'users' && user.role !== 'ADMIN'" role="alert">没有权限访问人员照片库。</p>
        <RecordsList v-else :directory="route === 'users'" :admin="user.role === 'ADMIN'" @updated="photoChanged"/>
      </template>
    </main>
  </div>
</template>
