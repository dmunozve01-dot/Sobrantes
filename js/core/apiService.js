class APIService {
  async getBaseUrl() { return await APP_CONFIG.getApiUrl(); }

  async getUserRole(email) { 
    const url = await this.getBaseUrl(); if (!url) return { error: "NO_AUTORIZADO" };
    try {
      const res = await fetch(`${url}?action=getUserRole&email=${encodeURIComponent(email)}&t=${new Date().getTime()}`);
      return await res.json();
    } catch (err) { return { error: "NO_AUTORIZADO" }; }
  }

  async solicitarAcceso(email, nombre) {
    const url = await this.getBaseUrl(); if (!url) return { success: false, message: "Falta URL" };
    try {
      const res = await fetch(`${url}?action=solicitarAcceso&email=${encodeURIComponent(email)}&nombre=${encodeURIComponent(nombre)}&t=${new Date().getTime()}`);
      return await res.json();
    } catch (err) { return { success: false, message: "Error de conexión." }; }
  }

  async getProduct(code) {
    const url = await this.getBaseUrl(); if (!url) return { success: false };
    try {
      const res = await fetch(`${url}?action=getProduct&code=${encodeURIComponent(code)}`);
      return await res.json();
    } catch (err) { return { success: false }; }
  }

  async saveSobrante(data) {
    const url = await this.getBaseUrl(); if (!url) return false;
    try {
      await fetch(url, { method: "POST", mode: "no-cors", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "saveSobrante", data }) });
      return true;
    } catch (err) { return false; }
  }

  async updateSobranteStatus(fecha, estado) {
    const url = await this.getBaseUrl(); if (!url) return false;
    try {
      await fetch(url, { method: "POST", mode: "no-cors", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "updateSobranteStatus", fecha, estado }) });
      return true;
    } catch (err) { return false; }
  }

  async updateAllSobrantesStatus(estado) {
    const url = await this.getBaseUrl(); if (!url) return false;
    try {
      await fetch(url, { method: "POST", mode: "no-cors", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "updateAllSobrantesStatus", estado }) });
      return true;
    } catch (err) { return false; }
  }

  async getSobrantes() {
    const url = await this.getBaseUrl(); if (!url) return [];
    try {
      const res = await fetch(`${url}?action=getSobrantes&t=${new Date().getTime()}`);
      const json = await res.json();
      return json.success ? json.data : [];
    } catch (err) { return []; }
  }

  async getRequests() {
    const url = await this.getBaseUrl(); if (!url) return [];
    try {
      const res = await fetch(`${url}?action=getRequests`);
      const json = await res.json();
      return json.success ? json.data : [];
    } catch (err) { return []; }
  }

  async getUsers() {
    const url = await this.getBaseUrl(); if (!url) return [];
    try {
      const res = await fetch(`${url}?action=getUsers`);
      const json = await res.json();
      return json.success ? json.data : [];
    } catch (err) { return []; }
  }

  async approveUser(user) {
    const url = await this.getBaseUrl(); if (!url) return false;
    try {
      await fetch(url, { method: "POST", mode: "no-cors", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "approveUser", user }) });
      return true;
    } catch (err) { return false; }
  }

  async updateUserStatus(email, estado) {
    const url = await this.getBaseUrl(); if (!url) return false;
    try {
      await fetch(url, { method: "POST", mode: "no-cors", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "updateUserStatus", email, estado }) });
      return true;
    } catch (err) { return false; }
  }

  async subirActivos(arrayDatos) {
    const url = await this.getBaseUrl(); if (!url) return { success: false, message: "Falta URL" };
    try {
      await fetch(url, { 
        method: "POST", 
        mode: "no-cors", 
        headers: { "Content-Type": "application/json" }, 
        body: JSON.stringify({ action: "subirActivos", arrayDatos: arrayDatos }) 
      });
      return { success: true, message: "¡Carga exitosa! Revisa tu Google Sheets." };
    } catch (err) { return { success: false, message: "Error de conexión." }; }
  }

  async validarEstadoActivo(sku) {
    const url = await this.getBaseUrl(); if (!url) return { activo: false };
    try {
      const res = await fetch(`${url}?action=verificarEstadoActivo&sku=${encodeURIComponent(sku)}&t=${new Date().getTime()}`);
      return await res.json();
    } catch (err) { return { activo: false }; }
  }
}
const apiService = new APIService();