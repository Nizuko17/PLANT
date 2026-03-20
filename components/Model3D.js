'use client';

import React, { Suspense, useRef, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, useGLTF, PresentationControls, Environment, ContactShadows, Center } from '@react-three/drei';

function Model({ url }) {
  const { scene } = useGLTF(url);
  const modelRef = useRef();

  // "Texture più morbide": ammorbidisce i materiali del modello (più ruvidi, meno metallici)
  useEffect(() => {
    scene.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        if (child.material) {
          child.material.roughness = 0.8; // Più ruvido = luce più soffusa
          child.material.metalness = 0.1; // Meno metallico = riflessi meno duri
        }
      }
    });
  }, [scene]);

  // Rotazione impercettibile per massima eleganza
  useFrame((state) => {
    if (modelRef.current) {
      modelRef.current.rotation.y += 0.0005; // 4 volte più lento
    }
  });

  return <primitive ref={modelRef} object={scene} scale={0.8} />;
}

export default function Model3D() {
  return (
    <div style={{
      width: '100%',
      height: '500px',
      background: 'var(--bg-alt)',
      borderRadius: '30px',
      overflow: 'hidden',
      border: '1px solid var(--border-color)',
      position: 'relative',
      boxShadow: 'inset 0 0 50px rgba(0,0,0,0.02)'
    }}>
      <Canvas dpr={[1, 2]} camera={{ fov: 0.20, position: [2, 5, 6] }} gl={{ alpha: true, antialias: true }} shadows>
        {/* Illuminazione molto soffusa e controllata */}
        <ambientLight intensity={0.4} />
        <spotLight
          position={[5, 10, 5]}
          angle={0.15}
          penumbra={1}
          intensity={0.5}
          color="#a7c4aa"
          castShadow
          shadow-bias={-0.0001}
        />
        <pointLight position={[-5, 5, -5]} intensity={0.2} />
        <directionalLight position={[0, 5, 0]} intensity={0.3} color="#ffffff" />

        <Suspense fallback={null}>
          <PresentationControls
            speed={0.5}
            global
            zoom={0.9}
            polar={[-0.1, Math.PI / 4]}
          >
            {/* Rimosso Stage per controllo manuale completo sulle luci ed evitare sovraesposizione */}
            <Center top>
              <Model url="/assets/PLANT3D.glb" />
            </Center>
            <Environment preset="city" blur={1} />
          </PresentationControls>
          <ContactShadows position={[0, -0.1, 0]} opacity={0.3} scale={10} blur={3} far={4} />
        </Suspense>
        <OrbitControls makeDefault enableZoom={true} minPolarAngle={0} maxPolarAngle={Math.PI / 1.75} />
      </Canvas>
      <div style={{
        position: 'absolute',
        bottom: '20px',
        left: '20px',
        fontSize: '0.75rem',
        color: 'var(--text-secondary)',
        background: 'rgba(255,255,255,0.5)',
        padding: '4px 12px',
        borderRadius: '20px',
        backdropFilter: 'blur(4px)'
      }}>
        Trascina per ruotare il modello 3D del PLANT
      </div>
    </div>
  );
}
