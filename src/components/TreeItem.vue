<template>
  <div>
    <!-- Flex container to separate the name and details (size and date) -->
    <div
      @click="toggle"
      class="item"
      :class="{ folder: isFolder, open: item.IsOpen }"
      :style="{ paddingLeft: depth * 20 + 'px' }"
    >
      <div class="file-info">
        <span v-if="isFolder">
          <i
            class="icon"
            :class="{
              'folder-icon': !item.IsOpen,
              'folder-open-icon': item.IsOpen,
            }"
          ></i>
          {{ item.Key }}
        </span>
        <span v-else>
          <i class="icon file-icon"></i>
          {{ item.Key }}
        </span>
      </div>
      <div class="file-details" v-if="!isFolder">
        <span>{{ formatSize(item.Size) }}</span>
        <span>{{ formatDate(item.LastModified) }}</span>
      </div>
    </div>

    <!-- If it's a folder and open, render children recursively -->
    <ul v-if="isFolder && item.IsOpen">
      <li v-for="(child, index) in item.children" :key="index">
        <TreeItem :item="child" :depth="depth + 1" />
      </li>
    </ul>
  </div>
</template>

<script setup>
import { computed } from "vue";

// Props
const props = defineProps({
  item: {
    type: Object,
    required: true,
  },
  depth: {
    type: Number,
    default: 0, // This tracks how deep the current item is in the hierarchy
  },
});

// Computed property to check if the item is a folder
const isFolder = computed(() => props.item.Type === "folder");

// Toggle function to open/close folder
const toggle = () => {
  if (isFolder.value) {
    props.item.IsOpen = !props.item.IsOpen;
  }
};

// Helper functions for formatting
const formatSize = (size) => {
  if (size < 1024) return `${size} B`;
  if (size < 1048576) return `${(size / 1024).toFixed(2)} KB`;
  return `${(size / 1048576).toFixed(2)} MB`;
};

const formatDate = (date) => {
  return new Date(date).toLocaleString();
};
</script>

<style scoped>
.item {
  cursor: pointer;
  display: flex;
  justify-content: space-between; /* Aligns name and details in separate columns */
  align-items: center;
  margin-left: 10px;
}

.file-info {
  flex: 1;
  display: flex;
  align-items: center;
}

.file-details {
  display: flex;
  gap: 20px; /* Space between size and date */
  color: gray;
  font-size: 0.9em;
}

.icon {
  margin-right: 5px;
}

.folder-icon::before {
  content: "📁"; /* Folder icon (closed) */
}

.folder-open-icon::before {
  content: "📂"; /* Folder icon (open) */
}

.file-icon::before {
  content: "📄"; /* File icon */
}
</style>
