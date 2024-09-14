<template>
  <main>
    <div>
      <progress class="progress h-1" v-if="loading"></progress>
      <div class="h-6" v-else></div>
    </div>
    <div class="bg-base-200 p-5">
      <div class="overflow-x-auto">
        <table class="table table-xs table-zebra">
          <thead>
            <tr>
              <th>Name</th>
              <th>Type</th>
              <th>Last Modified</th>
              <th>Size</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="file in fileListStore.list" :key="file.Key">
              <td>
                <a @click="navigate(file)">
                  {{ file.Name }}
                </a>
              </td>
              <td>{{ file.Type }}</td>
              <td>{{ formatDate(file.LastModified) }}</td>
              <td>{{ formatSize(file.Size) }}</td>
              <td>Action</td>
            </tr>
          </tbody>
        </table>

        <div v-if="fileListStore.nextToken" class="text-center mt-5">
          <button
            class="btn btn-sm btn-primary"
            @click="listObjcts(fileListStore.nextToken)"
            :disabled="loading"
          >
            <span class="loading loading-spinner" v-if="loading"></span>
            Load More
          </button>
        </div>
      </div>
    </div>
  </main>
</template>

<script setup>
import { ref, onMounted, computed, watch } from "vue";
import { useRoute } from "vue-router";
import { listBuckets, listObjects } from "@/api/s3";
import { useAuthStore } from "@/stores/auth";
import { useFileListStore } from "@/stores/file_list";
import TreeItem from "@/components/TreeItem.vue";
import router from "@/router";

import {
  IconChevronRight,
  IconChevronDown,
  IconFolderOutline,
  IconFileOutline,
} from "@iconify-prerendered/vue-mdi";

const authStore = useAuthStore();
const fileListStore = useFileListStore();
const buckets = ref([]);
const loading = ref(false);
const route = useRoute();

const formatSize = (size) => {
  if (!size) return "-";
  if (size < 1024) return `${size} B`;
  if (size < 1048576) return `${(size / 1024).toFixed(2)} KB`;
  return `${(size / 1048576).toFixed(2)} MB`;
};

const formatDate = (date) => {
  if (!date) return "-";
  return new Date(date).toLocaleString();
};

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

const navigate = (file) => {
  if (loading.value) return;
  if (file.Type === "folder") {
    const name = file.Name;
    console.log("Navigate to", name);
    const newPath = [...params.value, name];
    newPath.forEach((item, index) => {
      if (item === "") {
        newPath.splice(index, 1);
      }
    });
    router.push({ params: { catchAll: newPath } });
  }
};

const listObjcts = async (nextToken) => {
  loading.value = true;
  const bucket = params.value[0];
  listObjectsParams.value.Bucket = bucket;
  listObjectsParams.value.Prefix = params.value.slice(1).join("/") + "/";
  if (listObjectsParams.value.Prefix === "/") {
    listObjectsParams.value.Prefix = null;
  }

  if (nextToken) {
    listObjectsParams.value.ContinuationToken = nextToken;
  } else {
    listObjectsParams.value.ContinuationToken = null;
  }

  const { Contents, CommonPrefixes, NextContinuationToken } = await listObjects(
    listObjectsParams.value
  );

  if (!nextToken) {
    fileListStore.list = [];
  }

  if (NextContinuationToken) {
    fileListStore.nextToken = NextContinuationToken;
  } else {
    fileListStore.nextToken = null;
  }

  if (fileListStore.list.length < 1 && CommonPrefixes?.length > 0) {
    for (const CommonPrefix of CommonPrefixes) {
      const trimmedPath = CommonPrefix.Prefix.replace(/\/$/, "");
      // Split the string by '/'
      const segments = trimmedPath.split("/");
      // Return only the last segment
      const name = segments[segments.length - 1];

      fileListStore.append({
        // name remove slash at the end
        Name: name,
        Key: CommonPrefix.Prefix,
        Size: 0,
        LastModified: null,
        Type: "folder",
      });
    }
  }

  if (Contents?.length > 0) {
    for (const Content of Contents) {
      fileListStore.append({
        Name: Content.Key.split("/").pop(),
        Key: Content.Key,
        Size: Content.Size,
        LastModified: Content.LastModified,
        Type: "file",
      });
    }
  }

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
