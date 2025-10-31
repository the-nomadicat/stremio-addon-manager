<script setup>
import { ref } from 'vue'
import draggable from 'vuedraggable'
import AddonItem from './AddonItem.vue'
import Authentication from './Authentication.vue'
import DynamicForm from './DynamicForm.vue'
import Toast from './Toast.vue'
import { useDialog } from './DialogHost.vue'

const stremioAPIBase = "https://api.strem.io/api/"
const dragging = false
let stremioAuthKey = ref('');
let addons = ref([])
let loadAddonsButtonText = ref('Load Addons')

const authRef = ref(null)
const dialog = useDialog()
const toastRef = ref(null)

let isEditModalVisible = ref(false);
let currentManifest = ref({});
let currentEditIdx = ref(null);

// current email coming from Authentication.vue
const currentEmail = ref('')

/* ===============================
   STEP 4: BACKUP & RESTORE
   (only save/restore addons)
================================ */
const restoreInput = ref(null)

function safeForFilename(s) {
  return (s || '')
    .replace(/[^a-zA-Z0-9@.+-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80)
}

function isMobileDevice() {
  // Check for mobile/tablet user agents
  const userAgent = navigator.userAgent || navigator.vendor || window.opera
  return /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent.toLowerCase())
}

async function backupConfig() {
  const payload = { addons: Array.isArray(addons.value) ? addons.value : [] }
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })

  const who = safeForFilename(currentEmail.value || 'no-email')
  const now = new Date()
  const ts = now.toISOString().slice(0, 19).replace('T', ' ').replace(/:/g, '-')
  const filename = `stremio-addons-${who}-${ts}.json`

  try {
    // Try modern Web Share API first (works great on mobile)
    if (isMobileDevice() && navigator.share && navigator.canShare) {
      const file = new File([blob], filename, { type: 'application/json' })
      
      if (navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({
            files: [file],
            title: 'Stremio Addons Backup',
            text: 'Backup of your Stremio addon configuration'
          })
          
          toastRef.value?.show({
            message: 'Backup shared successfully',
            duration: 3000,
          })
          return
        } catch (shareError) {
          // User cancelled share or share failed, fall through to download
          if (shareError.name !== 'AbortError') {
            console.warn('Share failed, falling back to download:', shareError)
          }
        }
      }
    }

    // Fallback: Traditional download link (works on desktop and most mobile browsers)
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.style.display = 'none'
    document.body.appendChild(a)
    
    // Trigger download
    a.click()
    
    // Clean up
    setTimeout(() => {
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    }, 100)
    
    toastRef.value?.show({
      message: 'Backup downloaded successfully',
      duration: 3000,
    })
  } catch (error) {
    console.error('Backup failed:', error)
    
    toastRef.value?.show({
      message: 'Failed to create backup. Please try again.',
      duration: 4000,
    })
  }
}

function triggerRestore() {
  // On mobile, add accept attribute for better file picker UX
  if (restoreInput.value && isMobileDevice()) {
    restoreInput.value.accept = 'application/json,.json'
  }
  restoreInput.value?.click()
}

function restoreFromFile(e) {
  const file = e.target.files?.[0]
  if (!file) {
    return
  }
  
  // Validate file type
  if (!file.name.toLowerCase().endsWith('.json') && file.type !== 'application/json') {
    toastRef.value?.show({
      message: 'Please select a valid JSON backup file',
      duration: 4000,
    })
    if (restoreInput.value) restoreInput.value.value = ''
    return
  }
  
  // Check file size (prevent loading huge files on mobile)
  const maxSize = 5 * 1024 * 1024 // 5MB limit
  if (file.size > maxSize) {
    toastRef.value?.show({
      message: 'File is too large. Maximum size is 5MB.',
      duration: 4000,
    })
    if (restoreInput.value) restoreInput.value.value = ''
    return
  }
  
  const reader = new FileReader()
  
  reader.onload = () => {
    try {
      const data = JSON.parse(String(reader.result || '{}'))
      
      if (!data || typeof data !== 'object') {
        throw new Error('Invalid backup file format')
      }
      
      if (Array.isArray(data.addons)) {
        const addonCount = data.addons.length
        addons.value = data.addons
        
        toastRef.value?.show({
          message: `Successfully restored ${addonCount} addon${addonCount !== 1 ? 's' : ''}`,
          duration: 3000,
        })
      } else {
        toastRef.value?.show({
          message: 'Backup file missing "addons" array',
          duration: 4000,
        })
      }
    } catch (err) {
      console.error('Restore failed', err)
      
      toastRef.value?.show({
        message: 'Failed to restore backup. File may be corrupted.',
        duration: 4000,
      })
    } finally {
      // Clear the input so the same file can be selected again
      if (restoreInput.value) restoreInput.value.value = ''
    }
  }
  
  reader.onerror = (error) => {
    console.error('Failed to read the selected file:', error)
    
    toastRef.value?.show({
      message: 'Failed to read file. Please try again.',
      duration: 4000,
    })
    
    if (restoreInput.value) restoreInput.value.value = ''
  }
  
  // Read the file
  try {
    reader.readAsText(file)
  } catch (error) {
    console.error('Error starting file read:', error)
    
    toastRef.value?.show({
      message: 'Error reading file. Please try again.',
      duration: 4000,
    })
    
    if (restoreInput.value) restoreInput.value.value = ''
  }
}

/* ===============================
   Existing logic
================================ */
async function loadUserAddons() {
    // First, verify credentials using the comprehensive flow
    const verificationResult = await authRef.value?.handleLoadAddonsFlow?.();
    
    if (!verificationResult?.ok) {
        console.error('Verification failed:', verificationResult?.error);
        await dialog.alert({
            title: 'Failed to load addons',
            htmlMessage: verificationResult?.error || 'Could not verify credentials. Please check your details and try again.',
            confirmText: 'OK',
        });
        return;
    }
    
    const key = stremioAuthKey.value
    if (!key) {
        console.error('No auth key provided')
        await dialog.alert({
            title: 'Failed to load addons',
            htmlMessage: 'No AuthKey available. Please verify your credentials first.',
            confirmText: 'OK',
        });
        return
    }

    loadAddonsButtonText.value = 'Loading...'

    const url = `${stremioAPIBase}addonCollectionGet`

    try {
        const resp = await fetch(url, {
            method: 'POST',
            body: JSON.stringify({
                type: 'AddonCollectionGet',
                authKey: key,
                update: true,
            })
        })

        const data = await resp.json()

        if (!resp.ok || !('result' in data) || data.result == null) {
            console.error('Failed to fetch user addons: ', data)
            await dialog.alert({
                title: 'Failed to load addons',
                htmlMessage: 'Could not fetch user addons. Please confirm the Stremio AuthKey is correct and try again.',
                confirmText: 'OK',
            })
            return
        }

        addons.value = data.result.addons
    } catch (error) {
        console.error('Error fetching user addons', error)
        await dialog.alert({
            title: 'Network error',
            htmlMessage: 'Something went wrong while connecting to Stremio. Please try again in a moment.',
            confirmText: 'Dismiss',
        })
    } finally {
        loadAddonsButtonText.value = 'Load Addons'
    }
}

async function syncUserAddons() {
    const key = stremioAuthKey.value
    if (!key) {
        console.error('No auth key provided')
        return
    }
    console.log('Syncing addons...')

    const url = `${stremioAPIBase}addonCollectionSet`

    try {
        const resp = await fetch(url, {
            method: 'POST',
            body: JSON.stringify({
                type: 'AddonCollectionSet',
                authKey: key,
                addons: addons.value,
            })
        })

        const data = await resp.json()

        if (!resp.ok || !('result' in data) || data.result == null) {
            console.error('Sync failed: ', data)
            await dialog.alert({
                title: 'Sync failed',
                htmlMessage: 'Stremio did not accept the addon list. Please try again or check the console for details.',
                confirmText: 'OK',
            })
            return
        }

        if (!data.result.success) {
            await dialog.alert({
                title: 'Sync failed',
                htmlMessage: data.result.error || 'Unknown error.',
                confirmText: 'OK',
            })
        } else {
            console.log('Sync complete: ', data)
            await dialog.alert({
                title: 'Sync complete',
                htmlMessage: 'Your addon list has been uploaded to Stremio.',
                confirmText: 'Great!',
            })
        }
    } catch (error) {
        console.error('Error syncing addons', error)
        await dialog.alert({
            title: 'Network error',
            htmlMessage: `Error syncing addons: ${error}`,
            confirmText: 'Dismiss',
        })
    }
}

function removeAddon(idx) {
    addons.value.splice(idx, 1)
}

function handleToast({ message, duration }) {
    toastRef.value?.show({ message, duration })
}

function getNestedObjectProperty(obj, path, defaultValue = null) {
    try {
        return path.split('.').reduce((acc, part) => acc && acc[part], obj)
    } catch (e) {
        return defaultValue
    }
}

function setAuthKey(authKey) {
    stremioAuthKey.value = authKey
}

function setUserEmail(val) {
  currentEmail.value = (val || '').trim()
}

function openEditModal(idx) {
    isEditModalVisible.value = true;
    currentEditIdx.value = idx;
    currentManifest.value = { ...addons.value[idx].manifest };
    document.body.classList.add('modal-open');
}

function closeEditModal() {
    isEditModalVisible.value = false;
    currentManifest.value = {};
    currentEditIdx.value = null;
    document.body.classList.remove('modal-open');
}

async function saveManifestEdit(updatedManifest) {
    try {
        addons.value[currentEditIdx.value].manifest = updatedManifest;
        closeEditModal();
    } catch (e) {
        await dialog.alert({
            title: 'Update failed',
            htmlMessage: 'Failed to update manifest.',
            confirmText: 'OK',
        })
    }
}

function resetAddons() {
    addons.value = [];
}

function clearAddons() {
    if (addons.value.length === 0) return;
    resetAddons();
}
</script>

<template>
    <section id="configure">
        <h2>Configure Stremio</h2>
        <form onsubmit="return false;">
            <fieldset>
                <Authentication
                    ref="authRef"
                    :stremioAPIBase="stremioAPIBase"
                    @auth-key="setAuthKey"
                    @user-email="setUserEmail"
                    @reset-addons="resetAddons"
                />
            </fieldset>

            <fieldset id="form_step1">
                <legend>Step 1: Load Addons / Backup</legend>
                <div v-if="authRef?.canLoadAddons" class="action-row">
                    <div class="left-actions">
                        <button class="button primary" @click="loadUserAddons">
                            {{ loadAddonsButtonText }}
                        </button>
                        <button v-if="addons.length" type="button" class="button danger" @click="clearAddons" title="Clear all addons">
                            Clear Addons
                        </button>
                    </div>
                    <div class="right-actions">
                         <button v-if="addons.length" type="button" class="button" @click="backupConfig" title="Export config to file">
                            <i class="uil uil-export" style="margin-right:.35rem;"></i> Backup
                        </button>
                        <button type="button" class="button" @click="triggerRestore" title="Import config from file">
                            <i class="uil uil-import" style="margin-right:.35rem;"></i> Restore…
                        </button>
                        <input
                            ref="restoreInput"
                            type="file"
                            accept="application/json"
                            style="display:none"
                            @change="restoreFromFile"
                        />
                    </div>
                </div>
                <p v-else class="empty-state">Authenticate above via "Step 0: Authenticate" to load, backup, or restore addons.</p>
            </fieldset>

            <fieldset id="form_step2">
                <legend>Step 2: Edit/Re-Order Addons & Catalogs</legend>
                <draggable v-if="addons.length" :list="addons" item-key="transportUrl" class="sortable-list" ghost-class="ghost"
                    @start="dragging = true" @end="dragging = false">
                    <template #item="{ element, index }">
                        <AddonItem :name="element.manifest.name" :idx="index" :manifestURL="element.transportUrl"
                            :logoURL="element.manifest.logo"
                            :isDeletable="!getNestedObjectProperty(element, 'flags.protected', false)"
                            :isConfigurable="getNestedObjectProperty(element, 'manifest.behaviorHints.configurable', false)"
                            @delete-addon="removeAddon"
                            @edit-manifest="openEditModal"
                            @show-toast="handleToast" />
                    </template>
                </draggable>
                <p v-else-if="stremioAuthKey" class="empty-state">No addons loaded! Load addons or restore a configuration above to start editing them.</p>
            </fieldset>

            <fieldset id="form_step3">
                <legend>Step 3: Sync Addons</legend>
                <div v-if="addons.length" class="action-row">
                    <div class="left-actions">
                        <button type="button" class="button primary icon" @click="syncUserAddons">
                            Sync to Stremio
                            <img src="https://icongr.am/feather/loader.svg?size=16&amp;color=ffffff" alt="icon">
                        </button>
                    </div>
                </div>
                <p v-else-if="stremioAuthKey" class="empty-state">Load addons or restore a configuration above to enable syncing.</p>
            </fieldset>
        </form>
        
        <!-- Teleport Toast to body but keep within single root element -->
        <Teleport to="body">
            <Toast ref="toastRef" />
        </Teleport>
    </section>

    <div v-if="isEditModalVisible" class="modal">
        <div class="modal-content">
            <h3>Edit manifest</h3>
            <DynamicForm :manifest="currentManifest" @update-manifest="saveManifestEdit" @cancel="closeEditModal" />
        </div>
    </div>
</template>

<style scoped>
.sortable-list {
    padding: 25px;
    border-radius: 7px;
    padding: 30px 25px 20px;
    box-shadow: 0 15px 30px rgba(0, 0, 0, 0.1);
    touch-action: pan-y; /* Allow vertical scrolling but prevent horizontal scrolling during drag */
}

.item {
    touch-action: manipulation; /* Prevent double-tap zoom, allow single taps */
}
.item.dragging { 
    opacity: 0.6;
    touch-action: none; /* Disable all touch scrolling when actively dragging */
}
.item.dragging :where(.details, i) { opacity: 0; }

.action-row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    justify-content: space-between;
    flex-wrap: wrap;
}

.left-actions {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
}

.right-actions {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
}

.button.danger {
    background-color: #dc3545;
    transition: background-color 0.15s ease, transform 0.1s ease;
}

.button.danger:hover {
    background-color: #c82333;
}

.button.danger:active {
    background-color: #bd2130;
    transform: scale(0.98);
}

.modal {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 1000;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    justify-content: center;
    align-items: center;
    overflow: auto;
}

.modal-content {
    background: #2e2e2e; 
    color: #e0e0e0; 
    width: 75vw;
    max-width: 900px;
    max-height: 90vh;
    padding: 20px;
    border-radius: 5px;
    box-shadow: 0 5px 15px rgba(0, 0, 0, 0.7);
    overflow: hidden;
    display: flex;
    flex-direction: column;
}

/* Tablet and smaller screens - maximize screen usage */
@media (max-width: 1024px) {
    .modal-content {
        width: 95vw;
        max-width: none;
        max-height: 95vh;
        padding: 15px;
        border-radius: 8px;
    }
}

/* Mobile screens - full screen experience */
@media (max-width: 768px) {
    .modal {
        padding: 0;
        align-items: stretch;
    }
    
    .modal-content {
        width: 100%;
        height: 100%;
        max-height: none;
        padding: 12px;
        border-radius: 0;
        margin: 0;
    }
}

.empty-state {
    margin-top: 0.75rem;
    color: var(--color-grey, #aaa);
    font-style: italic;
}

button {
    padding: 10px 20px;
    border: none;
    background-color: #ffa600;
    color: white;
    font-size: 16px;
    cursor: pointer;
    border-radius: 5px;
    transition: background-color 0.15s ease, transform 0.1s ease, box-shadow 0.15s ease;
}

button:hover {
    background-color: #ff9500;
}

button:active {
    background-color: #e68a00;
    transform: scale(0.98);
    box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.2);
}

button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
}

.button.primary {
    background-color: #14854f;
}

.button.primary:hover {
    background-color: #117a45;
}

.button.primary:active {
    background-color: #0e6538;
    transform: scale(0.98);
    box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.3);
}

.button.primary:disabled {
    background-color: #6c757d;
    opacity: 0.6;
}

/* Mobile responsive styles for buttons and action rows */
@media (max-width: 768px) {
    .action-row {
        flex-direction: column;
        gap: 0.75rem;
        align-items: stretch;
    }
    
    .left-actions,
    .right-actions {
        width: 100%;
        flex-direction: column;
        gap: 0.5rem;
        padding: 0;
        margin: 0;
    }
    
    .left-actions button,
    .right-actions button {
        width: 100%;
        font-size: 15px;
        padding: 12px 16px;
        margin: 0;
        box-sizing: border-box;
    }
}

@media (max-width: 480px) {
    button {
        font-size: 14px;
        padding: 10px 14px;
    }
    
    .left-actions button,
    .right-actions button {
        font-size: 14px;
        padding: 10px 14px;
    }
}
</style>
