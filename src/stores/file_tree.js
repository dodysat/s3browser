import { defineStore } from "pinia"

const useFileTreeStore = defineStore({
	id: "file_tree",
	state: () => ({
		tree: [],
	}),
	actions: {
		set(key, value) {
			this[key] = value
		},
	},
	persist: true,
})


export { useFileTreeStore }
