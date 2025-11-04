<script setup>
import { ref, onMounted, onUnmounted, computed, nextTick } from 'vue'
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
let isLoadingAddons = ref(false)
let hasLoadedAddons = ref(false)

const authRef = ref(null)
const dialog = useDialog()
const toastRef = ref(null)

let isEditModalVisible = ref(false);
let currentManifest = ref({});
let currentManifestURL = ref('');
let currentEditIdx = ref(null);
let highlightCatalogInfo = ref(null);

// current email coming from Authentication.vue
const currentEmail = ref('')

// Find catalog feature
const catalogSearchQuery = ref('')
const catalogMatches = ref([])
const currentMatchIndex = ref(0)
const showSearchWidget = ref(false)
const searchWidgetAnimationKey = ref(0)
const searchInputRef = ref(null)
let searchDebounceTimer = null
const catalogMatchCount = computed(() => catalogMatches.value.length)
const catalogMatchDisplay = computed(() => {
    if (catalogMatchCount.value === 0) return '';
    return `${currentMatchIndex.value + 1} / ${catalogMatchCount.value}`;
})

// Track when changes need to be synced
const needsSync = ref(false)
// Store the original state of addons when loaded/synced
const originalAddons = ref(null)

// Track whether controls should be fixed or static
const controlsFixed = ref(true)
const controlsRef = ref(null)

// Computed property for button text
const loadAddonsButtonText = computed(() => {
    if (isLoadingAddons.value) {
        return hasLoadedAddons.value ? 'Reloading...' : 'Loading...'
    }
    if (hasLoadedAddons.value) return 'Reload Addons'
    return 'Load Addons'
})

/* ===============================
   STEP 4: BACKUP & RESTORE
   (only save/restore addons)
================================ */
const restoreInput = ref(null)

// Function to compare current addons with original state
function checkIfModified() {
    if (!originalAddons.value) {
        needsSync.value = false
        return
    }
    
    // Deep comparison of addons array
    const current = JSON.stringify(addons.value)
    const original = JSON.stringify(originalAddons.value)
    needsSync.value = current !== original
}

function saveOriginalState() {
    // Deep copy the current addon state
    originalAddons.value = JSON.parse(JSON.stringify(addons.value))
    needsSync.value = false
}

// Handle scroll to toggle between fixed and static positioning
function handleScroll() {
    if (!controlsRef.value) return
    
    const controlsElement = controlsRef.value
    const parent = controlsElement.parentElement // The fieldset (Step 3)
    
    if (!parent) return
    
    // Get Step 2 element to check if we've scrolled above the addon list
    const step2Element = document.getElementById('form_step2')
    
    const parentRect = parent.getBoundingClientRect()
    const step2Rect = step2Element?.getBoundingClientRect()
    const viewportHeight = window.innerHeight
    
    // Check if Step 2 is actually visible in the viewport
    // Step 2 is visible if its top is above viewport bottom AND its bottom is below viewport top
    const step2Visible = step2Rect && step2Rect.top < viewportHeight && step2Rect.bottom > 0
    
    // If Step 2 is completely scrolled off (either above or below viewport), hide sticky controls
    if (!step2Visible) {
        controlsFixed.value = false
        return
    }
    
    // If parent's bottom is visible, controls are at their natural position (static)
    // Otherwise, make them fixed to the bottom of the viewport
    controlsFixed.value = parentRect.bottom > viewportHeight
}

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
        
        // Check if restored state differs from original (enable Sync button)
        checkIfModified()
        
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

    isLoadingAddons.value = true

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
        hasLoadedAddons.value = true
        // Save the original state and clear sync flag
        saveOriginalState()
    } catch (error) {
        console.error('Error fetching user addons', error)
        await dialog.alert({
            title: 'Network error',
            htmlMessage: 'Something went wrong while connecting to Stremio. Please try again in a moment.',
            confirmText: 'Dismiss',
        })
    } finally {
        isLoadingAddons.value = false
    }
}

async function syncUserAddons() {
    const key = stremioAuthKey.value
    if (!key) {
        console.error('No auth key provided')
        return
    }

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
            // Save the new synced state as the original state
            saveOriginalState()
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
    checkIfModified()
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

function openEditAddon(idx) {
    isEditModalVisible.value = true;
    currentEditIdx.value = idx;
    currentManifest.value = { ...addons.value[idx].manifest };
    currentManifestURL.value = addons.value[idx].transportUrl;
    document.body.classList.add('modal-open');
}

function closeEditModal() {
    isEditModalVisible.value = false;
    currentManifest.value = {};
    currentManifestURL.value = '';
    currentEditIdx.value = null;
    highlightCatalogInfo.value = null;
    document.body.classList.remove('modal-open');
}

async function saveManifestEdit(updatedManifest) {
    try {
        addons.value[currentEditIdx.value].manifest = updatedManifest;
        checkIfModified()
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
    hasLoadedAddons.value = false
    // When resetting addons (e.g., switching accounts), clear the original state too
    // so the sync button is disabled (nothing to sync)
    originalAddons.value = null
    needsSync.value = false
}

function clearAddons() {
    if (addons.value.length === 0) return;
    resetAddons();
}

function handleDragEnd() {
    checkIfModified()
}

async function installAddon() {
    const manifestURL = await dialog.prompt({
        title: 'Add Addon to List',
        htmlMessage: 'Enter the addon manifest URL:<br><br><small><strong>Note:</strong> This will add the addon to your list. You must click "Sync to Stremio" afterwards to install it to your account.</small>',
        placeholder: 'https://example.com/manifest.json',
        confirmText: 'Add to List',
        cancelText: 'Cancel',
    });
    
    if (!manifestURL) return; // User cancelled
    
    const trimmedURL = manifestURL.trim();
    if (!trimmedURL) return;
    
    // Validate URL format
    try {
        new URL(trimmedURL);
    } catch (e) {
        await dialog.alert({
            title: 'Invalid URL',
            htmlMessage: 'Please enter a valid manifest URL.',
            confirmText: 'OK',
        });
        return;
    }
    
    // Check if addon already exists
    const exists = addons.value.some(addon => addon.transportUrl === trimmedURL);
    if (exists) {
        await dialog.alert({
            title: 'Addon Already in List',
            htmlMessage: 'This addon is already in your list.',
            confirmText: 'OK',
        });
        return;
    }
    
    // Fetch and validate manifest
    try {
        const response = await fetch(trimmedURL);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const manifest = await response.json();
        
        // Validate manifest has required fields
        if (!manifest.id || !manifest.name || !manifest.version) {
            throw new Error('Invalid manifest: missing required fields (id, name, or version)');
        }
        
        // Add the addon to the list
        addons.value.push({
            transportUrl: trimmedURL,
            manifest: manifest,
            flags: {}
        });
        
        // Check if state has changed from original
        checkIfModified()
        
        // Show simple success message
        toastRef.value?.show({
            message: `Added "${manifest.name}" to your addon list`,
            duration: 3000,
        })
        
    } catch (error) {
        console.error('Failed to add addon:', error);
        await dialog.alert({
            title: 'Failed to Add Addon',
            htmlMessage: `Could not install addon: ${error.message}`,
            confirmText: 'OK',
        });
    }
}

async function findCatalog() {
    const query = catalogSearchQuery.value.trim();
    
    if (!query) {
        catalogMatches.value = [];
        currentMatchIndex.value = 0;
        return;
    }
    
    if (!addons.value || addons.value.length === 0) {
        catalogMatches.value = [];
        currentMatchIndex.value = 0;
        return;
    }
    
    const queryLower = query.toLowerCase();
    catalogMatches.value = [];
    
    // Split query into words for multi-word matching
    const queryWords = queryLower.trim().split(/\s+/);
    
    // Search through all addons and their catalogs
    for (let i = 0; i < addons.value.length; i++) {
        const addon = addons.value[i];
        const catalogs = addon.manifest?.catalogs || [];
        
        for (let j = 0; j < catalogs.length; j++) {
            const catalog = catalogs[j];
            const catalogName = catalog.name || '';
            const catalogType = catalog.type || '';
            const catalogNameLower = catalogName.toLowerCase();
            const catalogTypeLower = catalogType.toLowerCase();
            
            let isMatch = false;
            
            if (queryWords.length === 1) {
                // Single word: match either name OR type (original behavior)
                isMatch = catalogNameLower.includes(queryWords[0]) || 
                         catalogTypeLower.includes(queryWords[0]);
            } else {
                // Multiple words: ALL words must match across name + type combined
                const combinedText = catalogNameLower + ' ' + catalogTypeLower;
                isMatch = queryWords.every(word => combinedText.includes(word));
            }
            
            if (isMatch) {
                // Found a match!
                catalogMatches.value.push({
                    addonIndex: i,
                    catalogIndex: j,
                    catalogName: catalogName || catalogType,
                    catalogType: catalogType
                });
            }
        }
    }
    
    if (catalogMatches.value.length > 0) {
        // Show the first match
        currentMatchIndex.value = 0;
        showCurrentMatch();
    } else {
        currentMatchIndex.value = 0;
    }
}

function showCurrentMatch() {
    if (catalogMatches.value.length === 0) return;
    
    const match = catalogMatches.value[currentMatchIndex.value];
    
    // Only open the addon if it's different from the currently open one
    if (currentEditIdx.value !== match.addonIndex) {
        openEditAddon(match.addonIndex);
        
        // Set highlight after modal opens with a small delay
        setTimeout(() => {
            highlightCatalogInfo.value = {
                name: match.catalogName,
                type: match.catalogType,
                index: match.catalogIndex
            };
        }, 100);
    } else {
        // Same addon, just update the highlight
        // Clear it first to ensure the watcher triggers even if it's the same catalog name
        highlightCatalogInfo.value = null;
        setTimeout(() => {
            highlightCatalogInfo.value = {
                name: match.catalogName,
                type: match.catalogType,
                index: match.catalogIndex
            };
        }, 50);
    }
}

function findNext() {
    if (catalogMatches.value.length === 0) return;
    
    currentMatchIndex.value = (currentMatchIndex.value + 1) % catalogMatches.value.length;
    showCurrentMatch();
}

function findPrevious() {
    if (catalogMatches.value.length === 0) return;
    
    currentMatchIndex.value = currentMatchIndex.value - 1;
    if (currentMatchIndex.value < 0) {
        currentMatchIndex.value = catalogMatches.value.length - 1;
    }
    showCurrentMatch();
}

function openSearchWidget() {
    if (!addons.value || addons.value.length === 0) {
        dialog.alert({
            title: 'No Addons Loaded',
            htmlMessage: 'Please load addons first before searching for catalogs.',
            confirmText: 'OK',
        });
        return;
    }
    
    // If already open, just trigger the animation again and refocus
    if (showSearchWidget.value) {
        searchWidgetAnimationKey.value++;
        nextTick(() => {
            searchInputRef.value?.focus();
        });
        return;
    }
    
    showSearchWidget.value = true;
    catalogSearchQuery.value = '';
    catalogMatches.value = [];
    currentMatchIndex.value = 0;
    
    // Focus the input after the widget is rendered
    nextTick(() => {
        searchInputRef.value?.focus();
    });
}

function closeSearchWidget() {
    showSearchWidget.value = false;
    catalogSearchQuery.value = '';
    catalogMatches.value = [];
    currentMatchIndex.value = 0;
}

function handleSearchInput() {
    // Clear existing debounce timer
    if (searchDebounceTimer) {
        clearTimeout(searchDebounceTimer);
    }
    
    // Set new debounce timer (500ms delay)
    searchDebounceTimer = setTimeout(() => {
        findCatalog();
    }, 500);
}

function handleKeydown(event) {
    if (event.key === 'Escape') {
        closeSearchWidget();
    }
}

onMounted(() => {
    window.addEventListener('scroll', handleScroll)
    window.addEventListener('keydown', handleKeydown)
    // Initial check
    handleScroll()
})

onUnmounted(() => {
    window.removeEventListener('scroll', handleScroll)
    window.removeEventListener('keydown', handleKeydown)
    if (searchDebounceTimer) {
        clearTimeout(searchDebounceTimer)
    }
})
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
                
                <!-- Find Catalog Button -->
                <div v-if="addons.length" class="find-catalog-section">
                    <button type="button" class="button find-catalog-button" @click="openSearchWidget">
                        Find Catalogs
                    </button>
                </div>
                
                <draggable v-if="addons.length" :list="addons" item-key="transportUrl" class="sortable-list" ghost-class="ghost"
                    handle=".drag-handle"
                    @start="dragging = true" @end="handleDragEnd">
                    <template #item="{ element, index }">
                        <AddonItem :name="element.manifest.name" :idx="index" :manifestURL="element.transportUrl"
                            :logoURL="element.manifest.logo"
                            :isDeletable="!getNestedObjectProperty(element, 'flags.protected', false)"
                            :isConfigurable="getNestedObjectProperty(element, 'manifest.behaviorHints.configurable', false)"
                            @delete-addon="removeAddon"
                            @edit-addon="openEditAddon"
                            @show-toast="handleToast" />
                    </template>
                </draggable>
                <p v-else-if="stremioAuthKey" class="empty-state">No addons loaded! Load addons or restore a configuration above to start editing them.</p>
            </fieldset>

            <fieldset id="form_step3">
                <legend>Step 3: Sync Addons</legend>
                <div v-if="addons.length" ref="controlsRef" class="action-row sticky-controls" :class="{ 'controls-fixed': controlsFixed }">
                    <div class="left-actions">
                        <button type="button" class="button primary large icon" :class="{ 'pulse': needsSync }" :disabled="!needsSync" @click="syncUserAddons">
                            Sync to Stremio
                            <img src="https://icongr.am/feather/loader.svg?size=16&amp;color=ffffff" alt="icon">
                        </button>
                    </div>
                    <div class="right-actions">
                        <button type="button" class="button install" @click="installAddon">
                            Add Addon...
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

    <!-- Catalog Search Widget -->
    <div v-if="showSearchWidget" class="search-widget-overlay">
        <div class="search-widget" :key="searchWidgetAnimationKey">
            <div class="search-widget-header">
                <input
                    ref="searchInputRef"
                    v-model="catalogSearchQuery"
                    type="text"
                    placeholder="Search catalogs by name or type..."
                    class="search-widget-input"
                    @input="handleSearchInput"
                />
                <button 
                    type="button" 
                    class="close-btn" 
                    @click="closeSearchWidget"
                    title="Close search"
                >
                    ✕
                </button>
            </div>
            
            <div v-if="catalogMatchCount > 0" class="search-widget-controls">
                <button 
                    type="button" 
                    class="nav-btn" 
                    @click="findPrevious"
                    title="Previous match"
                    :disabled="catalogMatchCount <= 1"
                >
                    ◀
                </button>
                <span class="match-display">{{ catalogMatchDisplay }}</span>
                <button 
                    type="button" 
                    class="nav-btn" 
                    @click="findNext"
                    title="Next match"
                    :disabled="catalogMatchCount <= 1"
                >
                    ▶
                </button>
            </div>
            
            <div v-else-if="catalogSearchQuery.trim()" class="search-widget-no-results">
                No matches found
            </div>
        </div>
    </div>

    <div v-if="isEditModalVisible" class="modal">
        <div class="modal-content">
            <DynamicForm 
                :manifest="currentManifest" 
                :manifestURL="currentManifestURL"
                :highlightCatalog="highlightCatalogInfo"
                @update-manifest="saveManifestEdit" 
                @cancel="closeEditModal"
            />
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

#form_step3 {
    position: relative;
    min-height: 114px;
}

.sticky-controls {
    background: linear-gradient(to top, #1a1a1a 0%, #1a1a1a 85%, rgba(26, 26, 26, 0.95) 100%);
    padding: 20px 25px;
    box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.3);
    box-sizing: border-box;
    transition: none;
}

.sticky-controls.controls-fixed {
    position: fixed;
    bottom: 0;
    left: 50%;
    transform: translateX(-50%);
    width: calc(100% - 91px) !important;
    max-width: 654px;
    z-index: 100;
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
    overscroll-behavior: contain;
}

.modal-content {
    background: #2e2e2e; 
    color: #e0e0e0; 
    width: 75vw;
    max-width: 900px;
    height: 90vh;
    max-height: 90vh;
    padding: 0;
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
        height: 95vh;
        max-height: 95vh;
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

.button.primary.large {
    padding: 13px 26px;
    font-size: 17px;
    font-weight: 600;
}

@keyframes pulse {
    0%, 100% {
        background-color: #14854f;
        box-shadow: 0 0 0 0 rgba(20, 133, 79, 0);
    }
    50% {
        background-color: #18a562;
        box-shadow: 0 0 0 8px rgba(20, 133, 79, 0.6);
    }
}

.button.primary.pulse {
    animation: pulse 0.6s ease-in-out 2;
    position: relative;
    z-index: 1;
}

.button.install {
    background-color: #007bff;
}

.button.install:hover {
    background-color: #0056b3;
}

.button.install:active {
    background-color: #004494;
    transform: scale(0.98);
    box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.3);
}

.button.install:disabled {
    background-color: #6c757d;
    opacity: 0.6;
}

.find-catalog-section {
    margin-bottom: 20px;
    display: flex;
    justify-content: flex-end;
}

.find-catalog-button {
    background-color: #007bff;
}

.find-catalog-button:hover {
    background-color: #0056b3;
}

.find-catalog-button:active {
    background-color: #004494;
}

/* Search Widget Overlay */
.search-widget-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: transparent;
    z-index: 2000;
    display: flex;
    justify-content: flex-end;
    align-items: flex-start;
    padding: 15px;
    pointer-events: none;
}

.search-widget {
    background: linear-gradient(135deg, #2a2a2a 0%, #1f1f1f 100%);
    border-radius: 10px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.8),
                0 0 0 1px rgba(255, 255, 255, 0.15);
    padding: 12px;
    min-width: 320px;
    max-width: 380px;
    pointer-events: auto;
    animation: searchWidgetAppear 0.6s ease-in-out 2;
}

@keyframes searchWidgetAppear {
    0%, 100% {
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.8),
                    0 0 0 1px rgba(255, 255, 255, 0.15);
    }
    50% {
        box-shadow: 0 0 32px rgba(0, 123, 255, 0.4),
                    0 0 0 6px rgba(0, 123, 255, 0.8);
    }
}

.search-widget-header {
    display: flex;
    gap: 8px;
    align-items: center;
    margin-bottom: 10px;
}

.search-widget-input {
    flex: 1;
    padding: 8px 12px;
    font-size: 14px;
    border: 2px solid rgba(255, 255, 255, 0.2);
    border-radius: 6px;
    background-color: rgba(255, 255, 255, 0.08);
    color: #e0e0e0;
    transition: border-color 0.2s ease, background-color 0.2s ease;
}

.search-widget-input:focus {
    outline: none;
    border-color: #007bff;
    background-color: rgba(255, 255, 255, 0.12);
}

.search-widget-input::placeholder {
    color: rgba(255, 255, 255, 0.4);
}

.close-btn {
    background-color: #dc3545;
    color: white;
    border: none;
    width: 32px;
    height: 32px;
    border-radius: 6px;
    font-size: 18px;
    font-weight: bold;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background-color 0.15s ease, transform 0.1s ease;
    padding: 0;
    flex-shrink: 0;
}

.close-btn:hover {
    background-color: #c82333;
}

.close-btn:active {
    background-color: #bd2130;
    transform: scale(0.95);
}

.search-widget-controls {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    padding: 8px;
    background: rgba(255, 255, 255, 0.05);
    border-radius: 6px;
}

.search-widget-controls .nav-btn {
    background-color: #007bff;
    color: white;
    border: none;
    padding: 6px 12px;
    font-size: 16px;
    font-weight: bold;
    cursor: pointer;
    border-radius: 5px;
    min-width: 38px;
    transition: background-color 0.15s ease, transform 0.1s ease;
}

.search-widget-controls .nav-btn:hover:not(:disabled) {
    background-color: #0056b3;
}

.search-widget-controls .nav-btn:active:not(:disabled) {
    background-color: #004494;
    transform: scale(0.95);
}

.search-widget-controls .nav-btn:disabled {
    background-color: #6c757d;
    opacity: 0.4;
    cursor: not-allowed;
}

.match-display {
    font-size: 14px;
    font-weight: 600;
    color: #e0e0e0;
    min-width: 55px;
    text-align: center;
}

.search-widget-no-results {
    padding: 8px;
    text-align: center;
    color: rgba(255, 255, 255, 0.5);
    font-size: 13px;
    font-style: italic;
    background: rgba(255, 255, 255, 0.03);
    border-radius: 6px;
}

/* Mobile responsive styles for buttons and action rows */
@media (max-width: 768px) {
    #form_step3 {
        min-height: 152px;
    }
    
    .action-row {
        flex-direction: column;
        gap: 0.75rem;
        align-items: stretch;
    }
    
    .sticky-controls {
        padding: 15px 25px;
        width: 100%; /* Use full width on mobile */
        max-width: 100%;
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
    
    .button.primary.large {
        padding: 14px 16px;
        font-size: 16px;
    }
}

@media (max-width: 600px) {
    .sticky-controls.controls-fixed {
        width: calc(100% - 66px) !important;
    }
}

@media (max-width: 480px) {
    #form_step3 {
        min-height: 137px;
    }
    
    .sticky-controls {
        padding: 12px 25px;
        width: 100%;
        max-width: 100%;
    }
    
    button {
        font-size: 14px;
        padding: 10px 14px;
    }
    
    .left-actions button,
    .right-actions button {
        font-size: 14px;
        padding: 10px 14px;
    }
    
    .button.primary.large {
        padding: 12px 14px;
        font-size: 15px;
    }
    
    .search-widget {
        min-width: 280px;
        max-width: 320px;
        padding: 10px;
    }
    
    .search-widget-input {
        font-size: 13px;
        padding: 7px 10px;
    }
    
    .close-btn {
        width: 28px;
        height: 28px;
        font-size: 16px;
    }
    
    .search-widget-controls {
        gap: 8px;
        padding: 6px;
    }
    
    .search-widget-controls .nav-btn {
        padding: 5px 10px;
        font-size: 14px;
        min-width: 32px;
    }
    
    .match-display {
        font-size: 13px;
        min-width: 45px;
    }
}
</style>
