<script setup lang="ts">
import WeatherMap from './components/WeatherMap.vue'
import LanguageSwitcher from './components/LanguageSwitcher.vue'
</script>

<template>
  <div class="app-container">
    <div class="language-container">
      <LanguageSwitcher />
    </div>
    <WeatherMap />
  </div>
</template>

<style>
body {
  margin: 0;
  padding: 0;
}

.app-container {
  position: relative;
  width: 100%;
  height: 100vh;
}

.language-container {
  position: absolute;
  top: 1rem;
  right: 1rem;
  z-index: 1001;
  background: white;
  padding: 0.5rem;
  border-radius: 4px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}
</style>