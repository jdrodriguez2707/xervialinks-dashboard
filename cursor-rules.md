# PROYECTO: Dashboard de Ingresos con Ad Manager (MVP)

## 🎯 OBJETIVO

Desarrollar una plataforma web privada que se integre con Google Ad Manager para:

- Obtener métricas publicitarias (ingresos, impresiones, eCPM)
- Visualizarlas en un dashboard
- Asignar ingresos a trabajadores según propiedades (dominios / ad units)
- Calcular ganancias según porcentajes
- Permitir vista de administrador y trabajadores

Este es un MVP interno, no un SaaS completo.

---

## 🧠 PRINCIPIOS CLAVE

- Mantenerlo SIMPLE (evitar sobreingeniería)
- Desarrollo ITERATIVO (paso a paso)
- Priorizar la lógica de negocio sobre la UI
- Garantizar exactitud en cálculos financieros
- Código limpio y mantenible
- Evitar abstracciones innecesarias

---

## 🏗️ ARQUITECTURA

Usar una arquitectura en capas simple:

- Controllers → manejan requests HTTP
- Services → lógica de negocio (CRÍTICO)
- Repositories / Data Layer → acceso a base de datos
- Models → definición de estructuras de datos

Evitar:

- patrones innecesarios
- microservicios
- complejidad prematura

---

## 🧩 MÓDULOS PRINCIPALES

### 1. Autenticación (Básica)

- Usuario administrador
- Usuario trabajador
- Control por roles

---

### 2. Integración con Ad Manager

- Conexión a API
- Obtener:
  - ingresos
  - impresiones
  - eCPM
- Inicialmente usar datos mock

---

### 3. Gestión de Trabajadores

- Crear workers
- Asignar porcentaje
- Asignar propiedades (dominio / ad unit)

---

### 4. Sistema de Ingresos (CRÍTICO)

Responsabilidades:

- Asignar ingresos a trabajadores
- Calcular pagos

Fórmula base:

worker_payout = revenue * percentage

En el futuro:

- soportar ajustes
- soportar net vs gross revenue

---

### 5. Dashboard

Administrador:

- ingresos totales
- desglose por worker
- métricas generales

Worker:

- ingresos personales
- monto a recibir
- propiedades asignadas

---

## 🗃️ ESTRUCTURA DE BASE DE DATOS (INICIAL)

Users:

- id
- name
- email
- password
- role

Workers:

- id
- user_id
- percentage

Properties:

- id
- worker_id
- type (domain, ad_unit)
- value

Reports:

- id
- date
- property
- impressions
- revenue
- ecpm

---

## 🔁 ESTRATEGIA DE DESARROLLO

Trabajar en iteraciones:

### Iteración 1

- Backend básico
- Endpoint de salud
- Datos mock

### Iteración 2

- Sistema de workers
- Lógica de porcentajes

### Iteración 3

- Cálculo de ingresos

### Iteración 4

- Dashboard frontend básico

### Iteración 5

- Integración con API real

### Iteración 6

- Mejoras (filtros, UI, etc.)

---

## 🧪 ESTRATEGIA DE TESTING

Testear SOLO lo crítico.

### TESTS OBLIGATORIOS

1. Cálculo de ingresos
2. Lógica de porcentajes
3. Asignación de workers

Ejemplo:

Entrada:

- revenue: 1000
- porcentaje: 70%

Salida esperada:

- payout: 700

---

### NO NECESARIO POR AHORA

- testing completo de UI
- edge cases complejos
- cobertura total

---

## ⚠️ PARTES CRÍTICAS / RIESGOS

1. Integración con Google Ad Manager
2. Consistencia de datos
3. Asignación correcta de ingresos

---

## 🧰 STACK TECNOLÓGICO

Frontend:

- React o Next.js

Backend:

- Node.js
- Express

Base de datos:

- PostgreSQL

Testing:

- Jest

Opcional:

- Supertest

---

## 🧹 REGLAS DE CALIDAD DE CÓDIGO

- Nombres claros en variables y funciones
- Funciones pequeñas y simples
- Evitar lógica anidada compleja
- Lógica de negocio en services
- Evitar duplicación de código

---

## 🚫 EVITAR

- Sobreingeniería
- Funcionalidades innecesarias
- Arquitectura compleja prematura
- Optimización prematura

---

## ✅ CRITERIOS DE ÉXITO

El MVP está completo cuando:

- Se obtienen datos (mock o reales)
- Se pueden asignar workers
- Los ingresos se calculan correctamente
- El dashboard muestra la información
- Cada usuario ve sus datos correctamente

---

## 🧠 NOTA FINAL

Este proyecto es para:

- aprender backend real
- manejar lógica financiera
- construir una herramienta útil

NO es para:

- perfección absoluta
- UI avanzada
- sistemas complejos

Construir simple. Construir bien.
