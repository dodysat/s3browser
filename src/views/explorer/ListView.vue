<template>
  <main>
    <div class="bg-base-300 p-5">
      <ul>
        <li v-for="(item, index) in fileStructure" :key="index">
          <TreeItem :item="item" :depth="0" />
        </li>
      </ul>
    </div>
  </main>
</template>

<script setup>
import { ref, onMounted, computed, watch } from "vue";
import { useRoute } from "vue-router";
import { listBuckets, listObjects } from "@/api/s3";
import { useAuthStore } from "@/stores/auth";
import TreeItem from "@/components/TreeItem.vue";

import {
  IconChevronRight,
  IconChevronDown,
  IconFolderOutline,
  IconFileOutline,
} from "@iconify-prerendered/vue-mdi";

const authStore = useAuthStore();
const buckets = ref([]);
const loading = ref(false);
const route = useRoute();
const fileStructure = ref([
  {
    Key: "config",
    Type: "folder",
    IsOpen: false,
    children: [
      {
        Key: "setup",
        Type: "folder",
        IsOpen: false,
        children: [
          {
            Key: "main",
            Type: "folder",
            IsOpen: false,
            children: [
              {
                Key: "up",
                Type: "folder",
                IsOpen: false,
                children: [
                  {
                    Key: "passport.js",
                    Size: 862837,
                    LastModified: "2021-09-30T07:00:00.000Z",
                    Type: "file",
                  },
                  {
                    Key: "routes.js",
                    Size: 862837,
                    LastModified: "2021-09-30T07:00:00.000Z",
                    Type: "file",
                  },
                ],
              },
              {
                Key: "passport.js",
                Size: 862837,
                LastModified: "2021-09-30T07:00:00.000Z",
                Type: "file",
              },
              {
                Key: "routes.js",
                Size: 862837,
                LastModified: "2021-09-30T07:00:00.000Z",
                Type: "file",
              },
            ],
          },
          {
            Key: "passport.js",
            Size: 862837,
            LastModified: "2021-09-30T07:00:00.000Z",
            Type: "file",
          },
          {
            Key: "routes.js",
            Size: 862837,
            LastModified: "2021-09-30T07:00:00.000Z",
            Type: "file",
          },
        ],
      },
      {
        Key: "database.js",
        Size: 862837,
        LastModified: "2021-09-30T07:00:00.000Z",
        Type: "file",
      },
    ],
  },
  {
    Key: "config",
    Size: 862837,
    LastModified: "2021-09-30T07:00:00.000Z",
    Type: "file",
  },
]);

const listObjectsParams = ref({
  Bucket: null,
  Prefix: null,
  MaxKeys: 100,
  ContinuationToken: null,
});

const params = computed(() => {
  return route.params.catchAll;
});

watch(params, async () => {
  await listObjcts();
});

onMounted(async () => {
  await listObjcts();
});

const listObjcts = async () => {
  loading.value = true;
  const bucket = params.value[0];
  listObjectsParams.value.Bucket = bucket;
  listObjectsParams.value.Prefix = params.value.slice(1).join("/") + "/";
  const { Contents, CommonPrefixes, NextContinuationToken } = await listObjects(
    listObjectsParams.value
  );

  loading.value = false;
};
</script>

<style scoped>
ul {
  list-style-type: none;
  padding-left: 20px;
}

li {
  margin-bottom: 5px;
}
</style>
