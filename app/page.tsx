'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import {
  DragDropContext,
  Droppable,
  Draggable,
  DropResult
} from '@hello-pangea/dnd'
import { Plus, Trash2, CheckCircle2, Clock, ListTodo } from 'lucide-react'

interface Tarea {
  id: string
  titulo: string
  descripcion: string
  estado: 'todo' | 'in_progress' | 'done'
  prioridad: 'baja' | 'media' | 'alta'
}

const COLUMNAS = [
  { id: 'todo', titulo: 'Por Hacer', icono: ListTodo, color: 'border-slate-700' },
  { id: 'in_progress', titulo: 'En Progreso', icono: Clock, color: 'border-amber-500/50' },
  { id: 'done', titulo: 'Completado', icono: CheckCircle2, color: 'border-emerald-500/50' }
]

export default function Home() {
  const [tareas, setTareas] = useState<Tarea[]>([])
  const [cargando, setCargando] = useState(true)
  const [nuevoTitulo, setNuevoTitulo] = useState('')
  const [nuevaDesc, setNuevaDesc] = useState('')
  const [nuevaPrioridad, setNuevaPrioridad] = useState<'baja' | 'media' | 'alta'>('media')

  useEffect(() => {
    fetchTareas()
  }, [])

  async function fetchTareas() {
    const { data, error } = await supabase.from('tareas').select('*')
    if (error) {
      console.error('Error al cargar tareas:', error)
    } else if (data) {
      setTareas(data as Tarea[])
    }
    setCargando(false)
  }

  const handleDragEnd = async (result: DropResult) => {
    const { destination, source, draggableId } = result

    if (!destination) return
    if (
      destination.droppableId === source.droppableId &&
      destination.index === source.index
    ) return

    const nuevoEstado = destination.droppableId as Tarea['estado']

    // Actualización optimista de la UI
    setTareas((prev) =>
      prev.map((t) => (t.id === draggableId ? { ...t, estado: nuevoEstado } : t))
    )

    // Guardar en Supabase
    const { error } = await supabase
      .from('tareas')
      .update({ estado: nuevoEstado })
      .eq('id', draggableId)

    if (error) {
      console.error('Error al actualizar tarea:', error)
      fetchTareas() // Revertir en caso de error
    }
  }

  const crearTarea = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!nuevoTitulo.trim()) return

    const nuevaTarea: Tarea = {
      id: Date.now().toString(),
      titulo: nuevoTitulo,
      descripcion: nuevaDesc,
      estado: 'todo',
      prioridad: nuevaPrioridad
    }

    setTareas((prev) => [...prev, nuevaTarea])
    setNuevoTitulo('')
    setNuevaDesc('')

    const { error } = await supabase.from('tareas').insert([nuevaTarea])
    if (error) {
      console.error('Error al crear tarea:', error)
      fetchTareas()
    }
  }

  const eliminarTarea = async (id: string) => {
    setTareas((prev) => prev.filter((t) => t.id !== id))
    const { error } = await supabase.from('tareas').delete().eq('id', id)
    if (error) {
      console.error('Error al eliminar tarea:', error)
      fetchTareas()
    }
  }

  const getPrioridadBadge = (p: Tarea['prioridad']) => {
    switch (p) {
      case 'alta':
        return 'bg-rose-500/10 text-rose-400 border-rose-500/30'
      case 'media':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/30'
      case 'baja':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
    }
  }

  if (cargando) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center">
        <p className="text-slate-400 animate-pulse font-mono">Cargando tablero...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans p-6 sm:p-10">
      <header className="max-w-7xl mx-auto mb-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent">
            FlowTask
          </h1>
          <p className="text-xs text-slate-400 font-light mt-1">
            Gestión visual de proyectos en tiempo real
          </p>
        </div>
      </header>

      {/* FORMULARIO DE CREACIÓN */}
      <section className="max-w-7xl mx-auto mb-12 bg-slate-900/60 border border-slate-800 p-5 rounded-2xl">
        <form onSubmit={crearTarea} className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            placeholder="Título de la nueva tarea..."
            value={nuevoTitulo}
            onChange={(e) => setNuevoTitulo(e.target.value)}
            className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500 transition"
          />
          <input
            type="text"
            placeholder="Descripción (opcional)..."
            value={nuevaDesc}
            onChange={(e) => setNuevaDesc(e.target.value)}
            className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500 transition"
          />
          <select
            value={nuevaPrioridad}
            onChange={(e) => setNuevaPrioridad(e.target.value as any)}
            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-500 transition cursor-pointer text-slate-300"
          >
            <option value="baja">Prioridad Baja</option>
            <option value="media">Prioridad Media</option>
            <option value="alta">Prioridad Alta</option>
          </select>
          <button
            type="submit"
            className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-5 py-3 rounded-xl transition flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-indigo-600/20"
          >
            <Plus className="w-4 h-4" /> Crear Tarea
          </button>
        </form>
      </section>

      {/* TABLERO KANBAN DRAG & DROP */}
      <main className="max-w-7xl mx-auto">
        <DragDropContext onDragEnd={handleDragEnd}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {COLUMNAS.map((col) => {
              const Icono = col.icono
              const tareasColumna = tareas.filter((t) => t.estado === col.id)

              return (
                <div
                  key={col.id}
                  className={`bg-slate-900/40 border ${col.color} rounded-2xl p-4 flex flex-col min-h-[500px]`}
                >
                  <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800">
                    <div className="flex items-center gap-2">
                      <Icono className="w-4 h-4 text-slate-400" />
                      <h2 className="font-semibold text-sm tracking-wide text-slate-200">
                        {col.titulo}
                      </h2>
                    </div>
                    <span className="bg-slate-800 text-slate-400 text-xs font-bold px-2.5 py-0.5 rounded-full">
                      {tareasColumna.length}
                    </span>
                  </div>

                  <Droppable droppableId={col.id}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={`flex-1 space-y-3 transition rounded-xl p-1 ${
                          snapshot.isDraggingOver ? 'bg-slate-800/30' : ''
                        }`}
                      >
                        {tareasColumna.map((tarea, index) => (
                          <Draggable
                            key={tarea.id}
                            draggableId={tarea.id}
                            index={index}
                          >
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                {...provided.dragHandleProps}
                                className={`bg-slate-900 border border-slate-800 p-4 rounded-xl shadow-md group transition hover:border-slate-700 ${
                                  snapshot.isDragging
                                    ? 'shadow-2xl border-indigo-500 scale-105'
                                    : ''
                                }`}
                              >
                                <div className="flex items-start justify-between gap-2 mb-2">
                                  <h3 className="font-medium text-sm text-slate-100">
                                    {tarea.titulo}
                                  </h3>
                                  <button
                                    onClick={() => eliminarTarea(tarea.id)}
                                    className="text-slate-600 hover:text-rose-400 transition cursor-pointer p-1"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                                {tarea.descripcion && (
                                  <p className="text-slate-400 text-xs mb-3 font-light leading-relaxed">
                                    {tarea.descripcion}
                                  </p>
                                )}
                                <div className="flex items-center justify-between pt-2 border-t border-slate-800/60">
                                  <span
                                    className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md border ${getPrioridadBadge(
                                      tarea.prioridad
                                    )}`}
                                  >
                                    {tarea.prioridad}
                                  </span>
                                </div>
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </div>
              )
            })}
          </div>
        </DragDropContext>
      </main>
    </div>
  )
}