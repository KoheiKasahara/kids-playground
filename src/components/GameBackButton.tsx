import { Link } from 'react-router-dom'
import styles from './GameBackButton.module.css'

type Props = { label?: string } & (
  | { to: string; onBack?: never }
  | { onBack: () => void; to?: never }
)

/** 親のsafe-area付きヘッダーの左端へ配置する。戻り先は画面が明示する。 */
export default function GameBackButton(props: Props) {
  return props.to !== undefined
    ? <Link className={styles.back} to={props.to} aria-label={props.label}>← もどる</Link>
    : <button className={styles.back} type="button" onClick={props.onBack} aria-label={props.label}>← もどる</button>
}
