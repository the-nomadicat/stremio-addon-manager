<script setup>
import { ref, computed, watch, onMounted } from 'vue'

const LS_KEY = 'sam.savedAccounts.v1'

// reactive state
const accounts = ref([])           // [{ id, label, serverUrl, email, lastUsedAt }]
const selectedId = ref(null)       // currently selected account id

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
    }
  } catch {
    accounts.value = []
  }
}
function persist() {
  localStorage.setItem(LS_KEY, JSON.stringify(accounts.value))
}
function makeId(serverUrl, email) {
  return `${(serverUrl||'').trim().toLowerCase()}::${(email||'').trim().toLowerCase()}`
}

// ---- public API (parent will call save(...) after successful login) ----
function save({ serverUrl, email, password, authKey, label }) {
  const id = makeId(serverUrl, email)
  const now = Date.now()
  const next = {
    id,
    label: (label || email || '').trim(),
    serverUrl: (serverUrl || '').trim(),
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
    accounts.value.splice(idx, 1)
    selectedId.value = accounts.value[0]?.id ?? null
    persist()
    // notify parent of new selection (or null)
    const sel = accounts.value.find(a => a.id === selectedId.value) || null
    emit('selected', sel)
  }
}

// expose methods to parent (via ref)
defineExpose({ save, removeSelected })

// when dropdown changes, update MRU + notify parent
watch(selectedId, (id) => {
  const sel = accounts.value.find(a => a.id === id)
  if (sel) {
    sel.lastUsedAt = Date.now()
    persist()
  }
  emit('selected', sel || null)
})

onMounted(load)
</script>

<template>
  <div class="saved-accounts">
    <label class="sam-label">Saved accounts</label>
    <div class="sam-row">
      <select v-model="selectedId" class="sam-select">
        <option v-for="a in accounts" :key="a.id" :value="a.id">
          {{ a.label }}
        </option>
      </select>
      <button type="button" class="sam-button" title="Delete selected" @click="removeSelected">
        <i class="uil uil-trash"></i>
      </button>
    </div>
  </div>
</template>

<style scoped>
.saved-accounts { margin-bottom: 1.5rem; }
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

.uil-trash {
  font-size:20px;
  line-height:1;
}
</style>
