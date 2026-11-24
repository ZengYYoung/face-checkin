<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { today } from '../api.js'

const date = ref(today())
const labels = [...'一二三四五六日']
const parts = computed(() => date.value.split('-'))
const position = computed(() => (new Date(date.value + 'T00:00:00Z').getUTCDay() + 6) % 7)
const week = computed(() => labels.map((_, index) => {
  const day = new Date(date.value + 'T00:00:00Z')
  day.setUTCDate(day.getUTCDate() + index - position.value)
  return day.getUTCDate()
}))
let timer
const update = () => { date.value = today() }
onMounted(() => { timer = setInterval(update, 1000); document.addEventListener('visibilitychange', update) })
onUnmounted(() => { clearInterval(timer); document.removeEventListener('visibilitychange', update) })
</script>
<template>
  <section class="calendar" aria-label="本周日历">
    <div class="calendar-head"><strong>{{ parts[0] }} 年 {{ Number(parts[1]) }} 月</strong><span class="weekday">星期{{ labels[position] }}</span></div>
    <time class="day" :datetime="date">{{ parts[2] }}</time>
    <ol class="week" aria-label="本周日期">
      <li v-for="(label,i) in labels" :key="label" :aria-current="i === position ? 'date' : undefined"><span>{{ label }}</span><strong>{{ week[i] }}</strong></li>
    </ol>
  </section>
</template>
