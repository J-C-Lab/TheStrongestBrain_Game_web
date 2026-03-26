import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Html, OrbitControls } from '@react-three/drei';
import {
  Physics,
  RigidBody,
  CuboidCollider,
  CapsuleCollider,
  BallCollider,
} from '@react-three/rapier';
import * as THREE from 'three';

const WARM_FOG_COLOR = '#f5ede0';
const PLAYER_SPAWN = { x: 0, y: 0.95, z: 2 };
const OPPONENT_SPAWN = { x: 0, y: 0.95, z: -2 };
const ZERO_VECTOR = { x: 0, y: 0, z: 0 };
const TEMP_PLAYER_POS = { x: 0, y: 0, z: 0 };
const TEMP_OPPONENT_POS = { x: 0, y: 0, z: 0 };
const TEMP_PLAYER_VEL = { x: 0, y: 0, z: 0 };
const TEMP_OPPONENT_VEL = { x: 0, y: 0, z: 0 };
const CAMERA_TARGET = new THREE.Vector3();
const CAMERA_POSITION = new THREE.Vector3();
const ORBIT_TARGET = new THREE.Vector3();
const HIT_WINDOW_MS = 40;
const ROUND_RESET_MS = 2000;
const PLAYER_SPEED_ROAM = 4.8;
const PLAYER_SPEED_FENCING = 2.7;
const OPPONENT_SPEED = 2.15;

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function resetRigidBody(body, spawn) {
  if (!body) return;

  TEMP_PLAYER_POS.x = spawn.x;
  TEMP_PLAYER_POS.y = spawn.y;
  TEMP_PLAYER_POS.z = spawn.z;
  body.setTranslation(TEMP_PLAYER_POS, true);
  body.setLinvel(ZERO_VECTOR, true);
  body.setAngvel(ZERO_VECTOR, true);
}

function Piste() {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 4096;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    const toY = (z) => ((7 - z) / 14) * height;

    ctx.fillStyle = '#cab9a1';
    ctx.fillRect(0, 0, width, height);

    const stripe = ctx.createLinearGradient(0, 0, width, 0);
    stripe.addColorStop(0, 'rgba(255,255,255,0.08)');
    stripe.addColorStop(0.5, 'rgba(255,255,255,0.18)');
    stripe.addColorStop(1, 'rgba(255,255,255,0.08)');
    ctx.fillStyle = stripe;
    ctx.fillRect(width * 0.18, 0, width * 0.64, height);

    ctx.fillStyle = 'rgba(145, 56, 48, 0.9)';
    ctx.fillRect(0, toY(7), width, toY(5.5) - toY(7));
    ctx.fillRect(0, toY(-5.5), width, toY(-7) - toY(-5.5));

    ctx.strokeStyle = 'rgba(255, 251, 242, 0.95)';
    ctx.lineWidth = 18;
    [0, 2, -2, 5, -5].forEach((z) => {
      const y = toY(z);
      ctx.beginPath();
      ctx.moveTo(60, y);
      ctx.lineTo(width - 60, y);
      ctx.stroke();
    });

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.lineWidth = 12;
    ctx.strokeRect(18, 18, width - 36, height - 36);

    ctx.strokeStyle = 'rgba(94, 76, 61, 0.22)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 22; i += 1) {
      const x = 60 + i * 42;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x - 120, height);
      ctx.stroke();
    }

    const createdTexture = new THREE.CanvasTexture(canvas);
    createdTexture.colorSpace = THREE.SRGBColorSpace;
    createdTexture.anisotropy = 8;
    createdTexture.needsUpdate = true;
    return createdTexture;
  }, []);

  useEffect(() => () => texture.dispose(), [texture]);

  return (
    <group>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[1, 0.05, 7]} position={[0, 0.05, 0]} />
        <mesh position={[0, 0.05, 0]} receiveShadow castShadow>
          <boxGeometry args={[2, 0.1, 14]} />
          <meshStandardMaterial color="#7a6a59" roughness={0.62} metalness={0.48} />
        </mesh>
        <mesh position={[0, 0.101, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[2, 14]} />
          <meshStandardMaterial
            map={texture}
            roughness={0.4}
            metalness={0.6}
            color="#e8dcc8"
          />
        </mesh>
      </RigidBody>
    </group>
  );
}

function ArenaBounds() {
  return (
    <>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[20, 0.1, 20]} position={[0, -0.05, 0]} />
      </RigidBody>

      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[0.08, 1.8, 7.15]} position={[-1.1, 1.8, 0]} />
        <CuboidCollider args={[0.08, 1.8, 7.15]} position={[1.1, 1.8, 0]} />
        <CuboidCollider args={[1.1, 1.8, 0.08]} position={[0, 1.8, 7.1]} />
        <CuboidCollider args={[1.1, 1.8, 0.08]} position={[0, 1.8, -7.1]} />
      </RigidBody>

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.051, 0]} receiveShadow>
        <planeGeometry args={[40, 40]} />
        <meshStandardMaterial color="#e3d6c4" roughness={0.92} metalness={0.05} />
      </mesh>
    </>
  );
}

function FighterModel({
  bodyColor,
  accentColor,
  swordRef,
  bodyVisible,
  bodyLabel,
  showLabel,
  sensorName,
  onTipEnter,
  facingRotation = 0,
}) {
  return (
    <group rotation={[0, facingRotation, 0]}>
      {bodyVisible && (
        <>
          <mesh castShadow position={[0, 0.08, 0]}>
            <capsuleGeometry args={[0.28, 0.95, 8, 16]} />
            <meshStandardMaterial color={bodyColor} roughness={0.72} metalness={0.12} />
          </mesh>
          <mesh castShadow position={[0, 0.75, 0]}>
            <sphereGeometry args={[0.18, 24, 24]} />
            <meshStandardMaterial color="#f3dbc4" roughness={0.88} metalness={0.02} />
          </mesh>
          <mesh castShadow position={[0, 0.3, 0]}>
            <boxGeometry args={[0.46, 0.7, 0.26]} />
            <meshStandardMaterial color={accentColor} roughness={0.62} metalness={0.16} />
          </mesh>
          {showLabel && (
            <Html position={[0, 1.2, 0]} center distanceFactor={10}>
              <div className="rounded-full border border-white/60 bg-black/45 px-3 py-1 text-xs text-white backdrop-blur-sm">
                {bodyLabel}
              </div>
            </Html>
          )}
        </>
      )}

      <group ref={swordRef} position={[0.22, 0.2, 0.2]}>
        <mesh castShadow position={[0, 0, 0.08]}>
          <boxGeometry args={[0.14, 0.08, 0.18]} />
          <meshStandardMaterial color="#5c4635" roughness={0.7} metalness={0.2} />
        </mesh>
        <mesh castShadow position={[0, 0, 0.2]}>
          <boxGeometry args={[0.22, 0.03, 0.08]} />
          <meshStandardMaterial color="#c8a24e" roughness={0.4} metalness={0.78} />
        </mesh>
        <mesh castShadow position={[0, 0, 0.78]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.02, 0.008, 1.1, 12]} />
          <meshStandardMaterial color="#d8dde3" roughness={0.18} metalness={0.95} />
        </mesh>

        <BallCollider
          name={sensorName}
          userData={{ role: sensorName }}
          sensor
          args={[0.06]}
          position={[0, 0, 1.32]}
          onIntersectionEnter={onTipEnter}
        />
      </group>
    </group>
  );
}

function Player({ bodyRef, swordRef, onTipEnter, gameMode }) {
  return (
    <RigidBody
      ref={bodyRef}
      colliders={false}
      mass={1.2}
      friction={1.8}
      restitution={0.05}
      linearDamping={5.2}
      angularDamping={8}
      canSleep={false}
      enabledRotations={[false, false, false]}
      position={[PLAYER_SPAWN.x, PLAYER_SPAWN.y, PLAYER_SPAWN.z]}
    >
      <CapsuleCollider
        args={[0.6, 0.28]}
        name="player-body"
        userData={{ characterId: 'player' }}
      />
      <FighterModel
        bodyColor="#efe8dd"
        accentColor="#a2876e"
        swordRef={swordRef}
        bodyVisible={gameMode !== 'FENCING'}
        bodyLabel="你"
        showLabel={gameMode === 'ROAMING'}
        sensorName="player-tip"
        onTipEnter={onTipEnter}
        facingRotation={Math.PI}
      />
    </RigidBody>
  );
}

function Opponent({ bodyRef, swordRef, onTipEnter, gameMode }) {
  return (
    <RigidBody
      ref={bodyRef}
      colliders={false}
      mass={1.25}
      friction={1.8}
      restitution={0.05}
      linearDamping={5.5}
      angularDamping={8}
      canSleep={false}
      enabledRotations={[false, false, false]}
      position={[OPPONENT_SPAWN.x, OPPONENT_SPAWN.y, OPPONENT_SPAWN.z]}
    >
      <CapsuleCollider
        args={[0.6, 0.28]}
        name="opponent-body"
        userData={{ characterId: 'opponent' }}
      />
      <FighterModel
        bodyColor="#352c2a"
        accentColor="#7a5f4f"
        swordRef={swordRef}
        bodyVisible
        bodyLabel="AI 对手"
        showLabel={gameMode === 'ROAMING'}
        sensorName="opponent-tip"
        onTipEnter={onTipEnter}
      />
    </RigidBody>
  );
}

function HelmetMask() {
  return (
    <Html fullscreen style={{ pointerEvents: 'none' }}>
      <div className="pointer-events-none absolute inset-0">
        <svg className="h-full w-full opacity-60" viewBox="0 0 100 100" preserveAspectRatio="none">
          <defs>
            <linearGradient id="maskShade" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="rgba(0,0,0,0.88)" />
              <stop offset="45%" stopColor="rgba(0,0,0,0.2)" />
              <stop offset="100%" stopColor="rgba(0,0,0,0.82)" />
            </linearGradient>
          </defs>
          <rect x="0" y="0" width="100" height="100" fill="url(#maskShade)" />
          <path d="M10 14 Q50 0 90 14" fill="none" stroke="black" strokeWidth="4" />
          <path d="M15 20 Q50 8 85 20" fill="none" stroke="black" strokeWidth="2" />
          {Array.from({ length: 13 }, (_, index) => {
            const x = 16 + index * 5.6;
            return <path key={`v-${x}`} d={`M${x} 9 Q${x - 2} 50 ${x} 91`} fill="none" stroke="black" strokeWidth="1.6" />;
          })}
          {Array.from({ length: 9 }, (_, index) => {
            const y = 18 + index * 8;
            return <path key={`h-${y}`} d={`M11 ${y} Q50 ${y - 5} 89 ${y}`} fill="none" stroke="black" strokeWidth="1.2" />;
          })}
        </svg>
      </div>
    </Html>
  );
}

function UIOverlay({ gameMode, gameState, score, onModeChange, onReset }) {
  const controlText =
    gameMode === 'ROAMING'
      ? 'WASD 漫游，拖拽视角，切换到比赛后进入第一人称。'
      : 'W/S 前后，A/D 横移，Space 弓步，Enter 冲刺，J 刺击，K 拨挡。';

  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex flex-col justify-between p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="pointer-events-auto max-w-xl rounded-3xl border border-[#e5d9c7]/80 bg-[#f7f0e4]/85 p-4 shadow-[0_18px_60px_rgba(93,68,42,0.16)] backdrop-blur">
          <p className="text-xs uppercase tracking-[0.35em] text-[#8e7154]">Real Fencing</p>
          <h2 className="mt-1 text-2xl font-semibold text-[#4e3f31]">慵懒宫廷击剑练习场</h2>
          <p className="mt-2 text-sm leading-6 text-[#5f5144]">{controlText}</p>
        </div>

        <div className="pointer-events-auto flex flex-col gap-3 rounded-3xl border border-[#e5d9c7]/80 bg-[#f7f0e4]/90 p-4 text-[#4e3f31] shadow-[0_18px_60px_rgba(93,68,42,0.16)] backdrop-blur">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onModeChange('ROAMING')}
              className={`rounded-full px-4 py-2 text-sm transition ${
                gameMode === 'ROAMING' ? 'bg-[#6d5644] text-white' : 'bg-white/80 hover:bg-white'
              }`}
            >
              漫游
            </button>
            <button
              type="button"
              onClick={() => onModeChange('FENCING')}
              className={`rounded-full px-4 py-2 text-sm transition ${
                gameMode === 'FENCING' ? 'bg-[#6d5644] text-white' : 'bg-white/80 hover:bg-white'
              }`}
            >
              比赛
            </button>
            <button
              type="button"
              onClick={onReset}
              className="rounded-full bg-[#c8a97d] px-4 py-2 text-sm text-white transition hover:bg-[#b79464]"
            >
              复位
            </button>
          </div>

          <div className="flex items-center justify-between gap-6">
            <div>
              <div className="text-xs uppercase tracking-[0.28em] text-[#9f876f]">Score</div>
              <div className="mt-1 text-3xl font-bold">
                {score.player} : {score.opponent}
              </div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-[0.28em] text-[#9f876f]">State</div>
              <div className={`mt-1 text-sm font-semibold ${gameState === 'HALTED' ? 'text-red-500' : 'text-emerald-600'}`}>
                {gameState === 'HALTED' ? '裁判暂停判灯中' : '比赛进行中'}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <div className="max-w-md rounded-3xl border border-white/40 bg-black/35 px-4 py-3 text-right text-xs leading-6 text-white backdrop-blur-sm">
          <div>剑道长度 14m，宽度 2m，红区与警戒线按真实尺度绘制。</div>
          <div>40ms 内双向命中将判定互中，双方同时得分。</div>
        </div>
      </div>
    </div>
  );
}

function SceneController({
  gameMode,
  gameState,
  playerBodyRef,
  opponentBodyRef,
  playerSwordRef,
  opponentSwordRef,
  controlsRef,
  keysRef,
  mouseRef,
  playerActionRef,
  opponentActionRef,
  aiStateRef,
}) {
  const { camera } = useThree();

  useFrame((_, delta) => {
    const playerBody = playerBodyRef.current;
    const opponentBody = opponentBodyRef.current;
    const playerSword = playerSwordRef.current;
    const opponentSword = opponentSwordRef.current;
    const controls = controlsRef.current;

    if (!playerBody || !opponentBody || !playerSword || !opponentSword) return;

    const dt = Math.min(delta, 0.05);
    const playerTranslation = playerBody.translation();
    const opponentTranslation = opponentBody.translation();
    const playerVelocity = playerBody.linvel();
    const opponentVelocity = opponentBody.linvel();
    const keys = keysRef.current;
    const playerAction = playerActionRef.current;
    const opponentAction = opponentActionRef.current;
    const ai = aiStateRef.current;

    if (gameState === 'PLAYING') {
      if (gameMode === 'ROAMING') {
        const roamX = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0);
        const roamZ = (keys.KeyS ? 1 : 0) - (keys.KeyW ? 1 : 0);
        TEMP_PLAYER_POS.x = clamp(playerTranslation.x + roamX * PLAYER_SPEED_ROAM * dt, -10, 10);
        TEMP_PLAYER_POS.y = PLAYER_SPAWN.y;
        TEMP_PLAYER_POS.z = clamp(playerTranslation.z + roamZ * PLAYER_SPEED_ROAM * dt, -10, 10);
        playerBody.setTranslation(TEMP_PLAYER_POS, true);
        playerBody.setLinvel(ZERO_VECTOR, true);
      } else {
        const moveX = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0);
        const moveZ = (keys.KeyS ? 1 : 0) - (keys.KeyW ? 1 : 0);

        playerAction.motionLock = Math.max(playerAction.motionLock - dt, 0);
        TEMP_PLAYER_VEL.x = moveX * PLAYER_SPEED_FENCING;
        TEMP_PLAYER_VEL.y = playerVelocity.y;
        TEMP_PLAYER_VEL.z = playerAction.motionLock > 0 ? playerVelocity.z : moveZ * PLAYER_SPEED_FENCING;
        playerBody.setLinvel(TEMP_PLAYER_VEL, true);

        if (playerTranslation.x < -0.96 || playerTranslation.x > 0.96) {
          TEMP_PLAYER_POS.x = clamp(playerTranslation.x, -0.96, 0.96);
          TEMP_PLAYER_POS.y = playerTranslation.y;
          TEMP_PLAYER_POS.z = playerTranslation.z;
          playerBody.setTranslation(TEMP_PLAYER_POS, true);
        }
      }

      ai.attackCooldown -= dt;
      ai.strafeTimer -= dt;
      ai.motionLock = Math.max(ai.motionLock - dt, 0);

      if (gameMode === 'FENCING') {
        const dz = playerTranslation.z - opponentTranslation.z;
        const dx = playerTranslation.x - opponentTranslation.x;
        const desiredGap = 3.1;

        if (ai.strafeTimer <= 0) {
          ai.strafeTimer = 0.9 + Math.random() * 1.2;
          ai.strafeDir *= -1;
        }

        let aiX = clamp(dx * 1.35 + ai.strafeDir * 0.35, -0.7, 0.7);
        let aiZ = clamp(dz - desiredGap, -1, 1);

        if (Math.abs(dz) < 2.1 && Math.random() < 0.012) {
          opponentAction.parry = 1;
        }

        if (ai.attackCooldown <= 0 && Math.abs(dz) < 3.3) {
          ai.attackCooldown = 0.95 + Math.random() * 1.2;
          opponentAction.thrust = 1;
          ai.motionLock = 0.2;
          opponentBody.applyImpulse({ x: 0, y: 0, z: 2.2 }, true);
        }

        TEMP_OPPONENT_VEL.x = aiX * OPPONENT_SPEED;
        TEMP_OPPONENT_VEL.y = opponentVelocity.y;
        TEMP_OPPONENT_VEL.z = ai.motionLock > 0 ? opponentVelocity.z : aiZ * OPPONENT_SPEED;
        opponentBody.setLinvel(TEMP_OPPONENT_VEL, true);

        if (opponentTranslation.x < -0.96 || opponentTranslation.x > 0.96) {
          TEMP_OPPONENT_POS.x = clamp(opponentTranslation.x, -0.96, 0.96);
          TEMP_OPPONENT_POS.y = opponentTranslation.y;
          TEMP_OPPONENT_POS.z = opponentTranslation.z;
          opponentBody.setTranslation(TEMP_OPPONENT_POS, true);
        }
      } else {
        TEMP_OPPONENT_VEL.x = 0;
        TEMP_OPPONENT_VEL.y = opponentVelocity.y;
        TEMP_OPPONENT_VEL.z = 0;
        opponentBody.setLinvel(TEMP_OPPONENT_VEL, true);
      }
    } else {
      playerBody.setLinvel(ZERO_VECTOR, true);
      opponentBody.setLinvel(ZERO_VECTOR, true);
      playerAction.motionLock = 0;
      ai.motionLock = 0;
    }

    playerAction.thrust = Math.max(playerAction.thrust - dt * 2.5, 0);
    playerAction.parry = Math.max(playerAction.parry - dt * 2.2, 0);
    opponentAction.thrust = Math.max(opponentAction.thrust - dt * 2.3, 0);
    opponentAction.parry = Math.max(opponentAction.parry - dt * 2.1, 0);

    const thrustPhase = 1 - playerAction.thrust;
    const parryPhase = 1 - playerAction.parry;
    const playerThrustOffset = Math.sin(thrustPhase * Math.PI) * 0.92;
    const playerParrySweep = Math.sin(parryPhase * Math.PI) * 0.72;

    // 鼠标会先被换算成 NDC 坐标，范围固定在 [-1, 1]。
    // 这里把 x 映射成左右偏航，把 y 映射成上下俯仰，等价于把二维光标投影为“剑尖应该朝向的角度”。
    // 最后用逐帧插值缓动到目标角度，第一人称下就不会出现瞬时跳动。
    const targetYaw = gameMode === 'FENCING' ? clamp(mouseRef.current.x * 0.55, -0.65, 0.65) : 0.18;
    const targetPitch = gameMode === 'FENCING' ? clamp(-mouseRef.current.y * 0.38 - 0.05, -0.52, 0.34) : -0.08;

    playerSword.rotation.x = THREE.MathUtils.lerp(playerSword.rotation.x, targetPitch + playerParrySweep * 0.18, 0.18);
    playerSword.rotation.y = THREE.MathUtils.lerp(playerSword.rotation.y, targetYaw + playerParrySweep * 0.78, 0.18);
    playerSword.rotation.z = THREE.MathUtils.lerp(playerSword.rotation.z, -playerParrySweep * 0.45, 0.18);
    playerSword.position.x = THREE.MathUtils.lerp(playerSword.position.x, 0.22 + playerParrySweep * 0.28, 0.18);
    playerSword.position.y = THREE.MathUtils.lerp(playerSword.position.y, 0.2 + mouseRef.current.y * 0.08, 0.18);
    playerSword.position.z = THREE.MathUtils.lerp(playerSword.position.z, 0.2 + playerThrustOffset, 0.2);

    const opponentDx = playerTranslation.x - opponentTranslation.x;
    const opponentDy = 1.68 - 1.5;
    const opponentThrustOffset = Math.sin((1 - opponentAction.thrust) * Math.PI) * 0.86;
    const opponentParrySweep = Math.sin((1 - opponentAction.parry) * Math.PI) * 0.58;
    const opponentYaw = clamp(opponentDx * 0.24, -0.45, 0.45);
    const opponentPitch = clamp(-opponentDy * 0.18 - 0.04, -0.4, 0.22);

    opponentSword.rotation.x = THREE.MathUtils.lerp(opponentSword.rotation.x, opponentPitch + opponentParrySweep * 0.15, 0.16);
    opponentSword.rotation.y = THREE.MathUtils.lerp(opponentSword.rotation.y, opponentYaw - opponentParrySweep * 0.7, 0.16);
    opponentSword.rotation.z = THREE.MathUtils.lerp(opponentSword.rotation.z, opponentParrySweep * 0.42, 0.16);
    opponentSword.position.x = THREE.MathUtils.lerp(opponentSword.position.x, 0.22 - opponentParrySweep * 0.2, 0.16);
    opponentSword.position.y = THREE.MathUtils.lerp(opponentSword.position.y, 0.2, 0.16);
    opponentSword.position.z = THREE.MathUtils.lerp(opponentSword.position.z, 0.2 + opponentThrustOffset, 0.18);

    if (gameMode === 'ROAMING' && controls) {
      ORBIT_TARGET.set(playerTranslation.x, 1.05, playerTranslation.z);
      controls.target.lerp(ORBIT_TARGET, 0.14);
      controls.update();
    } else {
      CAMERA_POSITION.set(playerTranslation.x, 1.7, playerTranslation.z + 0.05);
      CAMERA_TARGET.set(opponentTranslation.x, 1.58, opponentTranslation.z);
      camera.position.lerp(CAMERA_POSITION, 0.18);
      camera.lookAt(CAMERA_TARGET);
    }
  });

  return null;
}

export default function RealFencing() {
  const [gameMode, setGameMode] = useState('FENCING');
  const [score, setScore] = useState({ player: 0, opponent: 0 });
  const [gameState, setGameState] = useState('PLAYING');

  const containerRef = useRef(null);
  const playerBodyRef = useRef(null);
  const opponentBodyRef = useRef(null);
  const playerSwordRef = useRef(null);
  const opponentSwordRef = useRef(null);
  const controlsRef = useRef(null);
  const keysRef = useRef({});
  const mouseRef = useRef({ x: 0, y: 0 });
  const playerActionRef = useRef({ thrust: 0, parry: 0, motionLock: 0 });
  const opponentActionRef = useRef({ thrust: 0, parry: 0 });
  const aiStateRef = useRef({ attackCooldown: 1.2, strafeDir: 1, strafeTimer: 1.1, motionLock: 0 });
  const gameStateRef = useRef(gameState);
  const roundResolvedRef = useRef(false);
  const pendingScoreTimerRef = useRef(null);
  const resetTimerRef = useRef(null);
  const lastHit = useRef({ time: null, characterId: null });

  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  const clearRoundTimers = useCallback(() => {
    if (pendingScoreTimerRef.current) {
      window.clearTimeout(pendingScoreTimerRef.current);
      pendingScoreTimerRef.current = null;
    }

    if (resetTimerRef.current) {
      window.clearTimeout(resetTimerRef.current);
      resetTimerRef.current = null;
    }
  }, []);

  const resetRound = useCallback(() => {
    clearRoundTimers();
    lastHit.current = { time: null, characterId: null };
    roundResolvedRef.current = false;
    playerActionRef.current.thrust = 0;
    playerActionRef.current.parry = 0;
    playerActionRef.current.motionLock = 0;
    opponentActionRef.current.thrust = 0;
    opponentActionRef.current.parry = 0;
    aiStateRef.current.attackCooldown = 1 + Math.random() * 0.6;
    aiStateRef.current.strafeTimer = 0.8 + Math.random() * 0.6;
    aiStateRef.current.motionLock = 0;
    resetRigidBody(playerBodyRef.current, PLAYER_SPAWN);
    resetRigidBody(opponentBodyRef.current, OPPONENT_SPAWN);
    setGameState('PLAYING');
    gameStateRef.current = 'PLAYING';
  }, [clearRoundTimers]);

  const finalizeScore = useCallback(
    (winner) => {
      if (roundResolvedRef.current) return;

      roundResolvedRef.current = true;
      clearRoundTimers();

      setScore((previous) => ({
        player: previous.player + (winner === 'player' || winner === 'double' ? 1 : 0),
        opponent: previous.opponent + (winner === 'opponent' || winner === 'double' ? 1 : 0),
      }));

      setGameState('HALTED');
      gameStateRef.current = 'HALTED';
      resetTimerRef.current = window.setTimeout(resetRound, ROUND_RESET_MS);
    },
    [clearRoundTimers, resetRound],
  );

  const registerHit = useCallback(
    (hitBy) => {
      if (gameStateRef.current !== 'PLAYING' || roundResolvedRef.current) return;

      const now = performance.now();

      // 40ms 互中判定流程：
      // 1. 第一剑命中时只记录时间与出手方，不立刻给分。
      // 2. 开一个极短定时器等待“另一侧是否也在 40ms 内命中”。
      // 3. 如果第二次命中来自另一名角色且 diff <= 40，则判互中，双方同时加分。
      // 4. 如果超出 40ms 仍没有有效反击，则把分数判给先命中的那一方。
      if (lastHit.current.time === null) {
        lastHit.current = { time: now, characterId: hitBy };
        pendingScoreTimerRef.current = window.setTimeout(() => {
          if (!roundResolvedRef.current && lastHit.current.time !== null) {
            finalizeScore(lastHit.current.characterId);
          }
        }, HIT_WINDOW_MS + 5);
        return;
      }

      if (lastHit.current.characterId === hitBy) return;

      const diff = now - lastHit.current.time;
      if (diff <= HIT_WINDOW_MS) {
        finalizeScore('double');
      } else {
        finalizeScore(lastHit.current.characterId);
      }
    },
    [finalizeScore],
  );

  const handlePlayerTipEnter = useCallback(
    (event) => {
      const otherId =
        event.other?.colliderObject?.userData?.characterId ??
        event.other?.rigidBodyObject?.userData?.characterId;

      if (otherId === 'opponent') {
        registerHit('player');
      }
    },
    [registerHit],
  );

  const handleOpponentTipEnter = useCallback(
    (event) => {
      const otherId =
        event.other?.colliderObject?.userData?.characterId ??
        event.other?.rigidBodyObject?.userData?.characterId;

      if (otherId === 'player') {
        registerHit('opponent');
      }
    },
    [registerHit],
  );

  const triggerPlayerThrust = useCallback(() => {
    if (gameMode !== 'FENCING' || gameStateRef.current !== 'PLAYING') return;
    playerActionRef.current.thrust = 1;
  }, [gameMode]);

  const triggerPlayerParry = useCallback(() => {
    if (gameMode !== 'FENCING' || gameStateRef.current !== 'PLAYING') return;
    playerActionRef.current.parry = 1;
  }, [gameMode]);

  const triggerPlayerLunge = useCallback(
    (strength) => {
      if (gameMode !== 'FENCING' || gameStateRef.current !== 'PLAYING' || !playerBodyRef.current) return;
      playerActionRef.current.motionLock = strength > 4 ? 0.32 : 0.22;
      playerBodyRef.current.applyImpulse({ x: 0, y: 0, z: -strength }, true);
    },
    [gameMode],
  );

  const handleModeChange = useCallback((nextMode) => {
    keysRef.current = {};
    setGameMode(nextMode);
    resetRound();
  }, [resetRound]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.repeat) {
        if (event.code === 'Space' || event.code === 'Enter' || event.code === 'KeyJ' || event.code === 'KeyK') {
          return;
        }
      }

      keysRef.current[event.code] = true;

      if (event.code === 'Space') {
        event.preventDefault();
        triggerPlayerLunge(3.5);
      }

      if (event.code === 'Enter') {
        event.preventDefault();
        triggerPlayerLunge(5.2);
      }

      if (event.code === 'KeyJ') {
        triggerPlayerThrust();
      }

      if (event.code === 'KeyK') {
        triggerPlayerParry();
      }
    };

    const handleKeyUp = (event) => {
      keysRef.current[event.code] = false;
    };

    const handleMouseMove = (event) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect || rect.width === 0 || rect.height === 0) return;

      const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -(((event.clientY - rect.top) / rect.height) * 2 - 1);
      mouseRef.current.x = clamp(x, -1, 1);
      mouseRef.current.y = clamp(y, -1, 1);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('mousemove', handleMouseMove);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, [triggerPlayerLunge, triggerPlayerParry, triggerPlayerThrust]);

  useEffect(() => () => clearRoundTimers(), [clearRoundTimers]);

  return (
    <div
      ref={containerRef}
      className="relative mx-auto w-full overflow-hidden rounded-[32px] border border-[#e5d9c7] bg-[radial-gradient(circle_at_top,#fffaf2_0%,#f4eadb_48%,#eadfcd_100%)] shadow-[0_24px_80px_rgba(96,73,46,0.18)]"
    >
      <UIOverlay
        gameMode={gameMode}
        gameState={gameState}
        score={score}
        onModeChange={handleModeChange}
        onReset={resetRound}
      />

      <div className="h-[760px] w-full">
        <Canvas
          shadows
          dpr={[1, 1.6]}
          camera={{ position: [4.5, 6.8, 9], fov: 50, near: 0.1, far: 100 }}
        >
          <color attach="background" args={[WARM_FOG_COLOR]} />
          <fog attach="fog" args={[WARM_FOG_COLOR, 10, 50]} />

          <ambientLight color={WARM_FOG_COLOR} intensity={0.95} />
          <hemisphereLight color="#fbf3e8" groundColor="#6a5647" intensity={0.55} />
          <directionalLight
            castShadow
            position={[6, 10, 4]}
            intensity={1.25}
            color="#ffe8be"
            shadow-mapSize-width={2048}
            shadow-mapSize-height={2048}
            shadow-camera-near={0.1}
            shadow-camera-far={35}
            shadow-camera-left={-12}
            shadow-camera-right={12}
            shadow-camera-top={12}
            shadow-camera-bottom={-12}
          />

          <OrbitControls
            ref={controlsRef}
            enabled={gameMode === 'ROAMING'}
            enablePan={false}
            minDistance={5}
            maxDistance={12}
            minPolarAngle={0.65}
            maxPolarAngle={1.2}
          />

          <Physics gravity={[0, -9.81, 0]}>
            <ArenaBounds />
            <Piste />

            <Player
              bodyRef={playerBodyRef}
              swordRef={playerSwordRef}
              onTipEnter={handlePlayerTipEnter}
              gameMode={gameMode}
            />
            <Opponent
              bodyRef={opponentBodyRef}
              swordRef={opponentSwordRef}
              onTipEnter={handleOpponentTipEnter}
              gameMode={gameMode}
            />
          </Physics>

          <SceneController
            gameMode={gameMode}
            gameState={gameState}
            playerBodyRef={playerBodyRef}
            opponentBodyRef={opponentBodyRef}
            playerSwordRef={playerSwordRef}
            opponentSwordRef={opponentSwordRef}
            controlsRef={controlsRef}
            keysRef={keysRef}
            mouseRef={mouseRef}
            playerActionRef={playerActionRef}
            opponentActionRef={opponentActionRef}
            aiStateRef={aiStateRef}
          />

          {gameMode === 'FENCING' && <HelmetMask />}
        </Canvas>
      </div>
    </div>
  );
}
