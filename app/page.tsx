'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import {
  DragDropContext,
  Droppable,
  Draggable,
  DropResult
} from '@hello-pangea/dnd'
import { Plus, Trash2, CheckCircle2, Clock, ListTodo, Pencil, Check, X } from 'lucide-react'

interface Tarea {
  id: string
  titulo: string
  descripcion: string
  estado: 'todo' | 'in_progress' | 'done'
  prioridad: 'baja' | 'media' | 'alta'
  user_id?: string
}

const COLUMNAS = [
  { id: 'todo', titulo: 'Por Hacer', icono: ListTodo, color: 'border-slate-700' },
  { id: 'in_progress', titulo: 'En Progreso', icono: Clock, color: 'border-amber-500/50' },
  { id: 'done', titulo: 'Completado', icono: CheckCircle2, color: 'border-emerald-500/50' }
]

export default function Home() {
  const [tareas, setTareas] = useState<Tarea[]>([])
  const [cargando, setCargando] = useState(true)
  const [sesionLista, setSesionLista] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [nuevoTitulo, setNuevoTitulo] = useState('')
  const [nuevaDesc, setNuevaDesc] = useState('')
  const [nuevaPrioridad, setNuevaPrioridad] = useState<'baja' | 'media' | 'alta'>('media')
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [edicion, setEdicion] = useState({ titulo: '', descripcion: '', prioridad: 'media' as Tarea['prioridad'] })
  const router = useRouter()

  // Comprueba si hay sesión activa antes de dejar ver el tablero
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.push('/login')
      } else {
        setUserId(session.user.id) // Guardamos el ID del usuario logueado
        setSesionLista(true)
      }
    })

    // Escucha también si el usuario cierra sesión mientras está en la página
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) router.push('/login')
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    fetchTareas()

    // Abrimos un canal llamado "tareas-realtime" (el nombre es libre, es solo una etiqueta)
    const channel = supabase
      .channel('tareas-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tareas' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const nueva = payload.new as Tarea
            setTareas((prev) =>
              // Evita duplicar si ya la habíamos añadido nosotros mismos de forma optimista
              prev.some((t) => t.id === nueva.id) ? prev : [...prev, nueva]
            )
          }

          if (payload.eventType === 'UPDATE') {
            const actualizada = payload.new as Tarea
            setTareas((prev) =>
              prev.map((t) => (t.id === actualizada.id ? actualizada : t))
            )
          }

          if (payload.eventType === 'DELETE') {
            const borrada = payload.old as Tarea
            setTareas((prev) => prev.filter((t) => t.id !== borrada.id))
          }
        }
      )
      .subscribe()

    // Cuando el componente se desmonta (cierras la pestaña, navegas a otra página),
    // cerramos el canal para no dejar conexiones abiertas innecesariamente
    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  async function fetchTareas() {
    // Con RLS activado, Supabase ya solo devuelve las tareas del usuario logueado
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
    if (!nuevoTitulo.trim() || !userId) return

    const nuevaTarea: Tarea = {
      id: crypto.randomUUID(),
      titulo: nuevoTitulo,
      descripcion: nuevaDesc,
      estado: 'todo',
      prioridad: nuevaPrioridad,
      user_id: userId // Necesario para que la política RLS de "insert" lo permita
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

  const iniciarEdicion = (tarea: Tarea) => {
    setEditandoId(tarea.id)
    setEdicion({ titulo: tarea.titulo, descripcion: tarea.descripcion, prioridad: tarea.prioridad })
  }

  const cancelarEdicion = () => {
    setEditandoId(null)
  }

  const guardarEdicion = async (id: string) => {
    // Actualización optimista, igual que en handleDragEnd
    setTareas((prev) =>
      prev.map((t) => (t.id === id ? { ...t, ...edicion } : t))
    )
    setEditandoId(null)

    const { error } = await supabase
      .from('tareas')
      .update(edicion)
      .eq('id', id)

    if (error) {
      console.error('Error al editar tarea:', error)
      fetchTareas()
    }
  }

  const cerrarSesion = async () => {
    await supabase.auth.signOut()
    router.push('/login')
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

  if (cargando || !sesionLista) {
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
        <button
          onClick={cerrarSesion}
          className="text-xs text-slate-400 hover:text-rose-400 transition border border-slate-800 rounded-lg px-3 py-1.5"
        >
          Cerrar sesión
        </button>
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
                                {editandoId === tarea.id ? (
                                  // MODO EDICIÓN
                                  <div className="space-y-2">
                                    <input
                                      type="text"
                                      value={edicion.titulo}
                                      onChange={(e) => setEdicion({ ...edicion, titulo: e.target.value })}
                                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
                                    />
                                    <input
                                      type="text"
                                      value={edicion.descripcion}
                                      onChange={(e) => setEdicion({ ...edicion, descripcion: e.target.value })}
                                      placeholder="Descripción (opcional)..."
                                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                                    />
                                    <select
                                      value={edicion.prioridad}
                                      onChange={(e) => setEdicion({ ...edicion, prioridad: e.target.value as Tarea['prioridad'] })}
                                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
                                    >
                                      <option value="baja">Prioridad Baja</option>
                                      <option value="media">Prioridad Media</option>
                                      <option value="alta">Prioridad Alta</option>
                                    </select>
                                    <div className="flex justify-end gap-2 pt-1">
                                      <button
                                        onClick={cancelarEdicion}
                                        className="text-slate-500 hover:text-slate-300 transition p-1"
                                      >
                                        <X className="w-4 h-4" />
                                      </button>
                                      <button
                                        onClick={() => guardarEdicion(tarea.id)}
                                        className="text-emerald-500 hover:text-emerald-400 transition p-1"
                                      >
                                        <Check className="w-4 h-4" />
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  // MODO NORMAL
                                  <>
                                    <div className="flex items-start justify-between gap-2 mb-2">
                                      <h3 className="font-medium text-sm text-slate-100">
                                        {tarea.titulo}
                                      </h3>
                                      <div className="flex items-center gap-1">
                                        <button
                                          onClick={() => iniciarEdicion(tarea)}
                                          className="text-slate-600 hover:text-indigo-400 transition cursor-pointer p-1"
                                        >
                                          <Pencil className="w-3.5 h-3.5" />
                                        </button>
                                        <button
                                          onClick={() => eliminarTarea(tarea.id)}
                                          className="text-slate-600 hover:text-rose-400 transition cursor-pointer p-1"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      </div>
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
                                  </>
                                )}
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