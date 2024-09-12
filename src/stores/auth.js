import { defineStore } from "pinia"

const useAuthStore = defineStore({
	id: "auth",
	state: () => ({
		region: null,
		endpoint: null,
		accessKeyId: null,
		secretAccessKey: null,
		bucket: null,
	}),
	actions: {
		set(key, value) {
			this[key] = value
		},
		logout() {
			this.region = null
			this.endpoint = null
			this.accessKeyId = null
			this.secretAccessKey = null
			this.bucket = null
		},
		login({
			region,
			endpoint,
			accessKeyId,
			secretAccessKey,
			bucket
		}) {
			this.region = region
			this.endpoint = endpoint
			this.accessKeyId = accessKeyId
			this.secretAccessKey = secretAccessKey
			this.bucket = bucket
		}
	},
	persist: true,
})


export { useAuthStore }
