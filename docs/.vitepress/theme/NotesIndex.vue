<script setup>
import { data as notes } from '../notes.data.mjs'
</script>

<template>
  <section class="notes-page">
    <span class="section-number">THE NOTEBOOK</span>
    <h1>学习笔记<span class="title-dot">。</span></h1>
    <p class="notes-intro">把零散的知识，整理成自己的理解。</p>
    <div v-if="!notes.length" class="notes-empty">
      <img src="/bear.svg" width="72" height="72" alt="" />
      <h2>还没有发布笔记</h2>
      <p>这里的第一页，留给下一次学习。</p>
      <a href="/" class="text-link">回到小窝 <span aria-hidden="true">↗</span></a>
    </div>
    <ul v-else class="note-list"><li v-for="note in notes" :key="note.url"><a :href="note.url"><span>{{ note.title }}</span><span aria-hidden="true">↗</span></a></li></ul>
  </section>
</template>
