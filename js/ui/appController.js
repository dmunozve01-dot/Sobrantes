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

    if (activePanel !== panelScanner && isCameraRunning) {
      apagarCamara();
    }
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

  // EVENTOS DE EXCEL
  const btnDownload = document.getElementById('btnDownloadTemplate');
  if (btnDownload) btnDownload.addEventListener('click', descargarPlantillaActivos);

  const inputExcel = document.getElementById('excelActivosInput');
  if (inputExcel) inputExcel.addEventListener('change', handleExcelActivosUpload);

  loadDashboard();
});

// ================= CÁMARA =================
async function apagarCamara() {
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
  }
}

async function toggleCamera() {
  const btn = document.getElementById('btnCameraToggle');
  const scanLine = document.getElementById('scanLine');

  if (isCameraRunning) {
    await apagarCamara();
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

function mostrarProductoEnSheet(producto, codigoEscaneado) {
  currentProduct = producto;
  currentCosto = producto.costo;
  document.getElementById('prodCode').innerText = codigoEscaneado;
  document.getElementById('prodDesc').innerText = currentProduct.descripcion || "Producto sin nombre";
  document.getElementById('prodCost').innerText = `S/ ${currentCosto.toFixed(2)}`;
  
  const stdCase = currentProduct.stdCaseQty || 0;
  const btnAddBox = document.getElementById('btnAddBox');
  if (stdCase > 0) { document.getElementById('prodStdCase').innerText = stdCase; btnAddBox.style.display = 'flex'; } 
  else { btnAddBox.style.display = 'none'; }

  document.getElementById('inputCantidad').value = 0;
  calculateTotal();
  document.getElementById('productSheet').classList.add('show');
}

// ================= BÚSQUEDA MANUAL =================
let searchTimeout;
window.tempDropdownProducts = {}; 

window.limpiarBuscador = function() {
  const input = document.getElementById('inputManualCode');
  const dropdown = document.getElementById('manualSearchDropdown');
  const resultDiv = document.getElementById('manualSearchResult');
  const btnClear = document.getElementById('btnClearSearch');
  
  input.value = '';
  dropdown.style.display = 'none';
  resultDiv.innerText = '';
  btnClear.style.display = 'none';
  input.focus();

  window.ultimoCodigoEscaneado = ""; 
  if (isCameraRunning && html5QrCode) {
    try { html5QrCode.resume(); } catch(e) {}
    document.getElementById('scanLine').style.display = 'block';
  }
};

function buscarCodigoManual(texto) {
  const resultDiv = document.getElementById('manualSearchResult');
  const dropdown = document.getElementById('manualSearchDropdown');
  const btnClear = document.getElementById('btnClearSearch');
  const cleanCode = texto.trim();

  if (cleanCode.length > 0) btnClear.style.display = 'block';
  else btnClear.style.display = 'none';

  if (cleanCode.length < 2) {
    resultDiv.innerText = "";
    dropdown.style.display = 'none';
    return;
  }
  
  resultDiv.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Buscando...';
  dropdown.style.display = 'none';
  clearTimeout(searchTimeout);
  
  searchTimeout = setTimeout(async () => {
    const res = await apiService.getProduct(cleanCode);
    
    if (res.success && res.productos && res.productos.length > 0) {
      resultDiv.innerText = '';
      window.tempDropdownProducts = {};
      let htmlLista = '';
      
      res.productos.forEach((prod, index) => {
        const idTemp = 'prod_' + index;
        window.tempDropdownProducts[idTemp] = prod;
        
        htmlLista += `
          <li style="padding: 12px 15px; border-bottom: 1px solid #334155; cursor: pointer; display: flex; flex-direction: column; gap: 4px;" 
              onclick="seleccionarProductoDropdown('${idTemp}', '${prod.codigo}')">
            <strong style="color: var(--neon-cyan); font-size: 1rem;">${prod.codigo}</strong>
            <span style="color: #cbd5e1; font-size: 0.85rem;">${prod.descripcion}</span>
          </li>
        `;
      });
      
      dropdown.innerHTML = htmlLista;
      dropdown.style.display = 'block'; 
    } else {
      resultDiv.innerHTML = '❌ Producto no encontrado';
      dropdown.style.display = 'none';
    }
  }, 300);
}

window.seleccionarProductoDropdown = function(idTemp, codigoReal) {
   const dropdown = document.getElementById('manualSearchDropdown');
   const input = document.getElementById('inputManualCode');
   const prodSeleccionado = window.tempDropdownProducts[idTemp];
   
   dropdown.style.display = 'none';
   input.value = codigoReal; 
   
   if (prodSeleccionado) {
     mostrarProductoEnSheet(prodSeleccionado, codigoReal); 
   }
};

// ================= ESCANEO CON CÁMARA =================
async function onScanSuccess(decodedText, decodedResult) {
  if (decodedText === window.ultimoCodigoEscaneado) return;
  window.ultimoCodigoEscaneado = decodedText;

  if (isCameraRunning) { 
    html5QrCode.pause(); 
    document.getElementById('scanLine').style.display = 'none'; 
  }

  if (navigator.vibrate) navigator.vibrate(100);

  const res = await apiService.getProduct(decodedText);
  
  if (res.success && res.productos && res.productos.length > 0) {
    const productoEscaneado = res.productos[0]; 
    mostrarProductoEnSheet(productoEscaneado, decodedText);
  } else {
    try { await navigator.clipboard.writeText(decodedText); } catch(e) {}
    alert(`❌ Producto NO encontrado.\n\nEl código [ ${decodedText} ] ha sido copiado.`);
    
    const manualInput = document.getElementById('inputManualCode');
    if (manualInput) {
      manualInput.value = decodedText; 
      buscarCodigoManual(decodedText);
    }
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
    codigo: currentProduct.codigo || currentProduct.codigoEncontrado, 
    descripcion: currentProduct.descripcion || "Sin nombre", 
    cantidad: cant, 
    costoUnitario: currentCosto, 
    total: cant * currentCosto,
    stdCaseQty: currentProduct.stdCaseQty || 0,
    motivo: "Ingreso por escáner"
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
  
  limpiarBuscador(); 
}

// ================= DASHBOARD =================
async function loadDashboard() {
  const dashList = document.getElementById('dashboardList');
  dashList.innerHTML = '<tr><td colspan="6" class="empty-msg">Cargando resumen...</td></tr>';

  try {
    const data = await apiService.getSobrantes();
    const pendientes = data.filter(item => item.estado !== 'LEVANTADO');

    const agrupados = {};
    let totalSoles = 0;
    let totalBultos = 0;
    let totalSaldos = 0;

    pendientes.forEach(item => {
      const cant = parseFloat(item.cantidad) || 0;
      const tot = parseFloat(item.total) || 0;
      
      if (!agrupados[item.codigo]) {
        agrupados[item.codigo] = {
          codigo: item.codigo,
          descripcion: item.descripcion,
          stdCaseQty: parseFloat(item.stdCaseQty) || 0,
          cantidad: 0,
          total: 0,
          fechas: []
        };
      }
      agrupados[item.codigo].cantidad += cant;
      agrupados[item.codigo].total += tot;
      agrupados[item.codigo].fechas.push(item.fecha);
    });

    const itemsMostrar = Object.values(agrupados).filter(item => item.cantidad > 0);

    itemsMostrar.forEach(item => {
      totalSoles += item.total;
      let bultos = 0;
      let saldos = item.cantidad;

      if (item.stdCaseQty > 0) {
        bultos = Math.trunc(item.cantidad / item.stdCaseQty);
        saldos = item.cantidad % item.stdCaseQty;
      }
      
      totalBultos += bultos;
      totalSaldos += saldos;
    });

    document.getElementById('kpiTotalSoles').innerText = `S/ ${totalSoles.toFixed(2)}`;
    document.getElementById('kpiTotalBultos').innerText = totalBultos;
    document.getElementById('kpiTotalSaldos').innerText = totalSaldos;

    dashList.innerHTML = '';
    if (itemsMostrar.length === 0) {
      dashList.innerHTML = '<tr><td colspan="6" class="empty-msg">No hay productos pendientes.</td></tr>';
      return;
    }

    itemsMostrar.forEach(item => {
      let bultos = 0;
      let saldos = item.cantidad;

      if (item.stdCaseQty > 0) {
        bultos = Math.trunc(item.cantidad / item.stdCaseQty);
        saldos = item.cantidad % item.stdCaseQty;
      }

      const costoUnit = item.cantidad !== 0 ? (item.total / item.cantidad) : 0;
      const fechasCodificadas = encodeURIComponent(JSON.stringify(item.fechas));
      const descStr = item.descripcion.replace(/'/g, "\'");
      
      dashList.innerHTML += `
        <tr>
          <td style="color: var(--neon-cyan); font-weight: bold;">${item.codigo}</td>
          <td>${item.descripcion}</td>
          <td style="text-align: center; font-weight: bold; color: #a855f7;">${bultos}</td>
          <td style="text-align: center; font-weight: bold; color: var(--neon-green);">${saldos}</td>
          <td style="text-align: right; color: var(--neon-green); font-weight: bold;">S/ ${item.total.toFixed(2)}</td>
          <td style="text-align: center; display: flex; justify-content: center; gap: 5px;">
            <button class="btn btn-danger" style="padding: 4px 8px; font-size: 0.8rem;" onclick="mostrarModalDescuento('${item.codigo}', '${descStr}', ${costoUnit}, ${item.stdCaseQty})" title="Descontar cantidad">
              <i class="fa-solid fa-minus"></i>
            </button>
            <button class="btn btn-success" style="padding: 4px 8px; font-size: 0.8rem;" onclick="completarLevanteMultiple('${fechasCodificadas}')" title="Marcar como Levantado">
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

async function completarLevanteMultiple(fechasCodificadas) {
  if (!confirm("¿Marcar este producto como LEVANTADO? Desaparecerá del dashboard.")) return;
  
  const fechas = JSON.parse(decodeURIComponent(fechasCodificadas));
  let hasError = false;

  for (const fecha of fechas) {
    const success = await apiService.updateSobranteStatus(fecha, 'LEVANTADO');
    if (!success) hasError = true;
  }

  if (hasError) {
    alert("⚠️ Hubo un problema al actualizar algunos registros.");
  } else {
    alert("✅ Producto marcado como levantado.");
  }
  loadDashboard();
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

// ================= MODAL DE DESCUENTO =================
function mostrarModalDescuento(codigo, descripcion, costoUnitario, stdCaseQty) {
  const modal = document.createElement('div');
  modal.id = 'modalDescuentoPersonalizado';
  modal.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.8); display:flex; justify-content:center; align-items:center; z-index:9999; padding:20px; box-sizing:border-box;';

  modal.innerHTML = `
    <div style="background:#1a1a2e; padding:25px; border-radius:12px; width:100%; max-width:350px; color:#fff; border: 1px solid var(--danger, #ef4444); box-shadow: 0 10px 25px rgba(0,0,0,0.5);">
      <h3 style="margin-top:0; color:var(--danger, #ef4444); font-size:1.2rem; display:flex; align-items:center; gap:8px;">
        <i class="fa-solid fa-triangle-exclamation"></i> Registrar Descuento
      </h3>
      <p style="font-size:0.9rem; margin-bottom:20px; color:#cbd5e1; line-height:1.4;">${descripcion}</p>
      
      <label style="display:block; margin-bottom:8px; font-weight:bold; font-size:0.9rem;">Cantidad a descontar:</label>
      <input type="number" id="descCantidad" min="1" value="1" style="width:100%; padding:10px; margin-bottom:15px; border-radius:6px; border:1px solid #475569; background:#0f172a; color:#fff; font-size:1rem; box-sizing:border-box;">
      
      <label style="display:block; margin-bottom:8px; font-weight:bold; font-size:0.9rem;">Motivo del movimiento:</label>
      <select id="descMotivo" style="width:100%; padding:10px; margin-bottom:25px; border-radius:6px; border:1px solid #475569; background:#0f172a; color:#fff; font-size:1rem; box-sizing:border-box;">
        <option value="Error operativo / Mal escaneo">Error operativo / Mal escaneo</option>
        <option value="Regularización de inventario">Regularización de inventario</option>
        <option value="Producto dañado / Merma">Producto dañado / Merma</option>
        <option value="Consumo interno">Consumo interno</option>
        <option value="Ajuste administrativo">Ajuste administrativo</option>
      </select>

      <div style="display:flex; justify-content:space-between; gap:10px;">
        <button id="btnCancelDesc" class="btn" style="flex:1; background:#475569; color:white; padding:10px; border-radius:6px;">Cancelar</button>
        <button id="btnConfirmDesc" class="btn btn-danger" style="flex:1; padding:10px; border-radius:6px; font-weight:bold;">Confirmar</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  document.getElementById('btnCancelDesc').addEventListener('click', () => document.body.removeChild(modal));

  document.getElementById('btnConfirmDesc').addEventListener('click', async () => {
    const cant = parseFloat(document.getElementById('descCantidad').value);
    const motivo = document.getElementById('descMotivo').value;

    if (isNaN(cant) || cant <= 0) return alert("Ingresa una cantidad válida.");

    const btnConf = document.getElementById('btnConfirmDesc');
    btnConf.disabled = true;
    btnConf.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';

    const data = {
      usuario: currentUser,
      codigo: codigo,
      descripcion: descripcion,
      cantidad: -cant,
      costoUnitario: costoUnitario,
      total: -cant * costoUnitario,
      stdCaseQty: parseFloat(stdCaseQty) || 0,
      motivo: motivo
    };

    const success = await apiService.saveSobrante(data);
    if (success) {
      alert("✅ Descuento registrado.");
      document.body.removeChild(modal);
      loadDashboard(); 
    } else {
      alert("❌ Error al registrar.");
      btnConf.disabled = false;
      btnConf.innerHTML = 'Confirmar';
    }
  });
}

// ================= HISTORIAL =================
async function loadHistory() {
  const list = document.getElementById('historyList');
  list.innerHTML = '<p class="empty-msg">Cargando historial...</p>';
  
  try {
    const data = await apiService.getSobrantes();
    list.innerHTML = '';
    if (!data || data.length === 0) {
      list.innerHTML = '<p class="empty-msg">Aún no hay movimientos registrados.</p>';
      return;
    }

    data.forEach(item => {
      let fechaStr = item.fecha;
      try { if(fechaStr && fechaStr !== "Sin fecha") fechaStr = new Date(fechaStr).toLocaleString('es-PE'); } catch(e) {}
      
      const totalNum = parseFloat(item.total) || 0;
      const cantNum = parseFloat(item.cantidad) || 0;
      const isLevantado = item.estado === 'LEVANTADO';
      const isDiscount = cantNum < 0;
      
      let tipoMovimientoHtml = isDiscount 
        ? `<span style="color: var(--danger, #ef4444); font-weight: bold;"><i class="fa-solid fa-arrow-trend-down"></i> Salida de inventario</span>`
        : `<span style="color: var(--neon-green, #10b981); font-weight: bold;"><i class="fa-solid fa-arrow-trend-up"></i> Ingreso de inventario</span>`;

      const motivoTexto = item.motivo ? item.motivo : (isDiscount ? "Descuento general" : "Levante por escáner");
      const badgeEstado = isLevantado 
        ? `<span style="background: var(--neon-green); color: #000; padding: 2px 6px; border-radius: 4px; font-weight: bold; font-size: 0.7rem;">LEVANTADO</span>` 
        : `<span style="background: ${isDiscount ? 'var(--danger)' : 'var(--neon-cyan)'}; color: ${isDiscount ? '#fff' : '#000'}; padding: 2px 6px; border-radius: 4px; font-weight: bold; font-size: 0.7rem;">${isDiscount ? 'DESCONTADO' : 'PENDIENTE'}</span>`;

      list.innerHTML += `
        <div class="list-card" style="opacity: ${isLevantado ? '0.6' : '1'}; border-left: 4px solid ${isDiscount ? 'var(--danger)' : 'var(--neon-green)'};">
          <div class="list-card-header">
            <strong>${item.descripcion}</strong>
            <span class="price" style="color: ${isDiscount ? 'var(--danger)' : 'var(--neon-green)'};">S/ ${totalNum.toFixed(2)}</span>
          </div>
          <div class="list-card-body" style="margin-bottom: 8px;">
            <span><i class="fa-solid fa-barcode"></i> ${item.codigo}</span>
            <span>Cant: <b style="color: ${isDiscount ? 'var(--danger)' : 'inherit'}; font-size: 1.1rem;">${cantNum}</b></span>
          </div>
          <div style="background: rgba(255,255,255,0.05); padding: 8px; border-radius: 6px; font-size: 0.85rem; margin-bottom: 8px;">
            <div style="margin-bottom: 4px;">${tipoMovimientoHtml}</div>
            <div style="color: #cbd5e1;"><i class="fa-regular fa-comment-dots"></i> <strong>Motivo:</strong> ${motivoTexto}</div>
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
        try { await navigator.share({ files: [file], title: 'Reporte', text: 'Resumen de donaciones.' }); } 
        catch (error) { if (error.name !== 'AbortError') console.error('Error:', error); }
      } else {
        const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = 'Reporte.png'; link.click();
        alert("✅ Imagen descargada.");
      }
    }, 'image/png');
  } catch (error) { alert("❌ Error al generar la imagen."); } 
  finally { btn.innerHTML = originalText; btn.disabled = false; }
}

// ================= ADMIN Y EXCEL =================
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
            <button class="btn btn-cancel" style="padding:6px 10px; font-size:0.75rem;" onclick="approveUser('${req.email}', '${req.nombre}', 'USER')">USER</button>
            <button class="btn btn-primary" style="padding:6px 10px; font-size:0.75rem;" onclick="approveUser('${req.email}', '${req.nombre}', 'ADMIN')">ADMIN</button>
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
  if (success) { alert(`✅ Usuario aprobado como ${rol}.`); loadAdminData(); } 
  else { alert("❌ Error al aprobar."); }
}

async function toggleUser(email, nuevoEstado) {
  const success = await apiService.updateUserStatus(email, nuevoEstado);
  if (success) { loadAdminData(); }
}

// ================= DESCARGAR Y SUBIR EXCEL =================
function descargarPlantillaActivos() {
  const datosPlantilla = [
    { "SKU": "130745", "Descripcion Material": "NESTLE BESOS DE MOZA CLASICO CJ 9X24G", "Local": "1263", "Estado Local": "Activo" },
    { "SKU": "10000205033367", "Descripcion Material": "NUBE PH BLACK 40 MT PQ 4UN", "Local": "1263", "Estado Local": "Activo" }
  ];

  const worksheet = XLSX.utils.json_to_sheet(datosPlantilla);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Activos");
  XLSX.writeFile(workbook, "Plantilla_Activos.xlsx");
}

async function handleExcelActivosUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  const statusDiv = document.getElementById('uploadStatus');
  statusDiv.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Leyendo archivo (esto puede tardar si son muchas filas)...';
  statusDiv.style.color = 'var(--text-gray)';

  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      if (jsonData.length === 0) throw new Error("El archivo está vacío.");

      const datosFiltrados = jsonData.map(row => ({
        sku: row['SKU'] || row['Sku'] || row['sku'],
        descripcion: row['Descripcion Material'] || row['Descripción Material'] || '',
        local: row['Local'] || row['local'],
        estado: row['Estado Local'] || row['Descripción Estado Local'] || row['Descripcion Estado Local'] || ''
      })).filter(row => row.sku && row.local && String(row.estado).trim().toLowerCase() === 'activo');

      if (datosFiltrados.length === 0) throw new Error("No se encontraron filas con Estado Local 'Activo'.");

      statusDiv.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Enviando ${datosFiltrados.length} productos a Google Sheets...`;
      
      const res = await apiService.subirActivos(datosFiltrados);
      
      if (res.success) {
        statusDiv.innerHTML = `✅ ${res.message}`;
        statusDiv.style.color = 'var(--neon-green)';
      } else {
        throw new Error(res.message);
      }

    } catch (err) {
      console.error(err);
      statusDiv.innerHTML = `❌ Error: ${err.message}`;
      statusDiv.style.color = 'var(--danger)';
    } finally {
      event.target.value = ''; 
    }
  };
  reader.readAsArrayBuffer(file);
}