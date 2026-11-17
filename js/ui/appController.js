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
    if (u.role === 'ADMIN') {
      document.getElementById('navAdmin').classList.remove('hidden');
    }
  }

  // Navegación
  const navDashboard = document.getElementById('navDashboard');
  const navScanner = document.getElementById('navScanner');
  const navHistory = document.getElementById('navHistory');
  const navAdmin = document.getElementById('navAdmin');
  
  const panelDashboard = document.getElementById('panelDashboard');
  const panelScanner = document.getElementById('panelScanner');
  const panelHistory = document.getElementById('panelHistory');
  const panelAdmin = document.getElementById('panelAdmin');

  function switchTab(activeNav, activePanel) {
    [navDashboard, navScanner, navHistory, navAdmin].forEach(nav => { if(nav) nav.classList.remove('active'); });
    [panelDashboard, panelScanner, panelHistory, panelAdmin].forEach(panel => { if(panel) panel.classList.add('hidden'); });
    
    activeNav.classList.add('active');
    activePanel.classList.remove('hidden');
  }

  navDashboard.addEventListener('click', () => { switchTab(navDashboard, panelDashboard); loadDashboard(); });
  navScanner.addEventListener('click', () => switchTab(navScanner, panelScanner));
  navHistory.addEventListener('click', () => { switchTab(navHistory, panelHistory); loadHistory(); });
  if (navAdmin) {
    navAdmin.addEventListener('click', () => { switchTab(navAdmin, panelAdmin); loadAdminData(); });
  }

  html5QrCode = new Html5Qrcode("reader");
  document.getElementById('btnStartCamera').addEventListener('click', startCamera);
  document.getElementById('inputCantidad').addEventListener('input', calculateTotal);
  document.getElementById('btnCancelScan').addEventListener('click', closeBottomSheet);
  document.getElementById('btnSave').addEventListener('click', saveLevante);
  
  // NUEVO: Evento para compartir reporte
  document.getElementById('btnShareReport').addEventListener('click', shareReport);

  // BOTONES DE SUMA RÁPIDA
  document.getElementById('btnAddUnit').addEventListener('click', () => {
    const input = document.getElementById('inputCantidad');
    const cantActual = parseFloat(input.value) || 0;
    input.value = cantActual + 1;
    calculateTotal();
  });

  document.getElementById('btnAddBox').addEventListener('click', () => {
    const stdCase = currentProduct ? (currentProduct.stdCaseQty || 0) : 0;
    if (stdCase > 0) {
      const input = document.getElementById('inputCantidad');
      const cantActual = parseFloat(input.value) || 0;
      input.value = cantActual + stdCase; 
      calculateTotal();
    }
  });

  loadDashboard();
});

// ================= LÓGICA DEL DASHBOARD =================
async function loadDashboard() {
  const dashList = document.getElementById('dashboardList');
  dashList.innerHTML = '<p class="empty-msg">Cargando resumen...</p>';

  try {
    const data = await apiService.getSobrantes();
    
    let totalSoles = 0;
    let totalUnidades = 0;
    let totalLevantes = data.length;

    data.forEach(item => {
      totalSoles += parseFloat(item.total) || 0;
      totalUnidades += parseFloat(item.cantidad) || 0;
    });

    document.getElementById('kpiTotalSoles').innerText = `S/ ${totalSoles.toFixed(2)}`;
    document.getElementById('kpiTotalUnidades').innerText = totalUnidades;
    document.getElementById('kpiTotalLevantes').innerText = totalLevantes;

    dashList.innerHTML = '';
    if (data.length === 0) {
      dashList.innerHTML = '<p class="empty-msg">Aún no hay productos registrados.</p>';
      return;
    }

    data.forEach(item => {
      const totalNum = parseFloat(item.total) || 0;
      const cantNum = parseFloat(item.cantidad) || 0;

      dashList.innerHTML += `
        <div class="list-card" style="border-left: 4px solid var(--neon-cyan);">
          <div class="list-card-header">
            <strong>${item.descripcion}</strong>
            <span class="price">S/ ${totalNum.toFixed(2)}</span>
          </div>
          <div class="list-card-body">
            <span><i class="fa-solid fa-barcode"></i> Cód: ${item.codigo}</span>
            <span>Cant: <b>${cantNum}</b></span>
          </div>
        </div>
      `;
    });
  } catch (error) {
    dashList.innerHTML = '<p class="empty-msg" style="color:var(--danger)">Error al cargar el resumen.</p>';
  }
}

// ================= COMPARTIR POR WHATSAPP =================
async function shareReport() {
  const btn = document.getElementById('btnShareReport');
  const dashboard = document.getElementById('dashboardContent');
  
  const originalText = btn.innerHTML;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Generando imagen...';
  btn.disabled = true;

  try {
    // Tomamos la "foto" del dashboard
    const canvas = await html2canvas(dashboard, { 
      scale: 2, // Mayor resolución
      backgroundColor: getComputedStyle(document.body).getPropertyValue('--bg-main') // Respeta el modo oscuro/claro
    });

    // Convertimos el canvas a un archivo de imagen
    canvas.toBlob(async (blob) => {
      const file = new File([blob], 'Reporte_Donaciones.png', { type: 'image/png' });

      // Verificamos si el celular soporta compartir archivos (Web Share API)
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({
            files: [file],
            title: 'Reporte de Donaciones',
            text: 'Aquí tienes el resumen de las donaciones registradas.'
          });
        } catch (error) {
          if (error.name !== 'AbortError') {
            console.error('Error al compartir:', error);
          }
        }
      } else {
        // Si no lo soporta (ej. en PC), se descarga la imagen automáticamente
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'Reporte_Donaciones.png';
        link.click();
        alert("✅ Imagen descargada. Si estás en PC, ábrela y envíala manualmente por WhatsApp.");
      }
    }, 'image/png');

  } catch (error) {
    console.error("Error al generar reporte:", error);
    alert("❌ Error al generar la imagen.");
  } finally {
    btn.innerHTML = originalText;
    btn.disabled = false;
  }
}

// ================= LÓGICA DEL ESCÁNER =================
async function startCamera() {
  document.getElementById('btnStartCamera').style.display = 'none';
  document.getElementById('scanLine').style.display = 'block';
  
  try {
    await html5QrCode.start({ facingMode: "environment" }, { fps: 15 }, onScanSuccess);
  } catch (err) {
    alert("Error al abrir la cámara. Recuerda que debes usar HTTPS.");
    document.getElementById('btnStartCamera').style.display = 'flex';
    document.getElementById('scanLine').style.display = 'none';
  }
}

async function onScanSuccess(decodedText) {
  html5QrCode.pause();
  if (navigator.vibrate) navigator.vibrate(200);
  
  document.getElementById('scanLine').style.display = 'none';

  document.getElementById('prodDesc').innerText = "Buscando producto...";
  document.getElementById('productSheet').classList.add('show');
  
  const res = await apiService.getProduct(decodedText);

  if (res.success) {
    currentProduct = res.producto;
    currentCosto = res.producto.costo;
    
    const nombreMostrar = currentProduct.descripcion ? currentProduct.descripcion : "Producto sin nombre";
    
    document.getElementById('prodCode').innerText = decodedText;
    document.getElementById('prodDesc').innerText = nombreMostrar;
    document.getElementById('prodCost').innerText = `S/ ${currentCosto.toFixed(2)}`;
    
    const stdCase = currentProduct.stdCaseQty || 0;
    const btnAddBox = document.getElementById('btnAddBox');
    
    if (stdCase > 0) {
      document.getElementById('prodStdCase').innerText = stdCase;
      btnAddBox.style.display = 'flex'; 
    } else {
      btnAddBox.style.display = 'none'; 
    }

    document.getElementById('inputCantidad').value = 1;
    calculateTotal();
  } else {
    alert("❌ Producto NO encontrado en la base de datos.");
    closeBottomSheet();
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
    descripcion: currentProduct.descripcion || "Sin nombre", 
    cantidad: cant, 
    costoUnitario: currentCosto, 
    total: cant * currentCosto 
  };
  
  const success = await apiService.saveSobrante(data);

  if (success) {
    alert("✅ Levante guardado correctamente.");
    closeBottomSheet();
    loadDashboard(); 
  } else {
    alert("❌ Error al guardar.");
    btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Guardar';
  }
}

function closeBottomSheet() {
  currentProduct = null; 
  currentCosto = 0;
  
  document.getElementById('productSheet').classList.remove('show');
  document.getElementById('btnStartCamera').style.display = 'flex';
  document.getElementById('btnSave').disabled = false;
  document.getElementById('btnSave').innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Guardar';
  
  document.getElementById('prodDesc').innerText = 'Nombre del Producto';
  document.getElementById('prodCode').innerText = '000000';
  document.getElementById('prodCost').innerText = 'S/ 0.00';
  document.getElementById('inputCantidad').value = '1';
  document.getElementById('totalCost').innerText = '0.00';
  
  if (html5QrCode) html5QrCode.resume();
}

// ================= LÓGICA DEL HISTORIAL =================
async function loadHistory() {
  const list = document.getElementById('historyList');
  list.innerHTML = '<p class="empty-msg">Cargando historial...</p>';
  
  try {
    const data = await apiService.getSobrantes();
    
    list.innerHTML = '';
    if (!data || data.length === 0) {
      list.innerHTML = '<p class="empty-msg">Aún no hay sobrantes registrados.</p>';
      return;
    }

    data.forEach(item => {
      let fechaStr = item.fecha;
      try { if(fechaStr && fechaStr !== "Sin fecha") fechaStr = new Date(fechaStr).toLocaleString('es-PE'); } catch(e) {}
      
      const totalNum = parseFloat(item.total) || 0;
      const cantNum = parseFloat(item.cantidad) || 0;

      list.innerHTML += `
        <div class="list-card">
          <div class="list-card-header">
            <strong>${item.descripcion}</strong>
            <span class="price">S/ ${totalNum.toFixed(2)}</span>
          </div>
          <div class="list-card-body">
            <span><i class="fa-solid fa-barcode"></i> ${item.codigo}</span>
            <span>Cant: <b>${cantNum}</b></span>
          </div>
          <div class="list-card-footer">
            <span><i class="fa-solid fa-user"></i> ${item.usuario}</span>
            <span>${fechaStr}</span>
          </div>
        </div>
      `;
    });
  } catch (error) {
    list.innerHTML = '<p class="empty-msg" style="color:var(--danger)">Error al cargar el historial.</p>';
  }
}

// ================= LÓGICA DEL ADMIN =================
async function loadAdminData() {
  const reqList = document.getElementById('requestsList');
  reqList.innerHTML = '<p class="empty-msg">Cargando...</p>';
  const requests = await apiService.getRequests();
  
  reqList.innerHTML = '';
  if (requests.length === 0) {
    reqList.innerHTML = '<p class="empty-msg">No hay solicitudes pendientes.</p>';
  } else {
    requests.forEach(req => {
      reqList.innerHTML += `
        <div class="list-card" style="display:flex; justify-content:space-between; align-items:center;">
          <div>
            <strong style="display:block; font-size:0.9rem;">${req.nombre}</strong>
            <span style="font-size:0.8rem; color:var(--text-gray);">${req.email}</span>
          </div>
          <button class="btn btn-success" style="padding:8px 12px; font-size:0.8rem;" onclick="approveUser('${req.email}', '${req.nombre}')">Aprobar</button>
        </div>
      `;
    });
  }

  const userList = document.getElementById('usersList');
  userList.innerHTML = '<p class="empty-msg">Cargando...</p>';
  const users = await apiService.getUsers();
  
  userList.innerHTML = '';
  if (users.length === 0) {
    userList.innerHTML = '<p class="empty-msg">No hay usuarios registrados.</p>';
  } else {
    users.forEach(u => {
      const isBlocked = u.estado === 'BLOQUEADO';
      const badgeColor = isBlocked ? 'var(--danger)' : 'var(--neon-green)';
      const btnText = isBlocked ? 'Desbloquear' : 'Bloquear';
      
      userList.innerHTML += `
        <div class="list-card" style="display:flex; justify-content:space-between; align-items:center;">
          <div>
            <strong style="display:block; font-size:0.9rem;">${u.nombre} <span style="font-size:0.65rem; background:var(--bg-hover); padding:2px 4px; border-radius:4px;">${u.rol}</span></strong>
            <span style="font-size:0.8rem; color:var(--text-gray);">${u.email}</span>
            <span style="color: ${badgeColor}; font-weight: bold; font-size: 0.75rem;">● ${u.estado}</span>
          </div>
          <button class="btn btn-cancel" style="padding:8px 12px; font-size:0.8rem;" onclick="toggleUser('${u.email}', '${isBlocked ? 'ACTIVO' : 'BLOQUEADO'}')">${btnText}</button>
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