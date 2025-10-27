<script setup>
import { ref, computed } from 'vue'
import SavedAccounts from './SavedAccounts.vue'
import { useDialog } from './DialogHost.vue'

const props = defineProps({
  stremioAPIBase: { type: String, required: true }
})

const SAVE_PREF_KEY = 'sam.saveAccounts.enabled'
const ACCOUNTS_STORAGE_KEY = 'sam.savedAccounts.v1'

const authKey = ref('')
const email = ref('')
const password = ref('')
const emits = defineEmits(['auth-key', 'user-email', 'reset-addons'])

const savedRef = ref(null)
const savingEnabled = ref(false)
const authKeyInput = ref(null)
const dialog = useDialog()

if (typeof window !== 'undefined') {
  try {
    const pref = window.localStorage.getItem(SAVE_PREF_KEY)
    let hasSavedAccounts = false
    const rawAccounts = window.localStorage.getItem(ACCOUNTS_STORAGE_KEY)
    if (rawAccounts) {
      try {
        const parsed = JSON.parse(rawAccounts)
        hasSavedAccounts = Array.isArray(parsed) && parsed.length > 0
      } catch {
        hasSavedAccounts = false
      }
    }

    if (pref === '1') {
      savingEnabled.value = true
    } else if (pref === '0') {
      savingEnabled.value = hasSavedAccounts
    } else {
      savingEnabled.value = hasSavedAccounts
    }

    if (savingEnabled.value) {
      window.localStorage.setItem(SAVE_PREF_KEY, '1')
    }
  } catch {
    savingEnabled.value = false
  }
}

const canGetNewAuthKey = computed(() => {
  return Boolean(email.value.trim() && password.value.trim())
})

function onSavedSelected(a) {
  if (!savingEnabled.value) return

  if (!a || !a.id) {
    if (email.value || password.value) {
      clearCredentials()
    }
    if (authKey.value) {
      clearAuthKey()
    }
    emits('reset-addons')
    return
  }
  
  emits('reset-addons')
  email.value = a.email
  password.value = a.password || ''
  authKey.value = a.authKey || ''
  emits('user-email', email.value)
  emitAuthKey()
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
  if (!savingEnabled.value) return
  savedRef.value?.resetSelection?.({ silent: true })
}

function persistSavingPreference(val) {
  if (typeof window === 'undefined') return
  try {
    if (val) window.localStorage.setItem(SAVE_PREF_KEY, '1')
    else window.localStorage.setItem(SAVE_PREF_KEY, '0')
  } catch {
    /* ignore */
  }
}

async function handleSavingToggle(nextEnabled) {
  const targetState = Boolean(nextEnabled)
  if (targetState === savingEnabled.value) return

  if (!targetState) {
    const hasSaved = savedRef.value?.hasAccounts?.() || false
    const confirmed = !hasSaved || await dialog.confirm({
      title: 'Disable saved logins?',
      message: 'Disabling saved accounts will delete all saved login details on this device.'
            + '\n\nYour saved email, password, and auth keys will be removed from this browser.',
      confirmText: 'Disable & delete accounts',
      cancelText: 'Cancel',
    })
    if (!confirmed) {
      savingEnabled.value = true
      persistSavingPreference(true)
      return
    }
    savedRef.value?.clearAll?.()
  }

  savingEnabled.value = targetState
  persistSavingPreference(targetState)
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

function onAuthKeyInput(event) {
  const target = event?.target || authKeyInput.value
  const activeElement = typeof document !== 'undefined' ? document.activeElement : null
  const isManualEdit = target && activeElement === target

  if (!isManualEdit) {
    if (!authKey.value) return
    authKey.value = ''
    if (target) target.value = ''
    emitAuthKey()
    emits('reset-addons')
    return
  }

  resetSavedSelection()
  clearCredentials()
  emitAuthKey()
  emits('reset-addons')
}

async function maybeOfferSaveAccount() {
  if (!savingEnabled.value) return
  const normalizedAuthKey = authKey.value.replaceAll('"', '').trim()
  if (!normalizedAuthKey) return
  const saved = savedRef.value
  if (!saved?.hasAuthKey || saved.hasAuthKey(normalizedAuthKey)) return

  const defaultLabel = email.value.trim() || 'Saved login'
  const promptText = 'Do you want to save this account for quick access?'
                  + '\n\nEnter a label to identify it later, or Skip this step.'
  const label = await dialog.prompt({
    title: 'Save this account?',
    message: promptText,
    defaultValue: defaultLabel,
    placeholder: defaultLabel,
    confirmText: 'Save login',
    cancelText: 'Skip',
  })
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

    if (savingEnabled.value) {
      savedRef.value?.save({
        serverUrl: props.stremioAPIBase,
        email: trimmedEmail,
        password: password.value,
        authKey: authKey.value,
        label: trimmedEmail,
      })
    }

    emits('user-email', trimmedEmail)
  } catch (err) {
    console.error(err)
    await dialog.alert({
      title: 'Login failed',
      message: err?.message || 'Unknown error',
      confirmText: 'Dismiss',
    })
  }
}

function emitAuthKey() {
  emits('auth-key', authKey.value.replaceAll('"', '').trim())
}

defineExpose({ maybeOfferSaveAccount })
</script>

<template>
  <legend>Step 0: Authenticate</legend>

  <div class="save-toggle" :class="{ 'is-enabled': savingEnabled }">
    <button
      type="button"
      class="save-toggle__button"
      role="switch"
      :aria-checked="savingEnabled"
      @click="handleSavingToggle(!savingEnabled)"
      @keyup.enter.prevent="handleSavingToggle(!savingEnabled)"
      @keyup.space.prevent="handleSavingToggle(!savingEnabled)"
    >
      <span class="save-toggle__indicator" aria-hidden="true"></span>
      <span class="save-toggle__content">
        <span class="save-toggle__title">Enable saved logins on this device</span>
        <span class="save-toggle__subtitle">Store credentials locally for faster sign-in.</span>
        <span class="save-toggle__warning">Only enable this on a trusted personal device. Do not use on shared or public computers.</span>
      </span>
      <span class="save-toggle__status" aria-hidden="true">
        {{ savingEnabled ? 'On' : 'Off' }}
      </span>
    </button>
  </div>

  <SavedAccounts
    v-if="savingEnabled"
    ref="savedRef"
    @selected="onSavedSelected"
  />
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
      ref="authKeyInput"
      type="password"
      autocomplete="off"
      data-bwignore="true"
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

.save-toggle {
  margin-bottom: 1.25rem;
}

.save-toggle__button {
  display: flex;
  align-items: center;
  gap: 1rem;
  width: 100%;
  padding: 1rem 1.15rem;
  border-radius: 14px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.06), rgba(255, 255, 255, 0.02));
  color: inherit;
  cursor: pointer;
  transition: border-color 0.2s ease, box-shadow 0.2s ease, transform 0.1s ease;
}

.save-toggle__button:focus {
  outline: none;
  box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.2);
}

.save-toggle__button:active {
  transform: translateY(1px);
}

.save-toggle.is-enabled .save-toggle__button {
  border-color: rgba(21, 205, 116, 0.45);
  box-shadow: 0 6px 18px rgba(21, 205, 116, 0.18);
  background: linear-gradient(135deg, rgba(21, 205, 116, 0.18), rgba(21, 205, 116, 0.06));
}

.save-toggle__indicator {
  position: relative;
  width: 48px;
  height: 26px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.25);
  transition: background 0.25s ease;
}

.save-toggle__indicator::after {
  content: '';
  position: absolute;
  top: 3px;
  left: 3px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #101010;
  transition: transform 0.25s ease, background 0.25s ease;
}

.save-toggle.is-enabled .save-toggle__indicator {
  background: rgba(21, 205, 116, 0.35);
}

.save-toggle.is-enabled .save-toggle__indicator::after {
  transform: translateX(22px);
  background: #15cd74;
}

.save-toggle__content {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.3rem;
  text-align: left;
}

.save-toggle__title {
  font-weight: 700;
}

.save-toggle__subtitle {
  font-size: 1.00rem;
  opacity: 0.82;
}

.save-toggle__warning {
  font-size: 1.1rem;
  color: #ffb74d;
  font-weight: 700;
  line-height: 1.35;
}

.save-toggle__status {
  font-weight: 600;
  letter-spacing: 0.05em;
  font-size: 0.85rem;
  text-transform: uppercase;
  opacity: 0.8;
}
</style>
