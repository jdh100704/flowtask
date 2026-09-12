# ⚡ FlowTask — Gestor de Tareas Kanban

FlowTask es una aplicación web interactiva de gestión de tareas estilo Kanban con funcionalidad **Drag & Drop** en tiempo real y persistencia de datos.

## 🚀 Tecnologías Utilizadas

- **Frontend:** Next.js (App Router), React, TypeScript, Tailwind CSS
- **Backend & Base de Datos:** Supabase (PostgreSQL)
- **Librerías:** `@hello-pangea/dnd` (Drag & Drop), `lucide-react` (Iconos)
- **Despliegue:** Vercel

## ✨ Características

- 📋 **Tablero Kanban:** Organización por columnas (Por Hacer, En Progreso, Completado).
- 🔄 **Drag & Drop Interactivo:** Mueve tarjetas entre columnas actualizando el estado instantáneamente.
- ⚡ **Persistencia en Tiempo Real:** Los cambios se sincronizan en la base de datos de Supabase.
- 🏷️ **Gestión de Prioridades:** Clasificación visual por prioridad (Alta, Media, Baja).
- ➕ **CRUD Completo:** Creación y eliminación rápida de tareas.

## 🛠️ Instalación Local

```bash
# Clonar el repositorio
git clone [https://github.com/jdh100704/flowtask.git](https://github.com/jdh100704/flowtask.git)

# Entrar a la carpeta
cd flowtask

# Instalar dependencias
npm install

# Iniciar en entorno de desarrollo
npm run dev