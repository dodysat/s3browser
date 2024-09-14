import { defineStore } from "pinia"

const useFileListStore = defineStore({
	id: "file_list",
	state: () => ({
		list: [],
		nextToken: null,
	}),
	actions: {
		set(key, value) {
			this[key] = value
		},
		append(value) {
			this.list.push(value)
		}
	},
	persist: true,
})


export { useFileListStore }
