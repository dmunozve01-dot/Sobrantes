// js/data/storeRepository.js

class StoreRepository {
  constructor() {
    this.currentProduct = null;
    this.currentQuantity = 1;
  }

  setProduct(product) {
    this.currentProduct = product;
    this.currentQuantity = 1;
  }

  setQuantity(qty) {
    this.currentQuantity = parseFloat(qty) || 0;
  }

  getTotal() {
    if (!this.currentProduct) return 0;
    return this.currentQuantity * this.currentProduct.costo;
  }

  getCurrentData() {
    return {
      codigo: this.currentProduct.codigoEscaneado,
      descripcion: this.currentProduct.descripcion,
      cantidad: this.currentQuantity,
      costoUnitario: this.currentProduct.costo,
      total: this.getTotal()
    };
  }

  clear() {
    this.currentProduct = null;
    this.currentQuantity = 1;
  }
}

const storeRepository = new StoreRepository();