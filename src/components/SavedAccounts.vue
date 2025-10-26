<script setup>
import { ref, computed, watch, onMounted } from 'vue'

const LS_KEY = 'sam.savedAccounts.v1'

// reactive state
const accounts = ref([])           // [{ id, label, email, password, authKey, lastUsedAt }]
const DEFAULT_ID = ''
const defaultAccount = Object.freeze({
  id: DEFAULT_ID,
  label: '-- Not Selected --',
  email: '',
  password: '',
  authKey: '',
  lastUsedAt: 0,
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

// ---- persistence helpers ----
function load() {
  try {
    const raw = localStorage.getItem(LS_KEY)
    accounts.value = raw ? JSON.parse(raw) : []
    // auto-select most recently used
    if (accounts.value.length) {
      const latest = [...accounts.value].sort((a,b) => b.lastUsedAt - a.lastUsedAt)[0]
      selectedId.value = latest.id
      emit('selected', latest)
    } else {
      selectedId.value = DEFAULT_ID
      emit('selected', { ...defaultAccount })
    }
  } catch {
    accounts.value = []
    selectedId.value = DEFAULT_ID
    emit('selected', { ...defaultAccount })
  }
}
function persist() {
  localStorage.setItem(LS_KEY, JSON.stringify(accounts.value))
}
function makeId(email) {
  return (email || '').trim().toLowerCase()
}

// ---- public API (parent will call save(...) after successful login) ----
function save({ email, password, authKey, label }) {
  const id = makeId(email)
  const now = Date.now()
  const next = {
    id,
    label: (label || email || '').trim(),
    email: (email || '').trim(),
    password: password || '',   // ✅ store password
    authKey: (authKey || '').trim(),
    lastUsedAt: now,
  }
  const idx = accounts.value.findIndex(a => a.id === id)
  if (idx >= 0) accounts.value.splice(idx, 1, { ...accounts.value[idx], ...next })
  else accounts.value.push(next)
  selectedId.value = id
  persist()
}

// remove currently selected
function removeSelected() {
  if (!selectedId.value) return
  const idx = accounts.value.findIndex(a => a.id === selectedId.value)
  if (idx >= 0) {
    const target = accounts.value[idx]
    const label = target?.label || target?.email || 'this account'
    const confirmed = window.confirm(`Delete saved login for:\n\n${label}?`)
    if (!confirmed) return

    accounts.value.splice(idx, 1)
    selectedId.value = accounts.value[0]?.id ?? DEFAULT_ID
    persist()
    // notify parent of new selection (or null)
    const sel = accounts.value.find(a => a.id === selectedId.value) || null
    emit('selected', sel)
  }
}

// when dropdown changes, update MRU + notify parent
watch(selectedId, (id) => {
  if (id === DEFAULT_ID) {
    emit('selected', { ...defaultAccount })
    return
  }
  const sel = accounts.value.find(a => a.id === id)
  if (sel) {
    sel.lastUsedAt = Date.now()
    persist()
  }
  emit('selected', sel || null)
})

onMounted(load)

function renameSelected() {
  if (selectedId.value === DEFAULT_ID) return
  const idx = accounts.value.findIndex(a => a.id === selectedId.value)
  if (idx === -1) return
  const target = accounts.value[idx]
  const currentLabel = target.label || target.email || ''
  const nextLabel = window.prompt('Rename saved login label:', currentLabel)
  if (nextLabel == null) return
  const trimmed = nextLabel.trim()
  if (!trimmed) {
    alert('Label cannot be empty.')
    return
  }
  accounts.value.splice(idx, 1, { ...target, label: trimmed })
  persist()
}

// expose methods to parent (via ref)
defineExpose({ save, removeSelected, renameSelected })
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
