<script setup lang="ts">
import GlobalSearch from '../components/GlobalSearch.vue'
</script>

<template>
  <GlobalSearch
    :open="true"
  >
    <template #settings>
      <div class="flex items-center gap-4">
        <div class="flex items-center gap-2">
          <input id="searchContent" type="checkbox" class="rounded border-border">
          <label for="searchContent" class="text-sm text-foreground">搜索内容</label>
        </div>
        <div class="flex items-center gap-2">
          <input id="searchName" type="checkbox" class="rounded border-border">
          <label for="searchName" class="text-sm text-foreground">搜索用户名</label>
        </div>
        <div class="flex items-center gap-2">
          <input id="searchName" type="checkbox" class="rounded border-border">
          <label for="searchName" class="text-sm text-foreground">语义搜索</label>
        </div>
      </div>
    </template>
  </GlobalSearch>
</template>
