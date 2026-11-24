<script setup>
defineProps(['to', 'icon', 'title', 'detail'])
</script>
<template>
  <a class="route" :href="'#/' + to">
    <svg aria-hidden="true"><use :href="'#'+icon"/></svg>
    <span><b>{{ title }}</b><small v-if="detail">{{ detail }}</small></span>
    <svg class="arrow" aria-hidden="true"><use href="#arrow"/></svg>
  </a>
</template>
