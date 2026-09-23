<script setup>
defineProps({ record: { type: Object, required: true } })
</script>

<template>
  <time v-if="record.uploadedAt" class="upload-date" :datetime="record.uploadedAt">{{ record.uploadDateText }}</time>
  <span v-else class="upload-date">{{ record.uploadDateText }}</span>
</template>
