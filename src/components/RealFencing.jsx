import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Environment, OrbitControls, PointerLockControls } from '@react-three/drei';
import { Physics, RigidBody, CuboidCollider, CapsuleCollider, BallCollider } from '@react-three/rapier';
import * as THREE from 'three';

const ROUND_DURATION_SECONDS = 180;
const LIGHT_DURATION_MS = 2000;
const ROAMING_SPAWN = { x: 0, y: 1.02, z: 4.8 };
const PLAYER_SPAWN = { x: 0, y: 1.02, z: 2 };
const OPPONENT_SPAWN = { x: 0, y: 1.02, z: -2 };
const CAMERA_HEIGHT = 0.68;
const HALL_LIMIT = 6.2;
const PISTE_HALF_WIDTH = 0.95;
const PISTE_HALF_LENGTH = 6.7;
const ROAM_SPEED = 4.1;
const FENCE_SPEED = 2.75;
const AI_SPEED = 1.9;
const HIT_WINDOW_MS = 40;
const HALT_MS = 2000;

const UP = new THREE.Vector3(0, 1, 0);
const FORWARD = new THREE.Vector3();
const RIGHT = new THREE.Vector3();
const MOVE = new THREE.Vector3();
const CAMERA_POS = new THREE.Vector3();
const LOOK_AT = new THREE.Vector3();
const ZERO = { x: 0, y: 0, z: 0 };
const EMPTY_LIGHTS = { player: false, opponent: false };
const EMPTY_CARDS = {
  player: { yellow: false, red: false, black: false },
  opponent: { yellow: false, red: false, black: false },
};

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function formatTime(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function resetBody(body, spawn) {
  if (!body) return;
  body.setTranslation({ x: spawn.x, y: spawn.y, z: spawn.z }, true);
  body.setLinvel(ZERO, true);
  body.setAngvel(ZERO, true);
}

// 1. UI 闁喚鍍电紒鍕
function LightDot({ active, colorClass }) {
  return <div className={`h-3.5 w-3.5 rounded-full border border-white/40 ${active ? colorClass : 'bg-white/10'}`} />;
}

function PenaltyStrip({ label, active, className }) {
  return (
    <div
      className={`h-6 w-4 rounded-sm border border-white/40 shadow ${active ? className : 'bg-white/10'}`}
      title={label}
    />
  );
}

function FloatingToolbar({
  gameMode,
  gameState,
  score,
  timeLeft,
  hitLights,
  penaltyCards,
  pointerLocked,
  onModeChange,
  onRestart,
}) {
  const toggleLabel = gameMode === 'ROAMING' ? 'Roaming -> Start Match' : 'Fencing -> Back To Roam';

  return (
    <div className="pointer-events-none absolute top-4 left-1/2 z-20 w-[min(96%,1100px)] -translate-x-1/2">
      <div className="pointer-events-auto rounded-xl border border-white/20 bg-stone-900/50 text-stone-100 shadow-2xl backdrop-blur-md">
        <div className="flex flex-wrap items-center justify-between gap-4 px-4 py-3 md:px-5">
          <div>
            <div className="text-[11px] uppercase tracking-[0.35em] text-amber-200/80">
              Castle Fencing Toolbar
            </div>
            <div className="mt-1 text-base font-semibold md:text-lg">
              {gameMode === 'ROAMING' ? 'Castle Hall Third-Person Roaming' : 'Fencing First-Person Match'}
            </div>
            <div className="mt-1 text-xs text-stone-300/90">
              {gameMode === 'ROAMING'
                ? 'Drag to orbit the camera. WASD follows the current viewing direction.'
                : pointerLocked
                  ? 'First-person view is locked. Press Esc to release.'
                  : 'Click Enter First-Person to enable stable match camera control.'}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {gameMode === 'FENCING' && (
              <button
                id="fencing-lock-button"
                type="button"
                className="rounded-lg border border-amber-200/35 bg-amber-100/10 px-3 py-2 text-sm text-amber-50 transition hover:bg-amber-100/20"
              >
                {pointerLocked ? 'First-Person Active' : 'Enter First-Person'}
              </button>
            )}
            <button
              type="button"
              onClick={onModeChange}
              className="rounded-lg bg-stone-100/90 px-3 py-2 text-sm font-medium text-stone-900 transition hover:bg-white"
            >
              {toggleLabel}
            </button>
            <button
              type="button"
              onClick={onRestart}
              className="rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm transition hover:bg-white/20"
            >
              Restart
            </button>
          </div>
        </div>

        <div className="grid gap-3 border-t border-white/10 px-4 py-3 md:grid-cols-[1.1fr_0.9fr_1fr_1.2fr] md:px-5">
          <div className="rounded-lg bg-black/15 px-3 py-2">
            <div className="text-xs uppercase tracking-[0.25em] text-stone-300">Score</div>
            <div className="mt-1 flex items-center gap-3 text-2xl font-bold">
              <span>{score.player}</span>
              <span className="text-stone-400">:</span>
              <span>{score.opponent}</span>
            </div>
          </div>

          <div className="rounded-lg bg-black/15 px-3 py-2">
            <div className="text-xs uppercase tracking-[0.25em] text-stone-300">Countdown</div>
            <div className="mt-1 text-2xl font-bold">{formatTime(timeLeft)}</div>
            <div className="mt-1 text-xs text-stone-300">
              {gameMode === 'FENCING' && gameState === 'PLAYING' ? 'Timer running' : 'Timer paused'}
            </div>
          </div>

          <div className="rounded-lg bg-black/15 px-3 py-2">
            <div className="text-xs uppercase tracking-[0.25em] text-stone-300">Hit Lights</div>
            <div className="mt-2 flex items-center gap-4">
              <div className="flex items-center gap-2 text-sm">
                <LightDot
                  active={hitLights.player}
                  colorClass="bg-emerald-400 shadow-[0_0_16px_rgba(52,211,153,0.9)]"
                />
                <span>Player Light</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <LightDot
                  active={hitLights.opponent}
                  colorClass="bg-red-400 shadow-[0_0_16px_rgba(248,113,113,0.9)]"
                />
                <span>Opponent Light</span>
              </div>
            </div>
          </div>

          <div className="rounded-lg bg-black/15 px-3 py-2">
            <div className="text-xs uppercase tracking-[0.25em] text-stone-300">Penalty Cards</div>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <div className="flex items-center justify-between gap-2 rounded-md bg-white/5 px-2 py-1.5">
                <span className="text-sm">Player</span>
                <div className="flex gap-1.5">
                  <PenaltyStrip label="Yellow card" active={penaltyCards.player.yellow} className="bg-yellow-400" />
                  <PenaltyStrip label="Red card" active={penaltyCards.player.red} className="bg-red-500" />
                  <PenaltyStrip label="Black card" active={penaltyCards.player.black} className="bg-black" />
                </div>
              </div>
              <div className="flex items-center justify-between gap-2 rounded-md bg-white/5 px-2 py-1.5">
                <span className="text-sm">Opponent</span>
                <div className="flex gap-1.5">
                  <PenaltyStrip label="Yellow card" active={penaltyCards.opponent.yellow} className="bg-yellow-400" />
                  <PenaltyStrip label="Red card" active={penaltyCards.opponent.red} className="bg-red-500" />
                  <PenaltyStrip label="Black card" active={penaltyCards.opponent.black} className="bg-black" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function HelmetMask() {
  return (
    <div className="pointer-events-none absolute inset-0 z-10">
      <svg className="h-full w-full opacity-50" viewBox="0 0 100 100" preserveAspectRatio="none">
        <defs>
          <linearGradient id="maskShade" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="rgba(0,0,0,0.9)" />
            <stop offset="28%" stopColor="rgba(0,0,0,0.28)" />
            <stop offset="72%" stopColor="rgba(0,0,0,0.16)" />
            <stop offset="100%" stopColor="rgba(0,0,0,0.82)" />
          </linearGradient>
        </defs>
        <rect width="100" height="100" fill="url(#maskShade)" />
        {Array.from({ length: 14 }, (_, index) => {
          const x = 13 + index * 5.7;
          return <path key={`v-${x}`} d={`M${x} 7 Q${x - 2} 50 ${x} 93`} fill="none" stroke="black" strokeWidth="1.35" />;
        })}
        {Array.from({ length: 10 }, (_, index) => {
          const y = 14 + index * 7.7;
          return <path key={`h-${y}`} d={`M8 ${y} Q50 ${y - 4} 92 ${y}`} fill="none" stroke="black" strokeWidth="1" />;
        })}
      </svg>
    </div>
  );
}

// 2. RealisticCastle 閸︾儤娅欑紒鍕 (閸︾増婢橀妴浣割暰婢逛降鈧礁鍘滆ぐ?
function RealisticCastle() {
  return (
    <group>
      <mesh receiveShadow position={[0, -0.05, 0]}>
        <boxGeometry args={[15, 0.1, 15]} />
        <meshPhysicalMaterial
          color="#d4c5b0"
          roughness={0.1}
          metalness={0.2}
          clearcoat={0.24}
          clearcoatRoughness={0.22}
          reflectivity={0.65}
        />
      </mesh>
      <mesh castShadow receiveShadow position={[0, 3.5, -7.25]}>
        <boxGeometry args={[15, 7.2, 0.45]} />
        <meshStandardMaterial color="#c8b39d" roughness={0.9} metalness={0.04} />
      </mesh>
      <mesh castShadow receiveShadow position={[0, 3.5, 7.25]}>
        <boxGeometry args={[15, 7.2, 0.45]} />
        <meshStandardMaterial color="#c8b39d" roughness={0.9} metalness={0.04} />
      </mesh>
      <mesh castShadow receiveShadow position={[-7.25, 3.5, 0]}>
        <boxGeometry args={[0.45, 7.2, 15]} />
        <meshStandardMaterial color="#c5af98" roughness={0.92} metalness={0.03} />
      </mesh>
      <mesh castShadow receiveShadow position={[7.25, 3.5, 0]}>
        <boxGeometry args={[0.45, 7.2, 15]} />
        <meshStandardMaterial color="#c5af98" roughness={0.92} metalness={0.03} />
      </mesh>
      <mesh castShadow receiveShadow position={[0, 7.1, 0]}>
        <boxGeometry args={[15, 0.35, 15]} />
        <meshStandardMaterial color="#bca791" roughness={0.96} metalness={0.03} />
      </mesh>

      <group position={[0, 0, -7.02]}>
        <mesh castShadow receiveShadow position={[-4.7, 3.6, 0.12]}>
          <boxGeometry args={[5.3, 7.1, 0.72]} />
          <meshStandardMaterial color="#ccb7a2" roughness={0.92} metalness={0.03} />
        </mesh>
        <mesh castShadow receiveShadow position={[4.7, 3.6, 0.12]}>
          <boxGeometry args={[5.3, 7.1, 0.72]} />
          <meshStandardMaterial color="#ccb7a2" roughness={0.92} metalness={0.03} />
        </mesh>
        <mesh castShadow receiveShadow position={[0, 6.35, 0.12]}>
          <boxGeometry args={[15, 1.55, 0.72]} />
          <meshStandardMaterial color="#c8b39d" roughness={0.92} metalness={0.03} />
        </mesh>
        <mesh castShadow receiveShadow position={[-1.55, 2.5, 0.18]}>
          <boxGeometry args={[1.15, 5, 0.82]} />
          <meshStandardMaterial color="#ccb7a2" roughness={0.92} metalness={0.03} />
        </mesh>
        <mesh castShadow receiveShadow position={[1.55, 2.5, 0.18]}>
          <boxGeometry args={[1.15, 5, 0.82]} />
          <meshStandardMaterial color="#ccb7a2" roughness={0.92} metalness={0.03} />
        </mesh>
        <mesh castShadow receiveShadow position={[0, 4.7, 0.18]}>
          <boxGeometry args={[4.2, 0.48, 0.82]} />
          <meshStandardMaterial color="#ccb7a2" roughness={0.92} metalness={0.03} />
        </mesh>
      </group>

      {[-4.4, 4.4].map((x) => (
        <group key={x} position={[x, 4.05, -7.01]}>
          <mesh castShadow receiveShadow>
            <boxGeometry args={[1, 3.3, 0.18]} />
            <meshStandardMaterial color="#d7c8b6" roughness={0.88} metalness={0.03} />
          </mesh>
          <mesh position={[0, 0.05, 0.12]}>
            <boxGeometry args={[0.48, 2.5, 0.04]} />
            <meshStandardMaterial
              color="#635b54"
              emissive="#f3debf"
              emissiveIntensity={0.28}
              roughness={0.22}
              metalness={0.1}
            />
          </mesh>
          <mesh position={[0, 1.55, 0.12]} rotation={[0, 0, Math.PI / 4]}>
            <boxGeometry args={[0.36, 0.36, 0.04]} />
            <meshStandardMaterial
              color="#635b54"
              emissive="#f3debf"
              emissiveIntensity={0.22}
              roughness={0.22}
              metalness={0.1}
            />
          </mesh>
        </group>
      ))}

      <mesh castShadow receiveShadow position={[0, 0.02, -2.2]}>
        <boxGeometry args={[2.8, 0.04, 5.8]} />
        <meshStandardMaterial color="#6f3e3a" roughness={0.9} metalness={0.04} />
      </mesh>

      {[
        [-6.2, 2.2, 2.2],
        [6.2, 2.2, -1.5],
      ].map((position, index) => (
        <group key={index} position={position}>
          <mesh castShadow>
            <boxGeometry args={[0.18, 0.75, 0.16]} />
            <meshStandardMaterial color="#705b48" roughness={0.76} metalness={0.12} />
          </mesh>
          <mesh castShadow position={[0, 0.45, 0.16]}>
            <sphereGeometry args={[0.12, 20, 20]} />
            <meshStandardMaterial
              color="#ffd39b"
              emissive="#f5cc85"
              emissiveIntensity={1.8}
              roughness={0.2}
              metalness={0.05}
            />
          </mesh>
          <pointLight
            castShadow
            color="#f5cc85"
            intensity={18}
            distance={10}
            decay={2}
            position={[0, 0.55, 0.5]}
          />
        </group>
      ))}

      <ambientLight color="#f5ede0" intensity={0.22} />
      <directionalLight
        castShadow
        color="#fff3dc"
        intensity={1.15}
        position={[3.5, 7.8, -2.6]}
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-near={0.5}
        shadow-camera-far={25}
        shadow-camera-left={-12}
        shadow-camera-right={12}
        shadow-camera-top={12}
        shadow-camera-bottom={-12}
      />
      <pointLight color="#f5cc85" intensity={6} distance={12} decay={2} position={[-2.5, 3.8, 1.8]} />
    </group>
  );
}

// 3. Piste 閸撴垿浜剧紒鍕
function PisteLine({ position, size, color = '#f2f3f4' }) {
  return (
    <mesh position={position} receiveShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial color={color} roughness={0.55} metalness={0.18} />
    </mesh>
  );
}

function Piste() {
  return (
    <group>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[1, 0.025, 7]} position={[0, 0.025, 0]} />
        <mesh castShadow receiveShadow position={[0, 0.025, 0]}>
          <boxGeometry args={[2, 0.05, 14]} />
          <meshStandardMaterial color="#a0a4a8" metalness={0.6} roughness={0.4} />
        </mesh>
      </RigidBody>
      <PisteLine position={[0, 0.052, 0]} size={[1.9, 0.002, 0.08]} />
      <PisteLine position={[0, 0.052, 2]} size={[1.9, 0.002, 0.08]} />
      <PisteLine position={[0, 0.052, -2]} size={[1.9, 0.002, 0.08]} />
      <PisteLine position={[0, 0.052, 5]} size={[1.9, 0.002, 0.08]} />
      <PisteLine position={[0, 0.052, -5]} size={[1.9, 0.002, 0.08]} />
      <PisteLine position={[0, 0.052, 6.25]} size={[1.9, 0.002, 1.5]} color="#a3473d" />
      <PisteLine position={[0, 0.052, -6.25]} size={[1.9, 0.002, 1.5]} color="#a3473d" />
    </group>
  );
}

// 4. Fencer 娴滆櫣澧挎稉搴″ⅳ缂佸嫪娆?(閸栧懎鎯堥崚姘秼閸滃本顒熼崳?
function FencerModel({ swordRef, bodyVisible, sensorName, onTipEnter, facingRotation, isPlayer }) {
  return (
    <group rotation={[0, facingRotation, 0]}>
      {bodyVisible && (
        <>
          <mesh castShadow position={[0, 0.05, 0]}>
            <capsuleGeometry args={[0.24, 1.05, 10, 18]} />
            <meshStandardMaterial color="#ffffff" roughness={0.5} metalness={0.05} />
          </mesh>
          <mesh castShadow position={[0, 0.86, 0]}>
            <sphereGeometry args={[0.18, 24, 24]} />
            <meshStandardMaterial color="#f4f4f4" roughness={0.52} metalness={0.06} />
          </mesh>
          <mesh castShadow position={[0, 0.86, 0.09]}>
            <boxGeometry args={[0.27, 0.24, 0.08]} />
            <meshStandardMaterial color="#121212" roughness={0.72} metalness={0.18} />
          </mesh>
        </>
      )}

      <group ref={swordRef} position={isPlayer ? [0.24, 0.48, 0.16] : [0.22, 0.48, 0.12]}>
        <mesh castShadow position={[0, 0, 0.06]}>
          <boxGeometry args={[0.14, 0.08, 0.18]} />
          <meshStandardMaterial color="#5c4a3c" roughness={0.68} metalness={0.16} />
        </mesh>
        <mesh castShadow position={[0, 0, 0.19]}>
          <boxGeometry args={[0.24, 0.028, 0.08]} />
          <meshStandardMaterial color="#d3b07b" roughness={0.35} metalness={0.62} />
        </mesh>
        <mesh castShadow rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0.79]}>
          <cylinderGeometry args={[0.02, 0.02, 1.2, 16]} />
          <meshStandardMaterial metalness={1} roughness={0.1} color="silver" />
        </mesh>
        <BallCollider
          sensor
          name={sensorName}
          userData={{ role: sensorName }}
          args={[0.055]}
          position={[0, 0, 1.39]}
          onIntersectionEnter={onTipEnter}
        />
      </group>
    </group>
  );
}

function Fencer({
  bodyRef,
  swordRef,
  colliderName,
  onTipEnter,
  position,
  facingRotation,
  bodyVisible,
  isPlayer,
}) {
  const characterId = colliderName === 'player-body' ? 'player' : 'opponent';

  return (
    <RigidBody
      ref={bodyRef}
      colliders={false}
      mass={1.1}
      friction={2.2}
      restitution={0.02}
      linearDamping={5.5}
      angularDamping={9}
      enabledRotations={[false, false, false]}
      canSleep={false}
      position={position}
    >
      <CapsuleCollider args={[0.6, 0.27]} name={colliderName} userData={{ characterId }} />
      <FencerModel
        swordRef={swordRef}
        bodyVisible={bodyVisible}
        sensorName={`${characterId}-tip`}
        onTipEnter={onTipEnter}
        facingRotation={facingRotation}
        isPlayer={isPlayer}
      />
    </RigidBody>
  );
}

function SceneSystem({
  gameMode,
  gameState,
  playerBodyRef,
  opponentBodyRef,
  playerSwordRef,
  opponentSwordRef,
  keysRef,
  mouseAimRef,
  playerActionRef,
  opponentActionRef,
  aiRef,
  orbitRef,
}) {
  const { camera } = useThree();

  useEffect(() => {
    const player = playerBodyRef.current?.translation() ?? (gameMode === 'ROAMING' ? ROAMING_SPAWN : PLAYER_SPAWN);
    if (gameMode === 'ROAMING') {
      camera.position.set(player.x, player.y + 2.4, player.z + 5.2);
      LOOK_AT.set(player.x, player.y + 0.75, player.z);
      camera.lookAt(LOOK_AT);
    } else {
      camera.position.set(player.x, player.y + CAMERA_HEIGHT, player.z + 0.05);
      camera.lookAt(0, 1.6, -2);
    }
  }, [camera, gameMode, playerBodyRef]);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    const playerBody = playerBodyRef.current;
    const opponentBody = opponentBodyRef.current;
    const playerSword = playerSwordRef.current;
    const opponentSword = opponentSwordRef.current;
    const orbit = orbitRef.current;
    if (!playerBody || !opponentBody || !playerSword || !opponentSword) return;

    const playerTranslation = playerBody.translation();
    const opponentTranslation = opponentBody.translation();
    const playerVelocity = playerBody.linvel();
    const opponentVelocity = opponentBody.linvel();

    if (gameMode === 'FENCING') {
      CAMERA_POS.set(playerTranslation.x, playerTranslation.y + CAMERA_HEIGHT, playerTranslation.z);
      camera.position.copy(CAMERA_POS);
    }

    camera.getWorldDirection(FORWARD);
    FORWARD.y = 0;
    if (FORWARD.lengthSq() < 0.0001) FORWARD.set(0, 0, -1);
    FORWARD.normalize();
    RIGHT.crossVectors(FORWARD, UP).normalize();
    MOVE.set(0, 0, 0);

    if (gameState === 'PLAYING') {
      if (keysRef.current.KeyW) MOVE.add(FORWARD);
      if (keysRef.current.KeyS) MOVE.sub(FORWARD);
      if (keysRef.current.KeyD) MOVE.add(RIGHT);
      if (keysRef.current.KeyA) MOVE.sub(RIGHT);
      if (MOVE.lengthSq() > 0) MOVE.normalize().multiplyScalar(gameMode === 'ROAMING' ? ROAM_SPEED : FENCE_SPEED);

      playerActionRef.current.motionLock = Math.max(playerActionRef.current.motionLock - dt, 0);
      playerBody.setLinvel(
        {
          x: MOVE.x,
          y: playerVelocity.y,
          z: playerActionRef.current.motionLock > 0 ? playerVelocity.z : MOVE.z,
        },
        true,
      );

      if (gameMode === 'ROAMING') {
        playerBody.setTranslation(
          {
            x: clamp(playerTranslation.x, -HALL_LIMIT, HALL_LIMIT),
            y: playerTranslation.y,
            z: clamp(playerTranslation.z, -HALL_LIMIT, HALL_LIMIT),
          },
          true,
        );
        opponentBody.setLinvel(ZERO, true);
      } else {
        playerBody.setTranslation(
          {
            x: clamp(playerTranslation.x, -PISTE_HALF_WIDTH, PISTE_HALF_WIDTH),
            y: playerTranslation.y,
            z: clamp(playerTranslation.z, -PISTE_HALF_LENGTH, PISTE_HALF_LENGTH),
          },
          true,
        );

        aiRef.current.attackCooldown -= dt;
        aiRef.current.strafeTimer -= dt;
        aiRef.current.motionLock = Math.max(aiRef.current.motionLock - dt, 0);
        const dx = playerTranslation.x - opponentTranslation.x;
        const dz = playerTranslation.z - opponentTranslation.z;

        if (aiRef.current.strafeTimer <= 0) {
          aiRef.current.strafeTimer = 0.7 + Math.random() * 1.1;
          aiRef.current.strafeDirection *= -1;
        }

        if (Math.abs(dz) < 2.25 && Math.random() < 0.012) {
          opponentActionRef.current.parry = 1;
        }

        if (aiRef.current.attackCooldown <= 0 && Math.abs(dz) < 3.25) {
          aiRef.current.attackCooldown = 1 + Math.random() * 1.15;
          opponentActionRef.current.thrust = 1;
          aiRef.current.motionLock = 0.22;
          opponentBody.applyImpulse({ x: 0, y: 0, z: 2.1 }, true);
        }

        opponentBody.setLinvel(
          {
            x: clamp(dx * 1.15 + aiRef.current.strafeDirection * 0.32, -0.78, 0.78) * AI_SPEED,
            y: opponentVelocity.y,
            z: aiRef.current.motionLock > 0 ? opponentVelocity.z : clamp(dz - 3.05, -1, 1) * AI_SPEED,
          },
          true,
        );
        opponentBody.setTranslation(
          {
            x: clamp(opponentTranslation.x, -PISTE_HALF_WIDTH, PISTE_HALF_WIDTH),
            y: opponentTranslation.y,
            z: clamp(opponentTranslation.z, -PISTE_HALF_LENGTH, PISTE_HALF_LENGTH),
          },
          true,
        );
      }
    } else {
      playerBody.setLinvel(ZERO, true);
      opponentBody.setLinvel(ZERO, true);
    }

    playerActionRef.current.thrust = Math.max(playerActionRef.current.thrust - dt * 2.45, 0);
    playerActionRef.current.parry = Math.max(playerActionRef.current.parry - dt * 2.15, 0);
    opponentActionRef.current.thrust = Math.max(opponentActionRef.current.thrust - dt * 2.2, 0);
    opponentActionRef.current.parry = Math.max(opponentActionRef.current.parry - dt * 2.05, 0);

    const thrustOffset = Math.sin((1 - playerActionRef.current.thrust) * Math.PI) * 0.9;
    const parryOffset = Math.sin((1 - playerActionRef.current.parry) * Math.PI) * 0.72;
    const targetYaw = gameMode === 'FENCING' ? clamp(mouseAimRef.current.x, -0.65, 0.65) : 0.12;

    // 姒х姵鐖ｆ潏鎾冲弳閸忓牆褰夐幋?aim 閸嬪繒些閿涘苯鍟€閺勭姴鐨犻崚鏉垮ⅳ閻ㄥ嫬浜搁懜顏勬嫲娣囶垯璇濈憴鎺嬧偓?    // 鏉╂瑦鐗卞В鏃囩濡€崇础娑撳妫︽穱婵堟殌缁楊兛绔存禍铏剐炵憴鍡欏殠閿涘苯寮甸懗鍊燁唨閸撴垵鐨风捄鐔兼閹靛鍎撮惉鍕櫙閺傜懓鎮滅粔璇插З閵?    playerSword.rotation.x = THREE.MathUtils.lerp(playerSword.rotation.x, targetPitch + parryOffset * 0.16, 0.18);
    playerSword.rotation.y = THREE.MathUtils.lerp(playerSword.rotation.y, targetYaw + parryOffset * 0.8, 0.18);
    playerSword.rotation.z = THREE.MathUtils.lerp(playerSword.rotation.z, -parryOffset * 0.48, 0.18);
    playerSword.position.x = THREE.MathUtils.lerp(playerSword.position.x, 0.24 + parryOffset * 0.22, 0.18);
    playerSword.position.y = THREE.MathUtils.lerp(playerSword.position.y, 0.48 + mouseAimRef.current.y * 0.08, 0.18);
    playerSword.position.z = THREE.MathUtils.lerp(playerSword.position.z, 0.16 + thrustOffset, 0.2);

    const enemyThrust = Math.sin((1 - opponentActionRef.current.thrust) * Math.PI) * 0.82;
    const enemyParry = Math.sin((1 - opponentActionRef.current.parry) * Math.PI) * 0.55;
    const enemyYaw = clamp((playerTranslation.x - opponentTranslation.x) * 0.24, -0.45, 0.45);
    opponentSword.rotation.x = THREE.MathUtils.lerp(opponentSword.rotation.x, -0.05 + enemyParry * 0.12, 0.16);
    opponentSword.rotation.y = THREE.MathUtils.lerp(opponentSword.rotation.y, enemyYaw - enemyParry * 0.65, 0.16);
    opponentSword.rotation.z = THREE.MathUtils.lerp(opponentSword.rotation.z, enemyParry * 0.42, 0.16);
    opponentSword.position.x = THREE.MathUtils.lerp(opponentSword.position.x, 0.22 - enemyParry * 0.2, 0.16);
    opponentSword.position.z = THREE.MathUtils.lerp(opponentSword.position.z, 0.12 + enemyThrust, 0.18);

    if (gameMode === 'ROAMING') {
      if (orbit) {
        LOOK_AT.set(playerTranslation.x, playerTranslation.y + 0.75, playerTranslation.z);
        orbit.target.lerp(LOOK_AT, 0.18);
        orbit.update();
      }
    } else {
      LOOK_AT.set(opponentTranslation.x, opponentTranslation.y + 0.55, opponentTranslation.z);
      camera.lookAt(LOOK_AT);
    }
  });

  return null;
}

// 5. 娑撹崵绮嶆禒?RealFencing (閸栧懎鎯?Canvas 閸滃瞼澧块悶鍡曠瑯閻?
export default function RealFencing() {
  const [gameMode, setGameMode] = useState('ROAMING');
  const [gameState, setGameState] = useState('PLAYING');
  const [score, setScore] = useState({ player: 0, opponent: 0 });
  const [timeLeft, setTimeLeft] = useState(ROUND_DURATION_SECONDS);
  const [pointerLocked, setPointerLocked] = useState(false);
  const [hitLights, setHitLights] = useState(EMPTY_LIGHTS);
  const [penaltyCards, setPenaltyCards] = useState(EMPTY_CARDS);

  const containerRef = useRef(null);
  const orbitRef = useRef(null);
  const playerBodyRef = useRef(null);
  const opponentBodyRef = useRef(null);
  const playerSwordRef = useRef(null);
  const opponentSwordRef = useRef(null);
  const keysRef = useRef({});
  const mouseAimRef = useRef({ x: 0, y: 0 });
  const gameModeRef = useRef(gameMode);
  const gameStateRef = useRef(gameState);
  const playerActionRef = useRef({ thrust: 0, parry: 0, motionLock: 0 });
  const opponentActionRef = useRef({ thrust: 0, parry: 0 });
  const aiRef = useRef({ attackCooldown: 1.2, strafeTimer: 0.9, strafeDirection: 1, motionLock: 0 });
  const roundResolvedRef = useRef(false);
  const lastHitRef = useRef({ time: null, characterId: null });
  const pendingHitTimerRef = useRef(null);
  const resetTimerRef = useRef(null);
  const lightTimerRef = useRef(null);

  useEffect(() => {
    gameModeRef.current = gameMode;
  }, [gameMode]);

  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  const clearLightTimer = useCallback(() => {
    if (lightTimerRef.current) {
      window.clearTimeout(lightTimerRef.current);
      lightTimerRef.current = null;
    }
  }, []);

  const clearTimers = useCallback(() => {
    if (pendingHitTimerRef.current) window.clearTimeout(pendingHitTimerRef.current);
    if (resetTimerRef.current) window.clearTimeout(resetTimerRef.current);
    pendingHitTimerRef.current = null;
    resetTimerRef.current = null;
    clearLightTimer();
  }, [clearLightTimer]);

  const flashLights = useCallback(
    (winner) => {
      clearLightTimer();
      setHitLights({
        player: winner === 'player' || winner === 'double',
        opponent: winner === 'opponent' || winner === 'double',
      });
      lightTimerRef.current = window.setTimeout(() => {
        setHitLights(EMPTY_LIGHTS);
        lightTimerRef.current = null;
      }, LIGHT_DURATION_MS);
    },
    [clearLightTimer],
  );

  const resetForMode = useCallback((mode) => {
    mouseAimRef.current = { x: 0, y: 0 };
    playerActionRef.current = { thrust: 0, parry: 0, motionLock: 0 };
    opponentActionRef.current = { thrust: 0, parry: 0 };
    aiRef.current = {
      attackCooldown: 1 + Math.random() * 0.6,
      strafeTimer: 0.8 + Math.random() * 0.5,
      strafeDirection: 1,
      motionLock: 0,
    };
    resetBody(playerBodyRef.current, mode === 'ROAMING' ? ROAMING_SPAWN : PLAYER_SPAWN);
    resetBody(opponentBodyRef.current, OPPONENT_SPAWN);
  }, []);

  const resetRound = useCallback(() => {
    clearTimers();
    lastHitRef.current = { time: null, characterId: null };
    roundResolvedRef.current = false;
    setHitLights(EMPTY_LIGHTS);
    gameStateRef.current = 'PLAYING';
    setGameState('PLAYING');
    resetForMode(gameModeRef.current);
  }, [clearTimers, resetForMode]);

  const restartMatch = useCallback(() => {
    setScore({ player: 0, opponent: 0 });
    setTimeLeft(ROUND_DURATION_SECONDS);
    setHitLights(EMPTY_LIGHTS);
    setPenaltyCards(EMPTY_CARDS);
    resetRound();
  }, [resetRound]);

  const finalizeScore = useCallback(
    (winner) => {
      if (roundResolvedRef.current) return;
      roundResolvedRef.current = true;
      clearTimers();
      flashLights(winner);
      setScore((previous) => ({
        player: previous.player + (winner === 'player' || winner === 'double' ? 1 : 0),
        opponent: previous.opponent + (winner === 'opponent' || winner === 'double' ? 1 : 0),
      }));
      gameStateRef.current = 'HALTED';
      setGameState('HALTED');
      resetTimerRef.current = window.setTimeout(resetRound, HALT_MS);
    },
    [clearTimers, flashLights, resetRound],
  );

  const registerHit = useCallback(
    (hitBy) => {
      if (gameModeRef.current !== 'FENCING' || gameStateRef.current !== 'PLAYING' || roundResolvedRef.current) return;
      const now = performance.now();

      // Record the first touch and wait briefly for a possible counter-hit.
      // If the opponent also lands within 40ms, resolve it as a double touch.
      if (lastHitRef.current.time === null) {
        lastHitRef.current = { time: now, characterId: hitBy };
        pendingHitTimerRef.current = window.setTimeout(() => {
          if (!roundResolvedRef.current && lastHitRef.current.time !== null) {
            finalizeScore(lastHitRef.current.characterId);
          }
        }, HIT_WINDOW_MS + 5);
        return;
      }

      if (lastHitRef.current.characterId === hitBy) return;
      if (now - lastHitRef.current.time <= HIT_WINDOW_MS) finalizeScore('double');
      else finalizeScore(lastHitRef.current.characterId);
    },
    [finalizeScore],
  );

  const handleModeChange = useCallback(() => {
    const nextMode = gameModeRef.current === 'ROAMING' ? 'FENCING' : 'ROAMING';
    if (document.pointerLockElement && nextMode === 'ROAMING') {
      document.exitPointerLock?.();
    }
    keysRef.current = {};
    clearTimers();
    lastHitRef.current = { time: null, characterId: null };
    roundResolvedRef.current = false;
    setHitLights(EMPTY_LIGHTS);
    gameModeRef.current = nextMode;
    gameStateRef.current = 'PLAYING';
    setGameMode(nextMode);
    setGameState('PLAYING');
    resetForMode(nextMode);
  }, [clearTimers, resetForMode]);

  const handlePlayerTipEnter = useCallback(
    (event) => {
      const otherId =
        event.other?.colliderObject?.userData?.characterId ??
        event.other?.rigidBodyObject?.userData?.characterId;
      if (otherId === 'opponent') registerHit('player');
    },
    [registerHit],
  );

  const handleOpponentTipEnter = useCallback(
    (event) => {
      const otherId =
        event.other?.colliderObject?.userData?.characterId ??
        event.other?.rigidBodyObject?.userData?.characterId;
      if (otherId === 'player') registerHit('opponent');
    },
    [registerHit],
  );

  useEffect(() => {
    const onKeyDown = (event) => {
      keysRef.current[event.code] = true;
      if (gameModeRef.current !== 'FENCING' || gameStateRef.current !== 'PLAYING') return;
      if (event.code === 'KeyJ' && !event.repeat) playerActionRef.current.thrust = 1;
      if (event.code === 'KeyK' && !event.repeat) playerActionRef.current.parry = 1;
      if (event.code === 'Space' && !event.repeat && playerBodyRef.current) {
        event.preventDefault();
        playerActionRef.current.motionLock = 0.28;
        playerBodyRef.current.applyImpulse({ x: 0, y: 0, z: -4.8 }, true);
      }
    };

    const onKeyUp = (event) => {
      keysRef.current[event.code] = false;
    };

    const onMouseMove = (event) => {
      if (gameModeRef.current !== 'FENCING') return;
      if (document.pointerLockElement) {
        mouseAimRef.current.x = clamp(mouseAimRef.current.x + event.movementX * 0.0035, -0.7, 0.7);
        mouseAimRef.current.y = clamp(mouseAimRef.current.y + event.movementY * 0.0025, -0.45, 0.32);
        return;
      }
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect || rect.width === 0 || rect.height === 0) return;
      const nx = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      const ny = ((event.clientY - rect.top) / rect.height) * 2 - 1;
      mouseAimRef.current.x = clamp(nx * 0.55, -0.65, 0.65);
      mouseAimRef.current.y = clamp(ny * 0.25, -0.4, 0.3);
    };

    const onPointerLockChange = () => {
      setPointerLocked(Boolean(document.pointerLockElement));
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('mousemove', onMouseMove);
    document.addEventListener('pointerlockchange', onPointerLockChange);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('pointerlockchange', onPointerLockChange);
    };
  }, []);

  useEffect(() => {
    if (gameMode !== 'FENCING' || gameState !== 'PLAYING' || timeLeft <= 0) return undefined;
    const timer = window.setInterval(() => {
      setTimeLeft((previous) => {
        if (previous <= 1) {
          gameStateRef.current = 'HALTED';
          setGameState('HALTED');
          return 0;
        }
        return previous - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [gameMode, gameState, timeLeft]);

  useEffect(() => {
    resetForMode('ROAMING');
    return () => clearTimers();
  }, [clearTimers, resetForMode]);

  return (
    <div
      ref={containerRef}
      className="relative w-full h-[75vh] min-h-[600px] rounded-xl overflow-hidden border border-stone-300/70 bg-[radial-gradient(circle_at_top,#fffaf2_0%,#eadfcd_60%,#d7c4ad_100%)] shadow-2xl"
    >
      <FloatingToolbar
        gameMode={gameMode}
        gameState={gameState}
        score={score}
        timeLeft={timeLeft}
        hitLights={hitLights}
        penaltyCards={penaltyCards}
        pointerLocked={pointerLocked}
        onModeChange={handleModeChange}
        onRestart={restartMatch}
      />
      {gameMode === 'FENCING' && <HelmetMask />}

      <div className="absolute inset-0">
        <Canvas
          className="h-full w-full"
          shadows
          dpr={[1, 1.7]}
          camera={{ position: [0, 1.7, 5], fov: 70, near: 0.1, far: 120 }}
        >
          <fog attach="fog" args={['#efe5d7', 10, 34]} />
          <Suspense fallback={null}>
            <Environment preset="sunset" background blur={0.05} />
          </Suspense>

          <OrbitControls
            ref={orbitRef}
            enabled={gameMode === 'ROAMING'}
            enablePan={false}
            enableDamping
            dampingFactor={0.08}
            minDistance={3.6}
            maxDistance={7.5}
            minPolarAngle={0.75}
            maxPolarAngle={1.35}
          />

          <Physics gravity={[0, -9.81, 0]}>
            <RigidBody type="fixed" colliders={false}>
              <CuboidCollider args={[7.5, 0.2, 7.5]} position={[0, -0.1, 0]} />
              <CuboidCollider args={[7.5, 3.6, 0.3]} position={[0, 3.5, -7.25]} />
              <CuboidCollider args={[7.5, 3.6, 0.3]} position={[0, 3.5, 7.25]} />
              <CuboidCollider args={[0.3, 3.6, 7.5]} position={[-7.25, 3.5, 0]} />
              <CuboidCollider args={[0.3, 3.6, 7.5]} position={[7.25, 3.5, 0]} />
            </RigidBody>

            <RealisticCastle />
            <Piste />
            <Fencer
              bodyRef={playerBodyRef}
              swordRef={playerSwordRef}
              colliderName="player-body"
              onTipEnter={handlePlayerTipEnter}
              position={[PLAYER_SPAWN.x, PLAYER_SPAWN.y, PLAYER_SPAWN.z]}
              facingRotation={Math.PI}
              bodyVisible={gameMode !== 'FENCING'}
              isPlayer
            />
            <Fencer
              bodyRef={opponentBodyRef}
              swordRef={opponentSwordRef}
              colliderName="opponent-body"
              onTipEnter={handleOpponentTipEnter}
              position={[OPPONENT_SPAWN.x, OPPONENT_SPAWN.y, OPPONENT_SPAWN.z]}
              facingRotation={0}
              bodyVisible
              isPlayer={false}
            />
          </Physics>

          <SceneSystem
            gameMode={gameMode}
            gameState={gameState}
            playerBodyRef={playerBodyRef}
            opponentBodyRef={opponentBodyRef}
            playerSwordRef={playerSwordRef}
            opponentSwordRef={opponentSwordRef}
            keysRef={keysRef}
            mouseAimRef={mouseAimRef}
            playerActionRef={playerActionRef}
            opponentActionRef={opponentActionRef}
            aiRef={aiRef}
            orbitRef={orbitRef}
          />
          {gameMode === 'FENCING' && <PointerLockControls selector="#fencing-lock-button" />}
        </Canvas>
      </div>
    </div>
  );
}
