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
  box-sizing: border-box; /* Include padding and border in the width calculation */
}

/* Responsive styles for mobile */
@media (max-width: 640px) {
  .select-container {
    width: 100%;
    display: flex;
    justify-content: space-between;
  }
  
  .select-container label {
    min-width: 70px; /* Fixed width for labels on mobile */
    width: 70px;
    text-align: right; /* Right-align labels */
    margin-right: 10px; /* Add some space between label and input */
  }
  
  select {
    flex: 1;
    width: calc(100% - 80px); /* Consistent width for all inputs */
  }
}
</style> 