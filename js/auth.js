window.handleCredentialResponse = function(response) {
  const payload = parseJwt(response.credential);
  if(payload && payload.email) {
    saveUserSession({ name: payload.name, email: payload.email, picture: payload.picture });
  }
};

async function saveUserSession(userData) {
  const remember = document.getElementById('rememberMe')?.checked || false;
  
  if (typeof apiService !== 'undefined') {
    try {
      const res = await apiService.getUserRole(userData.email);
      
      if (res.error === "TU_CUENTA_ESTA_BLOQUEADA") {
        alert("🚫 Tu cuenta está BLOQUEADA. Contacta a soporte.");
        return; 
      }
      
      if (res.error === "NO_AUTORIZADO" || !res.role) {
        alert("⛔ Acceso Denegado.\n\nTu correo (" + userData.email + ") no está registrado. Solicita acceso.");
        return; 
      }
      userData.role = res.role;
      if (res.name && res.name !== 'Desconocido') userData.name = res.name;
      
    } catch (err) {
      alert("Error de conexión con el servidor.");
      return;
    }
  } else {
    alert("Error interno.");
    return;
  }

  if (remember) localStorage.setItem('sw_user', JSON.stringify(userData));
  else sessionStorage.setItem('sw_user', JSON.stringify(userData));

  window.location.replace('app.html');
}

function checkSessionAndLoadUI() {
  try {
    const userStr = sessionStorage.getItem('sw_user') || localStorage.getItem('sw_user');
    if (!userStr) { window.location.replace('index.html'); return; }
    
    const user = JSON.parse(userStr);

    const nameEl = document.getElementById('userName');
    const emailEl = document.getElementById('userEmail');
    const avatarEl = document.getElementById('userAvatar');

    if (nameEl) nameEl.innerText = user.name || 'Usuario';
    if (emailEl) emailEl.innerText = user.email || 'Sin correo';
    
    if (avatarEl && user.picture) {
      avatarEl.src = user.picture;
    }

    const btnLogout = document.getElementById('btnLogout');
    if (btnLogout) {
      btnLogout.onclick = () => {
        sessionStorage.removeItem('sw_user');
        localStorage.removeItem('sw_user');
        if (typeof google !== 'undefined' && google.accounts) google.accounts.id.disableAutoSelect();
        window.location.replace('index.html'); 
      };
    }
  } catch (e) {
    sessionStorage.removeItem('sw_user');
    localStorage.removeItem('sw_user');
    window.location.replace('index.html');
  }
}

function parseJwt(token) {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(decodeURIComponent(window.atob(base64).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join('')));
  } catch (e) { return {}; }
}