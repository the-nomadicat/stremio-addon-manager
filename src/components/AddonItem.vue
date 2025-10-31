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
  
  const emits = defineEmits(['delete-addon', 'edit-manifest', 'show-toast'])
  
  const defaultLogo = 'https://icongr.am/feather/box.svg?size=48&color=ffffff'
  
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
    
    // Try to open in new tab
    const newWindow = window.open(configureURL, '_blank', 'noopener,noreferrer');
    
    // Check if popup was blocked (most mobile browsers block popups)
    if (!newWindow || newWindow.closed || typeof newWindow.closed === 'undefined') {
      // Popup blocked - copy URL to clipboard and notify user
      copyURLToClipboard(configureURL, 'Popup blocked. Configuration URL copied to clipboard. Please paste in browser.');
    }
  }
  
  async function copyURLToClipboard(url, message) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = url;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        
        try {
          document.execCommand('copy');
        } finally {
          document.body.removeChild(textArea);
        }
      }
      
      emits('show-toast', {
        message: message,
        duration: 5000, // Longer duration for important message
      });
    } catch (error) {
      console.error('Error copying URL to clipboard', error);
      emits('show-toast', {
        message: 'Could not copy URL. Please open manually: ' + url,
        duration: 10000,
      });
    }
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
    emits('edit-manifest', props.idx)
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
    <div class="col">
      <button class="button icon-only visit-url" title="Open addon configuration page in new window"
        :disabled="!isConfigurable" 
        @click="openAddonConfigurationPage" @mousedown.stop @touchstart.stop>
        <img src="https://icongr.am/feather/arrow-up-right.svg?size=12">
      </button>
      <button class="button icon-only copy-url" title="Copy addon manifest URL to clipboard"
        @click="copyManifestURLToClipboard" @mousedown.stop @touchstart.stop>
        <img src="https://icongr.am/feather/clipboard.svg?size=12">
      </button>
      <button class="button icon-only edit-manifest" title="Edit manifest JSON" 
        @click="openEditManifestModal" @mousedown.stop @touchstart.stop>
        <img src="https://icongr.am/feather/edit.svg?size=12">
      </button>
      <button class="button icon-only delete" title="Remove addon from list" 
        :disabled="!isDeletable"
        @click="removeAddon" @mousedown.stop @touchstart.stop>
        <img src="https://icongr.am/feather/trash-2.svg?size=12">
      </button>
    </div>
    <i class="uil uil-draggabledots drag-handle"></i>
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
  gap: 8px;
  flex-wrap: wrap;
  align-items: center;
  min-width: 200px;
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
.edit-manifest img {
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
.dark .edit-manifest img {
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
}

.drag-handle:hover {
  opacity: 0.7;
}

@media (max-width: 768px) {
  .sortable-list .item {
    flex-direction: column;
    align-items: center;
    padding: 10px;
  }

  .item .details {
    margin-bottom: 10px;
    text-align: center;
  }

  .item .details img {
    margin-right: 12px;
    margin-bottom: 8px;
  }

  .col {
    flex-direction: row;
    gap: 8px;
    justify-content: center;
    width: 100%;
    margin-top: 10px;
  }

  .button {
    padding: 6px;
  }

  .uil-draggabledots {
    position: absolute;
    right: 10px;
    bottom: 10px;
  }
}

@media (max-width: 480px) {
  .item .details {
    flex-direction: column;
    align-items: center;
    text-align: center;
  }

  .item .details img {
    margin-bottom: 6px;
  }

  .col {
    flex-direction: row;
    gap: 4px;
    justify-content: center;
    width: 100%;
  }

  .button {
    padding: 4px;
  }

  .uil-draggabledots {
    display: none;
  }
}
</style>
