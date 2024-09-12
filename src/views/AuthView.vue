<template>
  <main class="container">
    <div>
      <div class="card bg-base-200 shadow-xl">
        <div class="card-body">
          <h2 class="card-title">Login</h2>
          <p class="text-md">
            Please enter your AWS S3 credentials to access your bucket. We do
            not store any credentials on our servers.
          </p>

          <AlertError :msg="errorMessage" class="my-4" />
          <div>
            <label class="form-control w-full max-w">
              <div class="label">
                <span class="label-text"> Region </span>
              </div>
              <input
                type="text"
                placeholder="ap-southeast-1"
                class="input input-bordered w-full max-w"
                v-model="formLogin.region"
              />
            </label>
          </div>

          <div>
            <label class="form-control w-full max-w">
              <div class="label">
                <span class="label-text"> Endpoint </span>
              </div>
              <input
                type="text"
                placeholder="https://s3.ap-southeast-1.wasabisys.com"
                class="input input-bordered w-full max-w"
                v-model="formLogin.endpoint"
              />
            </label>
          </div>

          <div>
            <label class="form-control w-full max-w">
              <div class="label">
                <span class="label-text"> Access Key Id </span>
              </div>
              <input
                type="text"
                placeholder="RvxdZ4TzatUq36WQcYkg"
                class="input input-bordered w-full max-w"
                v-model="formLogin.accessKeyId"
              />
            </label>
          </div>

          <div>
            <label class="form-control w-full max-w">
              <div class="label">
                <span class="label-text"> Secret Access Key </span>
              </div>
              <input
                type="text"
                placeholder="c4RrL9xb8uYWKdQU6nkzZfwJ7DCpHjNTPm3Xqh5t"
                class="input input-bordered w-full max-w"
                v-model="formLogin.secretAccessKey"
              />
            </label>
          </div>

          <div>
            <label class="form-control w-full max-w">
              <div class="label">
                <span class="label-text"> Bucket </span>
              </div>
              <input
                type="text"
                placeholder="my-bucket"
                class="input input-bordered w-full max-w"
                v-model="formLogin.bucket"
              />
              <div class="label">
                <span class="label-text-alt"
                  >leave empty if you hava access to list buckets</span
                >
              </div>
            </label>
          </div>

          <div class="card-actions mt-5">
            <button class="btn btn-primary w-full" @click="login">Login</button>
          </div>
        </div>
      </div>
      <AlertWarning
        msg="We do not store any AWS S3 credentials on our servers. All credentials are securely saved in your local storage. This website/app serves only as a user interface (UI) and is not connected to any external servers for credential management."
        class="mt-4 text-justify"
      />
    </div>
  </main>
</template>

<script setup>
import { ref, onMounted } from "vue";
import AlertWarning from "@/components/alerts/AlertWarning.vue";
import AlertError from "@/components/alerts/AlertError.vue";
import { checkConnection } from "@/api/s3";
import { useAuthStore } from "@/stores/auth";
import router from "@/router";

const authStore = useAuthStore();
const errorMessage = ref("");

const formLogin = ref({
  region: "",
  endpoint: "",
  accessKeyId: "",
  secretAccessKey: "",
  bucket: "",
});

const login = async () => {
  errorMessage.value = "";
  authStore.login({
    region: formLogin.value.region,
    endpoint: formLogin.value.endpoint,
    accessKeyId: formLogin.value.accessKeyId,
    secretAccessKey: formLogin.value.secretAccessKey,
    bucket: formLogin.value.bucket,
  });

  try {
    await checkConnection();
    if (!formLogin.value.bucket) {
      router.push({ name: "list" });
    } else {
      router.push({
        name: "list",
        params: { catchAll: [formLogin.value.bucket] },
      });
    }
  } catch (error) {
    errorMessage.value = error.message || "An error occurred";
    authStore.logout();
  }
};
</script>

<style scoped>
.container {
  max-width: 512px;
  margin: 0 auto;
  padding: 0 1rem;
  height: 100vh;
  display: flex;
  align-items: center;
}
</style>
