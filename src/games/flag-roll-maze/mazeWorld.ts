import type { RigidBody, World } from '@dimforge/rapier3d-compat'
import {
  BALL_ANGULAR_DAMPING,
  BALL_FRICTION,
  BALL_LINEAR_DAMPING,
  BALL_MASS,
  BALL_RADIUS,
  BALL_RESTITUTION,
  BALL_SPAWN_CLEARANCE_IN_RADII,
  BUMPER_FRICTION,
  BUMPER_HEIGHT,
  BUMPER_RESTITUTION,
  CAR_BODY_HEIGHT,
  CAR_BODY_ROUND,
  CAR_CABIN_RADIUS,
  CAR_DEPTH,
  CAR_FRICTION,
  CAR_RESTITUTION,
  CAR_WIDTH,
  CANNON_SETTLE_LERP,
  clampSpeed,
  FLOOR_FRICTION,
  FLOOR_THICKNESS,
  GOAL_CUP_FLOOR_Y,
  GOAL_CUP_RADIUS,
  GOAL_RADIUS,
  GOAL_REACHED_MAX_Y,
  gravityFromTilt,
  JUMP_PAD_COOLDOWN_MS,
  MAX_BALL_SPEED,
  PHYSICS_TIMESTEP,
  SPINNER_FRICTION,
  SPINNER_RESTITUTION,
  WALL_FRICTION,
  WALL_HEIGHT,
  WALL_RESTITUTION,
  type PhysicsVector,
} from './mazePhysics'
import {
  bumperKick,
  canKickBumper,
  markBumperKicked,
  spinnerAngleAt,
  type BumperCooldowns,
  type BumperGimmick,
  type CannonGimmick,
  type CarGimmick,
  type JumpPadGimmick,
  type SpinnerGimmick,
} from './mazeGimmicks'
import { carXAt } from './mazeCarToy'
import { cannonChamberPosition, cannonLaunchVelocity } from './mazeCannon'
import { jumpPadLaunch } from './mazeJumpPad'
import type { MazePoint, MazeStage } from './mazeStage'
import type { TiltInput } from './tiltInput'

/** Hookとheadlessテストが同じRapierコンストラクタを共有するための最小インターフェース。 */
export type RapierModule = Pick<
  typeof import('@dimforge/rapier3d-compat'),
  'World' | 'RigidBodyDesc' | 'ColliderDesc'
>

export type MazeWorld = {
  world: World
  ball: RigidBody
  stage: MazeStage
  /** 回転棒のkinematic body。配列順をギミック配列と揃え、描画側が対応付けやすくする。 */
  spinners: { gimmick: SpinnerGimmick; body: RigidBody }[]
  /** 車のkinematic body。位置を物理の正本にし、見た目はここへ毎フレーム同期する。 */
  cars: { gimmick: CarGimmick; body: RigidBody }[]
}

/** ボールはSTARTの地形上面から少し上へ置き、初期フレームで床へめり込まないようにする。 */
export function ballSpawnPosition(start: MazeStage['start']): PhysicsVector {
  return {
    x: start.x,
    y: (start.y ?? 0) + BALL_RADIUS * (1 + BALL_SPAWN_CLEARANCE_IN_RADII),
    z: start.z,
  }
}

/**
 * 床・壁・ギミック・ボールを同じRapier世界へ組み立てる。
 * 穴の位置だけ床を抜く必要があるため、床は盤面全体ではなく矩形ごとに分ける。
 */
export function createMazeWorld(rapier: RapierModule, stage: MazeStage): MazeWorld {
  // 初期重力は真下。最初のフレームで入力から上書きされる。
  const world = new rapier.World({ x: 0, y: -1, z: 0 })
  world.timestep = PHYSICS_TIMESTEP

  // 穴を含む大きな床を1枚置くと落下できなくなるため、穴を除いた矩形ごとに固定する。
  for (const floor of stage.floors) {
    world.createCollider(
      rapier.ColliderDesc.cuboid(
        floor.width / 2,
        FLOOR_THICKNESS / 2,
        floor.depth / 2,
      )
        .setTranslation(floor.x, -FLOOR_THICKNESS / 2, floor.z)
        .setFriction(FLOOR_FRICTION)
        .setRestitution(WALL_RESTITUTION),
    )
  }

  // Gマスは通常床から抜いて、球がわずかに沈む浅い円形のカップ底を置く。
  // 深い穴や段差にはせず、国旗が見えたまま自然に「カップイン」できる深さにする。
  world.createCollider(
    rapier.ColliderDesc.cylinder(FLOOR_THICKNESS / 2, GOAL_CUP_RADIUS)
      .setTranslation(
        stage.goal.x,
        GOAL_CUP_FLOOR_Y - FLOOR_THICKNESS / 2,
        stage.goal.z,
      )
      .setFriction(FLOOR_FRICTION)
      .setRestitution(WALL_RESTITUTION),
  )

  for (const wall of stage.walls) {
    world.createCollider(
      rapier.ColliderDesc.cuboid(wall.width / 2, WALL_HEIGHT / 2, wall.depth / 2)
        .setTranslation(wall.x, WALL_HEIGHT / 2, wall.z)
        .setFriction(WALL_FRICTION)
        .setRestitution(WALL_RESTITUTION),
    )
  }

  // terrainは親RigidBodyを持たない固定Colliderにし、既存の床・壁と同じ安定した手触りにする。
  for (const box of stage.terrain.boxes) {
    world.createCollider(
      rapier.ColliderDesc.cuboid(box.width / 2, box.height / 2, box.depth / 2)
        .setTranslation(box.x, box.y, box.z)
        .setRotation(quaternionAroundX(box.rotationX))
        // 柵やガードは引っかかりにくくし、天面は従来の床と同じ転がりやすさを保つ。
        .setFriction(box.style === 'guard' ? WALL_FRICTION : FLOOR_FRICTION)
        .setRestitution(WALL_RESTITUTION),
    )
  }

  for (const bar of stage.terrain.bars) {
    // Rapierの円柱はY軸方向なので、Z軸まわりに90°回してX軸方向の丸棒にする。
    world.createCollider(
      rapier.ColliderDesc.cylinder(bar.length / 2, bar.radius)
        .setTranslation(bar.x, bar.y, bar.z)
        .setRotation(quaternionAroundZ(Math.PI / 2))
        .setFriction(WALL_FRICTION)
        .setRestitution(WALL_RESTITUTION),
    )
  }

  for (const jumpPad of stage.gimmicks.jumpPads) {
    // 通路を横切る固定Colliderにし、上面だけを既定の床より0.12だけ高くする。
    world.createCollider(
      rapier.ColliderDesc.cuboid(
        jumpPad.halfWidth,
        jumpPad.top / 2,
        jumpPad.halfDepth,
      )
        .setTranslation(jumpPad.center.x, jumpPad.top / 2, jumpPad.center.z)
        .setFriction(FLOOR_FRICTION)
        .setRestitution(WALL_RESTITUTION),
    )
  }

  // 大砲は専用のColliderを持たない。
  // 砲室に壁を足すと、進入側に置けばボールが捕捉半径へ入る前に止まってしまい、
  // 発射側に置けば撃ち出したボールが自分の壁へ激突する。どちらも詰みになる。
  // 行き止まりは既にコース側の尾根(athletic-cannon-ridge)が作っており、
  // ボールはそこへ着く前に捕捉半径へ入るので、素通りは構造的に起こらない。

  const spinners: MazeWorld['spinners'] = []
  for (const gimmick of stage.gimmicks.spinners) {
    const body = world.createRigidBody(
      rapier.RigidBodyDesc.kinematicPositionBased()
        .setTranslation(gimmick.center.x, gimmick.height / 2, gimmick.center.z)
        .setRotation(quaternionAroundY(gimmick.initialAngle)),
    )
    world.createCollider(
      rapier.ColliderDesc.cuboid(
        gimmick.length / 2,
        gimmick.height / 2,
        gimmick.thickness / 2,
      )
        .setFriction(SPINNER_FRICTION)
        .setRestitution(SPINNER_RESTITUTION),
      body,
    )
    spinners.push({ gimmick, body })
  }

  const cars: MazeWorld['cars'] = []
  for (const gimmick of stage.gimmicks.cars) {
    const body = world.createRigidBody(
      rapier.RigidBodyDesc.kinematicPositionBased().setTranslation(
        carXAt(gimmick, 0),
        gimmick.center.y,
        gimmick.center.z,
      ),
    )
    world.createCollider(
      rapier.ColliderDesc.roundCuboid(
        CAR_WIDTH / 2 - CAR_BODY_ROUND,
        CAR_BODY_HEIGHT / 2 - CAR_BODY_ROUND,
        CAR_DEPTH / 2 - CAR_BODY_ROUND,
        CAR_BODY_ROUND,
      )
        .setFriction(CAR_FRICTION)
        .setRestitution(CAR_RESTITUTION),
      body,
    )
    // 屋根を円柱にして平らな天面をなくす。flag-pinball/carToy.tsで得た知見どおり、
    // 真上から落ちたボールが車の上で静止せず、自然に横へ転がり落ちるようにする。
    world.createCollider(
      rapier.ColliderDesc.cylinder(CAR_WIDTH * 0.28, CAR_CABIN_RADIUS)
        .setTranslation(
          0,
          CAR_BODY_HEIGHT / 2 + CAR_CABIN_RADIUS * 0.55,
          0,
        )
        .setRotation(quaternionAroundZ(Math.PI / 2))
        .setFriction(CAR_FRICTION)
        .setRestitution(CAR_RESTITUTION),
      body,
    )
    cars.push({ gimmick, body })
  }

  for (const bumper of stage.gimmicks.bumpers) {
    // 親RigidBodyを持たないColliderは固定物なので、バンパー用の剛体を増やさずに済む。
    world.createCollider(
      rapier.ColliderDesc.cylinder(BUMPER_HEIGHT / 2, bumper.radius)
        .setTranslation(bumper.center.x, BUMPER_HEIGHT / 2, bumper.center.z)
        .setFriction(BUMPER_FRICTION)
        .setRestitution(BUMPER_RESTITUTION),
    )
  }

  const spawn = ballSpawnPosition(stage.start)
  const ball = world.createRigidBody(
    rapier.RigidBodyDesc.dynamic()
      .setTranslation(spawn.x, spawn.y, spawn.z)
      .setLinearDamping(BALL_LINEAR_DAMPING)
      .setAngularDamping(BALL_ANGULAR_DAMPING)
      // 速い場面でも壁を通り抜けないよう連続衝突判定を有効にする。
      .setCcdEnabled(true)
      // 傾きを止めたまま眠らせると次の入力への反応が遅れるため、sleepさせない。
      .setCanSleep(false),
  )
  world.createCollider(
    rapier.ColliderDesc.ball(BALL_RADIUS)
      .setMass(BALL_MASS)
      .setFriction(BALL_FRICTION)
      .setRestitution(BALL_RESTITUTION),
    ball,
  )

  return { world, ball, stage, spinners, cars }
}

/** Y軸まわりの回転だけを扱うため、Rapierの型に依存しないリテラルで作る。 */
function quaternionAroundY(angle: number): { x: number; y: number; z: number; w: number } {
  return {
    x: 0,
    y: Math.sin(angle / 2),
    z: 0,
    w: Math.cos(angle / 2),
  }
}

/** X軸まわりの回転を、Rapierの型に依存しないリテラルで作る。 */
function quaternionAroundX(angle: number): { x: number; y: number; z: number; w: number } {
  return {
    x: Math.sin(angle / 2),
    y: 0,
    z: 0,
    w: Math.cos(angle / 2),
  }
}

/** Z軸まわりの回転を、Rapierの型に依存しないリテラルで作る。 */
function quaternionAroundZ(angle: number): { x: number; y: number; z: number; w: number } {
  return {
    x: 0,
    y: 0,
    z: Math.sin(angle / 2),
    w: Math.cos(angle / 2),
  }
}

/**
 * 物理ステップ直前に、絶対時刻から決めた角度を回転棒へ渡す。
 * 前フレームの角度へ加算しないので、フレーム落ちがあっても回転のずれが蓄積しない。
 */
export function advanceSpinners(
  spinners: MazeWorld['spinners'],
  elapsedSeconds: number,
): void {
  for (const { gimmick, body } of spinners) {
    body.setNextKinematicRotation(
      quaternionAroundY(spinnerAngleAt(gimmick, elapsedSeconds)),
    )
  }
}

/**
 * 物理ステップ直前に、絶対時刻で決めた車の次位置を渡す。
 * kinematicPositionBasedはRapierが現在位置との差から速度を求めるため、
 * flag-pinball/carToy.tsのBody.setVelocityと同じく衝突解決へ車の移動速度が伝わる。
 */
export function advanceCars(
  cars: MazeWorld['cars'],
  elapsedSeconds: number,
): void {
  for (const { gimmick, body } of cars) {
    body.setNextKinematicTranslation({
      x: carXAt(gimmick, elapsedSeconds),
      y: gimmick.center.y,
      z: gimmick.center.z,
    })
  }
}

/**
 * バンパーへ触れたボールへ外向きの一定インパルスを加える。
 * コライダーの反発だけでは低速時の「ポン！」が弱いため、速度に依存しないキックを重ねる。
 */
export function applyBumperKicks(
  ball: RigidBody,
  bumpers: readonly BumperGimmick[],
  cooldowns: BumperCooldowns,
  nowMs: number,
): string[] {
  const kicked: string[] = []
  const position = ball.translation()

  for (const bumper of bumpers) {
    if (!canKickBumper(cooldowns, bumper.id, nowMs)) continue
    const kick = bumperKick(position, bumper)
    if (kick === null) continue

    ball.applyImpulse(kick, true)
    markBumperKicked(cooldowns, bumper.id, nowMs)
    kicked.push(bumper.id)
  }

  return kicked
}

/**
 * ジャンプ床が返した発射速度をボールへ直接書き込み、同じ床での連続発火は短く抑える。
 * 失敗して手前へ落ちてもすぐ再挑戦できるよう、バンパーと同じMap型に短い420msを渡す。
 */
export function applyJumpPadLaunches(
  ball: RigidBody,
  jumpPads: readonly JumpPadGimmick[],
  cooldowns: BumperCooldowns,
  nowMs: number,
): string[] {
  const launched: string[] = []
  const position = ball.translation()
  const velocity = ball.linvel()

  for (const jumpPad of jumpPads) {
    if (!canKickBumper(cooldowns, jumpPad.id, nowMs, JUMP_PAD_COOLDOWN_MS)) {
      continue
    }
    const launch = jumpPadLaunch(position, velocity, jumpPad)
    if (launch === null) continue

    ball.setLinvel(launch, true)
    markBumperKicked(cooldowns, jumpPad.id, nowMs)
    launched.push(jumpPad.id)
  }

  return launched
}

/**
 * 捕捉中は砲室中心へ少しずつ寄せながら速度を止め、大砲内部でボールが暴れるのを防ぐ。
 */
export function settleBallIntoCannon(ball: RigidBody, cannon: CannonGimmick): void {
  const current = ball.translation()
  const chamber = cannonChamberPosition(cannon)
  ball.setTranslation(
    {
      x: current.x + (chamber.x - current.x) * CANNON_SETTLE_LERP,
      y: current.y + (chamber.y - current.y) * CANNON_SETTLE_LERP,
      z: current.z + (chamber.z - current.z) * CANNON_SETTLE_LERP,
    },
    true,
  )
  ball.setLinvel({ x: 0, y: 0, z: 0 }, true)
  ball.setAngvel({ x: 0, y: 0, z: 0 }, true)
}

/** 砲室中心から速度を直接指定して発射し、物理ステップ幅で飛距離が変わらないようにする。 */
export function fireCannon(ball: RigidBody, cannon: CannonGimmick): void {
  ball.setTranslation(cannonChamberPosition(cannon), true)
  ball.setLinvel(cannonLaunchVelocity(cannon), true)
  ball.setAngvel({ x: 0, y: 0, z: 0 }, true)
}

/** 傾き入力を重力へ反映する。盤面コライダーは動かさない。 */
export function applyTiltToGravity(world: World, tilt: TiltInput): void {
  world.gravity = gravityFromTilt(tilt)
}

/** 速度上限を超えたら方向を保ったまま抑える。抑えたときだけ true。 */
export function limitBallSpeed(ball: RigidBody, maxSpeed = MAX_BALL_SPEED): boolean {
  const limited = clampSpeed(ball.linvel(), maxSpeed)
  if (limited === null) return false
  ball.setLinvel(limited, true)
  return true
}

/**
 * 浅いカップの中心付近かつ、球がカップ底へ沈み始めた高さで判定する。
 * 見た目ではまだ縁にいる段階で結果表示へ切り替わることを防ぐ。
 */
export function isGoalReached(
  position: PhysicsVector,
  goal: MazePoint,
  radius = GOAL_RADIUS,
  maxY = GOAL_REACHED_MAX_Y,
): boolean {
  return (
    Math.hypot(position.x - goal.x, position.z - goal.z) <= radius &&
    position.y <= maxY
  )
}

/**
 * カップイン後の残った横方向の勢いだけを止める。
 * 従来のジャンプ演出は使わず、国旗ボールを浅いカップ内に安定して見せ続ける。
 */
export function settleBallInGoalCup(ball: RigidBody): void {
  const velocity = ball.linvel()
  ball.setLinvel(
    { x: 0, y: Math.min(velocity.y, 0), z: 0 },
    true,
  )
  const angularVelocity = ball.angvel()
  ball.setAngvel(
    { x: angularVelocity.x * 0.12, y: angularVelocity.y * 0.12, z: angularVelocity.z * 0.12 },
    true,
  )
}

/** ボールをスタートへ戻し、勢いも完全に消す。リトライと場外復帰の両方で使う。 */
export function resetBall(ball: RigidBody, start: MazeStage['start']): void {
  const spawn = ballSpawnPosition(start)
  ball.setTranslation(spawn, true)
  ball.setLinvel({ x: 0, y: 0, z: 0 }, true)
  ball.setAngvel({ x: 0, y: 0, z: 0 }, true)
  ball.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true)
}

/** 回転棒の中心から外向きへ押し出し、回され続ける状態から抜けさせる。 */
export function pushBallOutOfSpinner(
  ball: RigidBody,
  spinner: SpinnerGimmick,
  strength = 1.6,
): void {
  const position = ball.translation()
  const dx = position.x - spinner.center.x
  const dz = position.z - spinner.center.z
  const distance = Math.hypot(dx, dz)
  if (distance === 0) return

  ball.applyImpulse(
    {
      x: (dx / distance) * strength,
      y: 0,
      z: (dz / distance) * strength,
    },
    true,
  )
}

/**
 * 万一止まってしまったボールへ、傾けている方向にごく弱い力を加える。
 * 幼児が「動かない」まま諦めないための保険で、通常の転がりには影響しない大きさにする。
 */
export function nudgeBall(ball: RigidBody, tilt: TiltInput, strength = 0.12): void {
  const length = Math.hypot(tilt.x, tilt.y)
  if (length === 0) return
  ball.applyImpulse(
    {
      x: (tilt.x / length) * strength,
      y: 0,
      z: (tilt.y / length) * strength,
    },
    true,
  )
}
