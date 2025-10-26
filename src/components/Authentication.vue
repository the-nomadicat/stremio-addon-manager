<script setup>
import { ref, computed } from 'vue'
import SavedAccounts from './SavedAccounts.vue'

const props = defineProps({
  stremioAPIBase: { type: String, required: true }
})

const authKey = ref('')
const email = ref('')
const password = ref('')
const emits = defineEmits(['auth-key', 'user-email', 'reset-addons'])

const savedRef = ref(null)

const canGetNewAuthKey = computed(() => {
  return Boolean(email.value.trim() && password.value.trim())
})

function onSavedSelected(a) {
  emits('reset-addons')
  if (a) {
    email.value = a.email
    password.value = a.password || ''
    authKey.value = a.authKey || ''
    emits('user-email', email.value)
    emitAuthKey()
  }
}

function clearAuthKey() {
  if (!authKey.value) return
  authKey.value = ''
  emitAuthKey()
}

function clearCredentials() {
  if (email.value) {
    email.value = ''
  }
  if (password.value) {
    password.value = ''
  }
  emits('user-email', email.value)
}

function resetSavedSelection() {
  savedRef.value?.resetSelection?.({ silent: true })
}

function onEmailInput() {
  resetSavedSelection()
  clearAuthKey()
  emits('user-email', email.value)
  emits('reset-addons')
}

function onPasswordInput() {
  resetSavedSelection()
  clearAuthKey()
  emits('reset-addons')
}

function onAuthKeyInput() {
  resetSavedSelection()
  clearCredentials()
  emitAuthKey()
  emits('reset-addons')
}

function maybeOfferSaveAccount() {
  const normalizedAuthKey = authKey.value.replaceAll('"', '').trim()
  if (!normalizedAuthKey) return
  const saved = savedRef.value
  if (!saved?.hasAuthKey || saved.hasAuthKey(normalizedAuthKey)) return

  const defaultLabel = email.value.trim() || 'Saved login'
  const promptText = 'Save this account for quick access?\n\nEnter a label:'
  const label = window.prompt(promptText, defaultLabel)
  if (label == null) return
  const trimmedLabel = label.trim()
  if (!trimmedLabel) return
  saved.save({
    serverUrl: props.stremioAPIBase,
    email: email.value.trim(),
    password: password.value,
    authKey: normalizedAuthKey,
    label: trimmedLabel,
  })
}

async function loginUserPassword() {
  const trimmedEmail = email.value.trim()

  emits('reset-addons')
  authKey.value = ''
  emitAuthKey()

  try {
    const resp = await fetch(`${props.stremioAPIBase}login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        authKey: null,
        email: trimmedEmail,
        password: password.value,
      })
    })

    if (!resp.ok) {
      throw new Error(`HTTP ${resp.status}`)
    }

    const data = await resp.json()

    if (data?.error) {
      throw new Error(data.error?.message || 'Login failed')
    }

    const nextAuthKey = data?.result?.authKey
    if (!nextAuthKey) {
      throw new Error('Logged in, but empty AuthKey received')
    }

    authKey.value = nextAuthKey
    emitAuthKey()

    savedRef.value?.save({
      serverUrl: props.stremioAPIBase,
      email: trimmedEmail,
      password: password.value,
      authKey: authKey.value,
      label: trimmedEmail,
    })

    emits('user-email', trimmedEmail)
  } catch (err) {
    console.error(err)
    alert(`Login failed: ${err?.message || 'Unknown error'}`)
  }
}

function emitAuthKey() {
  emits('auth-key', authKey.value.replaceAll('"', '').trim())
}

defineExpose({ maybeOfferSaveAccount })
</script>

<template>
  <legend>Step 0: Authenticate</legend>

  <SavedAccounts ref="savedRef" @selected="onSavedSelected" />
  <div class="separator"><strong>OR...</strong></div>
  <div class="field-group">
    <label class="field-label" for="auth-email">Email</label>
    <input
      id="auth-email"
      type="text"
      v-model="email"
      placeholder="Stremio E-mail"
      @input="onEmailInput"
    >
  </div>
  <div class="field-group">
    <label class="field-label" for="auth-password">Password</label>
    <input
      id="auth-password"
      type="password"
      v-model="password"
      placeholder="Stremio Password"
      @input="onPasswordInput"
    >
  </div>
  <div class="field-group">
    <button
      type="button"
      class="button primary"
      @click="loginUserPassword"
      :disabled="!canGetNewAuthKey"
    >
      Get new AuthKey
    </button>
  </div>
  <div class="separator"><strong>OR...</strong></div>
  <div class="field-group">
    <label class="field-label" for="auth-key">AuthKey</label>
    <input
      id="auth-key"
      type="password"
      v-model="authKey"
      @input="onAuthKeyInput"
      placeholder="Paste Stremio AuthKey here..."
    >
  </div>
</template>

<style scoped>
.field-group {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  margin-bottom: 0.85rem;
}

.field-label {
  font-weight: 600;
  font-size: 1.5rem;
}

.field-group .button {
  align-self: flex-start;
}

.field-group .button[disabled] {
  opacity: 0.55;
  cursor: not-allowed;
}

.separator {
  margin: 1.5rem 0;
  font-weight: 600;
}

.sortable-list .item {
  list-style: none;
  display: flex;
  cursor: move;
  align-items: center;
  border-radius: 5px;
  padding: 10px 13px;
  margin-bottom: 11px;
  border: 1px solid #ccc;
  justify-content: space-between;
}
.dark .sortable-list .item { border: 1px solid #434242; }
.item .details { display: flex; align-items: center; }
.item .details img {
  height: 60px; width: 60px; pointer-events: none; margin-right: 12px;
  object-fit: contain; object-position: center; border-radius: 30%; background-color: #262626;
}
</style>
