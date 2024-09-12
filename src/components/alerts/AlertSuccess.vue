<script setup>
defineProps({
  msg: {
    type: String
  }
})
</script>

<template>
  <div role="alert" class="alert alert-success justify-start p-3" v-if="msg">
    <span class="text-left">{{ msg }}</span>
  </div>
</template>
