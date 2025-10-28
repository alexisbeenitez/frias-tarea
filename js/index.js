/* — Variables globales — */
const guardarBtn = document.getElementById("guardarBtn");
const reiniciarBtn = document.getElementById("reiniciarBtn");
const mesa = document.getElementById("mesa");
const resultado = document.getElementById("resultado");
const buscaminaContainer = document.getElementById("buscaminaContainer");
const buscaminaGrid = document.getElementById("buscaminaTablero");
const tiempoSpan = document.getElementById("tiempo");
const minasRestantesSpan = document.getElementById("minasRestantes");

const miembrosSelect = document.getElementById("miembrosSelect");
const restr1 = document.getElementById("restr1");
const restr2 = document.getElementById("restr2");
const presidenteAsiento = document.getElementById("presidenteAsiento");
const jugadoresBuscamina = document.getElementById("jugadoresBuscamina");
const tipoMesaEl = document.getElementById("tipoMesa");
const modoEl = document.getElementById("modo");

let temporizador = null, segundos = 0;
let minasRestantes = 0;
let estadoGuardado = false;

/* --- Helpers --- */
function abreviar(nombre) {
  // genera abreviación tipo P / V1 / TE / VO (máx 3 chars)
  const words = nombre.trim().split(/\s+/);
  if (words.length === 1) return words[0].slice(0,3).toUpperCase();
  const ab = words.map(w => w[0]).join('').slice(0,3).toUpperCase();
  return ab;
}

function factorial(n) { return n <= 1 ? 1 : n * factorial(n-1); }

/* --- Actualizar selects dependientes --- */
function actualizarDependientes() {
  // Obtener seleccionados (asegurar que presidente esté presente)
  let seleccionados = Array.from(miembrosSelect.selectedOptions).map(o => o.text);
  if (!seleccionados.includes("Presidente")) {
    // autoagrego Presidente al inicio si no está
    seleccionados.unshift("Presidente");
    // también seleccionar visualmente
    for (const opt of miembrosSelect.options) {
      if (opt.text === "Presidente") { opt.selected = true; break; }
    }
  }

  // Actualizar restr1/restr2 sin incluir Presidente
  [restr1, restr2].forEach(sel => {
    // guardar valor actual si sigue disponible
    const cur = sel.value || "";
    sel.innerHTML = '<option value="">(ninguno)</option>';
    seleccionados.filter(n => n !== "Presidente").forEach(n => {
      const o = document.createElement("option");
      o.value = n; o.textContent = n;
      sel.appendChild(o);
    });
    // intentar restaurar
    if (cur) {
      const opt = Array.from(sel.options).find(x => x.value === cur);
      if (opt) opt.selected = true;
    }
  });

  // actualizar jugadoresBuscamina (multi) con todos los miembros
  const curPlayers = Array.from(jugadoresBuscamina.selectedOptions).map(o=>o.value);
  jugadoresBuscamina.innerHTML = '';
  seleccionados.forEach(n => {
    const o = document.createElement("option");
    o.value = n; o.textContent = n;
    jugadoresBuscamina.appendChild(o);
  });
  // restaurar selección previa si corresponde
  Array.from(jugadoresBuscamina.options).forEach(opt => {
    if (curPlayers.includes(opt.value)) opt.selected = true;
  });

  // actualizar selector de asiento del presidente (1..N)
  const seatCount = seleccionados.length;
  const prevSeat = presidenteAsiento.value;
  presidenteAsiento.innerHTML = '';
  for (let i=1;i<=seatCount;i++){
    const o = document.createElement("option");
    o.value = String(i);
    o.textContent = `Asiento ${i}`;
    presidenteAsiento.appendChild(o);
  }
  // restaurar asiento si aún valido, si no dejar 1
  if (prevSeat && Number(prevSeat)<=seatCount) presidenteAsiento.value = prevSeat;
  else presidenteAsiento.value = '1';
}

miembrosSelect.addEventListener('change', actualizarDependientes);
window.addEventListener('load', actualizarDependientes);

/* --- Render mesa: asientos alrededor de figura (círculo o perímetro de rectángulo) --- */
function renderMesa(tipo, miembros, asientoPresidenteIndex, r1Val, r2Val) {
  mesa.classList.toggle('cuadrada', tipo === 'cuadrada');
  mesa.innerHTML = '';
  const total = miembros.length;
  const centerX = 150, centerY = 150;
  const radius = 110;

  function posRound(i, total) {
    const ang = (2*Math.PI/total) * i - Math.PI/2; // empezar en top
    const x = centerX + radius * Math.cos(ang);
    const y = centerY + radius * Math.sin(ang);
    return [x,y];
  }

  function posSquare(i,total) {
    // distribuir sobre perímetro de un rectángulo interior
    const w = 240, h = 180; // rect dims
    const perim = 2*(w+h);
    const step = perim / total;
    let dist = i * step;
    // recorrer lado superior (left->right), derecha (top->bottom), inferior (right->left), izquierda (bottom->top)
    let x,y;
    if (dist <= w) { x = centerX - w/2 + dist; y = centerY - h/2; }
    else if (dist <= w + h) { dist -= w; x = centerX + w/2; y = centerY - h/2 + dist; }
    else if (dist <= w + h + w) { dist -= (w+h); x = centerX + w/2 - dist; y = centerY + h/2; }
    else { dist -= (w+h+w); x = centerX - w/2; y = centerY + h/2 - dist; }
    return [x,y];
  }

  for (let idx=0; idx<total; idx++){
    const persona = document.createElement('div');
    persona.className = 'persona';
    const nombre = miembros[idx];
    persona.dataset.nombre = nombre;

    // abreviación
    persona.textContent = abreviar(nombre);

    // marcar presidente (anfitrion) por índice elegido: asientoPresidenteIndex es 1..N
    if ((idx+1) === Number(asientoPresidenteIndex)) persona.classList.add('anfitrion');

    if (nombre === r1Val || nombre === r2Val) persona.classList.add('restringido');

    // posición alrededor de figura
    const [x,y] = tipo === 'redonda' ? posRound(idx, total) : posSquare(idx, total);
    persona.style.left = `${x}px`;
    persona.style.top = `${y}px`;

    mesa.appendChild(persona);
  }
}

/* --- Permutaciones y conteo --- */
function permutar(arr) {
  if (arr.length === 0) return [[]];
  const res = [];
  for (let i=0;i<arr.length;i++){
    const rest = [...arr.slice(0,i), ...arr.slice(i+1)];
    for (const p of permutar(rest)) res.push([arr[i], ...p]);
  }
  return res;
}

/* Validaciones auxiliares para restricciones alrededor del Presidente:
   - "al lado" = índice inmediatamente anterior o siguiente (circular)
   - "en frente" = asiento opuesto (para even total: idx + N/2)
*/
function esRestriccionValida(total, presIndex, restrIndex) {
  // presIndex y restrIndex son 1..N
  const prev = presIndex === 1 ? total : presIndex - 1;
  const next = presIndex === total ? 1 : presIndex + 1;
  const frente = (total % 2 === 0) ? ((presIndex - 1 + total/2) % total) + 1 : null;
  if (restrIndex === prev || restrIndex === next) return false; // está al lado
  if (frente !== null && restrIndex === frente) return false; // está frente
  return true;
}

/* --- Guardar configuración (principal) --- */
guardarBtn.addEventListener('click', () => {
  // leer miembros (asegurar Presidente presente)
  let miembros = Array.from(miembrosSelect.selectedOptions).map(o=>o.text);
  if (!miembros.includes('Presidente')) {
    miembros.unshift('Presidente');
    // marcar visualmente la opción si existe
    for (const opt of miembrosSelect.options) if (opt.text==='Presidente') opt.selected=true;
  }

  if (miembros.length < 4) { alert('Debe haber al menos 4 miembros.'); return; }

  // Presidente asiento (1..N)
  const asientoPres = Number(presidenteAsiento.value) || 1;
  // restricciones
  const r1Val = restr1.value || "";
  const r2Val = restr2.value || "";

  // bloquear inputs EXCEPTO reiniciar
  document.querySelectorAll('#configForm select, #configForm button').forEach(el => {
    if (el.id !== 'reiniciarBtn') el.disabled = true;
  });
  // reiniciarBtn debe quedar habilitado
  reiniciarBtn.disabled = false;

  // render mesa
  renderMesa(tipoMesaEl.value, miembros, asientoPres, r1Val, r2Val);

  // mostrar resultado según modo
  const modo = modoEl.value;
  if (modo === 'conteo') {
    const total = miembros.length;
    const disposiciones = factorial(total - 1);
    resultado.innerHTML = `<b>Total de disposiciones válidas:</b> ${disposiciones.toLocaleString()}`;
  } else if (modo === 'listar') {
    // listar permutaciones con Presidente fijo en el asiento elegido: 
    // para listar de forma clara, colocamos Presidente primero y permutamos el resto (orden relativo)
    const restante = miembros.filter((m,i)=> (i+1) !== asientoPres); // quitar la persona situada en el asientoPres
    // IMPORTANT: esta simplificación asume la lista miembros[] está en orden "natural"
    // para mostrar permutaciones tomamos presidente fijo + permutaciones de los demás.
    const perm = permutar(restante);
    resultado.innerHTML = `<b>Total:</b> ${perm.length.toLocaleString()} disposiciones<br>(Primeras 50 mostradas)<br><br>`;
    resultado.innerHTML += perm.slice(0,50).map(p => `[Presidente @ Asiento ${asientoPres} | ${p.join(", ")}]`).join("<br>");
  } else if (modo === 'buscamina') {
    iniciarBuscamina(miembros);
  }

  estadoGuardado = true;
});

/* --- Reiniciar --- */
reiniciarBtn.addEventListener('click', () => {
  // reactivar todo
  document.querySelectorAll('#configForm select, #configForm button').forEach(el => el.disabled = false);
  // limpiar visuales
  resultado.innerHTML = '';
  mesa.innerHTML = '';
  buscaminaGrid.innerHTML = '';
  buscaminaContainer.classList.add('hidden');
  clearInterval(temporizador); temporizador = null;
  tiempoSpan.textContent = '0';
  segundos = 0;
  minasRestantes = 0;
  minasRestantesSpan.textContent = '0';
  estadoGuardado = false;
  // mantener selects con su contenido pero sin selección
  Array.from(miembrosSelect.options).forEach(o=>o.selected=false);
  actualizarDependientes();
});

/* --- Buscamina: crear tablero y lógica --- */
function iniciarBuscamina(miembros) {
  buscaminaContainer.classList.remove('hidden');
  buscaminaGrid.innerHTML = '';

  // jugadores seleccionados para buscamina
  let jugadores = Array.from(jugadoresBuscamina.selectedOptions).map(o=>o.value);
  if (jugadores.length === 0) jugadores = miembros.slice(); // todos si no seleccionaron

  const minas = Math.max(1, jugadores.length * 3);
  minasRestantes = minas;
  minasRestantesSpan.textContent = minasRestantes;

  // crear 30x30 = 900 celdas
  const totalCeldas = 900;
  const celdas = new Array(totalCeldas);
  for (let i=0;i<totalCeldas;i++){
    const div = document.createElement('div');
    div.className = 'celda';
    div.dataset.mina = 'false';
    div.dataset.revelada = 'false';
    div.dataset.idx = String(i);
    buscaminaGrid.appendChild(div);
    celdas[i] = div;
  }

  // plantar minas aleatorias
  let colocadas = 0;
  while (colocadas < minas) {
    const idx = Math.floor(Math.random()*totalCeldas);
    if (celdas[idx].dataset.mina === 'false') {
      celdas[idx].dataset.mina = 'true';
      colocadas++;
    }
  }

  // listeners
  celdas.forEach(cell => {
    cell.addEventListener('click', () => revelar(cell, celdas));
    cell.addEventListener('contextmenu', e => {
      e.preventDefault();
      toggleBandera(cell);
    });
  });

  // temporizador visible
  clearInterval(temporizador);
  segundos = 0;
  tiempoSpan.textContent = '0';
  temporizador = setInterval(()=> {
    segundos++; tiempoSpan.textContent = String(segundos);
  },1000);
}

/* revelar: si mina -> mina roja + game over; si no mina -> revelar y marcar verde pastel */
function revelar(celda, todas) {
  if (celda.dataset.revelada === 'true') return;
  celda.dataset.revelada = 'true';
  celda.classList.add('revelada');

  if (celda.dataset.mina === 'true') {
    celda.classList.add('mina');
    clearInterval(temporizador);
    alert('💥 ¡Explosión! Juego terminado.');
    // opcional: revelar todas las minas
    todas.filter(c=>c.dataset.mina==='true').forEach(c=>c.classList.add('mina'));
    return;
  } else {
    // color verde pastel ya aplicado por .revelada
    // mostrar número de minas alrededor (simple: contar minas 8 vecinos en grid 30x30)
    const idx = Number(celda.dataset.idx);
    const n = contarMinasVecinas(idx, todas);
    if (n>0) celda.textContent = String(n);
    // si n==0, podríamos auto-expandir (flood fill). Para simplicidad dejamos básico.
  }
}

/* contar minas vecinos en 30x30 */
function contarMinasVecinas(idx, todas) {
  const cols = 30;
  const rows = 30;
  const r = Math.floor(idx / cols);
  const c = idx % cols;
  let cnt = 0;
  for (let dr=-1; dr<=1; dr++){
    for (let dc=-1; dc<=1; dc++){
      if (dr===0 && dc===0) continue;
      const rr = r + dr, cc = c + dc;
      if (rr<0||rr>=rows||cc<0||cc>=cols) continue;
      const idn = rr*cols + cc;
      if (todas[idn].dataset.mina === 'true') cnt++;
    }
  }
  return cnt;
}

function toggleBandera(celda) {
  if (celda.dataset.revelada === 'true') return;
  if (celda.classList.contains('bandera')) {
    celda.classList.remove('bandera');
    celda.textContent = '';
    minasRestantes++;
  } else {
    celda.classList.add('bandera');
    celda.textContent = '🚩';
    minasRestantes--;
  }
  minasRestantesSpan.textContent = String(minasRestantes);
}

/* --- Inicial: poblar selects dependientes --- */
actualizarDependientes();

