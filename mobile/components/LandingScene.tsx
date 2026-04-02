/* eslint-disable react/no-unknown-property */
import React, { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Mesh } from "three";

function AnimatedGlobe(props: any) {
  // This reference will give us direct access to the mesh
  const mesh = useRef<Mesh>(null!);
  
  // Rotate mesh every frame, this is outside of React without overhead
  useFrame((state, delta) => {
    if (mesh.current) {
        mesh.current.rotation.y += delta * 0.2;
        mesh.current.rotation.x += delta * 0.1;
    }
  });

  return (
    <mesh
      {...props}
      ref={mesh}
      scale={2.5}
    >
      <icosahedronGeometry args={[1, 2]} />
      <meshBasicMaterial
        color={props.color || "#4ade80"}
        wireframe
      />
    </mesh>
  );
}

export default function LandingScene() {
  return (
    <>
      <ambientLight intensity={0.5} />
      <pointLight position={[10, 10, 10]} />
      <AnimatedGlobe position={[0, 0, 0]} color="#22c55e" />
    </>
  );
}