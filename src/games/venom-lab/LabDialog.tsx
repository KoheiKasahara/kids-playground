import { useEffect, useRef, type ReactNode } from 'react'
import { playLabSound } from './sounds'
import styles from './VenomLabPlay.module.css'

export default function LabDialog({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const dialog = ref.current!
    const previous = document.activeElement as HTMLElement | null
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    dialog.showModal()
    return () => {
      dialog.close()
      document.body.style.overflow = overflow
      if (previous?.isConnected) previous.focus({ preventScroll: true })
    }
  }, [])
  const close = () => { playLabSound(); onClose() }
  return <dialog ref={ref} className={styles.dialog} aria-label={title} onCancel={event => { event.preventDefault(); close() }}>
    <div className={styles.dialogHeader}><b>{title}</b><button type="button" onClick={close} autoFocus>✕ とじる</button></div>
    {children}
  </dialog>
}
