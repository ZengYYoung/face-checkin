<script setup>
import { computed, ref } from 'vue'
import PhotoInput from './PhotoInput.vue'
import { api } from '../api.js'
import { useRequest, useWait } from '../state.js'
const props = defineProps(['mode','initialNumber'])
const emit = defineEmits(['registered','signed-in'])
const register = computed(() => props.mode === 'register')
const studentNo = ref(props.initialNumber || ''), name = ref(''), password = ref(''), photo = ref(null)
const error = ref(''), field = ref(''), busy = ref(false)
const signal = useRequest()
const { remaining, wait } = useWait()
async function submit() {
  if (busy.value || remaining.value) return
  error.value = ''
  field.value = ''
  busy.value = true
  try {
    if (register.value) {
      if (!name.value.trim()) throw Object.assign(new Error('请填写姓名。'), { field: 'name' })
      if (!photo.value) throw Object.assign(new Error('请先选择本人的标准照。'), { field: 'photo' })
      const body = new FormData()
      for (const [key, value] of Object.entries({studentNo:studentNo.value, name:name.value.trim(), password:password.value, photo:photo.value})) body.append(key,value)
      await api('/users', {method:'POST',body,signal,session:false})
      if (!signal.aborted) emit('registered',studentNo.value)
    } else {
      const { user } = await api('/sessions', {method:'POST',body:{studentNo:studentNo.value,password:password.value},signal,session:false})
      if (!signal.aborted) emit('signed-in',user)
    }
  } catch (err) {
    error.value = err.message
    field.value = err.field || (err.code === 'STUDENT_NO_TAKEN' ? 'studentNo' : '')
    wait(err.retryAfter)
  } finally { busy.value = false }
}
</script>
<template>
  <h1>{{ register ? '注册账号' : '学号登录' }}</h1>
  <form class="page-form" @submit.prevent="submit">
    <fieldset :disabled="busy" class="fields">
      <label>学号<input v-model="studentNo" name="studentNo" inputmode="numeric" pattern="[0-9]{1,32}" maxlength="32" autocomplete="username" :aria-invalid="field === 'studentNo'" required></label>
      <label v-if="register">姓名<input v-model="name" name="name" maxlength="64" autocomplete="name" :aria-invalid="field === 'name'" required></label>
      <label>密码<input v-model="password" name="password" type="password" :minlength="register ? 8 : 1" :maxlength="register ? 64 : undefined" :autocomplete="register ? 'new-password' : 'current-password'" :placeholder="register ? '8 至 64 个字符' : undefined" :aria-invalid="field === 'password'" required></label>
    </fieldset>
    <PhotoInput v-if="register" v-model="photo" :disabled="busy" />
    <p v-if="error" class="message" role="alert">{{ error }}</p>
    <button class="primary" :disabled="busy || remaining > 0">{{ busy ? '正在提交…' : remaining ? remaining + ' 秒后重试' : register ? '注册并录入标准照' : '登录' }}</button>
    <a class="text-link" :href="register ? '#/login' : '#/register'">{{ register ? '已有账号，前往登录' : '首次使用，注册账号' }}</a>
  </form>
</template>
