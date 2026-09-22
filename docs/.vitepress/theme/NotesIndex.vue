<script setup>
import { data as notebook } from '../notes.data.mjs'
import SectionCards from './SectionCards.vue'
</script>

<template>
  <section class="notes-page">
    <span class="section-number">THE NOTEBOOK</span>
    <h1>笔记专区<span class="title-dot">。</span></h1>
    <p class="notes-intro">不同的学习方向，各有一处慢慢积累的角落。</p>
    <div v-if="!notebook.sections.length" class="notes-empty">
      <img src="/bear.svg" width="72" height="72" alt="" />
      <h2>还没有发布笔记</h2>
      <p>这里的第一页，留给下一次学习。</p>
      <a href="/" class="text-link">回到小窝 <span aria-hidden="true">↗</span></a>
    </div>
    <SectionCards v-else :sections="notebook.sections" />
  </section>
</template>
