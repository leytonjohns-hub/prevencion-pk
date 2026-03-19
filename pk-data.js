// pk-data.js — Shared data store for Seguridad PK SpA Prevention System
// All data persisted in localStorage

const PK = {
  // ─── AUTH ───────────────────────────────────────────────
  currentUser() {
    const u = localStorage.getItem('pk_user');
    return u ? JSON.parse(u) : null;
  },
  currentUsername() {
    return localStorage.getItem('pk_username') || '';
  },
  requireAuth(perfil) {
    const u = this.currentUser();
    if (!u) { window.location.href = 'login.html'; return null; }
    if (perfil && u.perfil !== perfil && !(Array.isArray(perfil) && perfil.includes(u.perfil))) {
      window.location.href = 'login.html'; return null;
    }
    return u;
  },
  logout() {
    localStorage.removeItem('pk_user');
    localStorage.removeItem('pk_username');
    window.location.href = 'login.html';
  },

  // ─── PREVENCIONISTAS ────────────────────────────────────
  PREVENCIONISTAS: {
    prev1: {
      nombre: 'Juan Carlos Jaque',
      email:  'prevencionpkseguridad1@gmail.com',
      diasSemana: 4,        // cuota máx de días por semana
      diasLabor: [],        // vacío = elige en cada planificación
      avatar: '👷'
    },
    prev2: {
      nombre: 'Delfina Pacheco',
      email:  'prevencionpk2@gmail.com',
      diasSemana: 3,
      diasLabor: [],
      avatar: '👷‍♀️'
    },
  },

  // ─── EMAILS GERENCIA (destinatarios de notificaciones) ──
  EMAILS_GERENCIA: [
    'rpkutz@gmail.com',
    'yalaska703@gmail.com',
    'leyton.johns@gmail.com',
  ],

  DIAS_SEMANA: ['Lunes','Martes','Miércoles','Jueves','Viernes'],

  // ─── PLANIFICACIONES ────────────────────────────────────
  getPlanificaciones(prevId) {
    const key = `pk_plan_${prevId}`;
    const d = localStorage.getItem(key);
    return d ? JSON.parse(d) : [];
  },
  savePlanificacion(prevId, semana, actividades) {
    const plans = this.getPlanificaciones(prevId);
    const idx = plans.findIndex(p => p.semana === semana);
    const obj = { semana, actividades, creadoEn: new Date().toISOString(), prevId };
    if (idx >= 0) plans[idx] = obj; else plans.push(obj);
    localStorage.setItem(`pk_plan_${prevId}`, JSON.stringify(plans));
    this.addNotificacion({
      tipo: 'planificacion',
      prevId,
      semana,
      msg: `${this.PREVENCIONISTAS[prevId]?.nombre} cargó planificación para la semana ${semana}`,
      fecha: new Date().toISOString()
    });
    return obj;
  },
  getPlanSemana(prevId, semana) {
    return this.getPlanificaciones(prevId).find(p => p.semana === semana) || null;
  },

  // ─── BITÁCORA ────────────────────────────────────────────
  getBitacora(prevId) {
    const d = localStorage.getItem(`pk_bitacora_${prevId}`);
    return d ? JSON.parse(d) : [];
  },
  addBitacora(prevId, entry) {
    const bit = this.getBitacora(prevId);
    entry.id = Date.now();
    entry.fecha = new Date().toISOString();
    entry.prevId = prevId;
    bit.unshift(entry);
    localStorage.setItem(`pk_bitacora_${prevId}`, JSON.stringify(bit));
    if (entry.urgencia === 'alta' || entry.urgencia === 'critica') {
      this.addNotificacion({
        tipo: 'novedad',
        prevId,
        msg: `⚠️ NOVEDAD ${entry.urgencia.toUpperCase()}: ${this.PREVENCIONISTAS[prevId]?.nombre} – ${entry.titulo}`,
        fecha: entry.fecha,
        urgencia: entry.urgencia
      });
    }
    return entry;
  },

  // ─── NOTIFICACIONES ─────────────────────────────────────
  getNotificaciones() {
    const d = localStorage.getItem('pk_notificaciones');
    return d ? JSON.parse(d) : [];
  },
  addNotificacion(n) {
    const notifs = this.getNotificaciones();
    n.id = Date.now();
    n.leida = false;
    notifs.unshift(n);
    localStorage.setItem('pk_notificaciones', JSON.stringify(notifs.slice(0, 100)));
    // Simulated email notification
    this.simulateEmail(n);
  },
  marcarLeida(id) {
    const notifs = this.getNotificaciones();
    const n = notifs.find(x => x.id === id);
    if (n) { n.leida = true; localStorage.setItem('pk_notificaciones', JSON.stringify(notifs)); }
  },
  getUnread() {
    return this.getNotificaciones().filter(n => !n.leida).length;
  },
  simulateEmail(n) {
    const emails = JSON.parse(localStorage.getItem('pk_emails') || '[]');
    emails.unshift({
      id: Date.now(),
      asunto: n.tipo === 'planificacion'
        ? '📅 Nueva Planificación Cargada – Seguridad PK SpA'
        : '🚨 Novedad Importante – Seguridad PK SpA',
      cuerpo: n.msg,
      destinatarios: this.EMAILS_GERENCIA,
      fecha: n.fecha,
      enviado: true
    });
    localStorage.setItem('pk_emails', JSON.stringify(emails.slice(0, 50)));
  },

  // ─── CHECKLIST / CUMPLIMIENTO ────────────────────────────
  getCumplimiento(prevId, semana) {
    const key = `pk_cumpl_${prevId}_${semana}`;
    const d = localStorage.getItem(key);
    return d ? JSON.parse(d) : {};
  },
  setCumplimiento(prevId, semana, actividadId, estado) {
    const c = this.getCumplimiento(prevId, semana);
    c[actividadId] = estado;
    localStorage.setItem(`pk_cumpl_${prevId}_${semana}`, JSON.stringify(c));
  },
  getPorcentajeCumplimiento(prevId, semana) {
    const plan = this.getPlanSemana(prevId, semana);
    if (!plan || !plan.actividades.length) return 0;
    const c = this.getCumplimiento(prevId, semana);
    const total = plan.actividades.length;
    const done = plan.actividades.filter(a => c[a.id] === 'cumplido').length;
    return Math.round((done / total) * 100);
  },

  // ─── SEMANA ACTUAL ───────────────────────────────────────
  getSemanaActual() {
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 1);
    const week = Math.ceil(((now - start) / 86400000 + start.getDay() + 1) / 7);
    return `${now.getFullYear()}-S${String(week).padStart(2, '0')}`;
  },
  getSemanaLabel(semana) {
    const [year, sw] = semana.split('-S');
    const weekNum = parseInt(sw);
    const jan1 = new Date(parseInt(year), 0, 1);
    const dayOfWeek = jan1.getDay() || 7;
    const firstMon = new Date(jan1);
    firstMon.setDate(jan1.getDate() + (dayOfWeek === 1 ? 0 : 8 - dayOfWeek));
    const monday = new Date(firstMon);
    monday.setDate(firstMon.getDate() + (weekNum - 1) * 7);
    const friday = new Date(monday);
    friday.setDate(monday.getDate() + 4);
    const fmt = d => d.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit' });
    return `Semana ${weekNum} (${fmt(monday)} – ${fmt(friday)}) ${year}`;
  },

  // ─── TIPOS DE ACTIVIDAD ──────────────────────────────────
  TIPOS_ACTIVIDAD: [
    { id: 'visita',    label: 'Visita a Empresa',          emoji: '🏭', color: '#1a6ebc' },
    { id: 'induccion', label: 'Inducción de Seguridad',    emoji: '📢', color: '#8e44ad' },
    { id: 'control',   label: 'Control de Actividades',    emoji: '✅', color: '#27ae60' },
    { id: 'capacitacion', label: 'Capacitación',           emoji: '📚', color: '#e67e22' },
    { id: 'auditoria', label: 'Auditoría / Inspección',    emoji: '🔍', color: '#c0392b' },
    { id: 'reunion',   label: 'Reunión de Coordinación',   emoji: '🤝', color: '#16a085' },
    { id: 'accidente', label: 'Investigación Accidente',   emoji: '⚠️', color: '#e74c3c' },
    { id: 'reporte',   label: 'Elaboración de Reportes',   emoji: '📊', color: '#2980b9' },
    { id: 'otro',      label: 'Otra Actividad',            emoji: '📌', color: '#7f8c8d' },
  ],

  getTipoActividad(id) {
    return this.TIPOS_ACTIVIDAD.find(t => t.id === id) || this.TIPOS_ACTIVIDAD[8];
  },

  // ─── COBERTURA SEMANAL ───────────────────────────────────
  // Retorna un objeto con cada día de la semana y qué prevencionistas
  // tienen actividades planificadas ese día
  getCoberturasSemana(semana) {
    const cobertura = {};
    this.DIAS_SEMANA.forEach(dia => { cobertura[dia] = []; });
    Object.keys(this.PREVENCIONISTAS).forEach(pid => {
      const plan = this.getPlanSemana(pid, semana);
      if (!plan) return;
      const diasPlanificados = [...new Set(plan.actividades.map(a => a.dia))];
      diasPlanificados.forEach(dia => {
        if (cobertura[dia] !== undefined) cobertura[dia].push(pid);
      });
    });
    return cobertura;
  },

  getDiasActividadesPrev(prevId, semana) {
    const plan = this.getPlanSemana(prevId, semana);
    if (!plan) return [];
    return [...new Set(plan.actividades.map(a => a.dia))];
  },

  // ─── SEED DEMO DATA ──────────────────────────────────────
  seedDemo() {
    // Sin datos demo — sistema listo para datos reales
    return;
  }
};

// Auto-seed
PK.seedDemo();
