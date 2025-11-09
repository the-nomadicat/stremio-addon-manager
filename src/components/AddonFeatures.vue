<template>
  <div v-if="features.length > 0" id="features" class="features">
    <span v-for="feature in features" :key="feature.name" class="feature-badge" :title="feature.description">
      {{ feature.icon }}<template v-if="showText"> {{ feature.name }}</template>
    </span>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  manifest: {
    type: Object,
    required: true
  },
  showText: {
    type: Boolean,
    default: true
  }
})

// Detect features based on manifest
const features = computed(() => {
  const manifest = props.manifest
  
  if (!manifest || !manifest.resources) {
    return []
  }
  
  // Check resources array for feature types
  const resources = Array.isArray(manifest.resources) 
    ? manifest.resources 
    : manifest.resources.map ? Object.values(manifest.resources) : []
  
  const resourceTypes = new Set()
  resources.forEach(resource => {
    if (typeof resource === 'string') {
      resourceTypes.add(resource.toLowerCase())
    } else if (resource && resource.name) {
      resourceTypes.add(resource.name.toLowerCase())
    }
  })
  
  const featureMap = {}
  
  // Check for Addon Installer support
  if (resourceTypes.has('addon_catalog') || (manifest.addonCatalogs && manifest.addonCatalogs.length > 0)) {
    featureMap['Addon Installer'] = {
      name: 'Addon Installer',
      icon: '🧩',
      description: 'Provide lists of addons for installing additional addons'
    }
  }
  
  // Check for Catalog support
  if (resourceTypes.has('catalog') || (manifest.catalogs && manifest.catalogs.length > 0)) {
    featureMap['Catalogs'] = {
      name: 'Catalogs',
      icon: '🎬',
      description: 'Provides content catalogs like "Best Movies", "Sci-Fi Shows", etc.'
    }
  }
  
  // Check for Meta support
  if (resourceTypes.has('meta')) {
    featureMap['Metadata'] = {
      name: 'Metadata',
      icon: 'ℹ️',
      description: 'Provides detailed information about content (ratings, cast, descriptions)'
    }
  }
  
  // Check for Search support (catalogs with search extra)
  const hasSearch = manifest.catalogs?.some(catalog => 
    catalog.extra?.some(extra => extra.name === 'search')
  )
  if (hasSearch) {
    featureMap['Search'] = {
      name: 'Search',
      icon: '🔍',
      description: 'Supports content search'
    }
  }
  
  // Check for Stream support
  if (resourceTypes.has('stream')) {
    featureMap['Streams'] = {
      name: 'Streams',
      icon: '▶️',
      description: 'Provides video streams'
    }
  }
  
  // Check for Subtitles support
  if (resourceTypes.has('subtitles')) {
    featureMap['Subtitles'] = {
      name: 'Subtitles',
      icon: '💬',
      description: 'Provides subtitles'
    }
  }
  
  // Sort alphabetically by feature name and return
  return Object.keys(featureMap)
    .sort()
    .map(key => featureMap[key])
})
</script>

<style scoped>
.features {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
}

.feature-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  background-color: #e8f4f8;
  border: 1px solid #b8d4e0;
  border-radius: 12px;
  font-size: 1.5rem;
  line-height: 1;
  color: #1a5a7a;
  white-space: nowrap;
  justify-content: center;
  min-width: 36px;
}

.dark .feature-badge {
  background-color: #1a3a4a;
  border: 1px solid #2d5468;
  color: #a8c8d8;
}
</style>
