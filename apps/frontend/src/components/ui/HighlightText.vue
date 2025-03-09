<!-- Highlight matched text in content -->
<script setup lang="ts">
interface Props {
  content: string
  query: string
}

defineProps<Props>()

/**
 * Split text into segments and highlight matches
 */
function getHighlightedSegments(content: string, query: string) {
  if (!query.trim())
    return [{ text: content, isMatch: false }]

  const segments = []
  const lowerContent = content.toLowerCase()
  const lowerQuery = query.toLowerCase()
  let lastIndex = 0

  while (true) {
    const index = lowerContent.indexOf(lowerQuery, lastIndex)
    if (index === -1) {
      // Add remaining text
      if (lastIndex < content.length) {
        segments.push({
          text: content.slice(lastIndex),
          isMatch: false,
        })
      }
      break
    }

    // Add text before match
    if (index > lastIndex) {
      segments.push({
        text: content.slice(lastIndex, index),
        isMatch: false,
      })
    }

    // Add matched text
    segments.push({
      text: content.slice(index, index + query.length),
      isMatch: true,
    })

    lastIndex = index + query.length
  }

  return segments
}
</script>

<template>
  <span>
    <template v-for="(segment, index) in getHighlightedSegments(content, query)" :key="index">
      <span
        :class="{
          'bg-yellow-200 dark:bg-yellow-900 dark:text-yellow-100': segment.isMatch,
        }"
      >{{ segment.text }}</span>
    </template>
  </span>
</template>
