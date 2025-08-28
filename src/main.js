import { createApp } from "vue";
import App from "./App.vue";

// Create app with global size configuration
const app = createApp(App);
app.config.globalProperties.$ELEMENT = {
  size: "small",
  zIndex: 2000,
};

app.mount("#app");
