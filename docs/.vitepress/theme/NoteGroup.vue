<script setup>
defineProps({ group: { type: Object, required: true }, depth: { type: Number, default: 0 } })
</script>

<template>
  <section class="note-group" :class="{ 'note-subgroup': depth > 0 }">
    <component :is="`h${Math.min(depth + 1, 6)}`" v-if="depth > 0" class="note-group-title">{{ group.name }}</component>
    <ul v-if="group.notes.length" class="note-list">
      <li v-for="note in group.notes" :key="note.url"><a :href="note.url"><span>{{ note.title }}</span><span aria-hidden="true">↗</span></a></li>
    </ul>
    <NoteGroup v-for="child in group.groups" :key="child.path" :group="child" :depth="depth + 1" />
  </section>
</template>
