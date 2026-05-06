Quiero rediseñar completamente la UI de mi aplicación usando Tailwind CSS y shadcn/ui, manteniendo la lógica existente sin modificar comportamiento ni endpoints.

CONTEXTO DEL PROYECTO:

- Frontend: React + Vite
- Estructura actual:
  src/
    app/
    features/
      auth/
      admin/
      worker/
    shared/
      api/
    styles/

- Backend ya funcional, NO modificar lógica
- Solo se va a rediseñar la UI

---

OBJETIVO:

Crear una UI moderna, consistente y profesional tipo dashboard (similar a AdSense), usando:

- Tailwind CSS
- shadcn/ui
- Componentes reutilizables
- Buenas prácticas de arquitectura

---

REGLAS IMPORTANTES:

1. NO modificar lógica de negocio ni llamadas API
2. NO cambiar estructura de features
3. NO mezclar lógica con UI
4. Crear componentes reutilizables
5. Mantener código limpio y escalable
6. NO usar CSS plano nuevo (solo Tailwind)
7. NO refactorizar todo de golpe, trabajar por vistas
8. Evitar clases Tailwind repetidas → abstraer en componentes

---

FASE 1 — SETUP

1. Instalar e integrar Tailwind CSS en el proyecto
2. Instalar y configurar shadcn/ui
3. Crear carpeta base de UI:

src/components/ui/

4. Generar componentes base con shadcn:

- Button
- Card
- Input
- Label
- Dialog (modal)
- Table
- Badge
- Select
- Skeleton

---

FASE 2 — DESIGN SYSTEM

Definir en tailwind.config.js:

- Colores:
  primary (oscuro tipo dashboard)
  secondary
  muted
  success (verde ingresos)
  warning (pendiente)
  danger

- Border radius consistente
- Espaciado estándar

---

FASE 3 — LAYOUT GLOBAL

Crear layout base reutilizable:

- Sidebar izquierda (como en las imágenes)
- Topbar con:
  - nombre del sistema
  - fecha
  - última sincronización
  - usuario activo

Ubicación:
src/app/AppLayout.jsx

---

FASE 4 — REDISEÑO VISTAS (usar las imágenes como referencia visual)

### ADMIN DASHBOARD

Ubicación:
features/admin/components/

Recrear:

1. Summary Cards:
   - Ingresos
   - Impresiones
   - eCPM

→ usar Card component
→ diseño limpio con spacing consistente

2. Workers section:
   - botón "Agregar trabajador"
   - estado vacío con mensaje

---

### MODAL NUEVO TRABAJADOR

- usar Dialog de shadcn
- inputs:
  - nombre
  - email
  - porcentaje
  - contraseña

- botones:
  - cancelar
  - guardar

---

### LISTA DE TRABAJADORES

- Card por trabajador
- mostrar:
  - nombre
  - email
  - porcentaje (Badge)
  - subdominios (chips/badges)

- Select para asignar subdominio
- Botón acción

---

### TABLA GANANCIAS

- usar Table de shadcn

Columnas:
- trabajador
- subdominios
- impresiones
- ingresos asignados
- %
- ganancia
- estado
- pagos

→ usar Badge para estado:
  pendiente → warning
  pagado → success

---

### WORKER DASHBOARD

Ubicación:
features/worker/components/

1. Cards:
- Hoy
- Ayer
- Últimos 7 días
- Este mes

→ diseño destacado (card seleccionada con borde)

2. eCPM
3. Impresiones

---

FASE 5 — UX MEJORAS

1. Skeleton loading en:
- cards
- tablas

2. Estados:
- vacío
- loading
- error

3. Animaciones suaves (hover, transitions)

---

FASE 6 — COMPONENTIZACIÓN

Crear componentes reutilizables:

- MetricCard
- SectionHeader
- EmptyState
- DataTable
- StatusBadge

Ubicación:
src/components/

---

FASE 7 — LIMPIEZA

- eliminar CSS antiguo no usado
- eliminar estilos duplicados
- asegurar imports limpios

---

IMPORTANTE:

- Mantener exactamente el comportamiento actual
- Solo mejorar UI/UX
- No romper funcionalidades existentes
- Usar buenas prácticas de React

---

ENTREGA ESPERADA:

- UI completamente rediseñada
- Código organizado
- Componentes reutilizables
- Diseño consistente tipo dashboard profesional

---

Empieza con:

1. Setup de Tailwind + shadcn
2. Crear layout base
3. Luego avanzar por vistas (admin dashboard primero)