import '@testing-library/jest-dom'
import { configure } from '@testing-library/dom'

// 遅延 route と重い DOM を coverage 付きで同時に動かしても、既定の 1 秒で
// 成否が揺れないようにする。fake timer で境界を検証するテストには影響しない。
configure({ asyncUtilTimeout: 10_000 })
