import { initializeApp } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-analytics.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";
// AGGIUNTO: importati doc e deleteDoc per eliminare i dati
import { getFirestore, collection, getDocs, addDoc, doc, deleteDoc,getDocsFromServer } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAIbW5KtpoRMaUAcYdso5L-tu2K6J_lHTk",
  authDomain: "corosualidaquilaturate.firebaseapp.com",
  projectId: "corosualidaquilaturate",
  storageBucket: "corosualidaquilaturate.firebasestorage.app",
  messagingSenderId: "188396592285",
  appId: "1:188396592285:web:71b9ddbe64436ad4660874",
  measurementId: "G-CTK08FV774"
};

// Inizializzazione
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();
const db = getFirestore(app);

const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzJULlRyUPM8saP4SGfHwAiPPGoHL_XfFcvQKVNV5xqR_1rGhjpvkDW9PxbIhRuqNNn/exec";
const adminEmail = "c.sualidaquila@gmail.com"; 

// AGGIUNTO: Stato globale dell'amministratore per controllare la visualizzazione dei cestini
let isAdmin = false;

// Login
const googleLoginBtn = document.getElementById('googleLoginBtn');
if (googleLoginBtn) {
  googleLoginBtn.addEventListener('click', () => {
    signInWithPopup(auth, provider)
      .then(() => console.log("Login completato!"))
      .catch(error => alert('Errore login: ' + error.message));
  });
}

// Logout
const logoutBtn = document.getElementById('logoutBtn');
if (logoutBtn) {
  logoutBtn.addEventListener('click', () => {
    signOut(auth).then(() => {
      console.log("Utente disconnesso.");
    });
  });
}
// CARICAMENTO IMMEDIATO: Leggiamo l'archivio per chiunque apra la pagina!
buildArchivioFromFirestore();

// Listener dello stato utente
onAuthStateChanged(auth, user => {
  const loginBtn = document.getElementById('googleLoginBtn');
  const userProfile = document.getElementById('userProfile');
  const userAvatar = document.getElementById('userAvatar');
  const userName = document.getElementById('userName');
  const caricaCantiBtn = document.getElementById('caricaCantiBtn');

  if(user) {
    if (user.email === adminEmail) {
        isAdmin = true; 
        loginBtn.style.display = 'none';
        userProfile.style.display = 'flex';
        userName.textContent = user.displayName;
        userAvatar.src = user.photoURL || 'images/default-avatar.png';
        
        if (caricaCantiBtn) {
        caricaCantiBtn.style.display = 'inline-block';
        setupModal();
        }
    }else{
        alert("⚠️ Accesso negato: l'utente non è autorizzato ad accedere!");
    }
  } else {
    isAdmin = false; 
    loginBtn.style.display = 'block';
    userProfile.style.display = 'none';
    if (caricaCantiBtn) caricaCantiBtn.style.display = 'none';
   
    const existingModal = document.getElementById('uploadModal');
    if (existingModal) existingModal.style.display = 'none';
  }

  // Ricarichiamo l'archivio per mostrare o nascondere i tasti di cancellazione
  buildArchivioFromFirestore();
});


/* ============================================================
   FUNZIONI DI LETTURA E RENDERING DA FIRESTORE
   ============================================================ */

async function buildArchivioFromFirestore() {
  try {

    const querySnapshot = await getDocsFromServer(collection(db, "canti"));

    const files = [];

    querySnapshot.forEach((doc) => {
      const data = doc.data();
      files.push({
        id: doc.id, // AGGIUNTO: Salviamo l'id del documento Firestore per l'eliminazione
        nome: formatTitle(data.nome || ''),
        link: data.link || '',
        tipo: data.tipo || '',
        categoria: data.categoria || '',
        lettera: formatTitle(data.nome || '')[0]?.toUpperCase() || '#'
      });
    });

    files.sort((a, b) => a.nome.localeCompare(b.nome, 'it'));

    const sezioni = [
      ['grid-t-natale', 'testo',    'natale', false],
      ['grid-t-pasqua', 'testo',    'pasqua', false],
      ['grid-t-matrimoni', 'testo',    'matrimoni', false],
      ['grid-t-funerali', 'testo',    'funerali', false],
      ['t-altri',       'testo',    'altro',  true ],
      ['grid-s-natale', 'spartito', 'natale', false],
      ['grid-s-pasqua', 'spartito', 'pasqua', false],
      ['grid-s-matrimoni', 'spartito',    'matrimoni', false],
      ['grid-s-funerali', 'spartito',    'funerali', false],
      ['s-altri',       'spartito', 'altro',  true ],
    ];

    sezioni.forEach(([id, tipo, categoria, isAZ]) => {
      const subset = files.filter(f => f.tipo === tipo && f.categoria === categoria);
      if (isAZ) {
        renderAlphaGrid(subset, id);
      } else {
        renderFlatGrid(subset, id);
      }
    });

  } catch (err) {
    console.error('Errore durante il caricamento da Firestore:', err);
  }
}

function formatTitle(raw) {
  const name = raw.replace(/\.pdf$/i, '').trim();
  return name.length > 0 ? name[0].toUpperCase() + name.slice(1).toLowerCase() : name;
}

// AGGIUNTO: Funzione helper per estrarre l'ID del file di Google Drive dal link salvato
function toDriveDownload(link) {
    const match = link.match(/\/d\/([a-zA-Z0-9_-]+)/) || link.match(/[?&]id=([^&#]+)/);
    // Aggiungiamo un timestamp &t= per ingannare la cache del browser
    return match ? `https://drive.google.com/uc?export=download&id=${match[1]}&t=${new Date().getTime()}` : link;
  }
  

function makeCard(f, isSparto) {
  const a = document.createElement('a');
  a.className = 'file-card';
  a.href      = toDriveDownload(f.link);
  a.download  = '';
  a.innerHTML = `
    <div class="file-icon ${isSparto ? 'mus' : 'pdf'}">
      <i class="fas ${isSparto ? 'fa-music' : 'fa-file-pdf'}"></i>
    </div>
    <div class="file-info">
      <div class="file-name">${f.nome}</div>
      <div class="file-meta">${isSparto ? 'PDF · Spartito' : 'PDF'}</div>
    </div>
    <i class="fas fa-download file-dl"></i>`;

  // AGGIUNTO: Se l'utente è amministratore, iniettiamo l'icona del cestino dentro la card
  if (isAdmin) {
    const deleteBtn = document.createElement('span');
    deleteBtn.innerHTML = '<i class="fas fa-trash-alt"></i>';
    deleteBtn.className = 'delete-file-btn';
    deleteBtn.style.cssText = `
      color: #dc3545; margin-left: 15px; cursor: pointer; font-size: 16px;
      padding: 5px; display: inline-flex; align-items: center; justify-content: center;
      transition: color 0.2s; z-index: 5;
    `;
    deleteBtn.title = "Elimina definitivamente questo canto";

    // Evitiamo che cliccando il cestino si attivi il download del PDF (preventDefault / stopPropagation)
    deleteBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      cancellaCanto(f.id, f.link, f.nome);
    });

    a.appendChild(deleteBtn);
  }

  return a;
}

// AGGIUNTO: Logica di cancellazione combinata (Drive + Firestore)
async function cancellaCanto(firestoreId, driveLink, nomeCanto) {
  const conferma = confirm(`⚠️ Sei sicuro di voler eliminare permanentemente "${nomeCanto}"? Questa azione non è reversibile.`);
  if (!conferma) return;

  try {
    const driveFileId = extractDriveFileId(driveLink);
    
    // Elimina da Cloud Firestore
    await deleteDoc(doc(db, "canti", firestoreId));
    console.log("Canto rimosso correttamente da Firestore.");

    alert(`🎉 "Il file ${nomeCanto}" è stato eliminato con successo.`);
    
    //  Ricarica l'interfaccia
    buildArchivioFromFirestore();

  } catch (error) {
    console.error("Errore durante la cancellazione:", error);
    alert("Si è verificato un errore durante l'eliminazione: " + error.message);
  }
}

function renderFlatGrid(files, gridId) {
  const grid = document.getElementById(gridId);
  if (!grid) return;
  
  const isSparto = gridId.startsWith('grid-s-');
  grid.innerHTML = '';
  
  if (files.length === 0) {
    grid.innerHTML = '<p style="padding: 10px; color: gray;">Nessun canto presente in questa categoria.</p>';
    return;
  }
  files.forEach(f => grid.appendChild(makeCard(f, isSparto)));
}

function renderAlphaGrid(files, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const isSparto = containerId.startsWith('s-');
  const hint     = container.querySelector('.upload-hint');
  container.innerHTML = '';
  if (hint) container.appendChild(hint);

  if (files.length === 0) {
    const noSongs = document.createElement('p');
    noSongs.style.cssText = "padding: 10px; color: gray;";
    noSongs.textContent = "Nessun canto presente.";
    container.appendChild(noSongs);
    return;
  }

  const groups = {};
  files.forEach(f => {
    groups[f.lettera] = groups[f.lettera] || [];
    groups[f.lettera].push(f);
  });

  Object.keys(groups).sort().forEach(letter => {
    const group = document.createElement('div');
    group.className = 'alpha-group';

    const letterEl = document.createElement('div');
    letterEl.className = 'alpha-letter';
    letterEl.textContent = letter;
    group.appendChild(letterEl);

    const grid = document.createElement('div');
    grid.className = 'file-grid';
    groups[letter].forEach(f => grid.appendChild(makeCard(f, isSparto)));

    group.appendChild(grid);
    container.appendChild(group);
  });
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const base64String = reader.result.split(',')[1];
      resolve(base64String);
    };
    reader.onerror = error => reject(error);
  });
}

// Chiamiamo la funzione all'avvio della pagina quando il DOM è pronto
document.addEventListener('DOMContentLoaded', () => {
    setupModal();
  });

function setupModal() {
    const modal = document.getElementById('uploadModal');
    const backdrop = document.getElementById('modalBackdrop'); // 🌟 Selettore del velo
    
    if (!modal) {
    console.warn("⚠️ Modale 'uploadModal' non trovata nell'HTML.");
    return;
    }

    const btnCarica = document.getElementById('caricaCantiBtn');
    if (btnCarica) {
    btnCarica.onclick = () => {
        modal.style.display = 'block';
        if (backdrop) backdrop.style.display = 'block'; // 🌟 Mostra lo sfondo oscurato
    };
    }

    // Chiusura al clic della X
    const chiudiBtn = document.getElementById('ChiudiBtn');
    if (chiudiBtn) {
    chiudiBtn.onclick = () => {
        modal.style.display = 'none';
        if (backdrop) backdrop.style.display = 'none'; // 🌟 Nasconde lo sfondo oscurato
    };
    }

    // 🌟 BONUS: Chiude la modale se l'utente clicca fuori (sullo sfondo oscurato)
    if (backdrop) {
    backdrop.onclick = () => {
        modal.style.display = 'none';
        backdrop.style.display = 'none';
    };
    }

    const inviaBtn = document.getElementById('InviaBtn');
    const loadingOverlay = document.getElementById('loadingOverlay');

    if (inviaBtn) {
    inviaBtn.onclick = async () => {
        const nomeInput = document.getElementById('Nome');
        const nome = nomeInput.value.trim();
        const tipo = document.getElementById('Tipo').value;
        const categoria = document.getElementById('Categoria').value;
        const fileInput = document.getElementById('File');
        const statusDiv = document.getElementById('testStatus');

        if (!nome || !fileInput.files.length) {
        alert("⚠️ Per favore, inserisci il nome del canto e seleziona un file!");
        return;
        }

        const file = fileInput.files[0];

        if (loadingOverlay) loadingOverlay.style.display = 'flex';
        
        statusDiv.textContent = "⏳ Conversione del file PDF in corso...";
        statusDiv.style.color = "#007bff";

        try {
        const base64 = await fileToBase64(file);
        statusDiv.textContent = "🚀 Caricamento su Google Drive in corso...";

        const response = await fetch(GOOGLE_SCRIPT_URL, {
            method: 'POST',
            headers: {
            'Content-Type': 'text/plain;charset=utf-8'
            },
            body: JSON.stringify({
            file: base64,
            mimeType: file.type || "application/pdf",
            fileName: file.name
            })
        });

        const result = await response.json();
        if (!result.success) {
            throw new Error(result.error || "Errore durante il caricamento.");
        }

        statusDiv.textContent = "💾 Salvataggio in Firestore...";
        
        await addDoc(collection(db, "canti"), {
            nome: nome,
            link: result.link,
            tipo: tipo,
            categoria: categoria
        });

        statusDiv.textContent = "✅ Completato!";
        statusDiv.style.color = "#28a745";

        nomeInput.value = "";
        fileInput.value = "";

        buildArchivioFromFirestore();

        setTimeout(() => {
            modal.style.display = 'none';
            statusDiv.textContent = "";
            
            // 🌟 Nascondiamo sia il velo che l'overlay di caricamento
            if (backdrop) backdrop.style.display = 'none';
            if (loadingOverlay) loadingOverlay.style.display = 'none';
        }, 2000);

        } catch (error) {
        console.error(error);
        statusDiv.textContent = "❌ Errore: " + error.message;
        statusDiv.style.color = "#dc3545";
        
        if (loadingOverlay) {
            setTimeout(() => {
            loadingOverlay.style.display = 'none';
            // Lasciamo visibile il backdrop e la modale così l'utente può riprovare o correggere il form
            }, 1500);
        }
        }
    };
    }
}

