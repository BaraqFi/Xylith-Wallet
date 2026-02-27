import React, { useRef, useEffect } from 'react';

interface OrbProps {
  state: 'IDLE' | 'THINKING' | 'PROCESSING' | 'ERROR';
}

/**
 * A canvas-based 3D particle sphere that deforms, rotates, and pulses.
 * Represents the AI's "Brain".
 */
export const AiOrb: React.FC<OrbProps> = ({ state }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = canvas.width = canvas.parentElement?.clientWidth || 400;
    let height = canvas.height = canvas.parentElement?.clientHeight || 400;

    // Track mouse position relative to canvas center (-1 to 1)
    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      mouseRef.current = {
        x: (e.clientX - centerX) / (width / 2),
        y: (e.clientY - centerY) / (height / 2)
      };
    };
    window.addEventListener('mousemove', handleMouseMove);

    // Resize handler
    const handleResize = () => {
      width = canvas.width = canvas.parentElement?.clientWidth || 400;
      height = canvas.height = canvas.parentElement?.clientHeight || 400;
    };
    window.addEventListener('resize', handleResize);

    // Sphere parameters
    const particles: { x: number, y: number, z: number, theta: number, phi: number, baseTheta: number, basePhi: number }[] = [];
    const count = 900; // Increased density
    const radius = Math.min(width, height) * 0.25;

    // Initialize particles on a sphere surface (Fibonacci Sphere for even distribution)
    for (let i = 0; i < count; i++) {
      const theta = Math.acos(1 - 2 * (i + 0.5) / count);
      const phi = Math.PI * (1 + Math.sqrt(5)) * i;

      particles.push({
        x: 0, y: 0, z: 0,
        theta, phi,
        baseTheta: theta, basePhi: phi
      });
    }

    let time = 0;
    let rotationX = 0;
    let rotationY = 0;
    let deformationScale = 0;

    // Pulse variables
    const pulseColors = [
      { r: 59, g: 130, b: 246 },  // Blue
      { r: 16, g: 185, b: 129 },  // Emerald
      { r: 139, g: 92, b: 246 },  // Violet
      { r: 236, g: 72, b: 153 },  // Pink
    ];

    let animationFrameId: number;

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      const now = Date.now();
      // Continuous gentle pulse (breathing)
      const pulseScale = 1 + Math.sin(now * 0.002) * 0.08; // +/- 8% size

      // State-based animation logic
      let targetSpeed = 0.002;
      let targetDeform = 0.2;

      // Base color (Metallic Black/Grey)
      let r = 20, g = 20, b = 30, a = 0.6;

      if (state === 'THINKING') {
        targetSpeed = 0.02;
        targetDeform = 1.2;
        r = 16; g = 185; b = 129; a = 0.8; // Greenish
      } else if (state === 'PROCESSING') {
        targetSpeed = 0.01;
        targetDeform = 0.6;
        r = 59; g = 130; b = 246; a = 0.8; // Blueish
      } else if (state === 'ERROR') {
        targetSpeed = 0;
        targetDeform = 0.1;
        r = 239; g = 68; b = 68; a = 0.8; // Red
      } else {
        // IDLE PULSE LOGIC (Continuous breathing color shift)
        const colorPulse = 0.5 + 0.5 * Math.sin(now * 0.001); // 0 to 1

        // Cycle colors every 5 seconds
        const colorIndex = Math.floor(now / 5000) % pulseColors.length;
        const nextColorIndex = (colorIndex + 1) % pulseColors.length;
        const colorProgress = (now % 5000) / 5000;

        const c1 = pulseColors[colorIndex];
        const c2 = pulseColors[nextColorIndex];

        // Interpolate between current and next color
        const targetR = c1.r + (c2.r - c1.r) * colorProgress;
        const targetG = c1.g + (c2.g - c1.g) * colorProgress;
        const targetB = c1.b + (c2.b - c1.b) * colorProgress;

        // Blend base color with target color based on pulse
        r += (targetR - r) * 0.3 * colorPulse;
        g += (targetG - g) * 0.3 * colorPulse;
        b += (targetB - b) * 0.3 * colorPulse;
        a += (0.9 - a) * 0.3 * colorPulse;
      }

      const colorString = `rgba(${Math.floor(r)},${Math.floor(g)},${Math.floor(b)},${a})`;

      // Mouse following physics (Target rotation)
      const targetRotY = mouseRef.current.x * 0.5;
      const targetRotX = -mouseRef.current.y * 0.5;

      rotationX += (targetRotX - rotationX) * 0.05;
      rotationY += (targetRotY - rotationY) * 0.05;

      deformationScale += (targetDeform - deformationScale) * 0.05;
      time += targetSpeed;

      ctx.save();
      ctx.translate(width / 2, height / 2);

      // Mouse attraction point (in 3D space, roughly mapped)
      // We don't have full raycasting, so we approximate a point on the sphere surface looking at camera
      // But we just use the mouseRef for directional bulge

      particles.forEach(p => {
        // 1. Base sphere position
        const currentRadius = radius * pulseScale;
        let x = currentRadius * Math.sin(p.theta) * Math.cos(p.phi);
        let y = currentRadius * Math.sin(p.theta) * Math.sin(p.phi);
        let z = currentRadius * Math.cos(p.theta);

        // 2. Apply Idle Rotation (Time based)
        let tx = x * Math.cos(time) - z * Math.sin(time);
        let tz = x * Math.sin(time) + z * Math.cos(time);
        x = tx; z = tz;

        let ty = y * Math.cos(time * 0.5) - z * Math.sin(time * 0.5);
        tz = y * Math.sin(time * 0.5) + z * Math.cos(time * 0.5);
        y = ty; z = tz;

        // 3. Apply Mouse Look Rotation (Interactive)
        // Rotate around Y axis based on mouse X
        tx = x * Math.cos(rotationY) - z * Math.sin(rotationY);
        tz = x * Math.sin(rotationY) + z * Math.cos(rotationY);
        x = tx; z = tz;

        // Rotate around X axis based on mouse Y
        ty = y * Math.cos(rotationX) - z * Math.sin(rotationX);
        tz = y * Math.sin(rotationX) + z * Math.cos(rotationX);
        y = ty; z = tz;

        // 4. Apply Noise / Breathing
        const noise = Math.sin(x * 0.05 + time * 3) * Math.cos(y * 0.05 + time * 2);
        let deformFactor = 1 + (noise * 0.1 * deformationScale);

        // 5. Mouse Attraction/Bulge (Surface follows cursor direction)
        // Check if particle is roughly in the direction of the mouse (z > 0 means facing camera)
        // simple proximity check in 2D projection for "bulge" effect
        const distFromMouse = Math.sqrt(
          Math.pow(x - mouseRef.current.x * radius, 2) +
          Math.pow(y - mouseRef.current.y * radius, 2)
        );

        if (z > 0 && distFromMouse < radius * 0.8) {
          deformFactor += (1 - distFromMouse / (radius * 0.8)) * 0.2; // Bulge out by up to 20%
        }

        x *= deformFactor;
        y *= deformFactor;
        z *= deformFactor;

        // 6. Project to 2D
        const scale = 300 / (300 + z);
        const x2d = x * scale;
        const y2d = y * scale;

        // Dynamic size based on depth and pulse
        const size = Math.max(0.1, (1.5 * scale));

        ctx.fillStyle = colorString;
        ctx.beginPath();
        ctx.arc(x2d, y2d, size, 0, Math.PI * 2);
        ctx.fill();
      });

      ctx.restore();
      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, [state]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none z-0"
    />
  );
};
