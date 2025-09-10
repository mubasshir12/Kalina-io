import React, { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { MoleculeData } from '../types';
import Tooltip from './Tooltip';
import { Info, Expand, Minimize } from 'lucide-react';

// CPK colors for atoms
const atomColors: Record<string, number> = {
    H: 0xffffff,  // White
    C: 0x222222,  // Black
    N: 0x0000ff,  // Blue
    O: 0xff0000,  // Red
    F: 0x00ff00,  // Green
    CL: 0x00ff00, // Green
    BR: 0xa52a2a, // Brown
    I: 0x9400d3,  // Violet
    S: 0xffff00,  // Yellow
    P: 0xffa500,  // Orange
    B: 0xffc0cb,  // Pink
    SI: 0xdaa520, // Goldenrod
    DEFAULT: 0xcccccc, // Gray
};

// Covalent radii for ball-and-stick, sticks, wireframe
const atomRadiiCovalent: Record<string, number> = {
    H: 0.3, C: 0.7, N: 0.65, O: 0.6, F: 0.5,
    CL: 1.0, BR: 1.15, I: 1.35, S: 1.0, P: 1.0,
    DEFAULT: 0.6,
};

// Van der Waals radii for space-filling
const atomRadiiVdW: Record<string, number> = {
    H: 1.2, C: 1.7, N: 1.55, O: 1.52, F: 1.47,
    CL: 1.75, BR: 1.85, I: 1.98, S: 1.8, P: 1.8,
    DEFAULT: 1.5,
};


type DisplayStyle = 'ball-and-stick' | 'sticks' | 'wireframe' | 'space-filling' | 'orbital';

// Function to get high-contrast text color
const getTextColorForBackground = (hexColor: number): string => {
    const color = new THREE.Color(hexColor);
    // Simple luminance formula: (0.299*R + 0.587*G + 0.114*B)
    const luminance = (0.299 * color.r + 0.587 * color.g + 0.114 * color.b);
    return luminance > 0.5 ? '#000000' : '#FFFFFF';
};

interface MoleculeViewerProps {
    molecule: MoleculeData;
}

const ControlRadio: React.FC<{ label: string; value: DisplayStyle; current: DisplayStyle; onChange: (v: DisplayStyle) => void; }> = ({ label, value, current, onChange }) => (
    <label className="flex items-center space-x-2 cursor-pointer">
        <input type="radio" name="displayStyle" value={value} checked={value === current} onChange={() => onChange(value)} className="hidden" />
        <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors ${value === current ? 'border-amber-500 bg-amber-500' : 'border-neutral-400 dark:border-gray-500'}`}>
            {value === current && <span className="w-1.5 h-1.5 rounded-full bg-white"></span>}
        </span>
        <span>{label}</span>
    </label>
);

const ControlCheckbox: React.FC<{ label: string; checked: boolean; onChange: (c: boolean) => void; }> = ({ label, checked, onChange }) => (
     <label className="flex items-center space-x-2 cursor-pointer">
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="hidden" />
        <span className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${checked ? 'border-amber-500 bg-amber-500' : 'border-neutral-400 dark:border-gray-500'}`}>
            {checked && <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="4"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
        </span>
        <span>{label}</span>
    </label>
);


const MoleculeViewer: React.FC<MoleculeViewerProps> = ({ molecule }) => {
    const mountRef = useRef<HTMLDivElement>(null);
    const [displayStyle, setDisplayStyle] = useState<DisplayStyle>('ball-and-stick');
    const [showHydrogens, setShowHydrogens] = useState(true);
    const [isAnimated, setIsAnimated] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);

    useEffect(() => {
        if (!mountRef.current || !molecule) return;
        
        let animationFrameId: number;
        const currentMount = mountRef.current;

        while(currentMount.firstChild) currentMount.removeChild(currentMount.firstChild);

        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x000000); // Always black background

        const renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(currentMount.clientWidth, currentMount.clientHeight);
        renderer.setPixelRatio(window.devicePixelRatio);
        currentMount.appendChild(renderer.domElement);
        
        const labelRenderer = new CSS2DRenderer();
        labelRenderer.setSize(currentMount.clientWidth, currentMount.clientHeight);
        labelRenderer.domElement.style.position = 'absolute';
        labelRenderer.domElement.style.top = '0px';
        labelRenderer.domElement.style.pointerEvents = 'none';
        currentMount.appendChild(labelRenderer.domElement);

        const camera = new THREE.PerspectiveCamera(75, currentMount.clientWidth / currentMount.clientHeight, 0.1, 1000);
        camera.position.z = 10;
        
        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        
        scene.add(new THREE.AmbientLight(0xffffff, 0.7));
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(5, 5, 5);
        scene.add(directionalLight);

        const moleculeGroup = new THREE.Group();
        
        let nucleus: THREE.Mesh | null = null;
        const electrons: { mesh: THREE.Mesh; orbitIndex: number; offset: number; speed: number }[] = [];
        const orbitPaths: { orbit: THREE.Line; path: THREE.EllipseCurve }[] = [];

        if (displayStyle === 'orbital') {
             nucleus = new THREE.Mesh(
                new THREE.SphereGeometry(1.2, 32, 32),
                new THREE.MeshStandardMaterial({
                    color: 0x9370DB,
                    emissive: 0x4B0082,
                    roughness: 0.2,
                    metalness: 0.8,
                    wireframe: true,
                })
            );
            moleculeGroup.add(nucleus);

            for (let i = 0; i < 3; i++) {
                const path = new THREE.EllipseCurve(0, 0, 3 + i * 1.8, 3 + i * 1.8, 0, 2 * Math.PI, false, 0);
                const points = path.getPoints(100);
                // FIX: Convert the 2D points from the ellipse curve to 3D points for the BufferGeometry.
                // The .setFromPoints method expects an array of Vector3, but EllipseCurve.getPoints returns Vector2.
                const points3D = points.map(p => new THREE.Vector3(p.x, p.y, 0));
                const geometry = new THREE.BufferGeometry().setFromPoints(points3D);
                const material = new THREE.LineBasicMaterial({ color: 0xaaaaee, transparent: true, opacity: 0.3 });
                const orbit = new THREE.Line(geometry, material);
                orbit.rotation.x = Math.random() * Math.PI;
                orbit.rotation.y = Math.random() * Math.PI;
                moleculeGroup.add(orbit);
                orbitPaths.push({ orbit, path });
                
                const numElectrons = i === 0 ? 2 : (i === 1 ? 8 : 4);
                for (let j = 0; j < numElectrons; j++) {
                    const electron = new THREE.Mesh(
                        new THREE.SphereGeometry(0.15, 16, 16),
                        new THREE.MeshStandardMaterial({
                            color: 0x87CEEB,
                            emissive: 0x00BFFF,
                            emissiveIntensity: 1.5,
                        })
                    );
                    electrons.push({ mesh: electron, orbitIndex: i, offset: (j / numElectrons) * 2 * Math.PI, speed: 0.6 - i * 0.1 });
                    moleculeGroup.add(electron);
                }
            }
        } else {
            const filteredAtoms = showHydrogens ? molecule.atoms : molecule.atoms.filter(a => a.element.toUpperCase() !== 'H');
            const atomIndexMap = new Map(filteredAtoms.map((atom, newIndex) => [molecule.atoms.indexOf(atom), newIndex]));
            const filteredBonds = molecule.bonds.filter(b => atomIndexMap.has(b.from) && atomIndexMap.has(b.to))
                .map(b => ({ ...b, from: atomIndexMap.get(b.from)!, to: atomIndexMap.get(b.to)! }));

            const positions = filteredAtoms.map(atom => new THREE.Vector3(atom.x, atom.y, atom.z));
            const center = new THREE.Vector3();
            if (positions.length > 0) {
                positions.forEach(pos => center.add(pos));
                center.divideScalar(positions.length);
            }
            moleculeGroup.position.sub(center);

            if (displayStyle === 'ball-and-stick' || displayStyle === 'space-filling') {
                const atomRadii = displayStyle === 'space-filling' ? atomRadiiVdW : atomRadiiCovalent;
                filteredAtoms.forEach((atom, index) => {
                    const radius = atomRadii[atom.element.toUpperCase()] || atomRadii.DEFAULT;
                    const colorHex = atomColors[atom.element.toUpperCase()] || atomColors.DEFAULT;
                    const geometry = new THREE.SphereGeometry(radius, 32, 32);
                    const material = new THREE.MeshPhongMaterial({ color: colorHex, shininess: 80 });
                    const sphere = new THREE.Mesh(geometry, material);
                    sphere.position.copy(positions[index]);
                    moleculeGroup.add(sphere);
                });
            }
            
            if (displayStyle !== 'space-filling') {
                const bondRadius = displayStyle === 'wireframe' ? 0.04 : 0.1;
                filteredBonds.forEach(bond => {
                    const start = positions[bond.from];
                    const end = positions[bond.to];
                    const bondVector = new THREE.Vector3().subVectors(end, start);
                    const bondLength = bondVector.length();
                    const bondCenter = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);

                    const geometry = new THREE.CylinderGeometry(bondRadius, bondRadius, bondLength, 16);
                    const material = new THREE.MeshPhongMaterial({ color: 0x888888, shininess: 50 });
                    const cylinder = new THREE.Mesh(geometry, material);
                    cylinder.position.copy(bondCenter);
                    cylinder.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), bondVector.clone().normalize());
                    moleculeGroup.add(cylinder);
                });
            }
            
            if (displayStyle === 'ball-and-stick' || displayStyle === 'sticks') {
                 filteredAtoms.forEach((atom, index) => {
                    const colorHex = atomColors[atom.element.toUpperCase()] || atomColors.DEFAULT;
                    const labelDiv = document.createElement('div');
                    labelDiv.textContent = atom.element;
                    const textColor = getTextColorForBackground(colorHex);
                    labelDiv.style.color = textColor;
                    labelDiv.style.fontSize = '14px';
                    labelDiv.style.fontWeight = 'bold';
                    labelDiv.style.textShadow = `0 0 4px ${textColor === '#FFFFFF' ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.15)'}`;
                    const label = new CSS2DObject(labelDiv);
                    label.position.copy(positions[index]);
                    moleculeGroup.add(label);
                });
            }
        }
        
        scene.add(moleculeGroup);
        
        const animate = () => {
            animationFrameId = requestAnimationFrame(animate);
            controls.update();
            if (isAnimated) moleculeGroup.rotation.y += 0.005;
            
            if (displayStyle === 'orbital') {
                const time = Date.now() * 0.001;
                if(nucleus) nucleus.rotation.y = time * 0.5;
                electrons.forEach(e => {
                    const path = orbitPaths[e.orbitIndex].path;
                    const orbit = orbitPaths[e.orbitIndex].orbit;
                    const t = ((time * e.speed) + e.offset) % (2 * Math.PI);
                    const position = path.getPoint(t / (2 * Math.PI));
                    // FIX: Set the electron's 3D position from the 2D point provided by the ellipse curve.
                    // The .copy() method expects a Vector3-like object, but path.getPoint returns a Vector2.
                    e.mesh.position.set(position.x, position.y, 0).applyQuaternion(orbit.quaternion);
                });
            }

            renderer.render(scene, camera);
            labelRenderer.render(scene, camera);
        };
        animate();
        
        const handleResize = () => {
            if (currentMount) {
                camera.aspect = currentMount.clientWidth / currentMount.clientHeight;
                camera.updateProjectionMatrix();
                renderer.setSize(currentMount.clientWidth, currentMount.clientHeight);
                labelRenderer.setSize(currentMount.clientWidth, currentMount.clientHeight);
            }
        };
        // Initial resize call
        setTimeout(handleResize, 10);

        window.addEventListener('resize', handleResize);

        return () => {
            cancelAnimationFrame(animationFrameId);
            window.removeEventListener('resize', handleResize);
            controls.dispose();
            scene.traverse(obj => {
                if (obj instanceof THREE.Mesh) {
                    obj.geometry.dispose();
                    if (Array.isArray(obj.material)) {
                        obj.material.forEach(mat => mat.dispose());
                    } else {
                        obj.material.dispose();
                    }
                }
            });
        };
    }, [molecule, displayStyle, showHydrogens, isAnimated, isFullscreen]);

    return (
        <div className={`my-4 bg-neutral-100 dark:bg-gray-800/50 rounded-lg border border-neutral-200 dark:border-gray-700 overflow-hidden shadow-md ${isFullscreen ? 'fixed inset-0 z-[9999] !m-0 !rounded-none' : 'relative'}`}>
            <div className={`relative w-full ${isFullscreen ? 'h-full' : 'aspect-[4/3] sm:aspect-video'}`}>
                <div ref={mountRef} className="absolute inset-0" />
                 <button onClick={() => setIsFullscreen(!isFullscreen)} className="absolute top-2 right-2 z-10 p-2 bg-black/30 text-white rounded-full hover:bg-black/50 transition-colors" aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}>
                    {isFullscreen ? <Minimize className="h-5 w-5" /> : <Expand className="h-5 w-5" />}
                </button>
            </div>
            <div className={`${isFullscreen ? 'absolute bottom-4 left-4 right-4 z-10 bg-black/30 backdrop-blur-sm rounded-lg' : 'bg-neutral-200/50 dark:bg-gray-900/40 border-t border-neutral-200 dark:border-gray-700'}`}>
                <div className="p-3">
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-neutral-700 dark:text-gray-300">
                        <ControlRadio label="Ball and Stick" value="ball-and-stick" current={displayStyle} onChange={setDisplayStyle} />
                        <ControlRadio label="Sticks" value="sticks" current={displayStyle} onChange={setDisplayStyle} />
                        <ControlRadio label="Wire-Frame" value="wireframe" current={displayStyle} onChange={setDisplayStyle} />
                        <ControlRadio label="Space-Filling" value="space-filling" current={displayStyle} onChange={setDisplayStyle} />
                         <ControlRadio label="Electron Orbitals" value="orbital" current={displayStyle} onChange={setDisplayStyle} />
                    </div>
                    {displayStyle !== 'orbital' && (
                        <div className="mt-3 flex items-center gap-x-4 gap-y-2 text-sm text-neutral-700 dark:text-gray-300">
                             <ControlCheckbox label="Show Hydrogens" checked={showHydrogens} onChange={setShowHydrogens} />
                             <ControlCheckbox label="Animate" checked={isAnimated} onChange={setIsAnimated} />
                        </div>
                    )}
                </div>
                 {(molecule.iupacName || molecule.molecularFormula) && displayStyle !== 'orbital' && (
                    <div className="p-3 border-t border-neutral-200 dark:border-gray-700 text-sm">
                        {molecule.iupacName && (
                            <p className="font-semibold text-neutral-800 dark:text-gray-200">{molecule.iupacName}</p>
                        )}
                        <div className="flex items-center gap-4 text-xs text-neutral-500 dark:text-gray-400 mt-1">
                            {molecule.molecularFormula && (
                                <Tooltip content="Molecular Formula"><span className="cursor-help">{molecule.molecularFormula}</span></Tooltip>
                            )}
                            {molecule.molecularWeight && (
                                <Tooltip content="Molecular Weight"><span className="cursor-help">{molecule.molecularWeight} g/mol</span></Tooltip>
                            )}
                             <Tooltip content={
                                <div className="max-w-xs text-left">
                                    <h4 className="font-bold mb-1">About this model</h4>
                                    <p>This 3D model is a representation of the molecule's lowest energy conformation, sourced from PubChem.</p>
                                </div>
                             }>
                               <Info className="h-4 w-4 ml-auto cursor-help" />
                            </Tooltip>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default MoleculeViewer;