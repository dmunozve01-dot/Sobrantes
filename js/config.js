const APP_CONFIG = {
  GOOGLE_CLIENT_ID: "606508682227-5khnp8kcefa8n17pmepvfcftddce8of6.apps.googleusercontent.com",
  DIRECT_API_URL: "https://script.google.com/macros/s/AKfycbxhBRQGrM6DVgPm-4SciZYjXryt8BuiLX7flrpvvu2-Iq_Bb8gEe8zxglWs91Gd8C-Tyg/exec",
  async getApiUrl() {
    if (this.DIRECT_API_URL && this.DIRECT_API_URL.includes("http")) {
      return this.DIRECT_API_URL;
    }
    return null;
  }
};
