<script setup>
defineProps({ sections: { type: Array, required: true } })
</script>

<template>
  <ul class="section-cards">
    <li v-for="(section, index) in sections" :key="section.name">
      <a class="section-card" :href="section.url">
        <span class="section-card-top"><span class="section-number">{{ String(index + 1).padStart(2, '0') }} / NOTES</span><span class="section-card-arrow" aria-hidden="true">↗</span></span>
        <span class="section-card-name">{{ section.name }}</span>
        <span class="section-card-bottom"><span>{{ section.count }} 篇笔记</span><span>进入专区 <span aria-hidden="true">→</span></span></span>
      </a>
    </li>
  </ul>
</template>
