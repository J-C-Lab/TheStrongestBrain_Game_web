import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import {
  Environment,
  OrbitControls,
  PointerLockControls,
} from '@react-three/drei';
import {
  BallCollider,
  CapsuleCollider,
  CuboidCollider,
  Physics,
  RigidBody,
} from '@react-three/rapier';
import * as THREE from 'three';

const ROUND_DURATION_SECONDS = 180;
const REST_DURATION_SECONDS = 60;
const LIGHT_DURATION_MS = 2000;
const DOUBLE_HIT_WINDOW_MS = 40;

const FENCER_GROUND_Y = -0.16;
const PLAYER_START = [0, FENCER_GROUND_Y, 2];
const OPPONENT_START = [0, FENCER_GROUND_Y, -2];

const PLAYER_FACING_Y = Math.PI;
const OPPONENT_FACING_Y = 0;
const FIRST_PERSON_CAMERA_Y = 1.86;
const LOOK_TARGET_Y = 1.72;
const THIRD_PERSON_TARGET_Y = 1.2;

const ROAM_SPEED = 3.8;
const FENCING_SPEED = 2.4;
const PLAYER_LUNGE_IMPULSE = 2.8;
const PLAYER_DASH_IMPULSE = 4.2;

const HALL_LIMIT_X = 6.2;
const HALL_LIMIT_Z = 6.2;
const PISTE_LIMIT_X = 0.92;
const PISTE_LIMIT_Z = 6.6;

const THRUST_DURATION = 0.24;
const PARRY_DURATION = 0.32;

const SWORD_LENGTH = 1.2;
const SWORD_CENTER_Z = 0.79;
const SWORD_TIP_Z = SWORD_CENTER_Z + SWORD_LENGTH / 2;

const WORLD_UP = new THREE.Vector3(0, 1, 0);
const CAMERA_FORWARD = new THREE.Vector3();
const CAMERA_RIGHT = new THREE.Vector3();
const TEMP_LOOK_TARGET = new THREE.Vector3();

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function formatTime(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function resetRigidBody(body, position) {
  if (!body) return;

  if (typeof body.setLinvel === 'function') {
    body.setLinvel({ x: 0, y: 0, z: 0 }, true);
  }

  if (typeof body.setAngvel === 'function') {
    body.setAngvel({ x: 0, y: 0, z: 0 }, true);
  }

  if (typeof body.setTranslation === 'function') {
    body.setTranslation(
      { x: position[0], y: position[1], z: position[2] },
      true,
    );
  }
}

function LightDot({ color }) {
  const colorClass =
    color === 'green'
      ? 'border-emerald-200 bg-emerald-400 shadow-[0_0_18px_rgba(74,222,128,0.85)]'
      : color === 'red'
        ? 'border-rose-200 bg-rose-400 shadow-[0_0_18px_rgba(251,113,133,0.85)]'
        : 'border-stone-500 bg-stone-800/30';

  return (
    <div
      className={`h-6 w-6 rounded-full border-2 transition-all duration-200 ${colorClass}`}
    />
  );
}

function PenaltyStrip({ cards }) {
  const items = [
    { key: 'yellow', active: cards.yellow, color: 'bg-amber-300' },
    { key: 'red', active: cards.red, color: 'bg-rose-400' },
    { key: 'black', active: cards.black, color: 'bg-stone-950' },
  ];

  return (
    <div className="flex items-center gap-1">
      {items.map((item) => (
        <div
          key={item.key}
          className={`h-4 w-2 rounded-sm border border-white/20 ${item.color} ${
            item.active ? 'opacity-100' : 'opacity-25'
          }`}
        />
      ))}
    </div>
  );
}

function FloatingToolbar({
  score,
  timer,
  round,
  gameMode,
  gameState,
  isResting,
  hitLights,
  penalties,
  onRestart,
  onToggleMode,
  onOpenSettings,
}) {
  const modeLabel =
    gameMode === 'FENCING' ? 'Tournament Hall | First Person' : 'Castle Hall | Roaming';

  const phaseLabel = isResting
    ? 'Resting'
    : gameState === 'HALTED'
      ? 'Judging Touch'
      : 'Live Bout';

  return (
    <div className="absolute top-[10px] left-0 z-20 w-full px-4">
      <div className="relative flex items-center justify-between rounded-xl border border-white/10 bg-stone-900/60 p-3 text-stone-100 shadow-2xl backdrop-blur-md">
        <div className="pointer-events-none flex flex-1 items-center">
          <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] tracking-[0.2em] text-stone-200/85 uppercase">
            <div>{modeLabel}</div>
            <div className="mt-0.5 text-[10px] tracking-[0.28em] text-stone-400">
              {phaseLabel}
            </div>
          </div>
        </div>

        <div className="pointer-events-none absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center gap-6">
          <PenaltyStrip cards={penalties.player} />
          <LightDot color={hitLights.player} />

          <div className="flex min-w-[160px] flex-col items-center">
            <div className="font-serif text-4xl leading-none text-white">
              {score.player} : {score.opponent}
            </div>
            <div className="mt-1 flex items-center gap-3 text-sm text-stone-300">
              <span className="font-mono">{formatTime(timer)}</span>
              <span className="font-serif tracking-[0.16em] text-stone-200">
                Round {round}
              </span>
            </div>
          </div>

          <LightDot color={hitLights.opponent} />
          <PenaltyStrip cards={penalties.opponent} />
        </div>

        <div className="pointer-events-auto relative z-10 flex flex-1 justify-end gap-3">
          <button
            type="button"
            onClick={onRestart}
            className="pointer-events-auto cursor-pointer rounded-md bg-white/10 px-3 py-1 text-xs text-stone-100 transition hover:bg-white/20"
          >
            Restart
          </button>
          <button
            type="button"
            onClick={onToggleMode}
            className="pointer-events-auto cursor-pointer rounded-md bg-white/10 px-3 py-1 text-xs text-stone-100 transition hover:bg-white/20"
          >
            {gameMode === 'FENCING' ? 'Back To Roam' : 'Enter First-Person'}
          </button>
          <button
            type="button"
            onClick={onOpenSettings}
            className="pointer-events-auto cursor-pointer rounded-md bg-white/10 px-3 py-1 text-xs text-stone-100 transition hover:bg-white/20"
          >
            Settings
          </button>
        </div>
      </div>
    </div>
  );
}

function HelmetMask({ visible }) {
  if (!visible) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-10">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_30%,rgba(0,0,0,0.25)_78%,rgba(0,0,0,0.6)_100%)]" />
      <svg
        className="absolute inset-0 h-full w-full opacity-60"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
      >
        <defs>
          <pattern
            id="fencing-helmet-grid"
            width="4"
            height="4"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M 0 0 L 4 4 M 4 0 L 0 4"
              stroke="rgba(0,0,0,0.65)"
              strokeWidth="0.28"
            />
          </pattern>
          <radialGradient id="fencing-helmet-fade" cx="50%" cy="45%" r="60%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.95)" />
            <stop offset="72%" stopColor="rgba(255,255,255,0.5)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0.05)" />
          </radialGradient>
        </defs>
        <path
          d="M10,8 Q50,-4 90,8 L96,82 Q50,102 4,82 Z"
          fill="url(#fencing-helmet-grid)"
        />
        <ellipse cx="50" cy="46" rx="33" ry="38" fill="url(#fencing-helmet-fade)" opacity="0.12" />
      </svg>
    </div>
  );
}

function SettingsModal({
  open,
  activeTab,
  onClose,
  onTabChange,
  systemSettings,
  matchSettings,
  onSystemChange,
  onMatchChange,
}) {
  const tabs = [
    { id: 'system', label: 'System' },
    { id: 'match', label: 'Match' },
    { id: 'about', label: 'About' },
  ];

  const sceneSwatches = [
    'from-stone-500 via-amber-200 to-stone-200',
    'from-zinc-700 via-stone-400 to-amber-100',
    'from-stone-800 via-stone-500 to-orange-200',
  ];

  if (!open) return null;

  return (
    <div
      className="pointer-events-auto fixed inset-0 z-[999] flex items-center justify-center bg-stone-950/35 p-6 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-5xl overflow-hidden rounded-3xl border border-white/15 bg-white/10 shadow-[0_20px_80px_rgba(15,10,5,0.45)] backdrop-blur-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex min-h-[540px]">
          <aside className="w-56 border-r border-white/10 bg-stone-950/25 p-5">
            <div className="font-serif text-2xl text-stone-50">Settings</div>
            <div className="mt-2 text-sm text-stone-300">
              Soft glass controls for system style and fencing presets.
            </div>

            <div className="mt-6 space-y-2">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => onTabChange(tab.id)}
                  className={`w-full rounded-xl px-4 py-3 text-left text-sm transition ${
                    activeTab === tab.id
                      ? 'bg-white/15 text-white shadow-lg'
                      : 'bg-white/5 text-stone-300 hover:bg-white/10'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </aside>

          <section className="flex-1 bg-gradient-to-br from-stone-50/8 via-white/5 to-amber-100/5 p-6 text-stone-100">
            <div className="flex items-start justify-between">
              <div>
                <div className="font-serif text-3xl">
                  {activeTab === 'system'
                    ? 'System Board'
                    : activeTab === 'match'
                      ? 'Match Module'
                      : 'About This Build'}
                </div>
                <div className="mt-2 max-w-2xl text-sm text-stone-300">
                  {activeTab === 'system' &&
                    'Shape the warm medieval castle atmosphere with muted palettes, serif typography, and scene presets.'}
                  {activeTab === 'match' &&
                    'Prepare the fencers, weapon rules, and handedness before connecting each option to gameplay logic.'}
                  {activeTab === 'about' &&
                    'Project identity and the rendering stack behind this retro-court fencing prototype.'}
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-stone-100 transition hover:bg-white/10"
              >
                Close
              </button>
            </div>

            {activeTab === 'system' && (
              <div className="mt-8 space-y-7">
                <div>
                  <div className="mb-3 text-xs uppercase tracking-[0.24em] text-stone-400">
                    Theme Color
                  </div>
                  <div className="flex gap-3">
                    {['#d9c8b2', '#c4b49b', '#9f8870', '#70818d'].map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => onSystemChange('themeColor', color)}
                        className={`h-10 w-10 rounded-full border-2 transition ${
                          systemSettings.themeColor === color
                            ? 'border-white shadow-[0_0_0_4px_rgba(255,255,255,0.12)]'
                            : 'border-white/20'
                        }`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>

                <div className="grid gap-5 md:grid-cols-2">
                  <label className="block">
                    <div className="mb-2 text-xs uppercase tracking-[0.24em] text-stone-400">
                      Theme Font
                    </div>
                    <select
                      value={systemSettings.themeFont}
                      onChange={(event) => onSystemChange('themeFont', event.target.value)}
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-stone-100 outline-none transition focus:border-white/25"
                    >
                      <option value="serif">Court Serif</option>
                      <option value="modern">Modern Sans</option>
                      <option value="display">Display Romantic</option>
                    </select>
                  </label>

                  <label className="block">
                    <div className="mb-2 text-xs uppercase tracking-[0.24em] text-stone-400">
                      Language
                    </div>
                    <select
                      value={systemSettings.language}
                      onChange={(event) => onSystemChange('language', event.target.value)}
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-stone-100 outline-none transition focus:border-white/25"
                    >
                      <option value="zh-CN">Chinese</option>
                      <option value="en-US">English</option>
                      <option value="fr-FR">French</option>
                    </select>
                  </label>
                </div>

                <div>
                  <div className="mb-3 text-xs uppercase tracking-[0.24em] text-stone-400">
                    Scene Presets
                  </div>
                  <div className="flex gap-4 overflow-x-auto pb-2">
                    {sceneSwatches.map((gradientClass, index) => (
                      <button
                        key={gradientClass}
                        type="button"
                        onClick={() => onSystemChange('scenePreset', `preset-${index + 1}`)}
                        className={`h-28 min-w-[170px] rounded-2xl border p-2 text-left transition ${
                          systemSettings.scenePreset === `preset-${index + 1}`
                            ? 'border-white/40 bg-white/10'
                            : 'border-white/10 bg-white/5'
                        }`}
                      >
                        <div className={`h-full rounded-xl bg-gradient-to-br ${gradientClass}`} />
                      </button>
                    ))}

                    <button
                      type="button"
                      className="flex h-28 min-w-[170px] items-center justify-center rounded-2xl border border-dashed border-white/20 bg-white/5 text-sm text-stone-300 transition hover:bg-white/10"
                    >
                      Upload Local Scene
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'match' && (
              <div className="mt-8 grid gap-6 lg:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                  <div className="text-xs uppercase tracking-[0.24em] text-stone-400">
                    Fencer Uniform
                  </div>
                  <div className="mt-4 flex gap-3">
                    {['#ffffff', '#f0e9df', '#d8d0c2', '#c9d4df'].map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => onMatchChange('uniformColor', color)}
                        className={`h-11 w-11 rounded-full border-2 transition ${
                          matchSettings.uniformColor === color
                            ? 'border-white shadow-[0_0_0_4px_rgba(255,255,255,0.12)]'
                            : 'border-white/20'
                        }`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                  <div className="text-xs uppercase tracking-[0.24em] text-stone-400">
                    Sword Hand
                  </div>
                  <div className="mt-4 flex gap-3">
                    {['left', 'right'].map((value) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => onMatchChange('handedness', value)}
                        className={`rounded-xl px-4 py-2 text-sm transition ${
                          matchSettings.handedness === value
                            ? 'bg-white/15 text-white'
                            : 'bg-white/5 text-stone-300 hover:bg-white/10'
                        }`}
                      >
                        {value === 'left' ? 'Left Hand' : 'Right Hand'}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 p-5 lg:col-span-2">
                  <div className="text-xs uppercase tracking-[0.24em] text-stone-400">
                    Weapon Type
                  </div>
                  <div className="mt-4 flex flex-wrap gap-3">
                    {['Epee', 'Foil', 'Sabre'].map((weapon) => (
                      <button
                        key={weapon}
                        type="button"
                        onClick={() => onMatchChange('weapon', weapon)}
                        className={`rounded-xl px-4 py-2 text-sm transition ${
                          matchSettings.weapon === weapon
                            ? 'bg-white/15 text-white'
                            : 'bg-white/5 text-stone-300 hover:bg-white/10'
                        }`}
                      >
                        {weapon}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'about' && (
              <div className="mt-8 grid gap-4 md:grid-cols-3">
                {[
                  { label: 'Version', value: 'V 1.0' },
                  { label: 'Developer', value: 'CholeUnique' },
                  { label: 'Engine', value: 'React Three Fiber & Rapier' },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="rounded-2xl border border-white/10 bg-white/5 p-5"
                  >
                    <div className="text-xs uppercase tracking-[0.24em] text-stone-400">
                      {item.label}
                    </div>
                    <div className="mt-3 font-serif text-2xl text-stone-50">
                      {item.value}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function RealisticCastle() {
  return (
    <group>
      <color attach="background" args={['#c4ab8b']} />
      <fog attach="fog" args={['#e3d3bf', 10, 34]} />

      <ambientLight intensity={0.35} color="#f5ede0" />
      <directionalLight
        position={[5, 10, 3]}
        intensity={1.2}
        color="#ffe3bf"
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-near={0.5}
        shadow-camera-far={40}
        shadow-camera-left={-14}
        shadow-camera-right={14}
        shadow-camera-top={14}
        shadow-camera-bottom={-14}
      />
      <pointLight position={[-5, 3.6, 2]} intensity={22} distance={14} color="#f5cc85" />
      <pointLight position={[5, 3.6, -2]} intensity={18} distance={12} color="#efbb70" />
      <Environment preset="sunset" background blur={0.05} />

      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <planeGeometry args={[15, 15]} />
        <meshPhysicalMaterial
          color="#d4c5b0"
          roughness={0.1}
          metalness={0.2}
          clearcoat={0.55}
          reflectivity={0.75}
        />
      </mesh>

      <mesh position={[0, 3.2, -7]} receiveShadow castShadow>
        <boxGeometry args={[14.5, 6.5, 0.55]} />
        <meshStandardMaterial color="#cbb293" roughness={0.9} metalness={0.05} />
      </mesh>

      <mesh position={[0, 3.2, 7]} receiveShadow castShadow>
        <boxGeometry args={[14.5, 6.5, 0.55]} />
        <meshStandardMaterial color="#cbb293" roughness={0.9} metalness={0.05} />
      </mesh>

      <mesh position={[-7, 3.2, 0]} receiveShadow castShadow>
        <boxGeometry args={[0.55, 6.5, 14.5]} />
        <meshStandardMaterial color="#c5a782" roughness={0.92} metalness={0.04} />
      </mesh>

      <mesh position={[7, 3.2, 0]} receiveShadow castShadow>
        <boxGeometry args={[0.55, 6.5, 14.5]} />
        <meshStandardMaterial color="#c5a782" roughness={0.92} metalness={0.04} />
      </mesh>

      <mesh position={[0, 6.45, 0]} receiveShadow>
        <boxGeometry args={[14.5, 0.4, 14.5]} />
        <meshStandardMaterial color="#c7b090" roughness={0.88} metalness={0.03} />
      </mesh>

      {[-4.8, -1.6, 1.6, 4.8].map((x) => (
        <group key={x} position={[x, 0, -6.7]}>
          <mesh position={[0, 1.8, 0]} castShadow receiveShadow>
            <cylinderGeometry args={[0.24, 0.32, 3.8, 24]} />
            <meshStandardMaterial color="#baa184" roughness={0.92} metalness={0.04} />
          </mesh>
          <mesh position={[0, 4.15, 0]} castShadow receiveShadow>
            <boxGeometry args={[0.75, 0.25, 0.55]} />
            <meshStandardMaterial color="#d3bea1" roughness={0.8} metalness={0.06} />
          </mesh>
        </group>
      ))}

      <group position={[0, 0.2, -6.72]}>
        <mesh position={[0, 2.6, 0.02]} castShadow receiveShadow>
          <boxGeometry args={[4.2, 5.2, 0.4]} />
          <meshStandardMaterial color="#c5a782" roughness={0.92} metalness={0.03} />
        </mesh>
        <mesh position={[0, 2.15, 0.26]} castShadow receiveShadow>
          <boxGeometry args={[1.7, 3.1, 0.15]} />
          <meshStandardMaterial color="#1b1612" roughness={0.35} metalness={0.2} />
        </mesh>
        <mesh position={[0, 3.72, 0.18]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <torusGeometry args={[0.85, 0.18, 18, 48, Math.PI]} />
          <meshStandardMaterial color="#c8ad89" roughness={0.72} metalness={0.08} />
        </mesh>
      </group>

      {[-3.2, 3.2].map((x) => (
        <group key={x} position={[x, 0, -6.65]}>
          <mesh position={[0, 4.1, 0.1]} castShadow receiveShadow>
            <boxGeometry args={[0.75, 2.6, 0.14]} />
            <meshStandardMaterial
              color="#d2c0a8"
              emissive="#f4d7a2"
              emissiveIntensity={0.15}
              roughness={0.18}
              metalness={0.08}
            />
          </mesh>
          <mesh position={[0, 5.5, 0.12]} rotation={[Math.PI / 2, 0, 0]} castShadow>
            <torusGeometry args={[0.38, 0.08, 12, 32, Math.PI]} />
            <meshStandardMaterial color="#b69774" roughness={0.7} metalness={0.08} />
          </mesh>
        </group>
      ))}

      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[7.5, 0.12, 7.5]} position={[0, -0.12, 0]} />
        <CuboidCollider args={[0.3, 3.2, 7.1]} position={[-7.1, 3.2, 0]} />
        <CuboidCollider args={[0.3, 3.2, 7.1]} position={[7.1, 3.2, 0]} />
        <CuboidCollider args={[7.1, 3.2, 0.3]} position={[0, 3.2, -7.1]} />
        <CuboidCollider args={[7.1, 3.2, 0.3]} position={[0, 3.2, 7.1]} />
      </RigidBody>
    </group>
  );
}

function PisteLine({ position, size, color }) {
  return (
    <mesh position={position} receiveShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial color={color} roughness={0.45} metalness={0.3} />
    </mesh>
  );
}

function Piste() {
  return (
    <group position={[0, 0.03, 0]}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[2, 0.05, 14]} />
        <meshStandardMaterial
          color="#a0a4a8"
          metalness={0.6}
          roughness={0.4}
          envMapIntensity={1.2}
        />
      </mesh>

      <PisteLine position={[0, 0.03, 0]} size={[0.04, 0.005, 14]} color="#ede8dd" />
      <PisteLine position={[0, 0.031, 2]} size={[2, 0.005, 0.04]} color="#f1ede5" />
      <PisteLine position={[0, 0.031, -2]} size={[2, 0.005, 0.04]} color="#f1ede5" />
      <PisteLine position={[0, 0.031, 5]} size={[2, 0.005, 0.04]} color="#f5dfd5" />
      <PisteLine position={[0, 0.031, -5]} size={[2, 0.005, 0.04]} color="#f5dfd5" />
      <PisteLine position={[0, 0.031, 6.25]} size={[2, 0.005, 1.5]} color="#c75a57" />
      <PisteLine position={[0, 0.031, -6.25]} size={[2, 0.005, 1.5]} color="#c75a57" />
    </group>
  );
}

function FencerModel({
  id,
  color,
  swordRef,
  onTipIntersection,
  handedness,
  hideBody,
}) {
  const handX = handedness === 'left' ? -0.22 : 0.22;

  return (
    <group>
      {!hideBody && (
        <>
          <mesh position={[0, 1.02, 0]} castShadow receiveShadow>
            <capsuleGeometry args={[0.28, 1.3, 10, 18]} />
            <meshStandardMaterial color={color} roughness={0.5} metalness={0.02} />
          </mesh>

          <mesh position={[0, 2.0, 0.02]} castShadow receiveShadow>
            <sphereGeometry args={[0.26, 24, 24]} />
            <meshStandardMaterial color="#111214" roughness={0.7} metalness={0.15} />
          </mesh>

          <mesh position={[handX, 1.35, 0.22]} rotation={[0, 0, handedness === 'left' ? 0.35 : -0.35]}>
            <capsuleGeometry args={[0.08, 0.62, 6, 10]} />
            <meshStandardMaterial color={color} roughness={0.52} metalness={0.02} />
          </mesh>
        </>
      )}

      <group ref={swordRef} position={[handX, 1.22, 0.46]}>
        <mesh castShadow receiveShadow rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0.08]}>
          <cylinderGeometry args={[0.055, 0.055, 0.12, 18]} />
          <meshStandardMaterial color="#b5987a" roughness={0.55} metalness={0.35} />
        </mesh>

        <mesh castShadow receiveShadow position={[0, 0, 0.17]}>
          <sphereGeometry args={[0.1, 20, 20]} />
          <meshStandardMaterial color="#d7c2a1" roughness={0.22} metalness={0.65} />
        </mesh>

        <mesh castShadow receiveShadow rotation={[Math.PI / 2, 0, 0]} position={[0, 0, SWORD_CENTER_Z]}>
          <cylinderGeometry args={[0.02, 0.02, SWORD_LENGTH, 14]} />
          <meshStandardMaterial color="#c6c8cb" metalness={1} roughness={0.1} />
        </mesh>

        <mesh castShadow receiveShadow position={[0, 0, SWORD_TIP_Z]}>
          <sphereGeometry args={[0.035, 14, 14]} />
          <meshStandardMaterial color="#eef2f4" metalness={0.95} roughness={0.12} />
        </mesh>

        <BallCollider
          args={[0.05]}
          sensor
          position={[0, 0, SWORD_TIP_Z]}
          onIntersectionEnter={onTipIntersection}
          userData={{ characterId: id, colliderType: 'tip' }}
        />
      </group>
    </group>
  );
}

function Fencer({
  id,
  type,
  position,
  facingY,
  bodyRef,
  swordRef,
  color,
  handedness,
  onTipIntersection,
  hideBody,
}) {
  return (
    <RigidBody
      ref={bodyRef}
      type={type}
      colliders={false}
      canSleep={false}
      lockRotations
      linearDamping={6}
      angularDamping={10}
      position={position}
      userData={{ characterId: id, colliderType: 'body' }}
    >
      <CapsuleCollider
        args={[0.58, 0.28]}
        position={[0, 1.02, 0]}
        userData={{ characterId: id, colliderType: 'body' }}
      />

      <group rotation={[0, facingY, 0]}>
        <FencerModel
          id={id}
          color={color}
          swordRef={swordRef}
          onTipIntersection={onTipIntersection}
          handedness={handedness}
          hideBody={hideBody}
        />
      </group>
    </RigidBody>
  );
}

function SceneSystem({
  gameMode,
  gameState,
  isResting,
  isSettingsOpen,
  keysRef,
  aimRef,
  playerActionRef,
  opponentActionRef,
  playerBodyRef,
  opponentBodyRef,
  playerSwordRef,
  opponentSwordRef,
}) {
  const { camera, clock } = useThree();
  const orbitRef = useRef(null);

  useEffect(() => {
    const playerBody = playerBodyRef.current;
    const opponentBody = opponentBodyRef.current;
    if (!playerBody || !opponentBody) return;

    const playerPosition = playerBody.translation();
    const opponentPosition = opponentBody.translation();

    if (gameMode === 'FENCING') {
      camera.position.set(
        playerPosition.x,
        playerPosition.y + FIRST_PERSON_CAMERA_Y,
        playerPosition.z,
      );
      camera.lookAt(
        opponentPosition.x,
        opponentPosition.y + LOOK_TARGET_Y,
        opponentPosition.z,
      );
    } else {
      camera.position.set(playerPosition.x + 4.8, 3.6, playerPosition.z + 5.4);
      camera.lookAt(playerPosition.x, playerPosition.y + THIRD_PERSON_TARGET_Y, playerPosition.z);
    }
  }, [camera, gameMode, playerBodyRef, opponentBodyRef]);

  useFrame((state, delta) => {
    const playerBody = playerBodyRef.current;
    const opponentBody = opponentBodyRef.current;

    if (!playerBody || !opponentBody) return;

    const playerPosition = playerBody.translation();
    const opponentPosition = opponentBody.translation();
    const inputLocked = isSettingsOpen || isResting || gameState !== 'PLAYING';

    if (gameMode === 'ROAMING') {
      // In roaming mode the keyboard direction is projected onto the camera forward/right
      // vectors, then the resulting 2D motion is written to the player rigid body velocity.
      camera.getWorldDirection(CAMERA_FORWARD);
      CAMERA_FORWARD.y = 0;

      if (CAMERA_FORWARD.lengthSq() < 0.0001) {
        CAMERA_FORWARD.set(0, 0, -1);
      }

      CAMERA_FORWARD.normalize();
      CAMERA_RIGHT.crossVectors(CAMERA_FORWARD, WORLD_UP).normalize();

      let moveX = 0;
      let moveZ = 0;

      if (keysRef.current.KeyW) {
        moveX += CAMERA_FORWARD.x;
        moveZ += CAMERA_FORWARD.z;
      }
      if (keysRef.current.KeyS) {
        moveX -= CAMERA_FORWARD.x;
        moveZ -= CAMERA_FORWARD.z;
      }
      if (keysRef.current.KeyD) {
        moveX += CAMERA_RIGHT.x;
        moveZ += CAMERA_RIGHT.z;
      }
      if (keysRef.current.KeyA) {
        moveX -= CAMERA_RIGHT.x;
        moveZ -= CAMERA_RIGHT.z;
      }

      const moveLength = Math.hypot(moveX, moveZ) || 1;
      moveX /= moveLength;
      moveZ /= moveLength;

      const currentVelocity = playerBody.linvel();
      if (!isSettingsOpen && (moveX !== 0 || moveZ !== 0)) {
        playerBody.wakeUp();
      }
      playerBody.setLinvel(
        {
          x: isSettingsOpen ? 0 : moveX * ROAM_SPEED,
          y: currentVelocity.y,
          z: isSettingsOpen ? 0 : moveZ * ROAM_SPEED,
        },
        true,
      );

      const clampedX = clamp(playerPosition.x, -HALL_LIMIT_X, HALL_LIMIT_X);
      const clampedZ = clamp(playerPosition.z, -HALL_LIMIT_Z, HALL_LIMIT_Z);
      if (clampedX !== playerPosition.x || clampedZ !== playerPosition.z) {
        playerBody.setTranslation(
          { x: clampedX, y: playerPosition.y, z: clampedZ },
          true,
        );
      }

      if (orbitRef.current) {
        orbitRef.current.target.set(
          playerPosition.x,
          playerPosition.y + THIRD_PERSON_TARGET_Y,
          playerPosition.z,
        );
        orbitRef.current.update();
      }
    } else {
      let axisX = 0;
      let axisZ = 0;

      if (keysRef.current.KeyA) axisX -= 1;
      if (keysRef.current.KeyD) axisX += 1;
      if (keysRef.current.KeyW) axisZ -= 1;
      if (keysRef.current.KeyS) axisZ += 1;

      const axisLength = Math.hypot(axisX, axisZ) || 1;
      axisX /= axisLength;
      axisZ /= axisLength;

      const currentVelocity = playerBody.linvel();
      if (!inputLocked && (axisX !== 0 || axisZ !== 0)) {
        playerBody.wakeUp();
      }
      playerBody.setLinvel(
        {
          x: inputLocked ? 0 : axisX * FENCING_SPEED,
          y: currentVelocity.y,
          z: inputLocked ? 0 : axisZ * FENCING_SPEED,
        },
        true,
      );

      const clampedX = clamp(playerPosition.x, -PISTE_LIMIT_X, PISTE_LIMIT_X);
      const clampedZ = clamp(playerPosition.z, -PISTE_LIMIT_Z, PISTE_LIMIT_Z);
      if (clampedX !== playerPosition.x || clampedZ !== playerPosition.z) {
        playerBody.setTranslation(
          { x: clampedX, y: playerPosition.y, z: clampedZ },
          true,
        );
      }

      camera.position.set(
        playerPosition.x,
        playerPosition.y + FIRST_PERSON_CAMERA_Y,
        playerPosition.z,
      );
    }

    const elapsed = clock.getElapsedTime();

    if (gameMode === 'FENCING') {
      const targetX = clamp(
        playerPosition.x * 0.58 + Math.sin(elapsed * 0.8) * 0.18,
        -PISTE_LIMIT_X,
        PISTE_LIMIT_X,
      );
      const preferredZ = clamp(playerPosition.z - 3.1, -5.2, 5.4);
      const nextOpponentX = THREE.MathUtils.lerp(opponentPosition.x, targetX, 0.045);
      const nextOpponentZ = THREE.MathUtils.lerp(opponentPosition.z, preferredZ, 0.05);

      opponentBody.setNextKinematicTranslation({
        x: nextOpponentX,
        y: FENCER_GROUND_Y,
        z: nextOpponentZ,
      });

      if (!inputLocked && elapsed > opponentActionRef.current.nextDecisionAt) {
        opponentActionRef.current.nextDecisionAt = elapsed + 1.8 + Math.random() * 1.4;
        if (Math.abs(playerPosition.z - opponentPosition.z) < 3.6) {
          opponentActionRef.current.thrustTime = THRUST_DURATION;
        } else {
          opponentActionRef.current.parryTime = PARRY_DURATION;
        }
      }
    }

    playerActionRef.current.thrustTime = Math.max(
      0,
      playerActionRef.current.thrustTime - delta,
    );
    playerActionRef.current.parryTime = Math.max(
      0,
      playerActionRef.current.parryTime - delta,
    );
    opponentActionRef.current.thrustTime = Math.max(
      0,
      opponentActionRef.current.thrustTime - delta,
    );
    opponentActionRef.current.parryTime = Math.max(
      0,
      opponentActionRef.current.parryTime - delta,
    );

    if (playerSwordRef.current) {
      const thrustProgress =
        playerActionRef.current.thrustTime > 0
          ? 1 - playerActionRef.current.thrustTime / THRUST_DURATION
          : 0;
      const parryProgress =
        playerActionRef.current.parryTime > 0
          ? 1 - playerActionRef.current.parryTime / PARRY_DURATION
          : 0;

      const thrustOffset = Math.sin(thrustProgress * Math.PI) * 0.58;
      const parrySweep = Math.sin(parryProgress * Math.PI) * 0.95;

      // Mouse deltas are accumulated into a compact aim range. That range is then
      // remapped into sword yaw/pitch so the blade tip tracks the user's screen aim.
      playerSwordRef.current.rotation.x = -0.18 + aimRef.current.y * 0.8;
      playerSwordRef.current.rotation.y = aimRef.current.x * 0.95;
      playerSwordRef.current.rotation.z = parrySweep;
      playerSwordRef.current.position.z = 0.46 + thrustOffset;
    }

    if (opponentSwordRef.current) {
      const opponentThrustProgress =
        opponentActionRef.current.thrustTime > 0
          ? 1 - opponentActionRef.current.thrustTime / THRUST_DURATION
          : 0;
      const opponentParryProgress =
        opponentActionRef.current.parryTime > 0
          ? 1 - opponentActionRef.current.parryTime / PARRY_DURATION
          : 0;

      const opponentThrustOffset = Math.sin(opponentThrustProgress * Math.PI) * 0.46;
      const opponentParrySweep = Math.sin(opponentParryProgress * Math.PI) * -0.85;

      TEMP_LOOK_TARGET.set(
        playerPosition.x - opponentPosition.x,
        (playerPosition.y + LOOK_TARGET_Y) - (opponentPosition.y + LOOK_TARGET_Y),
        playerPosition.z - opponentPosition.z,
      );

      const targetYaw = clamp(TEMP_LOOK_TARGET.x * 0.24, -0.3, 0.3);
      const targetPitch = clamp(TEMP_LOOK_TARGET.y * 0.38, -0.18, 0.22);

      opponentSwordRef.current.rotation.x = -0.12 + targetPitch;
      opponentSwordRef.current.rotation.y = targetYaw;
      opponentSwordRef.current.rotation.z = opponentParrySweep;
      opponentSwordRef.current.position.z = 0.46 + opponentThrustOffset;
    }
  });

  return gameMode === 'ROAMING' ? (
    <OrbitControls
      ref={orbitRef}
      enablePan={false}
      maxPolarAngle={Math.PI / 2.05}
      minPolarAngle={Math.PI / 4}
      minDistance={4.5}
      maxDistance={10}
    />
  ) : (
    <PointerLockControls selector="#real-fencing-canvas" />
  );
}

export default function RealFencing() {
  const playerBodyRef = useRef(null);
  const opponentBodyRef = useRef(null);
  const playerSwordRef = useRef(null);
  const opponentSwordRef = useRef(null);
  const gameModeRef = useRef('ROAMING');
  const gameStateRef = useRef('PLAYING');
  const isRestingRef = useRef(false);
  const isSettingsOpenRef = useRef(false);

  const keysRef = useRef({});
  const aimRef = useRef({ x: 0, y: 0 });
  const playerActionRef = useRef({ thrustTime: 0, parryTime: 0 });
  const opponentActionRef = useRef({
    thrustTime: 0,
    parryTime: 0,
    nextDecisionAt: 1.5,
  });

  const lastHitRef = useRef({ time: null, characterId: null });
  const hitDecisionTimeoutRef = useRef(null);
  const resumeTimeoutRef = useRef(null);
  const latestStateRef = useRef({
    gameMode: 'ROAMING',
    gameState: 'PLAYING',
    isResting: false,
    isSettingsOpen: false,
  });

  const [gameMode, setGameMode] = useState('ROAMING');
  const [gameState, setGameState] = useState('PLAYING');
  const [score, setScore] = useState({ player: 0, opponent: 0 });
  const [round, setRound] = useState(1);
  const [timer, setTimer] = useState(ROUND_DURATION_SECONDS);
  const [hitLights, setHitLights] = useState({ player: null, opponent: null });
  const [isResting, setIsResting] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState('system');
  const [penalties] = useState({
    player: { yellow: false, red: false, black: false },
    opponent: { yellow: false, red: false, black: false },
  });
  const [systemSettings, setSystemSettings] = useState({
    themeColor: '#d9c8b2',
    themeFont: 'serif',
    language: 'zh-CN',
    scenePreset: 'preset-1',
  });
  const [matchSettings, setMatchSettings] = useState({
    uniformColor: '#ffffff',
    handedness: 'left',
    weapon: 'Epee',
  });

  useEffect(() => {
    latestStateRef.current = { gameMode, gameState, isResting, isSettingsOpen };
  }, [gameMode, gameState, isResting, isSettingsOpen]);

  useEffect(() => {
    gameModeRef.current = gameMode;
    gameStateRef.current = gameState;
    isRestingRef.current = isResting;
    isSettingsOpenRef.current = isSettingsOpen;
  }, [gameMode, gameState, isResting, isSettingsOpen]);

  const clearPendingHit = useCallback(() => {
    if (hitDecisionTimeoutRef.current) {
      window.clearTimeout(hitDecisionTimeoutRef.current);
      hitDecisionTimeoutRef.current = null;
    }

    lastHitRef.current = { time: null, characterId: null };
  }, []);

  const clearResumeTimeout = useCallback(() => {
    if (resumeTimeoutRef.current) {
      window.clearTimeout(resumeTimeoutRef.current);
      resumeTimeoutRef.current = null;
    }
  }, []);

  const resetFencers = useCallback(() => {
    resetRigidBody(playerBodyRef.current, PLAYER_START);
    resetRigidBody(opponentBodyRef.current, OPPONENT_START);
    aimRef.current.x = 0;
    aimRef.current.y = 0;
    playerActionRef.current.thrustTime = 0;
    playerActionRef.current.parryTime = 0;
    opponentActionRef.current.thrustTime = 0;
    opponentActionRef.current.parryTime = 0;
  }, []);

  const startRestPhase = useCallback(() => {
    clearPendingHit();
    clearResumeTimeout();
    setGameState('RESTING');
    setIsResting(true);
    setTimer(REST_DURATION_SECONDS);
    setHitLights({ player: null, opponent: null });
    resetFencers();
  }, [clearPendingHit, clearResumeTimeout, resetFencers]);

  const finalizeScore = useCallback(
    (result) => {
      const current = latestStateRef.current;
      if (
        current.gameMode !== 'FENCING' ||
        current.gameState !== 'PLAYING' ||
        current.isResting
      ) {
        clearPendingHit();
        return;
      }

      clearPendingHit();
      clearResumeTimeout();

      setGameState('HALTED');

      setScore((previousScore) => {
        const nextScore = { ...previousScore };
        let lights = { player: null, opponent: null };

        if (result === 'player') {
          nextScore.player += 1;
          lights = { player: 'green', opponent: 'red' };
        } else if (result === 'opponent') {
          nextScore.opponent += 1;
          lights = { player: 'red', opponent: 'green' };
        } else if (result === 'double') {
          nextScore.player += 1;
          nextScore.opponent += 1;
          lights = { player: 'green', opponent: 'green' };
        }

        setHitLights(lights);

        // Touch scoring pauses the bout for two seconds, keeps the lamps lit,
        // then either resumes play or transitions into the one-minute rest phase.
        resumeTimeoutRef.current = window.setTimeout(() => {
          setHitLights({ player: null, opponent: null });
          resetFencers();

          if (nextScore.player >= 5 || nextScore.opponent >= 5) {
            startRestPhase();
          } else {
            setGameState('PLAYING');
          }
        }, LIGHT_DURATION_MS);

        return nextScore;
      });
    },
    [clearPendingHit, clearResumeTimeout, resetFencers, startRestPhase],
  );

  const registerHit = useCallback(
    (hitBy, targetId) => {
      const current = latestStateRef.current;
      if (
        current.gameMode !== 'FENCING' ||
        current.gameState !== 'PLAYING' ||
        current.isResting ||
        current.isSettingsOpen ||
        hitBy === targetId ||
        targetId === undefined
      ) {
        return;
      }

      const now = performance.now();
      const pending = lastHitRef.current;
      console.log(`[rapier-hit] ${hitBy} touched ${targetId} at ${now.toFixed(1)}ms`);

      // The 40ms double-touch window works like fencing apparatus logic:
      // first touch is stored, a short timer waits for a second valid touch,
      // and if the rival lands within <= 40ms both lamps are awarded together.
      if (pending.time === null) {
        lastHitRef.current = { time: now, characterId: hitBy };
        hitDecisionTimeoutRef.current = window.setTimeout(() => {
          finalizeScore(hitBy);
        }, DOUBLE_HIT_WINDOW_MS);
        return;
      }

      if (pending.characterId === hitBy) return;

      const diff = now - pending.time;
      clearPendingHit();

      if (diff <= DOUBLE_HIT_WINDOW_MS) {
        finalizeScore('double');
      } else {
        finalizeScore(pending.characterId);
      }
    },
    [clearPendingHit, finalizeScore],
  );

  const handlePlayerTipEnter = useCallback(
    (event) => {
      const targetId =
        event.other?.colliderObject?.userData?.characterId ??
        event.other?.rigidBodyObject?.userData?.characterId;

      if (targetId !== 'opponent') return;
      registerHit('player', targetId);
    },
    [registerHit],
  );

  const handleOpponentTipEnter = useCallback(
    (event) => {
      const targetId =
        event.other?.colliderObject?.userData?.characterId ??
        event.other?.rigidBodyObject?.userData?.characterId;

      if (targetId !== 'player') return;
      registerHit('opponent', targetId);
    },
    [registerHit],
  );

  const handleRestart = useCallback(() => {
    clearPendingHit();
    clearResumeTimeout();
    setScore({ player: 0, opponent: 0 });
    setRound(1);
    setTimer(ROUND_DURATION_SECONDS);
    setGameState('PLAYING');
    setIsResting(false);
    setHitLights({ player: null, opponent: null });
    resetFencers();
  }, [clearPendingHit, clearResumeTimeout, resetFencers]);

  const handleToggleMode = useCallback(() => {
    setGameMode((previousMode) => {
      const nextMode = previousMode === 'FENCING' ? 'ROAMING' : 'FENCING';
      keysRef.current = {};

      if (nextMode === 'ROAMING' && document.pointerLockElement) {
        document.exitPointerLock();
      }

      resetFencers();
      return nextMode;
    });
  }, [resetFencers]);

  const handleOpenSettings = useCallback(() => {
    console.log('Settings Button Clicked!');
    if (document.pointerLockElement) {
      document.exitPointerLock();
    }
    setIsSettingsOpen(true);
  }, []);

  useEffect(() => {
    const handleKeyDown = (event) => {
      keysRef.current[event.code] = true;
      console.log('按键触发:', event.code, '当前模式:', gameModeRef.current);

      if (isSettingsOpenRef.current) return;

      if (event.code === 'Space') {
        event.preventDefault();
      }

      if (gameModeRef.current !== 'FENCING') return;
      if (gameStateRef.current !== 'PLAYING') return;
      if (isRestingRef.current) return;

      const playerRigidBody = playerBodyRef.current;
      if (!playerRigidBody) return;

      if (event.code === 'Space' && !event.repeat) {
        playerRigidBody.wakeUp();
        playerRigidBody.applyImpulse(
          { x: 0, y: 0, z: -PLAYER_LUNGE_IMPULSE },
          true,
        );
      }

      if (event.code === 'Enter' && !event.repeat) {
        playerRigidBody.wakeUp();
        playerRigidBody.applyImpulse(
          { x: 0, y: 0, z: -PLAYER_DASH_IMPULSE },
          true,
        );
      }

      if (event.code === 'KeyJ' && !event.repeat) {
        playerActionRef.current.thrustTime = THRUST_DURATION;
      }

      if (event.code === 'KeyK' && !event.repeat) {
        playerActionRef.current.parryTime = PARRY_DURATION;
      }
    };

    const handleKeyUp = (event) => {
      keysRef.current[event.code] = false;
    };

    const handleMouseMove = (event) => {
      if (gameModeRef.current !== 'FENCING') return;
      if (isSettingsOpenRef.current) return;

      if (document.pointerLockElement) {
        aimRef.current.x = clamp(aimRef.current.x + event.movementX * 0.0025, -0.55, 0.55);
        aimRef.current.y = clamp(aimRef.current.y + event.movementY * 0.002, -0.35, 0.35);
      } else {
        const normalizedX = event.clientX / window.innerWidth - 0.5;
        const normalizedY = event.clientY / window.innerHeight - 0.5;
        aimRef.current.x = clamp(normalizedX * 0.9, -0.55, 0.55);
        aimRef.current.y = clamp(normalizedY * 0.7, -0.35, 0.35);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('mousemove', handleMouseMove);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, []);

  useEffect(() => {
    // The state machine has three time phases:
    // 1. PLAYING: 180 seconds count down.
    // 2. HALTED: timer pauses while touch lamps stay on.
    // 3. RESTING: 60 seconds count down, then the next round starts with a fresh score.
    if (gameMode !== 'FENCING') return undefined;
    if (gameState === 'HALTED') return undefined;

    if (timer <= 0) {
      if (isResting) {
        setRound((previousRound) => previousRound + 1);
        setScore({ player: 0, opponent: 0 });
        setTimer(ROUND_DURATION_SECONDS);
        setIsResting(false);
        setGameState('PLAYING');
        setHitLights({ player: null, opponent: null });
        resetFencers();
      } else {
        startRestPhase();
      }

      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setTimer((previousTimer) => previousTimer - 1);
    }, 1000);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [gameMode, gameState, isResting, timer, resetFencers, startRestPhase]);

  useEffect(() => {
    return () => {
      clearPendingHit();
      clearResumeTimeout();
    };
  }, [clearPendingHit, clearResumeTimeout]);

  const sceneStyle = useMemo(
    () => ({
      '--fencing-theme-color': systemSettings.themeColor,
    }),
    [systemSettings.themeColor],
  );

  return (
    <div
      className="relative w-full h-[75vh] min-h-[600px] overflow-hidden rounded-xl shadow-2xl"
      style={sceneStyle}
    >
      <FloatingToolbar
        score={score}
        timer={timer}
        round={round}
        gameMode={gameMode}
        gameState={gameState}
        isResting={isResting}
        hitLights={hitLights}
        penalties={penalties}
        onRestart={handleRestart}
        onToggleMode={handleToggleMode}
        onOpenSettings={handleOpenSettings}
      />

      <HelmetMask visible={gameMode === 'FENCING'} />

      <SettingsModal
        open={isSettingsOpen}
        activeTab={settingsTab}
        onClose={() => setIsSettingsOpen(false)}
        onTabChange={setSettingsTab}
        systemSettings={systemSettings}
        matchSettings={matchSettings}
        onSystemChange={(key, value) =>
          setSystemSettings((previous) => ({ ...previous, [key]: value }))
        }
        onMatchChange={(key, value) =>
          setMatchSettings((previous) => ({ ...previous, [key]: value }))
        }
      />

      <div id="real-fencing-canvas" className="h-full w-full">
        <Canvas
          shadows
          camera={{ position: [4.8, 3.6, 5.6], fov: 52, near: 0.1, far: 100 }}
          gl={{ antialias: true }}
        >
          <Physics gravity={[0, -9.81, 0]} debug>
            <RealisticCastle />
            <Piste />

            <Fencer
              id="player"
              type="dynamic"
              position={PLAYER_START}
              facingY={PLAYER_FACING_Y}
              bodyRef={playerBodyRef}
              swordRef={playerSwordRef}
              color={matchSettings.uniformColor}
              handedness={matchSettings.handedness}
              onTipIntersection={handlePlayerTipEnter}
              hideBody={gameMode === 'FENCING'}
            />

            <Fencer
              id="opponent"
              type="kinematicPosition"
              position={OPPONENT_START}
              facingY={OPPONENT_FACING_Y}
              bodyRef={opponentBodyRef}
              swordRef={opponentSwordRef}
              color="#ffffff"
              handedness="left"
              onTipIntersection={handleOpponentTipEnter}
              hideBody={false}
            />

            <SceneSystem
              gameMode={gameMode}
              gameState={gameState}
              isResting={isResting}
              isSettingsOpen={isSettingsOpen}
              keysRef={keysRef}
              aimRef={aimRef}
              playerActionRef={playerActionRef}
              opponentActionRef={opponentActionRef}
              playerBodyRef={playerBodyRef}
              opponentBodyRef={opponentBodyRef}
              playerSwordRef={playerSwordRef}
              opponentSwordRef={opponentSwordRef}
            />
          </Physics>
        </Canvas>
      </div>
    </div>
  );
}

