<template>
    <div class="modal-form">
        <div class="modal-form-header">
            <h3>Editing "{{ headerTitle }}"</h3>
        </div>
        <div class="modal-form-body">
            <form @submit.prevent="handleSubmit">
                <div v-if="!isAdvancedMode">
                    <div class="form-group">
                        <label for="name">Name</label>
                        <input
                            id="name"
                            name="name"
                            type="text"
                            v-model="formModel.name"
                        />
                    </div>
                    
                    <div class="form-group">
                        <label for="description">Description</label>
                        <textarea
                            id="description"
                            name="description"
                            rows="4"
                            v-model="formModel.description"
                        ></textarea>
                    </div>

                    <div class="form-group">
                        <label for="features">Features</label>
                        <AddonFeatures :manifest="formModel" :showText="true" />
                    </div>

                    <div class="form-group">
                        <label for="logo">Logo URL</label>
                        <input
                            id="logo"
                            name="logo"
                            type="text"
                            v-model="formModel.logo"
                        />
                    </div>

                    <div class="form-group">
                        <label for="background">Background URL</label>
                        <input
                            id="background"
                            name="background"
                            type="text"
                            v-model="formModel.background"
                        />
                    </div>
        
                    <div v-if="formModel.catalogs && formModel.catalogs.length > 0" class="form-group">
                        <label>Catalogs</label>
                        <Draggable
                            v-model="formModel.catalogs"
                            item-key="__dragKey"
                            class="catalog-list"
                            ghost-class="catalog-ghost"
                            handle=".drag-handle"
                            @end="onCatalogReorder"
                            tag="div"
                        >
                            <template #item="{ element, index }">
                                <div class="catalog-item" :key="element.__dragKey">
                                    <div class="catalog-controls-left">
                                        <span class="drag-handle" aria-label="Reorder catalog">
                                            <img src="/icons/move-24-000000.svg" alt="" aria-hidden="true" />
                                        </span>
                                        <!-- Visibility toggle indicator(s) -->
                                        <span 
                                            class="visibility-indicator" 
                                            :class="{ 
                                                'is-visible': !hasSystemExtra(element) && isCatalogVisible(element),
                                                'visibility-hidden': hasSystemExtra(element)
                                            }"
                                            :title="getVisibilityTitle(element)"
                                            @click="!hasSystemExtra(element) ? toggleCatalogVisibility(element) : null"
                                        >
                                            <img v-if="hasSearchExtra(element)" src="/icons/home-20-000000.svg" alt="" aria-hidden="true" class="icon-home" />
                                            <img v-if="hasSearchExtra(element)" src="/icons/compass-20-000000.svg" alt="" aria-hidden="true" class="icon-discover" />
                                            <img v-if="!hasSearchExtra(element) && !hasSystemExtra(element)" src="/icons/home-24-000000.svg" alt="" aria-hidden="true" />
                                        </span>
                                        <label :for="'catalog-' + element.type" class="catalog-type-label">
                                            {{ element.type }}
                                        </label>
                                    </div>
                                    <div class="catalog-controls-right">
                                        <input
                                            :id="'catalog-' + element.type"
                                            type="text"
                                            v-model="element.name"
                                            placeholder="Catalog Name"
                                        />
                                        <button 
                                            type="button" 
                                            class="delete-button" 
                                            :class="{ 'delete-hidden': hasSystemExtra(element) || hasSearchExtra(element) }"
                                            @click="handleDeleteCatalog(element, index)"
                                        >
                                            <img src="/icons/trash-2-16-000000.svg" alt="Delete Catalog" />
                                        </button>
                                    </div>
                                </div>
                            </template>
                        </Draggable>
                    </div>
        
                    <div class="form-actions">
                        <div class="form-actions-left">
                            <button 
                                class="save-button" 
                                :class="{ 'save-button-highlight': hasUnsavedChanges }"
                                type="submit" 
                                :disabled="!hasUnsavedChanges"
                            >
                                Save
                            </button>
                            <button type="button" class="switch-mode-button" @click="toggleEditMode">Advanced mode</button>
                            <button type="button" class="cancel-button" @click="handleCancel">Cancel</button>
                        </div>
                        <div class="form-actions-right">
                            <button type="button" class="reset-button" @click="handleReset" :disabled="isResetting" :title="isResetting ? 'Fetching manifest...' : 'Fetch and apply the latest manifest from the addon developer'">
                                {{ isResetting ? 'Resetting...' : 'Reset Addon' }}
                            </button>
                        </div>
                    </div>
                </div>
                
                <div v-else class="advanced-mode-container">
                    <textarea v-model="jsonModel" class="json-editor"></textarea>
                    <div class="form-actions">
                        <div class="form-actions-left">
                            <button 
                                class="save-button" 
                                :class="{ 'save-button-highlight': hasUnsavedChanges }"
                                type="button" 
                                @click="updateFromJson"
                                :disabled="!hasUnsavedChanges"
                            >
                                Save
                            </button>
                            <button type="button" class="switch-mode-button" @click="toggleEditMode">Classic mode</button>
                            <button type="button" class="cancel-button" @click="handleCancel">Cancel</button>
                        </div>
                        <div class="form-actions-right">
                            <button type="button" class="reset-button" @click="handleReset" :disabled="isResetting" :title="isResetting ? 'Fetching manifest...' : 'Fetch and apply the latest manifest from the addon developer'">
                                {{ isResetting ? 'Resetting...' : 'Reset Addon' }}
                            </button>
                        </div>
                    </div>
                </div>
                
                <!-- Teleport Toast to body but keep within single root element -->
                <Teleport to="body">
                    <Toast ref="toastRef" />
                </Teleport>
            </form>
        </div>
    </div>
</template>

<script setup>
import { ref, watch, defineEmits, onMounted, nextTick, computed } from 'vue'
import Draggable from 'vuedraggable'
import { useDialog } from './DialogHost.vue'
import Toast from './Toast.vue'
import AddonFeatures from './AddonFeatures.vue'

const props = defineProps({
  manifest: {
    type: Object,
    required: true
  },
  manifestURL: {
    type: String,
    required: false,
    default: ''
  },
  highlightCatalog: {
    type: [String, Object],
    required: false,
    default: null
  },
  flags: {
    type: Object,
    required: false,
    default: () => ({})
  }
})

const emits = defineEmits(['update-manifest', 'cancel'])

const isAdvancedMode = ref(false);
const formModel = ref({
  name: '',
  description: '',
  logo: '',
  background: '',
  catalogs: []
});
const jsonModel = ref('')
const initialManifest = ref(null)
const isResetting = ref(false)
const dialog = useDialog()
const toastRef = ref(null)
const hasUnsavedChanges = ref(false)
const headerTitle = computed(() => {
    const name = formModel.value?.name;
    if (typeof name === 'string' && name.trim().length > 0) {
        return name.trim();
    }
    const manifestName = props.manifest?.name;
    if (typeof manifestName === 'string' && manifestName.trim().length > 0) {
        return manifestName.trim();
    }
    return 'Addon';
});

watch(() => props.manifest, (newManifest) => {
    const clone = JSON.parse(JSON.stringify(newManifest));
    ensureCatalogDragKeys(clone.catalogs);
    formModel.value = clone;
    syncJsonModel();
    // Store the initial state when manifest is first loaded
    initialManifest.value = JSON.parse(JSON.stringify(clone));
    hasUnsavedChanges.value = false;
    nextTick(() => {
        calculateMaxLabelWidth();
    });
}, { immediate: true });

watch(() => props.highlightCatalog, (catalogInfo) => {
    if (catalogInfo) {
        // Wait for DOM to fully render
        setTimeout(() => {
            nextTick(() => {
                scrollToCatalog(catalogInfo);
            });
        }, 500);
    }
});

// Watch formModel for changes (deep watch)
watch(formModel, () => {
    checkForChanges();
}, { deep: true });

// Watch jsonModel for changes in advanced mode
watch(jsonModel, () => {
    if (isAdvancedMode.value) {
        checkForChanges();
    }
});

onMounted(() => {
  calculateMaxLabelWidth();
});

function checkForChanges() {
    if (!initialManifest.value) {
        hasUnsavedChanges.value = false;
        return;
    }
    
    let currentState, initialState;
    
    if (isAdvancedMode.value) {
        // In advanced mode, compare JSON strings
        try {
            currentState = JSON.stringify(JSON.parse(jsonModel.value));
            initialState = JSON.stringify(toSanitizedManifest(initialManifest.value));
        } catch (e) {
            // If JSON is invalid, consider it as changed
            hasUnsavedChanges.value = true;
            return;
        }
    } else {
        // In normal mode, compare sanitized manifests
        currentState = JSON.stringify(toSanitizedManifest(formModel.value));
        initialState = JSON.stringify(toSanitizedManifest(initialManifest.value));
    }
    
    hasUnsavedChanges.value = currentState !== initialState;
}

function calculateMaxLabelWidth() {
  const labels = document.querySelectorAll('.catalog-type-label');
  let maxWidth = 0;

  labels.forEach(label => {
    maxWidth = Math.max(maxWidth, label.scrollWidth);
  });

  labels.forEach(label => {
    label.style.width = `${maxWidth}px`;
  });
}

function scrollToCatalog(catalogInfo) {
    if (!catalogInfo) return;
    
    // Find the modal-form scroll container
    const scrollContainer = document.querySelector('.modal-form');
    if (!scrollContainer) return;
    
    // Find the catalog item element by data attribute or text content
    const catalogItems = document.querySelectorAll('.catalog-item');
    
    // If we have an index, use it directly (most reliable method)
    if (typeof catalogInfo.index === 'number' && catalogItems[catalogInfo.index]) {
        const item = catalogItems[catalogInfo.index];
        
        // Calculate scroll position to center the item in the modal
        const itemTop = item.offsetTop;
        const containerHeight = scrollContainer.clientHeight;
        const itemHeight = item.offsetHeight;
        const scrollTo = itemTop - (containerHeight / 2) + (itemHeight / 2);
        
        // Scroll the modal-form container
        scrollContainer.scrollTo({ top: scrollTo, behavior: 'smooth' });
        
        // Add highlight animation
        item.classList.add('catalog-highlight');
        setTimeout(() => {
            item.classList.remove('catalog-highlight');
        }, 600);
        
        return;
    }
    
    // Fallback to legacy string-based search for backward compatibility
    const catalogName = catalogInfo.name || catalogInfo;
    const catalogType = catalogInfo.type;
    
    for (const item of catalogItems) {
        const input = item.querySelector('input[type="text"]');
        const label = item.querySelector('.catalog-type-label');
        
        // Match by both name and type if type is provided
        if (catalogType && label) {
            const itemType = label.textContent.trim();
            const itemName = input ? input.value : '';
            
            if (itemType === catalogType && itemName === catalogName) {
                // Calculate scroll position to center the item in the modal
                const itemTop = item.offsetTop;
                const containerHeight = scrollContainer.clientHeight;
                const itemHeight = item.offsetHeight;
                const scrollTo = itemTop - (containerHeight / 2) + (itemHeight / 2);
                
                // Scroll the modal-form container
                scrollContainer.scrollTo({ top: scrollTo, behavior: 'smooth' });
                
                // Add highlight animation
                item.classList.add('catalog-highlight');
                setTimeout(() => {
                    item.classList.remove('catalog-highlight');
                }, 600);
                
                return;
            }
        }
        
        // Fallback: match by name only if type not provided
        if (input && input.value === catalogName) {
            // Calculate scroll position to center the item in the modal
            const itemTop = item.offsetTop;
            const containerHeight = scrollContainer.clientHeight;
            const itemHeight = item.offsetHeight;
            const scrollTo = itemTop - (containerHeight / 2) + (itemHeight / 2);
            
            // Scroll the modal-form container
            scrollContainer.scrollTo({ top: scrollTo, behavior: 'smooth' });
            
            // Add highlight animation
            item.classList.add('catalog-highlight');
            setTimeout(() => {
                item.classList.remove('catalog-highlight');
            }, 600);
            
            return;
        }
        
        // Also check catalog type label
        if (label && label.textContent.trim() === catalogName) {
            const itemTop = item.offsetTop;
            const containerHeight = scrollContainer.clientHeight;
            const itemHeight = item.offsetHeight;
            const scrollTo = itemTop - (containerHeight / 2) + (itemHeight / 2);
            
            scrollContainer.scrollTo({ top: scrollTo, behavior: 'smooth' });
            item.classList.add('catalog-highlight');
            setTimeout(() => {
                item.classList.remove('catalog-highlight');
            }, 600);
            return;
        }
    }
}

async function toggleEditMode() {
  isAdvancedMode.value = !isAdvancedMode.value;
    if (!isAdvancedMode.value) {
        try {
            const parsed = JSON.parse(jsonModel.value);
            ensureCatalogDragKeys(parsed.catalogs);
            formModel.value = parsed;
            nextTick(() => calculateMaxLabelWidth());
        } catch (e) {
            await dialog.alert({
                title: 'Invalid JSON',
                htmlMessage: 'The provided JSON could not be parsed. Please fix any syntax errors and try again.',
                confirmText: 'OK',
            });
        }
    } else {
        syncJsonModel();
    }
}

function handleSubmit() {
    const sanitized = toSanitizedManifest(formModel.value);
    emits('update-manifest', sanitized);
    jsonModel.value = JSON.stringify(sanitized, null, 2);
    
    // Update initial manifest to current state (saved)
    initialManifest.value = JSON.parse(JSON.stringify(formModel.value));
    hasUnsavedChanges.value = false;
    
    // Show success toast
    toastRef.value?.show({
        message: 'Manifest changes have been applied successfully.',
        duration: 3000,
    });
}

async function handleDeleteCatalog(catalog, index) {
    // If catalog has search extra, show scary warning about breaking search functionality
    if (hasSearchExtra(catalog)) {
        const catalogName = catalog.name || catalog.type || 'this catalog';
        const contentType = catalog.type || 'content';
        const addonName = formModel.value.name || 'this addon';
        
        const confirmed = await dialog.confirm({
            title: '⚠️ Delete Search Catalog?',
            htmlMessage: `<strong style="color: #ff4444;">WARNING: This will break search functionality!</strong><br><br>` +
                        `Deleting "<strong>${catalogName}</strong>" will remove the ability to search for <strong>${contentType}</strong> in Stremio via the "<strong>${addonName}</strong>" addon.<br><br>` +
                        `Are you absolutely sure you want to delete this catalog?`,
            confirmText: 'Yes, delete anyway',
            cancelText: 'Cancel',
        });
        
        if (!confirmed) return;
    }
    
    // Proceed with deletion
    removeCatalog(index);
}

function removeCatalog(index) {
  if (Array.isArray(formModel.value.catalogs)) {
    formModel.value.catalogs.splice(index, 1);
        syncJsonModel();
        nextTick(() => calculateMaxLabelWidth());
  }
}

async function updateFromJson() {
  try {
        const parsed = JSON.parse(jsonModel.value);
        ensureCatalogDragKeys(parsed.catalogs);
        formModel.value = parsed;
        const sanitized = toSanitizedManifest(parsed);
        emits('update-manifest', sanitized);
        jsonModel.value = JSON.stringify(sanitized, null, 2);
        isAdvancedMode.value = false;
        
        // Update initial manifest to current state (saved)
        initialManifest.value = JSON.parse(JSON.stringify(formModel.value));
        hasUnsavedChanges.value = false;
        
        nextTick(() => {
            calculateMaxLabelWidth();
        });
        
        // Show success toast
        toastRef.value?.show({
            message: 'Manifest changes have been applied successfully.',
            duration: 3000,
        });
  } catch (e) {
        await dialog.alert({
                title: 'Invalid JSON',
                htmlMessage: 'The provided JSON could not be parsed. Please fix any syntax errors and try again.',
                confirmText: 'OK',
        });
  }
}

function onCatalogReorder() {
    syncJsonModel();
    nextTick(() => calculateMaxLabelWidth());
}

function ensureCatalogDragKeys(catalogs) {
    if (!Array.isArray(catalogs)) return;
    const stamp = Date.now();
    catalogs.forEach((catalog, idx) => {
        if (!catalog.__dragKey) {
            const rand = Math.random().toString(36).slice(2, 8);
            catalog.__dragKey = `${catalog.type || 'catalog'}-${stamp}-${idx}-${rand}`;
        }
    });
}

function toSanitizedManifest(model) {
    const clone = JSON.parse(JSON.stringify(model));
    if (Array.isArray(clone.catalogs)) {
        clone.catalogs.forEach((catalog) => {
            if (catalog && typeof catalog === 'object') {
                delete catalog.__dragKey;
            }
        });
    }
    return clone;
}

function syncJsonModel() {
    jsonModel.value = JSON.stringify(toSanitizedManifest(formModel.value), null, 2);
}

function hasSearchExtra(catalog) {
    if (!Array.isArray(catalog.extra)) return false;
    return catalog.extra.some(e => e && typeof e === 'object' && e.name === 'search');
}

function hasGenreExtra(catalog) {
    if (!Array.isArray(catalog.extra)) return false;
    return catalog.extra.some(e => e && typeof e === 'object' && e.name === 'genre');
}

function hasSystemExtra(catalog) {
    // Check for special system extras that shouldn't be editable
    if (!Array.isArray(catalog.extra)) return false;
    const systemExtras = ['lastVideosIds', 'calendarVideosIds'];
    return catalog.extra.some(e => e && typeof e === 'object' && systemExtras.includes(e.name));
}

function getSearchExtra(catalog) {
    if (!Array.isArray(catalog.extra)) return null;
    return catalog.extra.find(e => e && typeof e === 'object' && e.name === 'search') || null;
}

function getGenreExtra(catalog) {
    if (!Array.isArray(catalog.extra)) return null;
    return catalog.extra.find(e => e && typeof e === 'object' && e.name === 'genre') || null;
}



function isCatalogVisible(catalog) {
    // When search extra exists, it controls visibility
    if (hasSearchExtra(catalog)) {
        const searchExtra = getSearchExtra(catalog);
        return searchExtra && searchExtra.isRequired !== true;
    }
    
    // When genre exists, it controls visibility
    if (hasGenreExtra(catalog)) {
        const genreExtra = getGenreExtra(catalog);
        return genreExtra && genreExtra.isRequired !== true;
    }
    
    // For catalogs without extra (like Trakt), default to visible
    if (!Array.isArray(catalog.extra) || catalog.extra.length === 0) {
        return true;
    }
    
    return false;
}

function getVisibilityTitle(catalog) {
    if (hasSystemExtra(catalog)) return '';
    
    const isVisible = isCatalogVisible(catalog);
    
    if (hasSearchExtra(catalog)) {
        return isVisible ? 'Visible on Home & Discover pages' : 'Hidden from Home & Discover pages';
    } else {
        return isVisible ? 'Visible on Home page' : 'Hidden from Home page';
    }
}

function toggleCatalogVisibility(catalog) {
    const isCurrentlyVisible = isCatalogVisible(catalog);
    
    // Ensure catalog has an extra array
    if (!Array.isArray(catalog.extra)) {
        catalog.extra = [];
    }
    
    // When search extra exists, it controls visibility
    if (hasSearchExtra(catalog)) {
        const searchExtra = getSearchExtra(catalog);
        if (!searchExtra) return;
        
        if (isCurrentlyVisible) {
            // Hide: add isRequired property
            searchExtra.isRequired = true;
        } else {
            // Show: remove isRequired property
            delete searchExtra.isRequired;
        }
        
        // Ensure genre extra has no isRequired property when search controls visibility
        const genreExtra = getGenreExtra(catalog);
        if (genreExtra && 'isRequired' in genreExtra) {
            delete genreExtra.isRequired;
        }
    } 
    // When genre exists, it controls visibility
    else if (hasGenreExtra(catalog)) {
        const genreExtra = getGenreExtra(catalog);
        if (!genreExtra) return;
        
        if (isCurrentlyVisible) {
            // Hide: add isRequired property
            genreExtra.isRequired = true;
        } else {
            // Show: remove isRequired property
            delete genreExtra.isRequired;
        }
    }
    // For catalogs without extra (like Trakt), add a genre extra
    else if (catalog.extra.length === 0) {
        if (isCurrentlyVisible) {
            // Hide: add genre extra with isRequired: true
            catalog.extra.push({
                name: 'genre',
                isRequired: true,
                options: [],
                optionsLimit: 1
            });
        }
        // If not visible and no extra exists, do nothing (shouldn't happen)
    }
    
    syncJsonModel();
}

async function handleCancel() {
    // Compare current state with initial state
    const currentSanitized = toSanitizedManifest(formModel.value);
    const initialSanitized = toSanitizedManifest(initialManifest.value);
    
    const currentJson = JSON.stringify(currentSanitized);
    const initialJson = JSON.stringify(initialSanitized);
    
    // If no changes were made, just close without confirmation
    if (currentJson === initialJson) {
        emits('cancel');
        return;
    }
    
    const confirmed = await dialog.confirm({
        title: 'Cancel editing',
        htmlMessage: 'Are you sure you want to cancel?<br><br>Any changes you made will be undone.',
        confirmText: 'Yes, cancel',
        cancelText: 'Keep editing',
    });
    
    if (confirmed) {
        // Restore the initial state
        if (initialManifest.value) {
            const restored = JSON.parse(JSON.stringify(initialManifest.value));
            ensureCatalogDragKeys(restored.catalogs);
            formModel.value = restored;
            syncJsonModel();
            nextTick(() => calculateMaxLabelWidth());
        }
        emits('cancel');
    }
}

async function handleReset() {
    if (!props.manifestURL) {
        await dialog.alert({
            title: 'Cannot reset',
            htmlMessage: 'No manifest URL available for this addon.',
            confirmText: 'OK',
        });
        return;
    }
    
    const confirmed = await dialog.confirm({
        title: 'Reset addon?',
        htmlMessage: '⚠️ <strong>Warning:</strong> This will fetch and apply the latest manifest from the addon developer.<br><br>Any customizations you\'ve made (renamed catalogs, reordering, etc.) will be lost.',
        confirmText: 'Yes, reset addon',
        cancelText: 'Cancel',
    });
    
    if (!confirmed) return;
    
    isResetting.value = true;
    
    try {
        // Convert stremio:// URLs to https://
        let fetchURL = props.manifestURL;
        if (fetchURL.startsWith('stremio://')) {
            fetchURL = fetchURL.replace('stremio://', 'https://');
        }
        
        // Create abort controller for timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout
        
        let response;
        try {
            response = await fetch(fetchURL, {
                signal: controller.signal,
                headers: {
                    'Accept': 'application/json'
                }
            });
            clearTimeout(timeoutId);
        } catch (fetchError) {
            clearTimeout(timeoutId);
            if (fetchError.name === 'AbortError') {
                throw new Error('Request timed out after 15 seconds. The addon server may be slow or unavailable.');
            }
            throw new Error(`Network error: ${fetchError.message}`);
        }
        
        if (!response.ok) {
            let errorMsg = `HTTP ${response.status}`;
            if (response.status === 404) {
                errorMsg += ' - Manifest not found. The addon may have been removed or the URL is incorrect.';
            } else if (response.status === 403) {
                errorMsg += ' - Access forbidden. The addon server denied the request.';
            } else if (response.status === 500) {
                errorMsg += ' - Server error. The addon server is experiencing issues.';
            } else if (response.status >= 400 && response.status < 500) {
                errorMsg += ' - Client error. The request was rejected by the server.';
            } else if (response.status >= 500) {
                errorMsg += ' - Server error. The addon server is experiencing issues.';
            }
            throw new Error(errorMsg);
        }
        
        // Check content type
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            throw new Error(`Invalid response type: Expected JSON but got ${contentType || 'unknown'}. The URL may not point to a valid addon manifest.`);
        }
        
        let data;
        try {
            data = await response.json();
        } catch (parseError) {
            throw new Error('Invalid JSON response. The manifest data is corrupted or malformed.');
        }
        
        // Validate manifest structure
        if (!data || typeof data !== 'object') {
            throw new Error('Invalid manifest: Response is not a valid object.');
        }
        
        if (!data.id || typeof data.id !== 'string') {
            throw new Error('Invalid manifest: Missing or invalid "id" field.');
        }
        
        if (!data.name || typeof data.name !== 'string') {
            throw new Error('Invalid manifest: Missing or invalid "name" field.');
        }
        
        if (!data.version || typeof data.version !== 'string') {
            throw new Error('Invalid manifest: Missing or invalid "version" field.');
        }
        
        if (data.catalogs && !Array.isArray(data.catalogs)) {
            throw new Error('Invalid manifest: "catalogs" field must be an array.');
        }
        
        // Apply the fetched manifest
        const clone = JSON.parse(JSON.stringify(data));
        ensureCatalogDragKeys(clone.catalogs);
        formModel.value = clone;
        syncJsonModel();
        
        // Don't reset initialManifest - the fetched manifest is different from parent
        // and should be treated as an unsaved change that needs to be saved
        
        nextTick(() => {
            calculateMaxLabelWidth();
        });
        
        toastRef.value?.show({
            message: 'Addon reset to latest version from developer.',
            duration: 3000,
        });
    } catch (error) {
        console.error('Failed to reset addon:', error);
        await dialog.alert({
            title: 'Reset Failed',
            htmlMessage: `Could not fetch the latest manifest from the addon developer.<br><br><strong>Error:</strong> ${error.message}<br><br><small>URL: ${props.manifestURL}</small>`,
            confirmText: 'OK',
        });
    } finally {
        isResetting.value = false;
    }
}
</script>

<style scoped>
.modal-form {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
    flex: 1 1 auto;
    width: 100%;
    overflow-y: auto;
    overscroll-behavior: contain;
}

.modal-form-header {
    padding: 20px 20px 15px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    flex-shrink: 0;
    position: sticky;
    top: 0;
    background: #2e2e2e;
    z-index: 10;
    pointer-events: none;
}

.modal-form-header h3 {
    margin: 0;
    user-select: none;
    pointer-events: auto;
}

.modal-form-body {
    flex: 1;
    display: flex;
    flex-direction: column;
    padding: 20px;
    min-height: 0;
}

.save-button {
    padding: 10px 20px;
    border: none;
    background-color: #14854f;
    color: #ffffff;
    font-size: 16px;
    cursor: pointer;
    border-radius: 5px;
    transition: background-color 0.2s ease, transform 0.1s ease, box-shadow 0.15s ease;
    margin-right: 10px;
}

.save-button:hover:not(:disabled) {
    background-color: #14854eef;
}

.save-button:active:not(:disabled) {
    background-color: #106e41;
    transform: scale(0.96);
    box-shadow: inset 0 2px 6px rgba(0, 0, 0, 0.3);
}

.save-button:disabled {
    background-color: #3d5f4a;
    cursor: not-allowed;
    opacity: 0.5;
    transform: none;
}

.save-button-highlight {
    animation: saveButtonPulse 0.6s ease-in-out 2;
}

@keyframes saveButtonPulse {
    0%, 100% {
        background-color: #14854f;
        box-shadow: 0 0 0 0 rgba(20, 133, 79, 0);
    }
    50% {
        background-color: #18a562;
        box-shadow: 0 0 0 8px rgba(20, 133, 79, 0.6);
    }
}

.switch-mode-button {
    padding: 10px 20px;
    border: none;
    background-color: #007bff;
    color: #ffffff;
    font-size: 16px;
    cursor: pointer;
    border-radius: 5px;
    transition: background-color 0.2s ease, transform 0.1s ease, box-shadow 0.15s ease;
}

.switch-mode-button:hover {
    background-color: #0056b3;
}

.switch-mode-button:active {
    background-color: #004494;
    transform: scale(0.96);
    box-shadow: inset 0 2px 6px rgba(0, 0, 0, 0.3);
}

.switch-mode-button:disabled {
    background-color: #6c757d;
    cursor: not-allowed;
    opacity: 0.6;
    transform: none;
}

.cancel-button {
    padding: 10px 20px;
    border: none;
    background-color: #6c757d;
    color: #ffffff;
    font-size: 16px;
    cursor: pointer;
    border-radius: 5px;
    transition: background-color 0.2s ease, transform 0.1s ease, box-shadow 0.15s ease;
}

.cancel-button:hover {
    background-color: #5a6268;
}

.cancel-button:active {
    background-color: #4e545a;
    transform: scale(0.96);
    box-shadow: inset 0 2px 6px rgba(0, 0, 0, 0.3);
}

.cancel-button:disabled {
    background-color: #6c757d;
    cursor: not-allowed;
    opacity: 0.6;
    transform: none;
}

.reset-button {
    padding: 10px 20px;
    border: none;
    background-color: #ff8c00;
    color: #ffffff;
    font-size: 16px;
    cursor: pointer;
    border-radius: 5px;
    transition: background-color 0.2s ease, transform 0.1s ease, box-shadow 0.15s ease;
}

.reset-button:hover:not(:disabled) {
    background-color: #e67e00;
}

.reset-button:active:not(:disabled) {
    background-color: #cc7000;
    transform: scale(0.96);
    box-shadow: inset 0 2px 6px rgba(0, 0, 0, 0.3);
}

.reset-button:disabled {
    background-color: #cccccc;
    cursor: not-allowed;
    opacity: 0.5;
    transform: none;
}

.delete-button {
    padding: 10px 20px;
    border: none;
    background-color: #ac0415;
    color: #00000091;
    font-size: 16px;
    cursor: pointer;
    border-radius: 5px;
    transition: background-color 0.2s ease, transform 0.1s ease, box-shadow 0.15s ease;
}

.delete-button:hover {
    background-color: #ac0415f3;
}

.delete-button:active {
    background-color: #8a0311;
    transform: scale(0.96);
    box-shadow: inset 0 2px 6px rgba(0, 0, 0, 0.4);
}

.delete-button:disabled {
    background-color: #f5f5f5;
    cursor: not-allowed;
    opacity: 0.6;
    transform: none;
}

.delete-button.delete-hidden {
    visibility: hidden;
    pointer-events: none;
}

.delete-button img {
    filter: brightness(0) invert(1);
}

form {
    display: flex;
    flex-direction: column;
    padding: 0;
    height: 100%;
    min-height: 0;
    touch-action: pan-y; /* Allow vertical scrolling in the form */
}

.form-group {
    margin-bottom: 15px;
}

label {
    display: block;
    margin-bottom: 5px;
}

input, textarea {
    width: 100%;
    padding: 10px;
    box-sizing: border-box;
    touch-action: manipulation; /* Prevent double-tap zoom on input fields */
}

textarea {
    resize: vertical;
    background-color: #131316;
    color: #f5f5f5;
}

.advanced-mode-container {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
    height: 100%;
}

.json-editor {
    flex: 1;
    min-height: 0;
    height: 100%;
    font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
    font-size: 14px;
    line-height: 1.5;
    padding: 15px;
    box-sizing: border-box;
    resize: none;
}

.catalog-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
    touch-action: pan-y; /* Allow vertical scrolling but control horizontal during drag */
}

.catalog-ghost {
    opacity: 0.4;
    touch-action: none; /* Disable scrolling when dragging */
    user-select: none;
    -webkit-user-select: none;
    -moz-user-select: none;
    -ms-user-select: none;
}

.catalog-item {
    display: flex;
    align-items: center;
    margin-top: 10px;
    touch-action: manipulation; /* Prevent double-tap zoom, allow single taps */
    flex-wrap: wrap;
    gap: 8px; /* Tighter gap between left and right groups */
    padding: 8px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 6px;
    background: rgba(255, 255, 255, 0.03);
    transition: background-color 0.3s ease, border-color 0.3s ease;
}

.catalog-item.catalog-highlight {
    background: rgba(0, 123, 255, 0.2);
    border-color: rgba(0, 123, 255, 0.5);
    animation: highlightPulse 0.6s ease-in-out 1;
}

@keyframes highlightPulse {
    0%, 100% {
        background: rgba(0, 123, 255, 0.2);
        border-color: rgba(0, 123, 255, 0.5);
    }
    50% {
        background: rgba(0, 123, 255, 0.35);
        border-color: rgba(0, 123, 255, 0.8);
    }
}

.catalog-controls-left {
    display: flex;
    align-items: center;
    gap: 8px; /* Tighter spacing within left group */
    flex-shrink: 0; /* Don't shrink this group */
}

.catalog-controls-right {
    display: flex;
    align-items: center;
    gap: 8px; /* Tighter spacing within right group */
    flex: 1 1 auto;
    min-width: 0; /* Allow shrinking */
}

/* Allow wrapping when screen is too narrow for all controls + 250px input */
@media (max-width: 600px) {
    .catalog-item {
        flex-wrap: wrap;
    }
    
    .catalog-controls-right {
        flex: 1 1 100%;
        min-width: 200px;
    }
}

.drag-handle {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    background: transparent;
    cursor: grab;
    border-radius: 6px;
    padding: 0;
    flex-shrink: 0;
    touch-action: none; /* Disable all touch scrolling for drag handles */
    transition: background-color 0.2s ease, transform 0.1s ease;
    user-select: none;
    -webkit-user-select: none;
    -moz-user-select: none;
    -ms-user-select: none;
}

.drag-handle:hover {
    background: rgba(255, 255, 255, 0.08);
}

.drag-handle:active {
    cursor: grabbing;
    touch-action: none; /* Keep scrolling disabled while actively dragging */
    background: rgba(255, 255, 255, 0.15);
    transform: scale(1.05);
}

.drag-handle img {
    pointer-events: none;
    filter: brightness(0) invert(1);
    user-select: none;
}

.visibility-indicator {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    min-width: 36px;
    height: 36px;
    background: transparent;
    cursor: pointer;
    border-radius: 6px;
    padding: 0 4px;
    flex-shrink: 0;
    transition: background-color 0.2s ease, transform 0.1s ease;
}

.visibility-indicator:hover {
    background: rgba(255, 255, 255, 0.08);
}

.visibility-indicator:active {
    background: rgba(255, 255, 255, 0.15);
    transform: scale(0.95);
}

.visibility-indicator img {
    pointer-events: none;
    filter: brightness(0) invert(0.5);
    user-select: none;
    transition: filter 0.2s;
}

.visibility-indicator.is-visible img {
    filter: brightness(0) saturate(100%) invert(58%) sepia(98%) saturate(2107%) hue-rotate(85deg) brightness(95%) contrast(101%);
}

.visibility-indicator.visibility-hidden {
    visibility: hidden;
    pointer-events: none;
}

.catalog-type-label {
    margin-right: 10px;
    color: #f5f5f5;
    font-weight: bold;
    text-align: right;
    white-space: nowrap;
}

.catalog-controls-right input {
    flex: 1 1 250px;
    margin-right: 10px;
    box-sizing: border-box;
    min-width: 250px;
}

.form-actions {
    display: flex;
    gap: 10px;
    margin-top: 20px;
    padding: 20px;
    margin: 0 -20px 0 -20px;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
    background: linear-gradient(to top, #2e2e2e 0%, #2e2e2e 70%, rgba(46, 46, 46, 0.95) 100%);
    position: sticky;
    bottom: 0;
    z-index: 10;
    justify-content: space-between;
    align-items: center;
}

.form-actions-left,
.form-actions-right {
    display: flex;
    gap: 10px;
    align-items: center;
}

@media (max-width: 1024px) {
    .modal-form-header {
        padding: 15px 15px 12px;
    }
    
    .modal-form-body {
        padding: 15px;
    }
}

@media (max-width: 768px) {
    .modal-form-header {
        padding: 12px;
    }
    
    .modal-form-body {
        padding: 12px;
    }
    
    /* Optimize spacing for mobile */
    .form-group {
        margin-bottom: 12px;
    }
    
    label {
        margin-bottom: 4px;
        font-size: 14px;
    }
    
    input, textarea {
        padding: 8px;
        font-size: 14px;
    }
    
    .form-actions {
        flex-wrap: wrap;
        gap: 8px;
        margin: 0 -12px 0 -12px;
        padding: 12px;
        bottom: 0;
    }
    
    .form-actions button {
        flex: 1 1 auto;
        min-width: 0;
        font-size: 14px;
        padding: 8px 12px;
    }
    
    .json-editor {
        font-size: 13px;
        padding: 12px;
    }
}

@media (max-width: 480px) {
    /* Further optimize for very small screens */
    .form-group {
        margin-bottom: 10px;
    }
    
    .form-actions {
        flex-direction: column;
        align-items: stretch;
    }
    
    .form-actions-left,
    .form-actions-right {
        width: 100%;
        flex-direction: column;
    }
    
    .form-actions button {
        width: 100%;
    }
}
</style>
