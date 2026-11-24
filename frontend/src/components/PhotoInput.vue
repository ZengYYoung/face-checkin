<script setup>
import { ref, watch, onUnmounted } from 'vue'
import { validatePhoto } from '../api.js'
const file = defineModel()
defineProps({ disabled: Boolean })
const emit = defineEmits(['change'])
const camera = ref(null), album = ref(null), url = ref(''), error = ref('')
watch(file, value => {
  if (url.value) URL.revokeObjectURL(url.value)
  url.value = value ? URL.createObjectURL(value) : ''
}, { immediate: true })
onUnmounted(() => { if (url.value) URL.revokeObjectURL(url.value) })
function select(event) {
  const input = event.target
  const next = input.files[0]
  input.value = ''
  if (!next) return
  error.value = validatePhoto(next)
  file.value = error.value ? null : next
  emit('change')
}
</script>
<template>
  <fieldset :disabled="disabled" class="photo-field">
    <legend>本人标准照</legend>
    <p class="hint">请选清晰单人照，JPEG 或 PNG，上限 <span class="unit">5 MiB</span>。</p>
    <div class="photo-tools">
      <button type="button" class="alternate" @click="camera.click()">拍摄标准照</button>
      <button type="button" class="alternate" @click="album.click()">从相册选择</button>
    </div>
    <input ref="camera" hidden type="file" accept="image/jpeg,image/png" capture="user" @change="select">
    <input ref="album" hidden type="file" accept="image/jpeg,image/png" @change="select">
    <img v-if="url" :src="url" class="preview" alt="待提交的标准照">
    <p v-if="error" class="message" role="alert">{{ error }}</p>
  </fieldset>
</template>
