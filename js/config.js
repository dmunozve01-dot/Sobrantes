const APP_CONFIG = {
  GOOGLE_CLIENT_ID: "",
  DIRECT_API_URL: "",
  async getApiUrl() {
    if (this.DIRECT_API_URL && this.DIRECT_API_URL.includes("http")) {
      return this.DIRECT_API_URL;
    }
    return null;
  }
};
