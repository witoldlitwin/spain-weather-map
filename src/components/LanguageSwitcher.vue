<script setup lang="ts">
import { ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

const { locale } = useI18n();
const selectedLanguage = ref(locale.value);

// Language options with flag emojis
const languageOptions = [
  { value: 'en', name: '🇬🇧 English' },
  { value: 'pl', name: '🇵🇱 Polski' }
];

watch(selectedLanguage, (newLanguage) => {
  locale.value = newLanguage;
  // Save the language preference to localStorage
  localStorage.setItem('userLanguage', newLanguage);
});
</script>

<template>
  <div class="select-container">
    <label for="language">{{ $t('language.select') }}</label>
    <select v-model="selectedLanguage" id="language">
      <option 
        v-for="option in languageOptions" 
        :key="option.value" 
        :value="option.value"
      >
        {{ option.name }}
      </option>
    </select>
  </div>
</template>

<style scoped>
.select-container {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.select-container label {
  font-weight: 500;
  font-family: 'Lato', sans-serif;
  white-space: nowrap;
}

select {
  padding: 0.5rem;
  border: 1px solid #ccc;
  border-radius: 4px;
  font-family: 'Lato', sans-serif;
  font-size: 1rem;
  min-width: 120px;
}

/* Responsive styles for mobile */
@media (max-width: 640px) {
  .select-container {
    width: 100%;
    justify-content: space-between;
  }
  
  select {
    flex: 1;
    max-width: calc(100% - 100px); /* Give space for the label */
  }
}
</style> 