<script setup>
  import { ref } from 'vue'

  const props = defineProps({
    name: {
      type: String,
      required: true
    },
    idx: {
      type: Number,
      required: true
    },
    manifestURL: {
      type: String,
      required: true
    },
    logoURL: {
      type: String,
      required: false
    },
    isDeletable: {
      type: Boolean,
      required: false,
      default: true
    },
    isConfigurable: {
      type: Boolean,
      required: false,
      default: false
    }
  })
  
  const emits = defineEmits(['delete-addon', 'edit-addon', 'show-toast'])
  
  const defaultLogo = '/icons/box-48-ffffff.svg'
  
  async function copyManifestURLToClipboard() {
    try {
      // Modern clipboard API - works on most browsers including mobile
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(props.manifestURL)
        emits('show-toast', {
          message: 'Manifest URL copied to clipboard!',
          duration: 3000,
        })
      } else {
        // Fallback for older browsers/mobile
        const textArea = document.createElement('textarea')
        textArea.value = props.manifestURL
        textArea.style.position = 'fixed'
        textArea.style.left = '-999999px'
        textArea.style.top = '-999999px'
        document.body.appendChild(textArea)
        textArea.focus()
        textArea.select()
        
        try {
          const successful = document.execCommand('copy')
          document.body.removeChild(textArea)
          
          if (successful) {
            emits('show-toast', {
              message: 'Manifest URL copied to clipboard!',
              duration: 3000,
            })
          } else {
            throw new Error('Copy command failed')
          }
        } catch (err) {
          document.body.removeChild(textArea)
          console.error('Failed to copy text:', err)
          emits('show-toast', {
            message: 'Failed to copy URL. Please copy manually.',
            duration: 4000,
          })
        }
      }
    } catch (error) {
      console.error('Error copying text to clipboard', error)
      emits('show-toast', {
        message: 'Failed to copy URL. Please try again.',
        duration: 3000,
      })
    }
  }
  
  function openAddonConfigurationPage() {
    const configureURL = props.manifestURL.replace("stremio://", "https://").replace("/manifest.json", "/configure");
    window.open(configureURL, '_blank', 'noopener,noreferrer');
  }
  
  function removeAddon() {
    // Prepare toast notification before emitting delete
    const addonName = props.name.length > 30 
      ? props.name.substring(0, 27) + '...' 
      : props.name
    
    // Emit to parent to show toast (since this component will be destroyed)
    emits('show-toast', {
      message: `"${addonName}" removed. Sync to Stremio to apply changes.`,
      duration: 4000,
    })
    
    // Then emit the delete event
    emits('delete-addon', props.idx)
  }
  
  function openEditManifestModal() {
    emits('edit-addon', props.idx)
  }
</script>

<template>
  <div class="item">
    <div class="col-8">
      <div class="details">
        <div class="logo_container">
          <img :src="logoURL || defaultLogo" />
        </div>
        <span>{{ name }}</span>
      </div>
    </div>
    <div class="actions-wrapper">
      <div class="col">
        <button class="button icon-only visit-url" title="Open addon configuration page in new window"
          :disabled="!isConfigurable" 
          @click="openAddonConfigurationPage" @mousedown.stop @touchstart.stop>
          <img src="/icons/arrow-up-right-12-000000.svg">
        </button>
        <button class="button icon-only copy-url" title="Copy addon manifest URL to clipboard"
          @click="copyManifestURLToClipboard" @mousedown.stop @touchstart.stop>
          <img src="/icons/clipboard-12-000000.svg">
        </button>
        <button class="button icon-only edit-addon" title="Edit addon" 
          @click="openEditManifestModal" @mousedown.stop @touchstart.stop>
          <img src="/icons/edit-12-000000.svg">
        </button>
        <button class="button icon-only delete" title="Remove addon from list" 
          :disabled="!isDeletable"
          @click="removeAddon" @mousedown.stop @touchstart.stop>
          <img src="/icons/trash-2-12-000000.svg">
        </button>
      </div>
      <span class="drag-handle" aria-label="Reorder addon">
        <img src="/icons/move-32-000000.svg" alt="" aria-hidden="true" />
      </span>
    </div>
  </div>
</template>

<style scoped>
.sortable-list .item {
  list-style: none;
  display: flex;
  cursor: default;
  align-items: center;
  border-radius: 5px;
  padding: 10px 13px;
  margin-bottom: 11px;
  border: 1px solid #ccc;
  justify-content: space-between;
  flex-wrap: wrap;
  position: relative; /* Needed for absolute positioning of drag handle on mobile */
  flex-direction: row; /* Keep horizontal layout on desktop */
}

@media (max-width: 768px) {
  .sortable-list .item {
    flex-direction: column; /* Stack vertically on mobile */
    align-items: flex-start; /* Left align everything */
    padding: 10px;
  }
}

.dark .sortable-list .item {
  border: 1px solid #434242;
}

.item .details {
  display: flex;
  align-items: center;
  flex: 1;
}

.item .details img {
  height: 60px;
  width: 60px;
  pointer-events: none;
  margin-right: 12px;
  object-fit: contain;
  object-position: center;
  border-radius: 30%;
  background-color: #262626;
}

.col {
  display: flex;
  gap: 6px; /* Consistent gap at all sizes */
  flex-wrap: nowrap; /* Never wrap the buttons */
  align-items: center;
  min-width: auto;
  flex-shrink: 1; /* Allow buttons to shrink if needed */
}

.actions-wrapper {
  display: flex;
  align-items: center;
  gap: 0; /* No gap needed, drag-handle has its own margin */
  flex-shrink: 0; /* Prevent shrinking on mobile */
  width: 100%;
  justify-content: space-between; /* Push buttons left, drag handle right */
}

.button {
  border-radius: 6px;
  cursor: pointer;
  padding: 8px;
  background-color: #2c5f8d;
  border: none;
  transition: background-color 0.2s ease, opacity 0.2s ease, transform 0.1s ease, box-shadow 0.15s ease;
}

.button:hover:not(:disabled) {
  background-color: #234a6f;
}

.button:active:not(:disabled) {
  background-color: #1a3a56;
  transform: scale(0.95);
  box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.2);
}

.button:disabled {
  background-color: #cccccc;
  cursor: not-allowed;
  opacity: 0.5;
  transform: none;
}

.dark .button {
  background-color: #3a6a96;
}

.dark .button:hover:not(:disabled) {
  background-color: #2d5478;
}

.dark .button:active:not(:disabled) {
  background-color: #234260;
  transform: scale(0.95);
  box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.3);
}

.dark .button:disabled {
  background-color: #555555;
  opacity: 0.4;
}

.icon-only {
  display: flex;
  justify-content: center;
  align-items: center;
}

.visit-url img,
.copy-url img,
.edit-addon img {
  width: 20px;
  height: 20px;
  filter: brightness(0); /* Make icons black */
  pointer-events: none; /* Prevent images from intercepting click events */
}

.delete img {
  width: 20px;
  height: 20px;
  filter: brightness(0) saturate(100%) invert(25%) sepia(85%) saturate(3500%) hue-rotate(345deg); /* Red color for delete */
  pointer-events: none; /* Prevent images from intercepting click events */
}

.dark .visit-url img,
.dark .copy-url img,
.dark .edit-addon img {
  filter: brightness(0); /* Keep icons black even in dark mode */
}

.dark .delete img {
  filter: brightness(0) saturate(100%) invert(35%) sepia(85%) saturate(4000%) hue-rotate(345deg); /* Brighter red for dark mode */
}

.drag-handle {
  cursor: move;
  touch-action: none; /* Disable scrolling when touching drag handle */
  user-select: none;
  -webkit-user-select: none;
  display: flex;
  align-items: center;
  padding: 8px;
  margin-left: 12px;
}

.drag-handle img {
  width: 32px;
  height: 32px;
  filter: brightness(0); /* Make icon black */
  pointer-events: none;
}

.dark .drag-handle img {
  filter: brightness(0) invert(1); /* Make icon white in dark mode */
}

.drag-handle:hover {
  opacity: 0.7;
}

@media (max-width: 768px) {
  .sortable-list .item {
    flex-direction: column;
    align-items: flex-start; /* Left align everything */
    padding: 10px;
  }

  .item .details {
    margin-bottom: 10px;
    align-self: flex-start; /* Force left alignment */
  }

  .item .details img {
    margin-right: 12px;
    margin-bottom: 8px;
  }

  .actions-wrapper {
    width: 100%;
    justify-content: space-between; /* Push buttons left, drag handle right */
    margin-top: 10px;
    flex-wrap: nowrap; /* Never wrap */
  }

  .col {
    flex-direction: row;
    gap: 6px; /* Reduce gap to fit more on one line */
    justify-content: flex-start;
    min-width: auto;
    flex-wrap: nowrap; /* Never wrap the buttons */
    flex-shrink: 1; /* Allow buttons to shrink if needed */
  }

  .button {
    padding: 6px;
    min-width: 32px; /* Ensure buttons don't get too small */
    flex-shrink: 0; /* Don't let individual buttons shrink */
  }

  .drag-handle {
    margin-left: 8px; /* Reduce margin to save space */
    padding: 6px; /* Reduce padding to save space */
    flex-shrink: 0; /* Never shrink the drag handle */
  }

  .drag-handle img {
    width: 32px; /* Keep large on mobile for easy touch */
    height: 32px;
  }
}

@media (max-width: 480px) {
  .item .details {
    flex-direction: row; /* Keep horizontal on small screens */
    align-items: center;
  }

  .item .details img {
    margin-bottom: 0; /* Remove bottom margin */
    margin-right: 12px; /* Keep right margin */
  }

  .actions-wrapper {
    justify-content: space-between; /* Keep buttons left, drag handle right */
  }

  .col {
    gap: 3px; /* Minimal gap for very small screens */
    flex-wrap: nowrap; /* Never wrap */
  }

  .button {
    padding: 4px; /* Smaller padding on very small screens */
    min-width: 28px; /* Slightly smaller minimum on tiny screens */
  }

  .button img {
    width: 16px; /* Slightly smaller icons on very small screens */
    height: 16px;
  }

  .drag-handle {
    margin-left: 4px; /* Minimal margin */
    padding: 4px;
  }

  .drag-handle img {
    width: 28px; /* Slightly smaller on very small screens but still usable */
    height: 28px;
  }
}
</style>
