<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useDialog } from './DialogHost.vue'

const LS_KEY = 'sam.savedAccounts.v1'

// reactive state
const accounts = ref([])           // [{ id, label, email, password, authKey }]
const DEFAULT_ID = ''
const defaultAccount = Object.freeze({
  id: DEFAULT_ID,
  label: '-- Not Selected --',
  email: '',
  password: '',
  authKey: '',
})
const selectedId = ref(DEFAULT_ID)       // currently selected account id
const displayAccounts = computed(() => {
  const sorted = [...accounts.value].sort((a, b) => {
    const left = (a.label || a.email || '').toLowerCase()
    const right = (b.label || b.email || '').toLowerCase()
    if (left < right) return -1
    if (left > right) return 1
    return 0
  })
  return [defaultAccount, ...sorted]
})

// emit selected account up to parent when user picks one
const emit = defineEmits(['selected'])

let suppressNextEmit = false
const dialog = useDialog()

function normalizeLabel(label, email, authKey) {
  const trimmedLabel = (label || '').trim()
  if (trimmedLabel) return trimmedLabel
  const trimmedEmail = (email || '').trim()
  if (trimmedEmail) return trimmedEmail
  const trimmedAuthKey = (authKey || '').trim()
  if (trimmedAuthKey) return trimmedAuthKey
  return 'Saved login'
}

function persist() {
  if (!accounts.value.length) {
    localStorage.removeItem(LS_KEY)
    return
  }
  localStorage.setItem(LS_KEY, JSON.stringify(accounts.value))
}

function load() {
  try {
    const raw = localStorage.getItem(LS_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    const entries = Array.isArray(parsed) ? parsed : []
    accounts.value = entries
    selectedId.value = DEFAULT_ID
    emit('selected', { ...defaultAccount })
  } catch {
    accounts.value = []
    selectedId.value = DEFAULT_ID
    emit('selected', { ...defaultAccount })
  }
}

function save({ email, password, authKey, label }) {
  const trimmedEmail = (email || '').trim()
  const trimmedAuthKey = (authKey || '').trim()
  const normalizedLabel = normalizeLabel(label, trimmedEmail, trimmedAuthKey)
  const id = normalizedLabel
  const next = {
    id,
    label: normalizedLabel,
    email: trimmedEmail,
    password: password || '',   // ✅ store password
    authKey: trimmedAuthKey,
  }
  const idx = accounts.value.findIndex(a => a.id === id)
  if (idx >= 0) {
    accounts.value.splice(idx, 1, { ...accounts.value[idx], ...next })
  } else {
    accounts.value.push(next)
  }
  selectedId.value = id
  persist()
}

function hasAuthKey(targetKey) {
  const needle = (targetKey || '').trim()
  if (!needle) return false
  return accounts.value.some(a => (a.authKey || '').trim() === needle)
}

function hasAccounts() {
  return accounts.value.length > 0
}

function clearAll() {
  const hadAccounts = accounts.value.length > 0
  accounts.value = []
  selectedId.value = DEFAULT_ID
  persist()
  emit('selected', { ...defaultAccount })
  return hadAccounts
}

// remove currently selected
async function removeSelected() {
  if (!selectedId.value) return
  const idx = accounts.value.findIndex(a => a.id === selectedId.value)
  if (idx >= 0) {
    const target = accounts.value[idx]
    const label = target?.label || target?.email || 'this account'
    const confirmed = await dialog.confirm({
      title: 'Delete saved login',
      message: `Delete saved login for “${label}”?\n\nThis removes the stored credentials from this browser.`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
    })
    if (!confirmed) return

    accounts.value.splice(idx, 1)
    selectedId.value = DEFAULT_ID
    persist()
  }
}

// when dropdown changes, notify parent
watch(selectedId, (id) => {
  if (suppressNextEmit) {
    suppressNextEmit = false
    return
  }
  if (id === DEFAULT_ID) {
    emit('selected', { ...defaultAccount })
    return
  }
  const sel = accounts.value.find(a => a.id === id)
  emit('selected', sel || null)
})

async function renameSelected() {
  if (selectedId.value === DEFAULT_ID) return
  const idx = accounts.value.findIndex(a => a.id === selectedId.value)
  if (idx === -1) return
  const target = accounts.value[idx]
  const currentLabel = target.label || target.email || ''
  const nextLabel = await dialog.prompt({
    title: 'Rename saved login',
    message: 'Update the label shown in the saved accounts list.',
    defaultValue: currentLabel,
    placeholder: currentLabel,
    confirmText: 'Save label',
    cancelText: 'Cancel',
  })
  if (nextLabel == null) return
  const trimmed = nextLabel.trim()
  if (!trimmed) {
    await dialog.alert({
      title: 'Invalid label',
      message: 'Label cannot be empty.',
      confirmText: 'OK',
    })
    return
  }
  const normalizedLabel = normalizeLabel(trimmed, target.email, target.authKey)
  const updated = { ...target, label: normalizedLabel, id: normalizedLabel }
  const duplicateIdx = accounts.value.findIndex((a, i) => i !== idx && a.id === normalizedLabel)
  if (duplicateIdx >= 0) {
    accounts.value.splice(duplicateIdx, 1, { ...accounts.value[duplicateIdx], ...updated })
    accounts.value.splice(idx, 1)
  } else {
    accounts.value.splice(idx, 1, updated)
  }
  suppressNextEmit = true
  selectedId.value = normalizedLabel
  persist()
}

function resetSelection(options = {}) {
  const { silent = false } = options
  if (selectedId.value === DEFAULT_ID) return
  suppressNextEmit = silent
  selectedId.value = DEFAULT_ID
}

onMounted(load)

defineExpose({
  save,
  removeSelected,
  renameSelected,
  resetSelection,
  hasAuthKey,
  clearAll,
  hasAccounts,
})
</script>

<template>
  <div>
    <label class="sam-label">Select saved account</label>
    <div class="sam-row">
      <select v-model="selectedId" class="sam-select">
        <option v-for="a in displayAccounts" :key="a.id" :value="a.id">
          {{ a.label }}
        </option>
      </select>
      <button
        type="button"
        class="sam-button"
        title="Rename saved login"
        @click="renameSelected"
      >
        <i class="uil uil-edit"></i>
      </button>
      <button type="button" class="sam-button" title="Delete selected" @click="removeSelected">
        <i class="uil uil-trash"></i>
      </button>
    </div>
  </div>
</template>

<style scoped>
.sam-label { display:block; font-weight:600; margin-bottom:.25rem; }
.sam-row { display:flex; gap:.5rem; align-items:center; }
.sam-select { flex:1; min-width:0; padding:.4rem; }

.sam-button {
  display:flex;
  align-items:center;
  justify-content:center;
  padding:.35rem;
  border:none;
  background:transparent;
  color:#aaa;
  cursor:pointer;
  border-radius:6px;
  transition:color 0.2s, background 0.2s;
}

.sam-button:hover {
  color:#e53935;              /* red hover */
  background:rgba(229,57,53,0.1);
}

.sam-button i {
  font-size:20px;
  line-height:1;
}

.uil-trash {
  font-size:20px;
  line-height:1;
}
</style>
