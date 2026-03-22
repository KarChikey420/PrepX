import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { MeshDistortMaterial, Sphere, Float, Stars } from '@react-three/drei';
import * as THREE from 'three';
import type { AIState } from '../types';

interface AICoreProps {
  state: AIState;
}

const colorMap = {
  idle: '#06b6d4',      // Cyan
  listening: '#f43f5e', // Rose
  thinking: '#9ca3af',  // Muted Gray
  speaking: '#6366f1'   // Indigo
};

const animateMap = {
  idle: { speed: 1, distort: 0.3 },
  listening: { speed: 3, distort: 0.6 },
  thinking: { speed: 0.5, distort: 0.1 },
  speaking: { speed: 4, distort: 0.8 }
};

export function AICore({ state }: AICoreProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const materialRef = useRef<any>(null);

  const targetColor = useMemo(() => new THREE.Color(colorMap[state] || colorMap.idle), [state]);
  const targetAnim = animateMap[state] || animateMap.idle;

  useFrame((_, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.x += delta * 0.2;
      meshRef.current.rotation.y += delta * 0.3;
    }
    
    if (materialRef.current) {
      // Smoothly transition colors
      materialRef.current.color.lerp(targetColor, 0.05);
      
      // Smoothly transition distortion & speed
      materialRef.current.distort = THREE.MathUtils.lerp(materialRef.current.distort, targetAnim.distort, 0.05);
      materialRef.current.speed = THREE.MathUtils.lerp(materialRef.current.speed, targetAnim.speed, 0.05);
    }
  });

  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight position={[10, 10, 5]} intensity={1.5} />
      <directionalLight position={[-10, -10, -5]} intensity={0.5} color="#06b6d4" />
      
      <Stars radius={50} depth={50} count={2000} factor={4} saturation={0} fade speed={1} />

      <Float speed={2} rotationIntensity={1.5} floatIntensity={2}>
        <Sphere ref={meshRef} args={[1.5, 64, 64]}>
          <MeshDistortMaterial
            ref={materialRef}
            color={colorMap.idle}
            envMapIntensity={1}
            clearcoat={0.8}
            clearcoatRoughness={0.2}
            metalness={0.9}
            roughness={0.1}
            distort={0.3}
            speed={1}
            wireframe={state === 'thinking'}
          />
        </Sphere>
      </Float>
    </>
  );
}
