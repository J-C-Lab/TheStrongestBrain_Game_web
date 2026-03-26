import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Environment, Html, PointerLockControls } from '@react-three/drei';
import { Physics, RigidBody, CuboidCollider, CapsuleCollider } from '@react-three/rapier';
import * as THREE from 'three';

const FLOOR_SIZE = 15;
const PLAYER_SPAWN = { x: 0, y: 1.05, z: 0 };
const CAMERA_EYE_HEIGHT = 0.65;
const MOVE_SPEED = 3.8;
const ROOM_LIMIT = 6.2;
const WARM_BG = '#f5ede0';
const STONE_COLOR = '#c5a782';
const FLOOR_COLOR = '#e5d5b7';

const WORLD_UP = new THREE.Vector3(0, 1, 0);
const TEMP_FORWARD = new THREE.Vector3();
const TEMP_RIGHT = new THREE.Vector3();
const TEMP_MOVE = new THREE.Vector3();
const TEMP_CAMERA = new THREE.Vector3();

function createStoneTexture({ base, grout, vein, size, repeatX, repeatY, crackAlpha }) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);

  const tile = size / 4;
  ctx.strokeStyle = grout;
  ctx.lineWidth = 6;

  for (let i = 0; i <= 4; i += 1) {
    const offset = i * tile;
    ctx.beginPath();
    ctx.moveTo(offset, 0);
    ctx.lineTo(offset, size);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, offset);
    ctx.lineTo(size, offset);
    ctx.stroke();
  }

  ctx.strokeStyle = vein;
  ctx.lineWidth = 2;
  ctx.globalAlpha = crackAlpha;
  for (let i = 0; i < 22; i += 1) {
    const startX = Math.random() * size;
    const startY = Math.random() * size;
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.bezierCurveTo(
      startX + Math.random() * 80 - 40,
      startY + Math.random() * 80 - 40,
      startX + Math.random() * 160 - 80,
      startY + Math.random() * 160 - 80,
      startX + Math.random() * 220 - 110,
      startY + Math.random() * 220 - 110,
    );
    ctx.stroke();
  }

  ctx.globalAlpha = 0.08;
  for (let i = 0; i < 1200; i += 1) {
    ctx.fillStyle = i % 2 === 0 ? '#ffffff' : '#7b6351';
    ctx.fillRect(Math.random() * size, Math.random() * size, 2, 2);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeatX, repeatY);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  texture.needsUpdate = true;
  return texture;
}

function useCastleTextures() {
  const floorTexture = useMemo(
    () =>
      createStoneTexture({
        base: '#dcc7a7',
        grout: '#c8b391',
        vein: '#8f7760',
        size: 1024,
        repeatX: 4,
        repeatY: 4,
        crackAlpha: 0.22,
      }),
    [],
  );

  const wallTexture = useMemo(
    () =>
      createStoneTexture({
        base: '#c5a782',
        grout: '#b08f69',
        vein: '#8c7156',
        size: 1024,
        repeatX: 3,
        repeatY: 2,
        crackAlpha: 0.18,
      }),
    [],
  );

  useEffect(
    () => () => {
      floorTexture.dispose();
      wallTexture.dispose();
    },
    [floorTexture, wallTexture],
  );

  return { floorTexture, wallTexture };
}

function CastleFloor({ floorTexture }) {
  return (
    <group>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[FLOOR_SIZE / 2, 0.25, FLOOR_SIZE / 2]} position={[0, -0.25, 0]} />
        <mesh receiveShadow position={[0, -0.25, 0]}>
          <boxGeometry args={[FLOOR_SIZE, 0.5, FLOOR_SIZE]} />
          <meshStandardMaterial
            map={floorTexture}
            color={FLOOR_COLOR}
            roughness={0.3}
            metalness={0.08}
            envMapIntensity={0.85}
          />
        </mesh>
      </RigidBody>

      <mesh receiveShadow position={[0, 0.005, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[FLOOR_SIZE, FLOOR_SIZE]} />
        <meshStandardMaterial color="#f7eddc" transparent opacity={0.08} />
      </mesh>
    </group>
  );
}

function StoneWall({ position, scale, wallTexture }) {
  return (
    <mesh castShadow receiveShadow position={position} scale={scale}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial
        map={wallTexture}
        color={STONE_COLOR}
        roughness={0.92}
        metalness={0.04}
        envMapIntensity={0.45}
      />
    </mesh>
  );
}

function Banner({ position, rotation }) {
  return (
    <group position={position} rotation={rotation}>
      <mesh castShadow position={[0, 1.55, 0]}>
        <cylinderGeometry args={[0.05, 0.05, 1.9, 12]} />
        <meshStandardMaterial color="#7d624e" roughness={0.75} />
      </mesh>
      <mesh castShadow position={[0, 0.55, 0.06]}>
        <boxGeometry args={[1.05, 1.9, 0.06]} />
        <meshStandardMaterial color="#7a423d" roughness={0.8} metalness={0.06} />
      </mesh>
      <mesh castShadow position={[0, -0.6, 0.06]} rotation={[0, 0, Math.PI / 4]}>
        <boxGeometry args={[0.28, 0.28, 0.05]} />
        <meshStandardMaterial color="#d1b07d" roughness={0.55} metalness={0.28} />
      </mesh>
    </group>
  );
}

function LancetWindow({ position }) {
  return (
    <group position={position}>
      <mesh castShadow>
        <boxGeometry args={[1.05, 3.3, 0.25]} />
        <meshStandardMaterial color="#b89a75" roughness={0.88} metalness={0.04} />
      </mesh>
      <mesh position={[0, 0.1, 0.13]}>
        <boxGeometry args={[0.55, 2.55, 0.04]} />
        <meshStandardMaterial color="#705f56" emissive="#f5cc85" emissiveIntensity={0.25} roughness={0.25} />
      </mesh>
      <mesh position={[0, 1.68, 0.13]} rotation={[0, 0, Math.PI / 4]}>
        <boxGeometry args={[0.42, 0.42, 0.04]} />
        <meshStandardMaterial color="#705f56" emissive="#f5cc85" emissiveIntensity={0.2} roughness={0.25} />
      </mesh>
    </group>
  );
}

function CastleArchitecture({ wallTexture }) {
  return (
    <group>
      <StoneWall position={[-7.35, 3.2, 0]} scale={[0.7, 6.4, 15]} wallTexture={wallTexture} />
      <StoneWall position={[7.35, 3.2, 0]} scale={[0.7, 6.4, 15]} wallTexture={wallTexture} />
      <StoneWall position={[0, 3.2, 7.35]} scale={[15, 6.4, 0.7]} wallTexture={wallTexture} />

      <group position={[0, 0, -6.9]}>
        <StoneWall position={[-5.1, 3.4, 0]} scale={[4.8, 6.8, 0.9]} wallTexture={wallTexture} />
        <StoneWall position={[5.1, 3.4, 0]} scale={[4.8, 6.8, 0.9]} wallTexture={wallTexture} />
        <StoneWall position={[0, 6.3, 0]} scale={[15, 1.4, 0.9]} wallTexture={wallTexture} />
        <StoneWall position={[-1.65, 2.15, 0.08]} scale={[1.2, 4.3, 0.95]} wallTexture={wallTexture} />
        <StoneWall position={[1.65, 2.15, 0.08]} scale={[1.2, 4.3, 0.95]} wallTexture={wallTexture} />
        <StoneWall position={[0, 4.25, 0.08]} scale={[4.4, 0.55, 0.95]} wallTexture={wallTexture} />
        <StoneWall position={[0, 4.9, 0.08]} scale={[3.3, 0.52, 0.95]} wallTexture={wallTexture} />
        <StoneWall position={[0, 5.55, 0.08]} scale={[2.2, 0.48, 0.95]} wallTexture={wallTexture} />
        <StoneWall position={[0, 6.05, 0.08]} scale={[1.1, 0.42, 0.95]} wallTexture={wallTexture} />
      </group>

      <LancetWindow position={[4.4, 3.35, -6.42]} />
      <LancetWindow position={[-4.4, 3.35, -6.42]} />

      <StoneWall position={[-5.4, 2.8, -2.5]} scale={[0.8, 5.6, 0.8]} wallTexture={wallTexture} />
      <StoneWall position={[5.4, 2.8, -2.5]} scale={[0.8, 5.6, 0.8]} wallTexture={wallTexture} />
      <StoneWall position={[-5.4, 2.8, 2.7]} scale={[0.8, 5.6, 0.8]} wallTexture={wallTexture} />
      <StoneWall position={[5.4, 2.8, 2.7]} scale={[0.8, 5.6, 0.8]} wallTexture={wallTexture} />

      <mesh castShadow receiveShadow position={[0, 6.7, 0]}>
        <boxGeometry args={[15, 0.55, 15]} />
        <meshStandardMaterial map={wallTexture} color="#baa187" roughness={0.95} metalness={0.03} />
      </mesh>

      <Banner position={[-7.02, 2.6, -1.9]} rotation={[0, Math.PI / 2, 0]} />
      <Banner position={[7.02, 2.6, -3.7]} rotation={[0, -Math.PI / 2, 0]} />
      <Banner position={[-7.02, 2.6, 3.2]} rotation={[0, Math.PI / 2, 0]} />
      <Banner position={[7.02, 2.6, 1.2]} rotation={[0, -Math.PI / 2, 0]} />
    </group>
  );
}

function CastleColliders() {
  return (
    <RigidBody type="fixed" colliders={false}>
      <CuboidCollider args={[7.6, 3.3, 0.35]} position={[0, 3.2, 7.35]} />
      <CuboidCollider args={[0.35, 3.3, 7.6]} position={[-7.35, 3.2, 0]} />
      <CuboidCollider args={[0.35, 3.3, 7.6]} position={[7.35, 3.2, 0]} />
      <CuboidCollider args={[7.6, 3.3, 0.35]} position={[0, 3.2, -7.35]} />
    </RigidBody>
  );
}

function TorchSconce({ position, intensity }) {
  return (
    <group position={position}>
      <mesh castShadow>
        <boxGeometry args={[0.24, 0.8, 0.18]} />
        <meshStandardMaterial color="#654f3e" roughness={0.72} metalness={0.12} />
      </mesh>
      <mesh castShadow position={[0, 0.55, 0.22]}>
        <sphereGeometry args={[0.13, 18, 18]} />
        <meshStandardMaterial color="#ffd098" emissive="#f5cc85" emissiveIntensity={1.8} />
      </mesh>
      <pointLight
        castShadow
        color="#f5cc85"
        intensity={intensity}
        distance={12}
        decay={2}
        position={[0, 0.75, 0.65]}
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
    </group>
  );
}

function HallDecor() {
  return (
    <group>
      <mesh castShadow receiveShadow position={[0, 0.06, -2.4]}>
        <boxGeometry args={[2.4, 0.06, 5.6]} />
        <meshStandardMaterial color="#7c403c" roughness={0.88} metalness={0.04} />
      </mesh>
      <mesh castShadow receiveShadow position={[-4.85, 0.4, 0.5]}>
        <boxGeometry args={[1.4, 0.35, 0.5]} />
        <meshStandardMaterial color="#7d624e" roughness={0.84} />
      </mesh>
      <mesh castShadow receiveShadow position={[4.85, 0.4, -1.2]}>
        <boxGeometry args={[1.4, 0.35, 0.5]} />
        <meshStandardMaterial color="#7d624e" roughness={0.84} />
      </mesh>
    </group>
  );
}

function CastleLights() {
  return (
    <>
      <ambientLight color={WARM_BG} intensity={0.22} />
      <pointLight position={[-4.8, 3.6, 1.8]} color="#f5cc85" intensity={2.2} distance={18} decay={2} />
      <TorchSconce position={[-6.55, 2.35, 0.8]} intensity={42} />
      <TorchSconce position={[6.55, 2.35, -2.8]} intensity={24} />
    </>
  );
}

function HUDOverlay({ gameMode, pointerLocked }) {
  const modeText =
    gameMode === 'ROAMING'
      ? '当前模式：欧洲中世纪城堡内景漫游（未比赛）'
      : '当前模式：未启用';

  return (
    <Html fullscreen style={{ pointerEvents: 'none' }}>
      <div className="pointer-events-none absolute inset-0">
        <div className="pointer-events-auto absolute left-1/2 top-4 w-[min(92vw,980px)] -translate-x-1/2 rounded-3xl border border-stone-200/15 bg-stone-900/80 px-5 py-4 font-serif text-stone-100 shadow-[0_20px_60px_rgba(0,0,0,0.28)] backdrop-blur-md">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-xs uppercase tracking-[0.35em] text-amber-200/80">Warm Medieval Castle</div>
              <div className="mt-1 text-lg md:text-xl">{modeText}</div>
            </div>
            <button
              id="castle-roam-trigger"
              type="button"
              className="rounded-full border border-amber-200/35 bg-amber-100/10 px-4 py-2 text-sm text-amber-50 transition hover:bg-amber-100/20"
            >
              {pointerLocked ? '漫游已锁定，按 Esc 退出' : '点击进入第一人称漫游'}
            </button>
          </div>
          <div className="mt-3 text-sm leading-6 text-stone-300/90">
            WASD 在城堡内自由移动，鼠标控制抬头、低头和左右观察。当前阶段仅建设场景与氛围，不显示任何击剑比分或裁判元素。
          </div>
        </div>
      </div>
    </Html>
  );
}

function RoamingController({ gameMode, playerRef }) {
  const { camera } = useThree();

  useEffect(() => {
    camera.position.set(PLAYER_SPAWN.x, PLAYER_SPAWN.y + CAMERA_EYE_HEIGHT, PLAYER_SPAWN.z);
    camera.lookAt(0, 2.2, -6.6);
  }, [camera]);

  useFrame(() => {
    const player = playerRef.current;
    if (!player || gameMode !== 'ROAMING') return;

    const position = player.translation();
    TEMP_CAMERA.set(position.x, position.y + CAMERA_EYE_HEIGHT, position.z);
    camera.position.copy(TEMP_CAMERA);
  });

  return null;
}

function PlayerRoamingBody({ playerRef }) {
  return (
    <RigidBody
      ref={playerRef}
      colliders={false}
      mass={1}
      friction={2.8}
      linearDamping={8}
      angularDamping={10}
      enabledRotations={[false, false, false]}
      canSleep={false}
      position={[PLAYER_SPAWN.x, PLAYER_SPAWN.y, PLAYER_SPAWN.z]}
    >
      <CapsuleCollider args={[0.5, 0.35]} />
      <mesh visible={false}>
        <capsuleGeometry args={[0.35, 1.1, 8, 16]} />
        <meshStandardMaterial transparent opacity={0} />
      </mesh>
    </RigidBody>
  );
}

function MovementSystem({ gameMode, playerRef, keysRef }) {
  const { camera } = useThree();

  useFrame(() => {
    const player = playerRef.current;
    if (!player) return;

    const velocity = player.linvel();
    if (gameMode !== 'ROAMING') {
      player.setLinvel({ x: 0, y: velocity.y, z: 0 }, true);
      return;
    }

    // 鼠标的朝向控制由 PointerLockControls 直接写入 camera 的旋转。
    // 这里不再手动计算“人物面向角”，而是直接读取相机看向哪里。
    // 于是 W/A/S/D 会天然地跟随视线方向，形成第一人称漫游的前后左右位移。
    camera.getWorldDirection(TEMP_FORWARD);
    TEMP_FORWARD.y = 0;
    if (TEMP_FORWARD.lengthSq() < 0.0001) {
      TEMP_FORWARD.set(0, 0, -1);
    }
    TEMP_FORWARD.normalize();

    TEMP_RIGHT.crossVectors(TEMP_FORWARD, WORLD_UP).normalize();
    TEMP_MOVE.set(0, 0, 0);

    if (keysRef.current.KeyW) TEMP_MOVE.add(TEMP_FORWARD);
    if (keysRef.current.KeyS) TEMP_MOVE.sub(TEMP_FORWARD);
    if (keysRef.current.KeyD) TEMP_MOVE.add(TEMP_RIGHT);
    if (keysRef.current.KeyA) TEMP_MOVE.sub(TEMP_RIGHT);

    if (TEMP_MOVE.lengthSq() > 0) {
      TEMP_MOVE.normalize().multiplyScalar(MOVE_SPEED);
    }

    const position = player.translation();
    const clampedX = THREE.MathUtils.clamp(position.x, -ROOM_LIMIT, ROOM_LIMIT);
    const clampedZ = THREE.MathUtils.clamp(position.z, -ROOM_LIMIT, ROOM_LIMIT);

    if (clampedX !== position.x || clampedZ !== position.z) {
      player.setTranslation({ x: clampedX, y: position.y, z: clampedZ }, true);
    }

    // React 负责把按键意图翻译为 x/z 方向速度，Rapier 负责碰撞与阻挡。
    // 因此玩家既能流畅前进，又不会轻易穿过石墙或滑出地板边界。
    player.setLinvel({ x: TEMP_MOVE.x, y: velocity.y, z: TEMP_MOVE.z }, true);
  });

  return null;
}

export default function RealFencing() {
  const [gameMode] = useState('ROAMING');
  const [pointerLocked, setPointerLocked] = useState(false);
  const playerRef = useRef(null);
  const keysRef = useRef({});

  const { floorTexture, wallTexture } = useCastleTextures();

  useEffect(() => {
    const handleKeyDown = (event) => {
      keysRef.current[event.code] = true;
    };

    const handleKeyUp = (event) => {
      keysRef.current[event.code] = false;
    };

    const handlePointerLockChange = () => {
      setPointerLocked(Boolean(document.pointerLockElement));
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    document.addEventListener('pointerlockchange', handlePointerLockChange);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      document.removeEventListener('pointerlockchange', handlePointerLockChange);
    };
  }, []);

  return (
    <div className="relative mx-auto w-full overflow-hidden rounded-[32px] border border-stone-300/70 bg-stone-100 shadow-[0_30px_90px_rgba(88,63,37,0.18)]">
      <div className="h-[760px] w-full">
        <Canvas
          shadows
          dpr={[1, 1.75]}
          camera={{
            position: [PLAYER_SPAWN.x, PLAYER_SPAWN.y + CAMERA_EYE_HEIGHT, PLAYER_SPAWN.z],
            fov: 72,
            near: 0.1,
            far: 100,
          }}
        >
          <color attach="background" args={[WARM_BG]} />
          <fog attach="fog" args={[WARM_BG, 8, 28]} />

          <HUDOverlay gameMode={gameMode} pointerLocked={pointerLocked} />

          <Suspense fallback={null}>
            {/*
              Environment preset 会快速加载一张暖色 HDR 环境贴图。
              这里选择 sunset，是为了让石墙、天花、地板自动吃到黄昏式的琥珀反射，
              以最低成本把整个场景推向“温暖城堡内景”的视觉氛围。
            */}
            <Environment preset="sunset" />
          </Suspense>

          <CastleLights />

          <Physics gravity={[0, -9.81, 0]}>
            <CastleFloor floorTexture={floorTexture} />
            <CastleColliders />
            <CastleArchitecture wallTexture={wallTexture} />
            <HallDecor />
            <PlayerRoamingBody playerRef={playerRef} />
            <MovementSystem gameMode={gameMode} playerRef={playerRef} keysRef={keysRef} />
          </Physics>

          <RoamingController gameMode={gameMode} playerRef={playerRef} />

          {/*
            Html 会把这一层界面渲染成普通 DOM，因此可以直接写 Tailwind 样式。
            但它仍然和 3D 场景处于同一个 React 状态树里，所以 mode 与 pointer lock
            的变化会同时驱动顶部 UI 与底层场景，形成同步更新的 2D/3D 叠加层。
          */}
          <PointerLockControls selector="#castle-roam-trigger" />
        </Canvas>
      </div>
    </div>
  );
}
