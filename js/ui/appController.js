let html5QrCode;
let currentUser = null;
let currentProduct = null;
let currentCosto = 0;
let isCameraRunning = false;

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
  document.getElementById('btnCameraToggle').addEventListener('click', toggleCamera);
  document.getElementById('inputCantidad').addEventListener('input', calculateTotal);
  document.getElementById('btnCancelScan').addEventListener('click', closeBottomSheet);
  
  document.getElementById('btnSave').addEventListener('click', () => saveLevante());
  
  document.getElementById('btnShareReport').addEventListener('click', shareReport);
  document.getElementById('btnCompleteAll').addEventListener('click', completarTodo);

  document.getElementById('btnAddUnit').addEventListener('click', () => {
    const input = document.getElementById('inputCantidad');
    input.value = (parseFloat(input.value) || 0) + 1;
    calculateTotal();
  });

  document.getElementById('btnAddBox').addEventListener('click', () => {
    const stdCase = currentProduct ? (currentProduct.stdCaseQty || 0) : 0;
    if (stdCase > 0) {
      const input = document.getElementById('inputCantidad');
      input.value = (parseFloat(input.value) || 0) + stdCase; 
      calculateTotal();
    }
  });

  loadDashboard();
});

// ================= CÁMARA =================
async function toggleCamera() {
  const btn = document.getElementById('btnCameraToggle');
  const scanLine = document.getElementById('scanLine');

  if (isCameraRunning) {
    try {
      await html5QrCode.stop();
      isCameraRunning = false;
      scanLine.style.display = 'none';
      btn.innerHTML = '<i class="fa-solid fa-camera"></i>';
      btn.style.background = 'var(--neon-cyan)';
    } catch (err) {}
  } else {
    try {
      await html5QrCode.start({ facingMode: "environment" }, { fps: 15 }, onScanSuccess);
      isCameraRunning = true;
      scanLine.style.display = 'block';
      btn.innerHTML = '<i class="fa-solid fa-video-slash"></i>';
      btn.style.background = 'var(--danger)';
    } catch (err) { alert("Error al abrir la cámara. Usa HTTPS."); }
  }
}

async function onScanSuccess(decodedText) {
  if (isCameraRunning) { html5QrCode.pause(); document.getElementById('scanLine').style.display = 'none'; }
  if (navigator.vibrate) navigator.vibrate(200);
  
  document.getElementById('prodDesc').innerText = "Buscando producto...";
  document.getElementById('productSheet').classList.add('show');
  
  const res = await apiService.getProduct(decodedText);

  if (res.success) {
    currentProduct = res.producto;
    currentCosto = res.producto.costo;
    document.getElementById('prodCode').innerText = decodedText;
    document.getElementById('prodDesc').innerText = currentProduct.descripcion || "Producto sin nombre";
    document.getElementById('prodCost').innerText = `S/ ${currentCosto.toFixed(2)}`;
    
    const stdCase = currentProduct.stdCaseQty || 0;
    const btnAddBox = document.getElementById('btnAddBox');
    if (stdCase > 0) { document.getElementById('prodStdCase').innerText = stdCase; btnAddBox.style.display = 'flex'; } 
    else { btnAddBox.style.display = 'none'; }

    document.getElementById('inputCantidad').value = 0;
    calculateTotal();
  } else {
    alert("❌ Producto NO encontrado.");
    closeBottomSheet();
  }
}

function calculateTotal() {
  const cant = parseFloat(document.getElementById('inputCantidad').value) || 0;
  document.getElementById('totalCost').innerText = (cant * currentCosto).toFixed(2);
}

async function saveLevante() {
  if (!currentProduct) return;
  let cant = parseFloat(document.getElementById('inputCantidad').value) || 0;
  if (cant <= 0) return alert("Ingresa una cantidad válida.");

  const btn = document.getElementById('btnSave');
  const originalHTML = btn.innerHTML;
  btn.disabled = true; 
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';

  const data = { 
    usuario: currentUser, 
    codigo: currentProduct.codigoEncontrado, 
    descripcion: currentProduct.descripcion || "Sin nombre", 
    cantidad: cant, 
    costoUnitario: currentCosto, 
    total: cant * currentCosto,
    stdCaseQty: currentProduct.stdCaseQty || 0
  };
  
  const success = await apiService.saveSobrante(data);

  if (success) {
    alert("✅ Levante guardado.");
    closeBottomSheet();
    loadDashboard(); 
  } else {
    alert("❌ Error al guardar.");
    btn.disabled = false; 
    btn.innerHTML = originalHTML;
  }
}

function closeBottomSheet() {
  currentProduct = null; currentCosto = 0;
  document.getElementById('productSheet').classList.remove('show');
  document.getElementById('btnSave').disabled = false;
  document.getElementById('btnSave').innerHTML = '<i class="fa-solid fa-plus"></i> Agregar';
  
  document.getElementById('prodDesc').innerText = 'Nombre del Producto';
  document.getElementById('prodCode').innerText = '000000';
  document.getElementById('prodCost').innerText = 'S/ 0.00';
  document.getElementById('inputCantidad').value = '0';
  document.getElementById('totalCost').innerText = '0.00';
  if (isCameraRunning && html5QrCode) { html5QrCode.resume(); document.getElementById('scanLine').style.display = 'block'; }
}

// ================= DASHBOARD =================
async function loadDashboard() {
  const dashList = document.getElementById('dashboardList');
  dashList.innerHTML = '<tr><td colspan="6" class="empty-msg">Cargando resumen...</td></tr>';

  try {
    const data = await apiService.getSobrantes();
    const pendientes = data.filter(item => item.estado !== 'LEVANTADO');

    let totalSoles = 0;
    let totalBultos = 0;
    let totalSaldos = 0;

    pendientes.forEach(item => {
      totalSoles += parseFloat(item.total) || 0;
      
      const cant = parseFloat(item.cantidad) || 0;
      const std = parseFloat(item.stdCaseQty) || 0;
      let bultos = 0;
      let saldos = cant;

      if (std > 0) {
        bultos = Math.trunc(cant / std);
        saldos = cant % std;
      }
      
      totalBultos += bultos;
      totalSaldos += saldos;
    });

    document.getElementById('kpiTotalSoles').innerText = `S/ ${totalSoles.toFixed(2)}`;
    document.getElementById('kpiTotalBultos').innerText = totalBultos;
    document.getElementById('kpiTotalSaldos').innerText = totalSaldos;

    dashList.innerHTML = '';
    if (pendientes.length === 0) {
      dashList.innerHTML = '<tr><td colspan="6" class="empty-msg">No hay productos pendientes.</td></tr>';
      return;
    }

    pendientes.forEach(item => {
      const totalNum = parseFloat(item.total) || 0;
      const cant = parseFloat(item.cantidad) || 0;
      const std = parseFloat(item.stdCaseQty) || 0;
      
      let bultos = 0;
      let saldos = cant;

      if (std > 0) {
        bultos = Math.trunc(cant / std);
        saldos = cant % std;
      }

      const costoUnit = cant !== 0 ? (totalNum / cant) : 0;
      const fechaStr = item.fecha.replace(/'/g, "\\'");
      const descStr = item.descripcion.replace(/'/g, "\\'");
      
      const colorBultos = bultos < 0 ? 'var(--danger)' : '#a855f7';
      const colorSaldos = saldos < 0 ? 'var(--danger)' : 'var(--neon-green)';

      dashList.innerHTML += `
        <tr>
          <td style="color: var(--neon-cyan); font-weight: bold;">${item.codigo}</td>
          <td>${item.descripcion}</td>
          <td style="text-align: center; font-weight: bold; color: ${colorBultos};">${bultos}</td>
          <td style="text-align: center; font-weight: bold; color: ${colorSaldos};">${saldos}</td>
          <td style="text-align: right; color: var(--neon-green); font-weight: bold;">S/ ${totalNum.toFixed(2)}</td>
          <td style="text-align: center; display: flex; justify-content: center; gap: 5px;">
            <button class="btn btn-danger" style="padding: 4px 8px; font-size: 0.8rem;" onclick="descontarDesdeDashboard('${item.codigo}', '${descStr}', ${costoUnit}, ${std})" title="Descontar cantidad">
              <i class="fa-solid fa-minus"></i>
            </button>
            <button class="btn btn-success" style="padding: 4px 8px; font-size: 0.8rem;" onclick="completarLevante('${fechaStr}')" title="Marcar como Levantado">
              <i class="fa-solid fa-check"></i>
            </button>
          </td>
        </tr>
      `;
    });
  } catch (error) {
    dashList.innerHTML = '<tr><td colspan="6" class="empty-msg" style="color:var(--danger)">Error al cargar el resumen.</td></tr>';
  }
}

async function completarLevante(fecha) {
  if (!confirm("¿Marcar este producto como LEVANTADO? Desaparecerá del dashboard.")) return;
  const success = await apiService.updateSobranteStatus(fecha, 'LEVANTADO');
  if (success) {
    alert("✅ Producto marcado como levantado.");
    loadDashboard();
  } else {
    alert("❌ Error al actualizar el estado.");
  }
}

async function completarTodo() {
  if (!confirm("⚠️ ¿Estás seguro de marcar TODOS los productos pendientes como LEVANTADOS?")) return;

  const btn = document.getElementById('btnCompleteAll');
  const originalText = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Procesando...';

  const success = await apiService.updateAllSobrantesStatus('LEVANTADO');
  if (success) {
    alert("✅ Todos los productos han sido marcados como Levantados.");
    loadDashboard();
  } else {
    alert("❌ Error al actualizar los productos.");
  }

  btn.disabled = false;
  btn.innerHTML = originalText;
}

// ================= COMPARTIR =================
async function shareReport() {
  const btn = document.getElementById('btnShareReport');
  const dashboard = document.getElementById('dashboardContent');
  
  const originalText = btn.innerHTML;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Generando...';
  btn.disabled = true;

  try {
    const canvas = await html2canvas(dashboard, { scale: 2, backgroundColor: getComputedStyle(document.body).getPropertyValue('--bg-main') });
    canvas.toBlob(async (blob) => {
      const file = new File([blob], 'Reporte_Donaciones.png', { type: 'image/png' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: 'Reporte de Donaciones', text: 'Aquí tienes el resumen.' });
        } catch (error) { if (error.name !== 'AbortError') console.error('Error al compartir:', error); }
      } else {
        const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = 'Reporte_Donaciones.png'; link.click();
        alert("✅ Imagen descargada.");
      }
    }, 'image/png');
  } catch (error) { alert("❌ Error al generar la imagen."); } 
  finally { btn.innerHTML = originalText; btn.disabled = false; }
}

// ================= HISTORIAL =================
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
      const isLevantado = item.estado === 'LEVANTADO';
      const isDiscount = cantNum < 0;
      
      const badgeEstado = isLevantado 
        ? `<span style="background: var(--neon-green); color: #000; padding: 2px 6px; border-radius: 4px; font-weight: bold; font-size: 0.7rem;">LEVANTADO</span>` 
        : `<span style="background: ${isDiscount ? 'var(--danger)' : 'var(--neon-cyan)'}; color: ${isDiscount ? '#fff' : '#000'}; padding: 2px 6px; border-radius: 4px; font-weight: bold; font-size: 0.7rem;">${isDiscount ? 'DESCUENTO' : 'PENDIENTE'}</span>`;

      list.innerHTML += `
        <div class="list-card" style="opacity: ${isLevantado ? '0.7' : '1'}; border-left: ${isDiscount ? '4px solid var(--danger)' : 'none'};">
          <div class="list-card-header">
            <strong>${item.descripcion}</strong>
            <span class="price" style="color: ${isDiscount ? 'var(--danger)' : 'var(--neon-green)'};">S/ ${totalNum.toFixed(2)}</span>
          </div>
          <div class="list-card-body">
            <span><i class="fa-solid fa-barcode"></i> ${item.codigo}</span>
            <span>Cant: <b style="color: ${isDiscount ? 'var(--danger)' : 'inherit'};">${cantNum}</b></span>
          </div>
          <div class="list-card-footer">
            <span>${badgeEstado}</span>
            <span>${fechaStr}</span>
          </div>
        </div>
      `;
    });
  } catch (error) {
    list.innerHTML = '<p class="empty-msg" style="color:var(--danger)">Error al cargar el historial.</p>';
  }
}

// ================= ADMIN =================
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
        <div class="list-card" style="display:flex; justify-content:space-between; align-items:center; flex-wrap: wrap; gap: 10px;">
          <div style="flex: 1; min-width: 150px;">
            <strong style="display:block; font-size:0.9rem;">${req.nombre}</strong>
            <span style="font-size:0.8rem; color:var(--text-gray);">${req.email}</span>
          </div>
          <div style="display: flex; gap: 5px;">
            <button class="btn btn-cancel" style="padding:6px 10px; font-size:0.75rem;" onclick="approveUser('${req.email}', '${req.nombre}', 'USER')" title="Aprobar como Operario">
              <i class="fa-solid fa-user"></i> USER
            </button>
            <button class="btn btn-primary" style="padding:6px 10px; font-size:0.75rem;" onclick="approveUser('${req.email}', '${req.nombre}', 'ADMIN')" title="Aprobar como Administrador">
              <i class="fa-solid fa-user-gear"></i> ADMIN
            </button>
          </div>
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
        <div class="list-card" style="display:flex; justify-content:space-between; align-items:center; flex-wrap: wrap; gap: 10px;">
          <div style="flex: 1; min-width: 150px;">
            <strong style="display:block; font-size:0.9rem;">${u.nombre} <span style="font-size:0.65rem; background:var(--bg-hover); padding:2px 4px; border-radius:4px;">${u.rol}</span></strong>
            <span style="font-size:0.8rem; color:var(--text-gray);">${u.email}</span>
            <div style="color: ${badgeColor}; font-weight: bold; font-size: 0.75rem; margin-top: 4px;">● ${u.estado}</div>
          </div>
          <button class="btn btn-cancel" style="padding:6px 10px; font-size:0.75rem;" onclick="toggleUser('${u.email}', '${isBlocked ? 'ACTIVO' : 'BLOQUEADO'}')">${btnText}</button>
        </div>
      `;
    });
  }
}

async function approveUser(email, nombre, rol) {
  const success = await apiService.approveUser({ email, nombre, rol: rol });
  if (success) {
    alert(`✅ Usuario aprobado como ${rol}.`);
    loadAdminData();
  } else {
    alert("❌ Error al aprobar.");
  }
}

async function toggleUser(email, nuevoEstado) {
  const success = await apiService.updateUserStatus(email, nuevoEstado);
  if (success) { loadAdminData(); }
}

async function descontarDesdeDashboard(codigo, descripcion, costoUnitario, stdCaseQty) {
  const input = prompt(`¿Cuántas unidades deseas descontar de:\n${descripcion}?`, "1");
  if (input === null) return; 
  
  const cantToDiscount = parseFloat(input);
  
  if (isNaN(cantToDiscount) || cantToDiscount <= 0) {
    return alert("Por favor, ingresa una cantidad válida mayor a 0.");
  }

  const data = {
    usuario: currentUser,
    codigo: codigo,
    descripcion: descripcion,
    cantidad: -cantToDiscount, 
    costoUnitario: costoUnitario,
    total: -cantToDiscount * costoUnitario,
    stdCaseQty: parseFloat(stdCaseQty) || 0
  };

  const success = await apiService.saveSobrante(data);
  if (success) {
    alert("✅ Descuento registrado correctamente en el historial.");
    loadDashboard(); 
  } else {
    alert("❌ Error al registrar el descuento.");
  }
}