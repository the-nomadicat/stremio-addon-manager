<script setup>
import { ref, computed, nextTick, watch } from 'vue'
import SavedAccounts from './SavedAccounts.vue'
import Toast from './Toast.vue'
import { useDialog } from './DialogHost.vue'

const props = defineProps({
  stremioAPIBase: { type: String, required: true }
})

// Toast ref for notifications
const toastRef = ref(null)

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

const canLoadAddons = computed(() => {
  const hasAuthKey = Boolean(authKey.value.trim())
  const hasEmailPassword = Boolean(email.value.trim() && password.value.trim())
  return hasAuthKey || hasEmailPassword
})

// Watch the saved account dropdown and update credentials + reset addons when it changes
watch(() => savedRef.value?.selectedEmail, (newEmail, oldEmail) => {
  if (!savingEnabled.value || newEmail === oldEmail) return
  
  // Always reset addons when selection changes
  emits('reset-addons')
  
  // Find the selected account and update credentials
  if (!newEmail) {
    // "Not Selected" was chosen - clear everything
    email.value = ''
    password.value = ''
    authKey.value = ''
    emits('user-email', '')
    emitAuthKey()
  } else {
    // An account was selected - load its credentials
    const account = savedRef.value?.findByEmail?.(newEmail)
    if (account) {
      email.value = account.email
      password.value = account.password || ''
      authKey.value = account.authKey || ''
      emits('user-email', email.value)
      emitAuthKey()
    }
  }
})

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
      htmlMessage: `Disabling saved accounts will delete all saved login details on this device.`
                + `<br><br>Your saved email, password, and auth keys will be removed from this browser.`,
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
  clearAuthKey()
  emits('user-email', email.value)
  emits('reset-addons')
}

function onPasswordInput() {
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

  emitAuthKey()
  emits('reset-addons')
}

// Helper: Login with email/password to get AuthKey
async function loginWithEmailPassword(emailToLogin, passwordToLogin) {
  try {
    const loginResp = await fetch(`${props.stremioAPIBase}login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        authKey: null,
        email: emailToLogin,
        password: passwordToLogin,
      }),
    });

    if (!loginResp.ok) {
      return { ok: false, error: `Login failed: HTTP ${loginResp.status}` };
    }

    const loginData = await loginResp.json();
    if (loginData?.error) {
      return { ok: false, error: loginData.error?.message || 'Login failed' };
    }

    const key = loginData?.result?.authKey || '';
    if (!key) {
      return { ok: false, error: 'Login succeeded but no AuthKey received' };
    }

    return { ok: true, authKey: key };
  } catch (err) {
    console.error('Login failed:', err);
    return { ok: false, error: err?.message || 'Network error' };
  }
}

// Helper: Get user info from AuthKey
async function getUserFromAuthKey(key) {
  try {
    const userResp = await fetch(`${props.stremioAPIBase}getUser`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ authKey: key }),
    });

    if (!userResp.ok) {
      return { ok: false, error: `getUser failed: HTTP ${userResp.status}` };
    }

    const userData = await userResp.json();
    if (userData?.error) {
      return { ok: false, error: userData.error?.message || 'getUser error' };
    }

    const user = userData?.result?.user || userData?.result || {};
    const profileEmail = user.email || user.mail || '';
    const uid = user._id || user.id || user.uid || '';

    return { ok: true, email: profileEmail || '', uid };
  } catch (err) {
    console.error('getUser failed:', err);
    return { ok: false, error: err?.message || 'Network error' };
  }
}

// Silent verification for load addons flow - returns result instead of showing dialogs
async function verifyCredentialsForLoad() {
  try {
    const trimmedEmail = email.value.trim();
    const trimmedPassword = password.value.trim();
    let key = authKey.value.trim();

    // CASE: email+password provided, no AuthKey
    if (!key && trimmedEmail && trimmedPassword) {
      // Check if this email exists in saved accounts
      if (savingEnabled.value) {
        const savedAccount = savedRef.value?.findByEmail?.(trimmedEmail);
        
        if (savedAccount) {
          // Email exists in saved accounts
          const savedPassword = (savedAccount.password || '').trim();
          const savedAuthKey = (savedAccount.authKey || '').trim();
          
          // CASE 1: Password matches saved password
          if (savedPassword && trimmedPassword === savedPassword) {
            // Try saved AuthKey first (fast path)
            if (savedAuthKey) {
              const userResult = await getUserFromAuthKey(savedAuthKey);
              
              if (userResult.ok) {
                // Saved AuthKey still works - use it
                authKey.value = savedAuthKey;
                emitAuthKey();
                return { ok: true, emailFromKey: userResult.email, uid: userResult.uid, usedSavedAuthKey: true };
              }
              
              // AuthKey expired - silent fallback to login
              console.log('Saved AuthKey expired, getting fresh one...');
            }
            
            // No saved AuthKey or it expired - login to get fresh one
            const loginResult = await loginWithEmailPassword(trimmedEmail, trimmedPassword);
            
            if (!loginResult.ok) {
              return { ok: false, error: loginResult.error };
            }
            
            // Update saved account with new AuthKey
            key = loginResult.authKey;
            authKey.value = key;
            emitAuthKey();
            savedRef.value?.updateAuthKeyForEmail?.(trimmedEmail, key);
            
            // Verify the new AuthKey
            const userResult = await getUserFromAuthKey(key);
            if (!userResult.ok) {
              return { ok: false, error: 'Failed to verify new AuthKey' };
            }
            
            return { ok: true, emailFromKey: userResult.email, uid: userResult.uid, refreshedAuthKey: true };
          }
          
          // CASE 2: Password does NOT match saved password
          // User may have changed password on Stremio - try their password
          const loginResult = await loginWithEmailPassword(trimmedEmail, trimmedPassword);
          
          if (!loginResult.ok) {
            return { ok: false, error: loginResult.error };
          }
          
          // Login successful - update saved account with new password and AuthKey
          key = loginResult.authKey;
          authKey.value = key;
          emitAuthKey();
          
          // Update saved account
          savedRef.value?.save?.({
            email: trimmedEmail,
            password: trimmedPassword,
            authKey: key,
            label: savedAccount.label || trimmedEmail,
          });
          
          // Show toast notification
          toastRef.value?.show({
            message: 'Password updated for saved account.',
            duration: 4000,
          });
          
          // Verify the new AuthKey
          const userResult = await getUserFromAuthKey(key);
          if (!userResult.ok) {
            return { ok: false, error: 'Failed to verify new AuthKey' };
          }
          
          return { ok: true, emailFromKey: userResult.email, uid: userResult.uid, updatedPassword: true };
        }
      }
      
      // Email NOT in saved accounts OR saving disabled - normal login flow
      const loginResult = await loginWithEmailPassword(trimmedEmail, trimmedPassword);
      
      if (!loginResult.ok) {
        return { ok: false, error: loginResult.error };
      }

      key = loginResult.authKey;
      authKey.value = key;
      emitAuthKey();
    }

    if (!key) {
      return { ok: false, error: 'No AuthKey available to verify' };
    }

    // Verify the AuthKey
    const userResult = await getUserFromAuthKey(key);
    
    if (!userResult.ok) {
      // AuthKey verification failed - try to recover
      const trimmedEmail = email.value.trim();
      const trimmedPassword = password.value.trim();
      
      // First, check if we have a saved account with this email that has a valid AuthKey
      if (savingEnabled.value && trimmedEmail) {
        const savedAccount = savedRef.value?.findByEmail?.(trimmedEmail);
        if (savedAccount) {
          const savedAuthKey = (savedAccount.authKey || '').trim();
          
          if (savedAuthKey && savedAuthKey !== key) {
            console.log('Invalid AuthKey entered, trying saved AuthKey for this account...');
            
            const savedKeyResult = await getUserFromAuthKey(savedAuthKey);
            
            if (savedKeyResult.ok) {
              // Saved AuthKey works - use it
              authKey.value = savedAuthKey;
              emitAuthKey();
              return { ok: true, emailFromKey: savedKeyResult.email, uid: savedKeyResult.uid, usedSavedAuthKey: true };
            }
            
            console.log('Saved AuthKey also invalid, will try email+password login...');
          }
        }
      }
      
      // Saved AuthKey didn't work or doesn't exist - fall back to email+password if available
      if (trimmedEmail && trimmedPassword) {
        console.log('AuthKey verification failed, falling back to email+password login...');
        
        const loginResult = await loginWithEmailPassword(trimmedEmail, trimmedPassword);
        
        if (!loginResult.ok) {
          return { ok: false, error: `AuthKey invalid and login failed: ${loginResult.error}` };
        }
        
        // Login successful - update with new AuthKey
        key = loginResult.authKey;
        authKey.value = key;
        emitAuthKey();
        
        // Update saved account if it exists
        if (savingEnabled.value && trimmedEmail) {
          const savedAccount = savedRef.value?.findByEmail?.(trimmedEmail);
          if (savedAccount) {
            savedRef.value?.updateAuthKeyForEmail?.(trimmedEmail, key);
          }
        }
        
        // Verify the new AuthKey
        const newUserResult = await getUserFromAuthKey(key);
        if (!newUserResult.ok) {
          return { ok: false, error: 'Failed to verify new AuthKey after login' };
        }
        
        return { ok: true, emailFromKey: newUserResult.email, uid: newUserResult.uid, recoveredFromInvalidAuthKey: true };
      }
      
      // No email+password available to fall back to
      return { ok: false, error: userResult.error };
    }

    return { ok: true, emailFromKey: userResult.email, uid: userResult.uid };
  } catch (err) {
    console.error('Verification failed:', err);
    return { ok: false, error: err?.message || 'Unknown error' };
  }
}

// Helper function to update email with toast notification
function updateEmailWithToast(emailFromKey) {
  const previousEmail = email.value;
  email.value = emailFromKey;
  emits('user-email', emailFromKey);
  
  // Show toast with undo option
  const truncatedEmail = emailFromKey.length > 30 
    ? emailFromKey.substring(0, 27) + '...' 
    : emailFromKey;
  
  toastRef.value?.show({
    message: `Email set to ${truncatedEmail} from AuthKey.`,
    duration: 5000,
    onUndo: () => {
      email.value = previousEmail;
      emits('user-email', previousEmail);
    }
  });
}

function emitAuthKey() {
  emits('auth-key', authKey.value.replaceAll('"', '').trim())
}

// Comprehensive load addons verification flow
async function handleLoadAddonsFlow() {
  // First verify credentials
  const verification = await verifyCredentialsForLoad();
  
  if (!verification.ok) {
    return { ok: false, error: verification.error };
  }
  
  const emailFromKey = verification.emailFromKey || '';
  const emailField = email.value.trim();
  
  // Handle the flow based on savingEnabled state
  if (!savingEnabled.value) {
    // Branch A: savingEnabled === false
    return await handleLoadFlowNoSaving(emailFromKey, emailField);
  } else {
    // Branch B: savingEnabled === true
    return await handleLoadFlowWithSaving(emailFromKey, emailField);
  }
}

async function handleLoadFlowNoSaving(emailFromKey, emailField) {
  // Handle empty emailFromKey edge case
  if (!emailFromKey) {
    console.warn("Couldn't confirm the email for this AuthKey. Continuing anyway.");
    return { ok: true };
  }
  
  // Check if email field is empty
  if (!emailField) {
    // Update email with toast notification
    updateEmailWithToast(emailFromKey);
    return { ok: true };
  }
  
  // Check for mismatch
  const hasMismatch = emailField.toLowerCase() !== emailFromKey.toLowerCase();
  
  if (hasMismatch) {
    // Update email, clear password, and inform user
    email.value = emailFromKey;
    password.value = '';
    emits('user-email', emailFromKey);
    
    await dialog.alert({
      title: 'Email updated',
      htmlMessage: `The email field has been updated to match the AuthKey:`
                + `<br><br><strong>${emailFromKey}</strong>`
                + `<br><br>The password has been cleared.`,
      confirmText: 'OK',
    });
  }
  
  return { ok: true };
}

async function handleLoadFlowWithSaving(emailFromKey, emailField) {
  // Handle empty emailFromKey edge case first
  if (!emailFromKey) {
    await dialog.alert({
      title: 'Warning',
      htmlMessage: `Couldn't confirm the email for this AuthKey. You can still continue.`
                + `<br><br>You may save this as an AuthKey-only entry if desired.`,
      confirmText: 'OK',
    });
    
    // Offer to save AuthKey-only if no saved entry exists
    if (!savedRef.value?.hasAuthKey?.(authKey.value.trim())) {
      await promptSaveAccount('');
    }
    
    return { ok: true };
  }
  
  // B1: emailField === ''
  if (!emailField) {
    // Check if account exists first
    const existing = savedRef.value?.findByEmail?.(emailFromKey);
    const currentAuthKey = authKey.value.trim();
    
    if (existing) {
      // Update authKey in saved account if different
      if (existing.authKey !== currentAuthKey) {
        savedRef.value?.updateAuthKeyForEmail?.(emailFromKey, currentAuthKey);
      }
      
      // Select the account in the dropdown (watcher will update credentials)
      savedRef.value?.selectByEmail?.(emailFromKey, { silent: false });
      
      const accountDisplay = savedRef.value?.formatAccountDisplay?.(existing, { quoted: true, bold: true }) || `"<strong>${emailFromKey}</strong>"`;
      
      await dialog.alert({
        title: 'Account loaded from saved logins',
        htmlMessage: `We verified your AuthKey and it belongs to:`
                  + `<br>${accountDisplay}`
                  + `<br><br>This matches a saved account, so we've loaded the saved account details for you.`,
        confirmText: 'OK',
      });
    } else {
      // New account - update email with toast notification and offer to save
      updateEmailWithToast(emailFromKey);
      
      await promptSaveAccount(emailFromKey);
    }
    
    return { ok: true };
  }
  
  // B2: mismatch - DETECT FIRST, then update fields, then prompt to save
  const hasMismatch = emailField.toLowerCase() !== emailFromKey.toLowerCase();
  
  if (hasMismatch) {
    const currentAuthKey = authKey.value.trim();
    
    // Check if account exists first
    const existing = savedRef.value?.findByEmail?.(emailFromKey);
    
    if (existing) {
      // Update authKey in saved account if different
      if (existing.authKey !== currentAuthKey) {
        savedRef.value?.updateAuthKeyForEmail?.(emailFromKey, currentAuthKey);
      }
      
      // Select the account in the dropdown (watcher will update credentials)
      savedRef.value?.selectByEmail?.(emailFromKey, { silent: false });
      
      const accountDisplay = savedRef.value?.formatAccountDisplay?.(existing, { quoted: true, bold: true }) || `"<strong>${emailFromKey}</strong>"`;
      
      await dialog.alert({
        title: 'Email mismatch - Account loaded',
        htmlMessage: `We verified your AuthKey and it belongs to:`
                  + `<br>${accountDisplay}`
                  + `<br><br>However, your email field showed:`
                  + `<br>${emailField}`
                  + `<br><br>Since <strong>${emailFromKey}</strong> matches a saved account, we've loaded the saved account for you.`,
        confirmText: 'OK',
      });
    } else {
      // New account - update email, clear password, offer to save
      const originalEmail = emailField;
      email.value = emailFromKey;
      password.value = '';
      emits('user-email', emailFromKey);
      
      await promptSaveNewAccountWithUniqueId(emailFromKey, currentAuthKey, originalEmail);
    }
    
    return { ok: true };
  }
  
  // B3: match
  const existing = savedRef.value?.findByEmail?.(emailFromKey);
  const currentAuthKey = authKey.value.trim();
  
  if (existing) {
    // Update authKey if different
    if (existing.authKey !== currentAuthKey) {
      savedRef.value?.updateAuthKeyForEmail?.(emailFromKey, currentAuthKey);
    }
    
    // Select the account in the dropdown (watcher will update credentials)
    savedRef.value?.selectByEmail?.(emailFromKey, { silent: false });
  } else {
    await promptSaveAccount(emailFromKey);
  }
  
  return { ok: true };
}

async function promptSaveAccount(emailForAccount) {
  const emailToSave = emailForAccount || email.value.trim();
  const label = await dialog.prompt({
    title: 'Save new account?',
    htmlMessage: `Add a name for this account (optional). If left blank, the email will be used.`
              + `<br><br>Email: <strong>${emailToSave}</strong>`,
    defaultValue: '',
    placeholder: emailToSave,
    confirmText: 'Save login',
    cancelText: 'Skip',
  });
  
  if (label === null) return; // User clicked Skip
  
  const trimmedLabel = label.trim();
  const finalLabel = trimmedLabel || emailToSave; // Use email if no label provided
  
  savedRef.value?.save({
    email: emailToSave,
    password: password.value, // Will be empty string if cleared due to mismatch
    authKey: authKey.value.trim(),
    label: finalLabel,
  });
}

async function promptSaveNewAccountWithUniqueId(emailForAccount, currentAuthKey, originalEmail = null) {
  // Build message based on whether there was a mismatch
  let htmlMessage;
  if (originalEmail) {
    htmlMessage = `Email mismatch detected!`
              + `<br><br>You entered: <strong>${originalEmail}</strong>`
              + `<br>AuthKey belongs to: <strong>${emailForAccount}</strong>`
              + `<br><br>The email field has been updated and the password has been cleared.`
              + `<br><br>Add a name for this account (optional). If left blank, the email will be used.`
              + `<br><br>Email: <strong>${emailForAccount}</strong>`;
  } else {
    htmlMessage = `Add a name for this account (optional). If left blank, the email will be used.`
              + `<br><br>Email: <strong>${emailForAccount}</strong>`;
  }
  
  const label = await dialog.prompt({
    title: 'Save new account?',
    htmlMessage: htmlMessage,
    defaultValue: '',
    placeholder: emailForAccount,
    confirmText: 'Save login',
    cancelText: 'Skip',
  });
  
  if (label === null) return; // User clicked Skip
  
  const trimmedLabel = label.trim();
  const finalLabel = trimmedLabel || emailForAccount; // Use email if no label provided
  
  savedRef.value?.save({
    email: emailForAccount,
    password: '', // Empty password for AuthKey-only logins
    authKey: currentAuthKey,
    label: finalLabel,
  });
}

function getSavedAccountInfo() {
  if (!savingEnabled.value || !email.value) return null
  return savedRef.value?.findByEmail?.(email.value)
}

function getFormattedAccountDisplay() {
  const accountInfo = getSavedAccountInfo()
  if (!accountInfo) return null
  return savedRef.value?.formatAccountDisplay?.(accountInfo) || null
}

defineExpose({ verifyCredentialsForLoad, handleLoadAddonsFlow, canLoadAddons, getSavedAccountInfo, getFormattedAccountDisplay })
</script>

<template>
  <div>
    <legend>Step 1: Authenticate</legend>

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
    />
    
    <div class="separator"><strong>OR...</strong> Use your Stremio account (Facebook login is not supported)</div>
    
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
    
    <div class="separator"><strong>OR...</strong> Use an authentication key (see "Step 1" in the guide above)</div>
    
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

    <!-- Toast notifications -->
    <Toast ref="toastRef" />
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
