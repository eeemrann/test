import { CalendarDays, CircleAlert, UserRound } from 'lucide-react'
import { useDraggable } from '@dnd-kit/core'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { formatTaskDate, isTaskOverdue, priorityClasses, priorityLabels } from '@/features/tasks/task-format'
import type { Task } from '@/features/tasks/types/task.types'

type TaskCardProps = {
  task: Task
  onSelect: (taskId: string) => void
  isDragDisabled?: boolean
}

export function TaskCard({ task, onSelect, isDragDisabled = false }: TaskCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
    data: { task },
    disabled: isDragDisabled,
  })
  const overdue = isTaskOverdue(task)
  const deadline = formatTaskDate(task.deadline)
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined

  return (
    <button
      ref={setNodeRef}
      type="button"
      onClick={() => onSelect(task.id)}
      style={style}
      {...listeners}
      {...attributes}
      className={cn('group w-full rounded-2xl text-left outline-none focus-visible:ring-2 focus-visible:ring-blue-500', isDragging && 'opacity-30')}
      aria-label={`Open task ${task.title}`}
    >
      <TaskCardContent task={task} overdue={overdue} deadline={deadline} />
    </button>
  )
}

export function TaskDragPreview({ task }: { task: Task }) {
  return <div className="w-[min(21rem,calc(100vw-2rem))] rounded-2xl border border-blue-200 bg-white p-4 text-left shadow-2xl"><TaskCardContent task={task} overdue={isTaskOverdue(task)} deadline={formatTaskDate(task.deadline)} /></div>
}

function TaskCardContent({ task, overdue, deadline }: { task: Task; overdue: boolean; deadline: string | null }) {
  return (
      <article className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm transition-all group-hover:-translate-y-0.5 group-hover:border-blue-200 group-hover:shadow-md">
        <div className="flex items-start justify-between gap-3">
          <h3 className="line-clamp-2 min-w-0 text-sm font-semibold leading-5 text-slate-950">{task.title}</h3>
          <Badge variant="outline" className={cn('shrink-0', priorityClasses[task.priority])}>{priorityLabels[task.priority]}</Badge>
        </div>
        {task.description && <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-500">{task.description}</p>}
        <div className="mt-4 space-y-2 border-t border-slate-100 pt-3 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <UserRound className="size-3.5 shrink-0" aria-hidden="true" />
            <span className="truncate">{task.assignee.fullName}</span>
          </div>
          {deadline && (
            <div className={cn('flex items-center gap-2', overdue && 'font-medium text-rose-700')}>
              {overdue ? <CircleAlert className="size-3.5 shrink-0" aria-hidden="true" /> : <CalendarDays className="size-3.5 shrink-0" aria-hidden="true" />}
              <span>{overdue ? `Overdue · ${deadline}` : `Due ${deadline}`}</span>
            </div>
          )}
          {task.team?.name && <p className="truncate text-[0.7rem] text-slate-400">{task.team.name}</p>}
        </div>
      </article>
  )
}
