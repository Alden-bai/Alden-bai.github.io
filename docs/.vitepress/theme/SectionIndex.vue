<script setup>
import { computed } from 'vue'
import { useData } from 'vitepress'
import { data as notebook } from '../notes.data.mjs'
import NoteGroup from './NoteGroup.vue'

const { params } = useData()
const section = computed(() => notebook.sections.find(item => item.name === params.value?.section))
</script>

<template>
  <section v-if="section" class="notes-page section-page">
    <a class="section-back" href="/notes/">← 全部专区</a>
    <span class="section-number">THE NOTEBOOK</span>
    <h1>{{ section.name }}<span class="title-dot">。</span></h1>
    <p class="notes-intro">共 {{ section.count }} 篇笔记，把每一次收获留在这里。</p>
    <NoteGroup :group="section.tree" />
  </section>
</template>
