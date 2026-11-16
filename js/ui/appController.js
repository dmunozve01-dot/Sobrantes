let html5QrCode;
let currentUser = null;
let currentProduct = null;
let currentCosto = 0;

document.addEventListener('DOMContentLoaded', () => {
  if (typeof checkSessionAndLoadUI === 'function') checkSessionAndLoadUI();

  const userStr = sessionStorage.getItem('sw_user') || localStorage.getItem('sw_user');
  if (userStr) {
    const u = JSON.parse(userStr);
    currentUser = u.name || "Operario";
    
    // Solo mostramos la pestaña Admin si el usuario es ADMIN
    if (u.role === 'ADMIN') {
      document.getElementById('tabAdmin').classList.remove('hidden');
    }
  }

  const tabScanner = document.getElementById('tabScanner');
  const tabAdmin = document.getElementById('tabAdmin');
  const panelScanner = document.getElementById('panelScanner');
  const panelAdmin = document.getElementById('panelAdmin');

  tabScanner.addEventListener('click', () => {
    tabScanner.className = 'btn btn-primary'; tabAdmin.className = 'btn btn-cancel hidden';
    panelScanner.classList.remove('hidden'); panelAdmin.classList.add('hidden');
  });

  tabAdmin.addEventListener('click', () => {
    tabAdmin.className = 'btn btn-primary'; tabScanner.className = 'btn btn-cancel';
    panelAdmin.classList.remove('hidden'); panelScanner.classList.add('hidden');
    loadAdminData();
  });

  html5QrCode = new Html5Qrcode("reader");
  document.getElementById('btnStartCamera').addEventListener('click', startCamera);
  document.getElementById('inputCantidad').addEventListener('input', calculateTotal);
  document.getElementById('btnCancelScan').addEventListener('click', resetApp);
  document.getElementById('btnSave').addEventListener('click', saveLevante);
});

async function startCamera() {
  document.getElementById('btnStartCamera').style.display = 'none';
  try {
    // MEJORA: Sin "qrbox", escanea toda la pantalla. Ideal para códigos de barras de productos.
    await html5QrCode.start(
      { facingMode: "environment" }, 
      { fps: 15 }, 
      onScanSuccess
    );
  } catch (err) {
    alert("Error al abrir la cámara. Recuerda que debes usar HTTPS (GitHub Pages).");
    document.getElementById('btnStartCamera').style.display = 'block';
  }
}

async function onScanSuccess(decodedText) {
  html5QrCode.pause();
  if (navigator.vibrate) navigator.vibrate(200); // Vibra el celular al escanear

  document.getElementById('productPanel').classList.remove('hidden');
  document.getElementById('prodDesc').innerText = "Buscando en Google Sheets...";
  
  const res = await apiService.getProduct(decodedText);

  if (res.success) {
    currentProduct = res.producto;
    currentCosto = res.producto.costo;
    
    document.getElementById('prodCode').innerText = decodedText;
    document.getElementById('prodDesc').innerText = currentProduct.descripcion;
    document.getElementById('prodCost').value = `$${currentCosto.toFixed(2)}`;
    
    // Ponemos la cantidad en 1 por defecto
    document.getElementById('inputCantidad').value = 1;
    calculateTotal();
  } else {
    alert("❌ Producto NO encontrado en la base de datos.");
    resetApp();
  }
}

function calculateTotal() {
  const cant = parseFloat(document.getElementById('inputCantidad').value) || 0;
  document.getElementById('totalCost').innerText = (cant * currentCosto).toFixed(2);
}

async function saveLevante() {
  if (!currentProduct) return;
  const cant = parseFloat(document.getElementById('inputCantidad').value) || 0;
  if (cant <= 0) return alert("Ingresa una cantidad válida.");

  const btn = document.getElementById('btnSave');
  btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Guardando...';

  const data = { 
    usuario: currentUser, 
    codigo: currentProduct.codigoEncontrado, 
    descripcion: currentProduct.descripcion, 
    cantidad: cant, 
    costoUnitario: currentCosto, 
    total: cant * currentCosto 
  };
  
  const success = await apiService.saveSobrante(data);

  if (success) {
    alert("✅ Levante guardado correctamente en Sobrantes.");
    resetApp();
  } else {
    alert("❌ Error al guardar. Revisa tu conexión.");
    btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Guardar';
  }
}

function resetApp() {
  currentProduct = null; currentCosto = 0;
  document.getElementById('productPanel').classList.add('hidden');
  document.getElementById('btnStartCamera').style.display = 'block';
  document.getElementById('btnSave').disabled = false;
  document.getElementById('btnSave').innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Guardar';
  if (html5QrCode) html5QrCode.resume(); // Vuelve a encender la cámara
}

// ================= LÓGICA DEL ADMIN =================
async function loadAdminData() {
  const reqList = document.getElementById('requestsList');
  reqList.innerHTML = '<p style="color: var(--text-gray);">Cargando...</p>';
  const requests = await apiService.getRequests();
  
  reqList.innerHTML = '';
  if (requests.length === 0) {
    reqList.innerHTML = '<p style="color: var(--text-gray);">No hay solicitudes pendientes.</p>';
  } else {
    requests.forEach(req => {
      reqList.innerHTML += `
        <div style="display: flex; justify-content: space-between; align-items: center; background: var(--bg-main); padding: 10px; border-radius: 8px; border: 1px solid var(--border-color);">
          <div>
            <strong style="display: block; font-size: 0.9rem;">${req.nombre}</strong>
            <span style="font-size: 0.8rem; color: var(--text-gray);">${req.email}</span>
          </div>
          <button class="btn btn-primary" style="padding: 6px 12px; font-size: 0.8rem;" onclick="approveUser('${req.email}', '${req.nombre}')">Aprobar</button>
        </div>
      `;
    });
  }

  const userList = document.getElementById('usersList');
  userList.innerHTML = '<p style="color: var(--text-gray);">Cargando...</p>';
  const users = await apiService.getUsers();
  
  userList.innerHTML = '';
  if (users.length === 0) {
    userList.innerHTML = '<p style="color: var(--text-gray);">No hay usuarios registrados.</p>';
  } else {
    users.forEach(u => {
      const isBlocked = u.estado === 'BLOQUEADO';
      const badgeColor = isBlocked ? 'var(--danger)' : 'var(--neon-green)';
      const btnText = isBlocked ? 'Desbloquear' : 'Bloquear';
      
      userList.innerHTML += `
        <div style="display: flex; justify-content: space-between; align-items: center; background: var(--bg-main); padding: 10px; border-radius: 8px; border: 1px solid var(--border-color); margin-bottom: 5px;">
          <div>
            <strong style="display: block; font-size: 0.9rem;">${u.nombre}</strong>
            <span style="font-size: 0.8rem; color: var(--text-gray);">${u.email}</span>
            <span style="font-size: 0.7rem; background: var(--bg-hover); padding: 2px 6px; border-radius: 4px; margin-left: 5px;">${u.rol}</span>
          </div>
          <div>
            <span style="color: ${badgeColor}; font-weight: bold; font-size: 0.8rem; margin-right: 10px;">${u.estado}</span>
            <button class="btn btn-cancel" style="padding: 6px 12px; font-size: 0.8rem;" onclick="toggleUser('${u.email}', '${isBlocked ? 'ACTIVO' : 'BLOQUEADO'}')">${btnText}</button>
          </div>
        </div>
      `;
    });
  }
}

async function approveUser(email, nombre) {
  const rol = confirm("¿Aprobar como ADMIN? (Aceptar = ADMIN, Cancelar = USER)");
  const success = await apiService.approveUser({ email, nombre, rol: rol ? 'ADMIN' : 'USER' });
  if (success) {
    alert("✅ Usuario aprobado.");
    loadAdminData();
  } else {
    alert("❌ Error.");
  }
}

async function toggleUser(email, nuevoEstado) {
  const success = await apiService.updateUserStatus(email, nuevoEstado);
  if (success) {
    loadAdminData();
  }
}