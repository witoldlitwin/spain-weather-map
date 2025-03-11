<script setup lang="ts">
import WeatherMap from './components/WeatherMap.vue'
</script>

<template>
  <div class="app-container">
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
</style>