<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useDialog } from './DialogHost.vue'

const LS_KEY = 'sam.savedAccounts'

// reactive state
const accounts = ref([])           // [{ email, label, password, authKey }]
const DEFAULT_EMAIL = ''
const defaultAccount = Object.freeze({
  email: DEFAULT_EMAIL,
  label: '-- Not Selected --',
  password: '',
  authKey: '',
})
const selectedEmail = ref(DEFAULT_EMAIL)       // currently selected account email (unique id)

// Helper function to format account display text
function formatAccountDisplay(account, options = {}) {
  const { quoted = false, bold = false } = options
  const email = account.email || ''
  const label = account.label || ''
  
  let display
  if (label && label !== email) {
    display = `${label} [${email}]`
  } else {
    display = email
  }
  
  if (quoted) {
    display = `"${display}"`
  }
  
  if (bold) {
    display = `<strong>${display}</strong>`
  }
  
  return display
}

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

function persist() {
  if (!accounts.value.length) {
    localStorage.removeItem(LS_KEY)
    return
  }
  localStorage.setItem(LS_KEY, JSON.stringify(accounts.value))
}

function load() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    const entries = Array.isArray(parsed) ? parsed : [];
    
    accounts.value = entries;
    selectedEmail.value = DEFAULT_EMAIL;
    emit('selected', { ...defaultAccount });
  } catch (err) {
    console.error('Failed to load saved accounts:', err);
    accounts.value = [];
    selectedEmail.value = DEFAULT_EMAIL;
    emit('selected', { ...defaultAccount });
  }
}

function save({ email, password, authKey, label }) {
  const trimmedEmail = (email || '').trim()
  if (!trimmedEmail) {
    console.warn('Cannot save account without email')
    return
  }
  
  const trimmedAuthKey = (authKey || '').trim()
  const trimmedLabel = (label || '').trim()
  const displayLabel = trimmedLabel || trimmedEmail
  
  const next = {
    email: trimmedEmail,
    label: displayLabel,
    password: password || '',
    authKey: trimmedAuthKey,
  }
  
  const idx = accounts.value.findIndex(a => (a.email || '').toLowerCase() === trimmedEmail.toLowerCase())
  if (idx >= 0) {
    // Update existing account, merge new data
    accounts.value.splice(idx, 1, { ...accounts.value[idx], ...next })
  } else {
    // Add new account
    accounts.value.push(next)
  }
  selectedEmail.value = trimmedEmail
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
  selectedEmail.value = DEFAULT_EMAIL
  persist()
  emit('selected', { ...defaultAccount })
  return hadAccounts
}

// remove currently selected
async function removeSelected() {
  if (!selectedEmail.value) return
  const idx = accounts.value.findIndex(a => (a.email || '').toLowerCase() === selectedEmail.value.toLowerCase())
  if (idx >= 0) {
    const target = accounts.value[idx]
    const displayText = formatAccountDisplay(target, { quoted: true, bold: true })
    const confirmed = await dialog.confirm({
      title: 'Delete saved login',
      htmlMessage: `Delete saved login for ${displayText}?`
                + `<br><br>This removes the stored credentials from this browser.`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
    })
    if (!confirmed) return

    accounts.value.splice(idx, 1)
    selectedEmail.value = DEFAULT_EMAIL
    persist()
  }
}

// when dropdown changes, notify parent
watch(selectedEmail, (email) => {
  if (suppressNextEmit) {
    suppressNextEmit = false
    return
  }
  if (email === DEFAULT_EMAIL) {
    emit('selected', { ...defaultAccount })
    return
  }
  const sel = accounts.value.find(a => (a.email || '').toLowerCase() === email.toLowerCase())
  emit('selected', sel || null)
})

async function renameSelected() {
  if (selectedEmail.value === DEFAULT_EMAIL) return
  const idx = accounts.value.findIndex(a => (a.email || '').toLowerCase() === selectedEmail.value.toLowerCase())
  if (idx === -1) return
  const target = accounts.value[idx]
  
  // Check if this is the first time setting a label (label equals email)
  const isFirstRename = target.label === target.email
  const defaultValue = isFirstRename ? '' : target.label
  const placeholder = target.email
  
  const nextLabel = await dialog.prompt({
    title: 'Rename saved login',
    htmlMessage: `Add a name for this account (optional). If left blank, the email will be used.`
              + `<br><br>Email: <strong>${target.email}</strong>`,
    defaultValue: defaultValue,
    placeholder: placeholder,
    confirmText: 'Save label',
    cancelText: 'Cancel',
  })
  if (nextLabel === null) return // User cancelled
  
  const trimmed = nextLabel.trim()
  // If empty, set label to email (no custom label)
  const finalLabel = trimmed || target.email
  
  // Simply update the label for this account
  accounts.value.splice(idx, 1, { ...target, label: finalLabel })
  persist()
}

function resetSelection(options = {}) {
  const { silent = false } = options
  if (selectedEmail.value === DEFAULT_EMAIL) return
  suppressNextEmit = silent
  selectedEmail.value = DEFAULT_EMAIL
}

function findByEmail(targetEmail) {
  const needle = (targetEmail || '').trim().toLowerCase();
  if (!needle) return null;
  return accounts.value.find(a => (a.email || '').trim().toLowerCase() === needle) || null;
}

function updateAuthKeyForEmail(targetEmail, newAuthKey) {
  const rec = findByEmail(targetEmail);
  if (!rec) return false;
  const idx = accounts.value.findIndex(a => (a.email || '').toLowerCase() === (rec.email || '').toLowerCase());
  if (idx < 0) return false;
  accounts.value.splice(idx, 1, { ...accounts.value[idx], authKey: (newAuthKey || '').trim() });
  persist();
  return true;
}

function getAllAccounts() {
  return accounts.value;
}

function selectByEmail(targetEmail, options = {}) {
  const { silent = false } = options
  const account = findByEmail(targetEmail);
  if (!account) return false;
  suppressNextEmit = silent;
  selectedEmail.value = account.email;
  return true;
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
  findByEmail,
  updateAuthKeyForEmail,
  getAllAccounts,
  selectByEmail,
  formatAccountDisplay,
})
</script>

<template>
  <div>
    <label class="sam-label">Select a saved account</label>
    <div class="sam-row">
      <select v-model="selectedEmail" class="sam-select">
        <option v-for="a in displayAccounts" :key="a.email" :value="a.email">
          {{ a.email === DEFAULT_EMAIL ? a.label : formatAccountDisplay(a) }}
        </option>
      </select>
      <button
        type="button"
        class="sam-button sam-button-edit"
        title="Rename saved login"
        :disabled="selectedEmail === DEFAULT_EMAIL"
        @click="renameSelected"
      >
        <img src="https://icongr.am/feather/edit.svg?size=12" alt="Edit">
      </button>
      <button type="button" class="sam-button sam-button-delete" title="Delete selected" 
        :disabled="selectedEmail === DEFAULT_EMAIL"
        @click="removeSelected">
        <img src="https://icongr.am/feather/trash-2.svg?size=12" alt="Delete">
      </button>
    </div>
  </div>
</template>

<style scoped>
.sam-label { display:block; font-weight:600; margin-bottom:.25rem; }
.sam-row { display:flex; gap:.5rem; align-items:center; }
.sam-select { flex:1; min-width:0; padding:.4rem; }

.sam-button {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 8px;
  border: none;
  background-color: #2c5f8d;
  cursor: pointer;
  border-radius: 6px;
  min-width: 40px;
  min-height: 40px;
  transition: background-color 0.2s ease, transform 0.1s ease, box-shadow 0.15s ease;
}

.sam-button:hover {
  background-color: #234a6f;
}

.sam-button:active {
  background-color: #1a3a56;
  transform: scale(0.95);
  box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.2);
}

.sam-button:disabled {
  background-color: #cccccc;
  cursor: not-allowed;
  opacity: 0.5;
  transform: none;
}

.sam-button img {
  width: 20px;
  height: 20px;
}

/* Edit button - black icon */
.sam-button-edit img {
  filter: brightness(0);
}

/* Delete button - red icon */
.sam-button-delete img {
  filter: brightness(0) saturate(100%) invert(25%) sepia(85%) saturate(3500%) hue-rotate(345deg);
}

/* Dark mode styling */
.dark .sam-button {
  background-color: #3a6a96;
}

.dark .sam-button:hover {
  background-color: #2d5478;
}

.dark .sam-button:active {
  background-color: #234260;
  transform: scale(0.95);
  box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.3);
}

.dark .sam-button:disabled {
  background-color: #555555;
  opacity: 0.4;
}

.dark .sam-button-edit img {
  filter: brightness(0);
}

.dark .sam-button-delete img {
  filter: brightness(0) saturate(100%) invert(35%) sepia(85%) saturate(4000%) hue-rotate(345deg);
}

/* Mobile responsive */
@media (max-width: 768px) {
  .sam-button {
    padding: 10px;
    min-width: 44px;
    min-height: 44px;
  }
  
  .sam-button img {
    width: 22px;
    height: 22px;
  }
}

</style>
