<script setup lang="ts">
import { ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

const { locale } = useI18n();
const selectedLanguage = ref(locale.value);

watch(selectedLanguage, (newLanguage) => {
  locale.value = newLanguage;
  // Save the language preference to localStorage
  localStorage.setItem('userLanguage', newLanguage);
});
</script>

<template>
  <div class="language-switcher">
    <label for="language">{{ $t('language.select') }}</label>
    <select v-model="selectedLanguage" id="language">
      <option value="en">{{ $t('language.en') }}</option>
      <option value="pl">{{ $t('language.pl') }}</option>
    </select>
  </div>
</template>

<style scoped>
.language-switcher {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

label {
    font-weight: 500;
}

select {
  padding: 0.5rem;
  border: 1px solid #ccc;
  border-radius: 4px;
}
</style> 