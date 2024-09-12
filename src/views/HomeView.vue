<template>
  <main>
    <div class="navbar bg-base-200">
      <div class="navbar-start">
        <a class="btn btn-ghost text-xl">S3 Browser</a>
      </div>
      <div class="navbar-end">
        <a class="btn" @click="showBuckets">
          <IconBucketOutline />
          <span v-if="currentBucket" class="ml-2">{{ currentBucket }}</span>
          <span v-else class="ml-2">Select Bucket</span>
        </a>
        <a class="btn" @click="logOut">Log Out</a>
      </div>
    </div>

    <RouterView class="mb-20 mt-5" />

    <div class="bottom-nav bg-base-200 p-2 flex gap-1">
      <!-- {{ params }} -->
      <div class="w-min" v-for="param in params" :key="param">
        <div class="flex items-center w-min gap-1">
          <IconChevronRight v-if="params.indexOf(param) !== 0" />
          <IconBucketOutline v-if="params.indexOf(param) === 0" />
          <IconFolderOutline v-if="params.indexOf(param) !== 0" />
          <router-link
            :to="
              '/list/' + params.slice(0, params.indexOf(param) + 1).join('/')
            "
            >{{ param }}</router-link
          >
        </div>
      </div>
    </div>
  </main>
</template>

<script setup>
import { RouterView, useRoute } from "vue-router";
import router from "@/router";

import {
  IconBucketOutline,
  IconChevronRight,
  IconFolderOutline,
} from "@iconify-prerendered/vue-mdi";

import { ref, onMounted, computed } from "vue";
import { useAuthStore } from "@/stores/auth";

const route = useRoute();

const params = computed(() => {
  return route.params.catchAll;
});

const authStore = useAuthStore();

const currentBucket = computed(() => {
  return authStore.bucket;
});

onMounted(() => {
  if (!authStore.accessKeyId) {
    router.push("/auth");
  }
});

const showBuckets = () => {
  console.log("showBuckets");
};

const logOut = () => {
  authStore.logout();
  router.push("/auth");
};
</script>

<style scoped>
.navbar {
  position: sticky;
  top: 0;
  z-index: 1000;
}

.bottom-nav {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 1000;
}
</style>
