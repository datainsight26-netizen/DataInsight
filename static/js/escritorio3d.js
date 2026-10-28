/**
 * ==============================================================================
 * escritorio3d.js — Sala de Escritório 3D Isométrica dos Agentes Autônomos
 * EnterSight (Three.js r128 procedural)
 * ==============================================================================
 */

(function () {
  'use strict';

  // Configuração dos 5 Agentes do Sistema EnterSight
  const AGENT_ROLES = [
    {
      id: 'agente_dados',
      name: 'Agente de Qualidade',
      shortName: 'Qualidade',
      role: 'Engenheiro de Dados 24/7',
      shirt: 0x06b6d4, // Ciano
      hair: 0x27272a,
      colorHex: '#06b6d4',
      deskPos: { x: -3.8, z: 2.2 }, // Frontal-esquerda
      facingAngle: Math.PI
    },
    {
      id: 'agente_financeiro',
      name: 'Agente Financeiro',
      shortName: 'Financeiro',
      role: 'Monitor de Fluxo & Custos',
      shirt: 0x10b981, // Verde
      hair: 0x582f0e,
      colorHex: '#10b981',
      deskPos: { x: -3.8, z: -1.0 }, // Fundo-esquerda
      facingAngle: Math.PI
    },
    {
      id: 'agente_vendas',
      name: 'Agente de Vendas',
      shortName: 'Vendas',
      role: 'Auditor de Vendas & Performance',
      shirt: 0x3b82f6, // Azul
      hair: 0x18181b,
      colorHex: '#3b82f6',
      deskPos: { x: 3.8, z: -1.0 }, // Fundo-direita
      facingAngle: Math.PI
    },
    {
      id: 'agente_decisao',
      name: 'Agente Estratégico',
      shortName: 'Estratégico',
      role: 'Estrategista & SWOT',
      shirt: 0x7c3aed, // Roxo
      hair: 0x7c2d12,
      colorHex: '#7c3aed',
      deskPos: { x: 3.8, z: 2.2 }, // Frontal-direita
      facingAngle: Math.PI
    },
    {
      id: 'agente_alertas',
      name: 'Agente de Alertas',
      shortName: 'Alertas',
      role: 'Sentinela de Anomalias',
      shirt: 0xf59e0b, // Âmbar
      hair: 0x3f3f46,
      colorHex: '#f59e0b',
      deskPos: { x: 0, z: 2.6 }, // Frontal-centro
      facingAngle: Math.PI
    }
  ];

  // Cores institucionais do tema EnterSight
  const WHITE = 0xffffff;
  const BLUE = 0x1d4ed8;
  const SKY = 0x60a5fa;
  const LIGHT = 0xdbeafe;
  const NAVY = 0x1e3a8a;
  const FLOOR_COLOR = 0xf1f6ff;

  let scene, camera, renderer, clock;
  let stageContainer, canvasEl, animId = null;
  let isRunning = false;
  let theta = Math.PI / 4;
  let initialTheta = Math.PI / 4;
  let zoom = 1.05;
  let isDragging = false;
  let lastMouseX = 0;
  let hoveredAgent = null;
  let presentationQueue = []; // Fila para apresentação no telão

  const agents3D = {};
  let whiteboardTextureObj = null;
  let activeDockAgentId = 'agente_dados';

  // Variáveis para Dark Mode e Iluminação Noturna
  let ambientLight, sunLight;
  let floorMesh, wallBackMesh, wallLeftMesh;
  let nightLightsGroup = null;
  let isDarkTheme = false;

  // Variáveis e função para Logomarca EnterSight (SVG Hexagonal Oficial)
  let logoTexObj = null;
  let brandImgLoaded = null;
  let logoBackBoardMesh = null;
  let logoBorderMeshes = []; // Frisos decorativos ao redor do painel
  let logoPlaneRef = null;   // Plano com textura do logo

  // Logo Hexagonal Oficial EnterSight em SVG
  const LOGO_HEX_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="374 42 212 241" width="280" height="318">' +
    '<g>' +
    '<path d="M480,52 L577,106 L577,220 L480,273 L384,220 L384,106Z" fill="#3b82f6" stroke="#3b82f6" stroke-width="10" stroke-linejoin="round"/>' +
    '<path d="M426,161 L460,132 L486,150 L520,115" fill="none" stroke="#ffffff" stroke-width="13" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<path d="M529,112 V201 H443" fill="none" stroke="#ffffff" stroke-width="13" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<path d="M463,181 L443,202 L463,222" fill="none" stroke="#ffffff" stroke-width="13" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<circle cx="529" cy="107" r="13" fill="#ffffff"/>' +
    '</g>' +
    '</svg>';

  const brandSvgImg = new Image();
  brandSvgImg.onload = () => {
    brandImgLoaded = brandSvgImg;
    if (logoTexObj) drawBrandLogo();
  };
  brandSvgImg.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(LOGO_HEX_SVG);
  if (brandSvgImg.complete) {
    brandImgLoaded = brandSvgImg;
  }

  function drawBrandLogo() {
    if (!logoTexObj) return;
    const ctx = logoTexObj.ctx;
    const w = 1400, h = 440;
    const isDark = isDarkTheme;
    ctx.clearRect(0, 0, w, h);

    // Fundo da placa da logomarca (tom leve no White para contraste com a parede)
    ctx.fillStyle = isDark ? '#0f172a' : '#f0f4ff';
    ctx.beginPath();
    ctx.roundRect(8, 8, w - 16, h - 16, 28);
    ctx.fill();

    // Borda nítida (Azul Neon no escuro / Azul Royal no claro)
    ctx.strokeStyle = isDark ? '#38bdf8' : '#2563eb';
    ctx.lineWidth = 10;
    ctx.stroke();

    // Imagem da logo Hexagonal EnterSight (SVG)
    if (brandImgLoaded && brandImgLoaded.complete && brandImgLoaded.naturalWidth > 0) {
      ctx.drawImage(brandImgLoaded, 80, 61, 280, 318);
    } else {
      ctx.fillStyle = '#3b82f6';
      ctx.beginPath();
      ctx.arc(220, 220, 140, 0, Math.PI * 2);
      ctx.fill();
    }

    // Nome "EnterSight": Enter (700) e Sight (300)
    ctx.fillStyle = isDark ? '#ffffff' : '#000000';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.font = '700 120px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText('Enter', 410, 220);
    const enterW = ctx.measureText('Enter').width;
    ctx.font = '300 120px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText('Sight', 410 + enterW - 2, 220);

    logoTexObj.tex.needsUpdate = true;
  }

  function detectDarkMode() {
    return document.documentElement.classList.contains('dark') ||
           document.documentElement.classList.contains('tema-escuro') ||
           document.body.classList.contains('dark') ||
           document.body.classList.contains('tema-escuro') ||
           document.documentElement.getAttribute('data-theme') === 'dark' ||
           document.documentElement.getAttribute('data-tema') === 'escuro' ||
           localStorage.getItem('tema') === 'escuro' ||
           localStorage.getItem('tema') === 'dark';
  }

  // Helper para verificar suporte a WebGL
  function isWebGLAvailable() {
    try {
      const c = document.createElement('canvas');
      return !!(window.WebGLRenderingContext && (c.getContext('webgl') || c.getContext('experimental-webgl')));
    } catch (e) {
      return false;
    }
  }

  // Helper para criar caixas procedurais
  function box(w, h, d, color, x, y, z, parent = scene, emissive = 0) {
    const geo = new THREE.BoxGeometry(w, h, d);
    const mat = new THREE.MeshStandardMaterial({
      color: color,
      emissive: emissive || 0,
      roughness: 0.65,
      metalness: 0.1
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  // Helper para gerar texturas em Canvas 2D
  function textCanvas(drawFn, width, height) {
    const c = document.createElement('canvas');
    c.width = width;
    c.height = height;
    const ctx = c.getContext('2d');
    drawFn(ctx, width, height);
    const tex = new THREE.CanvasTexture(c);
    return { tex, ctx, canvas: c };
  }

  // Criação da Etiqueta Flutuante em Sprite
  function createAgentSpriteLabel() {
    const obj = textCanvas(() => {}, 360, 120);
    const mat = new THREE.SpriteMaterial({
      map: obj.tex,
      transparent: true,
      depthTest: false
    });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(3.4, 1.13, 1);
    sprite.renderOrder = 99;
    return { sprite, ...obj };
  }

  function updateAgentSpriteLabel(ag) {
    const ctx = ag.labelObj.ctx;
    const w = 360, h = 120;
    ctx.clearRect(0, 0, w, h);

    // Cores conforme o estado
    let borderColor = '#93c5fd';
    let statusColor = '#64748b';
    let statusDot = '#94a3b8';

    if (ag.state === 'running') {
      borderColor = ag.cfg.colorHex;
      statusColor = '#2563eb';
      statusDot = '#2563eb';
    } else if (ag.state === 'idle') {
      borderColor = '#86efac';
      statusColor = '#16a34a';
      statusDot = '#16a34a';
    } else if (ag.state === 'error') {
      borderColor = '#fca5a5';
      statusColor = '#dc2626';
      statusDot = '#dc2626';
    } else if (ag.state === 'offline') {
      borderColor = '#cbd5e1';
      statusColor = '#94a3b8';
      statusDot = '#94a3b8';
    }

    // Fundo do balão (adaptado ao Dark Mode)
    ctx.fillStyle = isDarkTheme ? 'rgba(15, 23, 42, 0.94)' : 'rgba(255, 255, 255, 0.96)';
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.roundRect(8, 8, w - 16, h - 16, 18);
    ctx.fill();
    ctx.stroke();

    // Título: Nome & Cargo curto
    ctx.fillStyle = isDarkTheme ? '#f8fafc' : '#0f172a';
    ctx.font = 'bold 28px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${ag.cfg.shortName} · ${ag.cfg.role.split(' ')[0]}`, w / 2, 46);

    // Indicador e Status
    ctx.fillStyle = statusDot;
    ctx.beginPath();
    ctx.arc(38, 82, 6, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = statusColor;
    ctx.font = '600 22px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'left';
    const maxTxt = ag.currentStatusText.length > 24 ? ag.currentStatusText.slice(0, 22) + '...' : ag.currentStatusText;
    ctx.fillText(maxTxt, 54, 89);

    ag.labelObj.tex.needsUpdate = true;
  }

  // Criação dos Personagens
  function buildAgentCharacter(cfg, idx) {
    const group = new THREE.Group();
    group.userData = { agentId: cfg.id, isAgent: true };

    // Pernas
    const legs = box(0.52, 0.72, 0.32, 0x1e293b, 0, 0.36, 0, group);
    legs.userData = { agentId: cfg.id };

    // Tronco com a cor do agente
    const torso = box(0.64, 0.78, 0.36, cfg.shirt, 0, 1.11, 0, group);
    torso.userData = { agentId: cfg.id };

    // Detalhe de colarinho/gravata branca
    box(0.16, 0.52, 0.06, WHITE, 0, 1.18, 0.19, group);

    // Cabeça
    const head = box(0.44, 0.44, 0.42, 0xfcd9b6, 0, 1.72, 0, group);
    head.userData = { agentId: cfg.id };

    // Cabelo estilizado
    box(0.48, 0.18, 0.46, cfg.hair, 0, 1.95, -0.02, group);

    // Braços com articulação no ombro
    const armL = new THREE.Group();
    const armR = new THREE.Group();
    armL.position.set(-0.42, 1.4, 0);
    armR.position.set(0.42, 1.4, 0);

    // Manga e mão esquerda
    box(0.2, 0.65, 0.2, cfg.shirt, 0, -0.3, 0, armL);
    box(0.18, 0.2, 0.18, 0xfcd9b6, 0, -0.7, 0, armL);

    // Manga e mão direita
    box(0.2, 0.65, 0.2, cfg.shirt, 0, -0.3, 0, armR);
    box(0.18, 0.2, 0.18, 0xfcd9b6, 0, -0.7, 0, armR);

    group.add(armL);
    group.add(armR);

    // Posições-chave de movimentação
    const seatPos = { x: cfg.deskPos.x, y: -0.35, z: cfg.deskPos.z + 1.25 };
    const loungePos = {
      x: 4.2 + (idx % 3) * 0.9,
      y: -0.15,
      z: -3.6 + Math.floor(idx / 3) * 1.1
    };

    group.position.set(seatPos.x, seatPos.y, seatPos.z);
    group.rotation.y = cfg.facingAngle;
    scene.add(group);

    // Etiqueta Sprite
    const labelObj = createAgentSpriteLabel();
    labelObj.sprite.position.set(0, 2.9, 0);
    group.add(labelObj.sprite);

    return {
      cfg,
      group,
      legs,
      torso,
      head,
      armL,
      armR,
      labelObj,
      seatPos,
      loungePos,
      state: 'idle', // 'idle' | 'running' | 'error' | 'offline'
      currentStatusText: 'Aguardando ciclo...',
      currentWaypoints: [],
      waypointIdx: 0,
      isSeated: true,
      lastActionSummary: 'Pronto para monitoramento',
      lastActionTime: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      screenGlow: null
    };
  }

  // Construção do Escritório e Mobília Procedural
  function buildOfficeEnvironment() {
    // 1. Piso da sala
    floorMesh = box(15, 0.3, 11, FLOOR_COLOR, 0, -0.15, 0);

    // 2. Rodapés e molduras externas azuis
    box(15, 0.16, 0.16, BLUE, 0, 0.05, 5.55);
    box(0.16, 0.16, 11, BLUE, 7.55, 0.05, 0);

    // 3. Paredes (Fundo e Esquerda)
    wallBackMesh = box(15, 6.2, 0.35, WHITE, 0, 3.1, -5.65);
    wallLeftMesh = box(0.35, 6.2, 11, 0xf6f9ff, -7.65, 3.1, 0);

    // 4. Frisos de acabamento superior azul
    box(15, 0.22, 0.4, BLUE, 0, 6.25, -5.6);
    box(0.4, 0.22, 11, BLUE, -7.6, 6.25, 0);

    // 5. Rodapé traseiro estilizado
    box(15, 0.28, 0.3, SKY, 0, 0.14, -5.45);

    // 6. Logotipo "EnterSight" na parede lateral (sem telão) ampliado
    // Painel de fundo arquitetônico azul corporativo em relevo (x = -7.46)
    logoBackBoardMesh = box(0.06, 1.76, 5.24, BLUE, -7.46, 3.6, 0);
    const logoBorderTop = box(0.08, 0.08, 5.3, SKY, -7.45, 4.49, 0);
    const logoBorderBot = box(0.08, 0.08, 5.3, SKY, -7.45, 2.71, 0);
    logoBorderMeshes = [logoBorderTop, logoBorderBot];

    logoTexObj = textCanvas(() => {}, 1400, 440);
    const logoPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(5.0, 1.58),
      new THREE.MeshBasicMaterial({
        map: logoTexObj.tex,
        transparent: false,
        side: THREE.DoubleSide,
        depthWrite: true
      })
    );
    // Posição x = -7.30 bem à frente da base para eliminar Z-fighting em qualquer ângulo
    logoPlane.position.set(-7.30, 3.6, 0);
    logoPlane.rotation.y = Math.PI / 2;
    logoPlane.renderOrder = 20;
    scene.add(logoPlane);
    logoPlaneRef = logoPlane;

    // Renderização da logomarca oficial (SVG Hexagonal)
    if (!brandImgLoaded && brandSvgImg.complete) {
      brandImgLoaded = brandSvgImg;
    }
    drawBrandLogo();

    // 7. Telão Interativo Central na Parede
    box(7.8, 4.0, 0.16, NAVY, -0.6, 3.5, -5.46);
    whiteboardTextureObj = textCanvas(() => {}, 800, 420);
    const boardMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(7.5, 3.7),
      new THREE.MeshBasicMaterial({ map: whiteboardTextureObj.tex })
    );
    boardMesh.position.set(-0.6, 3.5, -5.36);
    boardMesh.userData = { isWhiteboard: true };
    scene.add(boardMesh);
    renderWhiteboardCanvas();

    // 8. Sofá Lounge (área de descanso para agentes desligados)
    createSofaLounge(5.2, -3.8);

    // 9. Plantas decorativas modernas nos cantos
    createPlant(-6.8, -4.8);
    createPlant(6.8, 4.8);
    createPlant(-6.8, 4.8);

    // 10. Mesas e computadores para cada agente
    AGENT_ROLES.forEach(cfg => {
      createAgentWorkstation(cfg);
    });

    // 11. Grupo de Iluminação e Luminárias Noturnas (Dark Mode)
    buildNightLighting(boardMesh, logoPlane);
  }

  // Criação da Iluminação Noturna e Luminárias Suspensas
  function buildNightLighting(boardMesh, logoPlane) {
    nightLightsGroup = new THREE.Group();
    nightLightsGroup.visible = false; // Começa desligado (ativado dinamicamente no dark mode)

    // Calhas de iluminação linear suspensas no teto (Ala Esquerda e Ala Direita)
    const calhaMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.8 });
    const ledMat = new THREE.MeshStandardMaterial({
      color: 0x93c5fd,
      emissive: 0x60a5fa,
      emissiveIntensity: 1.2,
      roughness: 0.3
    });

    // Calha Esquerda
    const calhaEsq = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.08, 4.2), calhaMat);
    calhaEsq.position.set(-3.8, 5.3, 0.6);
    const ledEsq = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.03, 4.0), ledMat);
    ledEsq.position.set(-3.8, 5.25, 0.6);
    nightLightsGroup.add(calhaEsq);
    nightLightsGroup.add(ledEsq);

    // Calha Direita
    const calhaDir = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.08, 4.2), calhaMat);
    calhaDir.position.set(3.8, 5.3, 0.6);
    const ledDir = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.03, 4.0), ledMat);
    ledDir.position.set(3.8, 5.25, 0.6);
    nightLightsGroup.add(calhaDir);
    nightLightsGroup.add(ledDir);

    // Cabos metálicos de suspensão
    [[-3.8, -1.2], [-3.8, 2.4], [3.8, -1.2], [3.8, 2.4]].forEach(pos => {
      const cabo = box(0.02, 0.8, 0.02, 0x64748b, pos[0], 5.7, pos[1], nightLightsGroup);
      cabo.castShadow = false;
    });

    // Luzes Pontuais das Calhas no Piso/Mesas
    const lightEsq = new THREE.PointLight(0xdbeafe, 1.9, 9.5, 1.4);
    lightEsq.position.set(-3.8, 5.1, 0.6);
    nightLightsGroup.add(lightEsq);

    const lightDir = new THREE.PointLight(0xdbeafe, 1.9, 9.5, 1.4);
    lightDir.position.set(3.8, 5.1, 0.6);
    nightLightsGroup.add(lightDir);

    // Luz no Corredor Central
    const lightCentro = new THREE.PointLight(0xe0f2fe, 1.3, 8.0, 1.5);
    lightCentro.position.set(0, 5.0, 2.5);
    nightLightsGroup.add(lightCentro);

    // Spot Direcional no Telão Central
    const spotBoard = new THREE.SpotLight(0x60a5fa, 2.8, 11, Math.PI / 3.2, 0.35);
    spotBoard.position.set(-0.6, 5.2, -2.6);
    spotBoard.target = boardMesh;
    nightLightsGroup.add(spotBoard);
    nightLightsGroup.add(spotBoard.target);

    // Spot Direcional na Parede do Logotipo EnterSight
    const spotLogo = new THREE.SpotLight(0x38bdf8, 2.6, 9.5, Math.PI / 3.4, 0.3);
    spotLogo.position.set(-4.0, 4.8, 0);
    spotLogo.target = logoPlane;
    nightLightsGroup.add(spotLogo);
    nightLightsGroup.add(spotLogo.target);

    // Luz Aconchegante no Sofá Lounge
    const lightLounge = new THREE.PointLight(0xfef08a, 1.6, 6.0, 1.6);
    lightLounge.position.set(5.2, 3.6, -3.8);
    nightLightsGroup.add(lightLounge);

    // Luzes individuais dos monitores dos agentes (Glow de tela no rosto e teclado)
    AGENT_ROLES.forEach(cfg => {
      const scrLight = new THREE.PointLight(cfg.shirt, 0.9, 2.8, 1.8);
      scrLight.position.set(cfg.deskPos.x, 1.78, cfg.deskPos.z - 0.05);
      nightLightsGroup.add(scrLight);
    });

    scene.add(nightLightsGroup);
  }

  // Estação de trabalho completa de um agente
  function createAgentWorkstation(cfg) {
    const x = cfg.deskPos.x;
    const z = cfg.deskPos.z;

    // Tampo superior da mesa (branco)
    box(2.5, 0.14, 1.3, WHITE, x, 1.05, z);
    // Moldura inferior azul
    box(2.5, 0.05, 1.3, BLUE, x, 0.98, z);

    // Pernas metálicas azul claro
    const legOffset = [[-1.15, -0.55], [1.15, -0.55], [-1.15, 0.55], [1.15, 0.55]];
    legOffset.forEach(p => box(0.1, 0.98, 0.1, SKY, x + p[0], 0.49, z + p[1]));

    // Monitor: Base, haste e carcaça
    box(0.45, 0.04, 0.25, NAVY, x, 1.13, z - 0.28);
    box(0.1, 0.45, 0.08, NAVY, x, 1.38, z - 0.32);
    box(1.2, 0.76, 0.08, NAVY, x, 1.78, z - 0.35);

    // Tela luminosa (emissive)
    const screenGeo = new THREE.BoxGeometry(1.08, 0.64, 0.02);
    const screenMat = new THREE.MeshStandardMaterial({
      color: 0x60a5fa,
      emissive: cfg.shirt,
      emissiveIntensity: 0.45,
      roughness: 0.2
    });
    const screenMesh = new THREE.Mesh(screenGeo, screenMat);
    screenMesh.position.set(x, 1.78, z - 0.3);
    scene.add(screenMesh);

    // Teclado
    box(0.7, 0.03, 0.24, LIGHT, x, 1.13, z + 0.12);

    // Cadeira de escritório
    box(0.8, 0.12, 0.8, NAVY, x, 0.65, z + 1.25);
    box(0.8, 0.8, 0.1, NAVY, x, 1.1, z + 1.65);
    box(0.12, 0.6, 0.12, SKY, x, 0.3, z + 1.25);

    // Salvar referência da tela para piscar durante execução
    if (agents3D[cfg.id]) {
      agents3D[cfg.id].screenGlow = screenMesh;
    } else {
      setTimeout(() => {
        if (agents3D[cfg.id]) agents3D[cfg.id].screenGlow = screenMesh;
      }, 50);
    }
  }

  // Sofá Lounge
  function createSofaLounge(x, z) {
    box(2.8, 0.48, 1.1, BLUE, x, 0.24, z);
    box(2.8, 0.85, 0.3, NAVY, x, 0.72, z - 0.55);
    box(0.32, 0.65, 1.1, NAVY, x - 1.4, 0.48, z);
    box(0.32, 0.65, 1.1, NAVY, x + 1.4, 0.48, z);
    // Almofadas claras
    box(1.1, 0.1, 0.45, LIGHT, x, 0.54, z + 0.05);

    // Mesinha de centro do lounge com caneca
    box(1.5, 0.35, 0.85, WHITE, x, 0.18, z + 1.35);
    box(0.14, 0.18, 0.14, BLUE, x - 0.3, 0.44, z + 1.35);
  }

  // Planta Decorativa Procedural
  function createPlant(x, z) {
    box(0.65, 0.65, 0.65, WHITE, x, 0.32, z);
    box(0.52, 0.95, 0.52, 0x38bdf8, x, 1.12, z);
    box(0.36, 0.65, 0.36, 0x7dd3fc, x, 1.72, z);
  }

  // Renderização do Telão na Parede (Canvas 2D para CanvasTexture)
  function renderWhiteboardCanvas() {
    if (!whiteboardTextureObj) return;
    const ctx = whiteboardTextureObj.ctx;
    const w = 800, h = 420;
    const isDark = isDarkTheme;

    // Fundo do quadro
    ctx.fillStyle = isDark ? '#0b1329' : '#f8fafc';
    ctx.fillRect(0, 0, w, h);

    // Barra de Título Superior
    ctx.fillStyle = isDark ? '#1e3a8a' : '#1d4ed8';
    ctx.fillRect(0, 0, w, 68);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 24px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('CENTRAL DE AGENTES IA', 24, 43);

    // Contadores em tempo real no topo do quadro
    let onlineCount = 0;
    AGENT_ROLES.forEach(cfg => {
      const ag = agents3D[cfg.id];
      if (ag && ag.state !== 'offline') onlineCount++;
    });

    const stats = window.AgentLogger ? window.AgentLogger.getStats() : { actions: 0, alerts: 0 };
    ctx.font = 'bold 16px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`${onlineCount} ONLINE   |   ${stats.actions} AÇÕES HOJE   |   ${stats.alerts} ALERTAS`, w - 24, 43);

    // Linha divisória
    ctx.strokeStyle = isDark ? '#1e293b' : '#e2e8f0';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(20, 80);
    ctx.lineTo(w - 20, 80);
    ctx.stroke();

    // Lista de status dos 5 agentes no quadro
    AGENT_ROLES.forEach((cfg, idx) => {
      const y = 100 + idx * 56;
      const ag = agents3D[cfg.id];
      const isSelected = activeDockAgentId === cfg.id;

      // Fundo sutil do card de cada agente no telão
      if (isDark) {
        ctx.fillStyle = isSelected ? 'rgba(59, 130, 246, 0.28)' : (idx % 2 === 0 ? '#111c38' : '#0e162b');
      } else {
        ctx.fillStyle = isSelected ? 'rgba(59, 130, 246, 0.12)' : (idx % 2 === 0 ? '#ffffff' : '#f1f5f9');
      }
      ctx.beginPath();
      ctx.roundRect(20, y - 18, w - 40, 50, 8);
      ctx.fill();

      if (isSelected) {
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      // Bolinha de status
      let dotColor = '#10b981';
      let stateLabel = 'ONLINE 24/7';
      if (ag) {
        if (ag.state === 'running') {
          dotColor = '#3b82f6';
          stateLabel = 'EXECUTANDO VARREDURA';
        } else if (ag.state === 'error') {
          dotColor = '#ef4444';
          stateLabel = 'ALERTA / FALHA';
        } else if (ag.state === 'offline') {
          dotColor = '#94a3b8';
          stateLabel = 'DESLIGADO';
        }
      }

      ctx.fillStyle = dotColor;
      ctx.beginPath();
      ctx.arc(42, y + 7, 7, 0, Math.PI * 2);
      ctx.fill();

      // Nome do Agente
      ctx.fillStyle = isDark ? '#f8fafc' : '#0f172a';
      ctx.font = 'bold 16px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(cfg.name, 62, y + 8);

      // Cargo / Função
      ctx.fillStyle = isDark ? '#94a3b8' : '#64748b';
      ctx.font = '500 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText(`• ${cfg.role}`, 310, y + 8);

      // Status / Última Ação
      const actTxt = ag ? ag.lastActionSummary : 'Monitoramento contínuo';
      const maxAct = actTxt.length > 28 ? actTxt.slice(0, 26) + '...' : actTxt;
      ctx.fillStyle = ag && ag.state === 'running' ? '#60a5fa' : (isDark ? '#cbd5e1' : '#334155');
      ctx.font = '600 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText(maxAct, 490, y + 8);

      // Horário e Badge
      ctx.textAlign = 'right';
      ctx.fillStyle = isDark ? '#94a3b8' : '#64748b';
      ctx.font = '12px ui-monospace, SFMono-Regular, monospace';
      const timeStr = ag ? ag.lastActionTime : '--:--';
      ctx.fillText(timeStr, w - 36, y + 8);
    });

    // Rodapé do quadro: dica de clique
    ctx.fillStyle = isDark ? '#64748b' : '#94a3b8';
    ctx.font = 'italic 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Clique em qualquer agente na sala ou no telão para abrir seu histórico de execuções.', w / 2, h - 14);

    whiteboardTextureObj.tex.needsUpdate = true;
  }

  // ============================================================================
  // MÁQUINA DE ESTADOS & WAYPOINTS DE MOVIMENTO
  // ============================================================================

  // Iniciar caminhada até o telão
  function sendAgentToWhiteboard(agentId) {
    const ag = agents3D[agentId];
    if (!ag || ag.state === 'offline') return;

    ag.state = 'running';
    ag.currentStatusText = 'Auditando dados...';

    // Adiciona à fila do quadro se não estiver nela
    if (!presentationQueue.includes(agentId)) {
      presentationQueue.push(agentId);
    }
    const qIndex = presentationQueue.indexOf(agentId);

    // Ponto alvo na frente do telão (com espaçamento caso haja fila)
    const targetX = -1.8 + qIndex * 1.3;
    const targetZ = -3.8;

    // Waypoints para desviar de mesas e cadeiras:
    // 1. Levanta e sai da cadeira (avança um pouco em Z)
    // 2. Vai para o corredor central em X: 0
    // 3. Avança até a parede do telão
    // 4. Se posiciona na frente do quadro
    ag.currentWaypoints = [
      { x: ag.seatPos.x, z: ag.seatPos.z + 0.6 },
      { x: 0, z: ag.seatPos.z + 0.6 },
      { x: 0, z: targetZ },
      { x: targetX, z: targetZ, isFinalPresentation: true }
    ];
    ag.waypointIdx = 0;
    ag.isSeated = false;

    updateAgentSpriteLabel(ag);
    renderWhiteboardCanvas();
    updateDockPanelUI(agentId);
  }

  // Retornar à mesa
  function returnAgentToDesk(agentId, success = true, summaryText = '') {
    const ag = agents3D[agentId];
    if (!ag) return;

    // Remove da fila de apresentação
    const qIdx = presentationQueue.indexOf(agentId);
    if (qIdx !== -1) presentationQueue.splice(qIdx, 1);

    ag.state = success ? 'idle' : 'error';
    ag.currentStatusText = success ? 'Varredura concluída' : 'Falha na varredura';
    if (summaryText) ag.lastActionSummary = summaryText;
    ag.lastActionTime = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    // Waypoints de retorno:
    // 1. Volta para o corredor central X: 0
    // 2. Desce pelo corredor até a altura da sua mesa
    // 3. Entra pelo vão da cadeira e senta
    ag.currentWaypoints = [
      { x: 0, z: -3.8 },
      { x: 0, z: ag.seatPos.z + 0.6 },
      { x: ag.seatPos.x, z: ag.seatPos.z + 0.6 },
      { x: ag.seatPos.x, z: ag.seatPos.z, isFinalSeat: true }
    ];
    ag.waypointIdx = 0;

    updateAgentSpriteLabel(ag);
    renderWhiteboardCanvas();
    updateDockPanelUI(agentId);
  }

  // Agente vai ao sofá de descanso (toggle desligado)
  function sendAgentToLounge(agentId) {
    const ag = agents3D[agentId];
    if (!ag) return;

    // Remove da fila do quadro caso estivesse
    const qIdx = presentationQueue.indexOf(agentId);
    if (qIdx !== -1) presentationQueue.splice(qIdx, 1);

    ag.state = 'offline';
    ag.currentStatusText = '☕ Em descanso';
    ag.lastActionSummary = 'Desligado pelo usuário';
    ag.lastActionTime = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    // Waypoints até o lounge
    ag.currentWaypoints = [
      { x: 0, z: ag.seatPos.z + 0.6 },
      { x: 0, z: -3.6 },
      { x: ag.loungePos.x, z: ag.loungePos.z, isLoungeSeat: true }
    ];
    ag.waypointIdx = 0;
    ag.isSeated = false;

    updateAgentSpriteLabel(ag);
    renderWhiteboardCanvas();
    updateDockPanelUI(agentId);
  }

  // Agente volta do sofá para a mesa (toggle religado)
  function wakeAgentFromLounge(agentId) {
    const ag = agents3D[agentId];
    if (!ag) return;

    ag.state = 'idle';
    ag.currentStatusText = 'Online 24/7';
    ag.lastActionSummary = 'Reiniciado e ativo';
    ag.lastActionTime = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    ag.currentWaypoints = [
      { x: 0, z: -3.6 },
      { x: 0, z: ag.seatPos.z + 0.6 },
      { x: ag.seatPos.x, z: ag.seatPos.z + 0.6 },
      { x: ag.seatPos.x, z: ag.seatPos.z, isFinalSeat: true }
    ];
    ag.waypointIdx = 0;

    updateAgentSpriteLabel(ag);
    renderWhiteboardCanvas();
    updateDockPanelUI(agentId);
  }

  // ============================================================================
  // LOOP DE ANIMAÇÃO & RENDERIZAÇÃO
  // ============================================================================

  function animationLoop() {
    if (!isRunning) return;
    animId = requestAnimationFrame(animationLoop);

    const time = clock.getElapsedTime();
    const speed = 0.07;

    // Posicionamento da Câmera Ortográfica Isométrica
    const camDistance = 22;
    camera.position.set(
      Math.sin(theta) * camDistance,
      17,
      Math.cos(theta) * camDistance
    );
    camera.lookAt(0, 1.8, 0);

    // Atualização de cada agente
    let activeWorkers = 0;
    AGENT_ROLES.forEach((cfg, idx) => {
      const ag = agents3D[cfg.id];
      if (!ag) return;

      if (ag.state === 'running') activeWorkers++;

      const g = ag.group;

      // 1. Há waypoints pendentes para caminhar?
      if (ag.currentWaypoints.length > 0 && ag.waypointIdx < ag.currentWaypoints.length) {
        const target = ag.currentWaypoints[ag.waypointIdx];
        const dx = target.x - g.position.x;
        const dz = target.z - g.position.z;
        const dist = Math.hypot(dx, dz);

        if (dist > 0.09) {
          // Caminhando: interpolação suave
          g.position.x += (dx / dist) * speed;
          g.position.z += (dz / dist) * speed;
          g.rotation.y = Math.atan2(dx, dz);

          // Oscilação vertical dos passos e balanço dos braços
          g.position.y = Math.abs(Math.sin(time * 12)) * 0.09;
          ag.armL.rotation.x = Math.sin(time * 12) * 0.65;
          ag.armR.rotation.x = -Math.sin(time * 12) * 0.65;
          ag.isSeated = false;
        } else {
          // Chegou no waypoint atual, avança para o próximo
          ag.waypointIdx++;

          if (ag.waypointIdx >= ag.currentWaypoints.length) {
            // Concluiu todos os waypoints
            ag.currentWaypoints = [];
            if (target.isFinalSeat) {
              ag.isSeated = true;
              g.position.y = ag.seatPos.y;
              g.rotation.y = cfg.facingAngle;
            } else if (target.isLoungeSeat) {
              ag.isSeated = true;
              g.position.y = ag.loungePos.y;
              g.rotation.y = -Math.PI / 2;
            } else if (target.isFinalPresentation) {
              // Chegou no quadro: fica de frente para a parede e levanta o braço
              g.rotation.y = 0;
              g.position.y = 0;
            }
          }
        }
      } else {
        // 2. Parado no estado atual
        if (ag.isSeated && ag.state !== 'offline') {
          // Sentado na mesa: digitando levemente
          g.position.y = ag.seatPos.y;
          g.rotation.y = cfg.facingAngle;
          ag.armL.rotation.x = -1.25 + Math.sin(time * 10 + idx) * 0.12;
          ag.armR.rotation.x = -1.25 + Math.cos(time * 9 + idx) * 0.12;

          // Brilho da tela oscilando suavemente (adaptado ao Dark Mode)
          if (ag.screenGlow) {
            const baseGlow = isDarkTheme ? 1.5 : 0.5;
            const osc = isDarkTheme ? 0.35 : 0.2;
            ag.screenGlow.material.emissiveIntensity = baseGlow + Math.sin(time * 4 + idx) * osc;
          }
        } else if (ag.state === 'running' && ag.currentWaypoints.length === 0) {
          // De frente para o quadro: braço direito levantado "escrevendo / apresentando"
          g.rotation.y = 0;
          g.position.y = 0;
          ag.armR.rotation.x = -2.2 + Math.sin(time * 6) * 0.15;
          ag.armL.rotation.x = -0.4;
        } else if (ag.state === 'offline') {
          // Relaxando no sofá
          g.position.y = ag.loungePos.y;
          g.rotation.y = -Math.PI / 2;
          ag.armL.rotation.x = 0;
          ag.armR.rotation.x = 0;
        } else if (ag.state === 'error') {
          // Alerta de erro: balançando a cabeça de um lado para o outro
          ag.head.rotation.y = Math.sin(time * 14) * 0.35;
        }
      }
    });

    // Atualiza status pill superior
    const statusPill = document.getElementById('e3d-status-text');
    if (statusPill) {
      statusPill.textContent = `${activeWorkers} em operação · ${AGENT_ROLES.length - activeWorkers} aguardando ciclo`;
    }

    renderer.render(scene, camera);
  }

  // ============================================================================
  // INTERAÇÃO DO USUÁRIO (ÓRBITA, ZOOM, RAYCASTING & CLIQUE)
  // ============================================================================

  function setupInteractionListeners() {
    const cv = renderer.domElement;
    const tooltip = document.getElementById('e3d-hover-tooltip');
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    // Rotação da câmera (Pointer Drag)
    cv.addEventListener('pointerdown', e => {
      isDragging = true;
      lastMouseX = e.clientX;
      cv.setPointerCapture(e.pointerId);
    });

    cv.addEventListener('pointerup', () => {
      isDragging = false;
    });

    cv.addEventListener('pointermove', e => {
      if (isDragging) {
        theta -= (e.clientX - lastMouseX) * 0.007;
        lastMouseX = e.clientX;
        return;
      }

      // Raycasting para Hover em Personagens ou Telão
      const rect = cv.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(scene.children, true);

      let foundAgent = null;
      let foundBoard = false;

      for (let i = 0; i < intersects.length; i++) {
        let obj = intersects[i].object;
        if (obj.userData && obj.userData.isWhiteboard) {
          foundBoard = true;
          break;
        }
        while (obj && obj !== scene) {
          if (obj.userData && obj.userData.agentId) {
            foundAgent = obj.userData.agentId;
            break;
          }
          obj = obj.parent;
        }
        if (foundAgent) break;
      }

      if (foundAgent) {
        cv.style.cursor = 'pointer';
        hoveredAgent = foundAgent;
        const ag = agents3D[foundAgent];
        if (tooltip && ag) {
          tooltip.style.display = 'block';
          tooltip.style.left = `${e.clientX - rect.left}px`;
          tooltip.style.top = `${e.clientY - rect.top}px`;
          tooltip.textContent = `📋 ${ag.cfg.name} (Clique para Histórico)`;
        }
      } else if (foundBoard) {
        cv.style.cursor = 'pointer';
        hoveredAgent = 'board';
        if (tooltip) {
          tooltip.style.display = 'block';
          tooltip.style.left = `${e.clientX - rect.left}px`;
          tooltip.style.top = `${e.clientY - rect.top}px`;
          tooltip.textContent = `📊 Central de Agentes (Clique para Histórico)`;
        }
      } else {
        cv.style.cursor = isDragging ? 'grabbing' : 'grab';
        hoveredAgent = null;
        if (tooltip) tooltip.style.display = 'none';
      }
    });

    // Zoom via Roda do Mouse
    cv.addEventListener('wheel', e => {
      e.preventDefault();
      zoom = Math.min(2.2, Math.max(0.65, zoom * (e.deltaY < 0 ? 1.08 : 0.92)));
      handleResize();
    }, { passive: false });

    // Clique para abrir Histórico
    cv.addEventListener('click', () => {
      if (!hoveredAgent) return;
      if (hoveredAgent === 'board') {
        selectDockAgent(activeDockAgentId);
        if (window.openAgentHistoryModal) {
          window.openAgentHistoryModal(activeDockAgentId);
        }
      } else {
        selectDockAgent(hoveredAgent);
        if (window.openAgentHistoryModal) {
          window.openAgentHistoryModal(hoveredAgent);
        }
      }
    });

    // Botão Resetar Câmera
    const btnResetCam = document.getElementById('e3d-btn-reset-cam');
    if (btnResetCam) {
      btnResetCam.addEventListener('click', () => {
        theta = initialTheta;
        zoom = 1.05;
        handleResize();
      });
    }

    // Botão Focar Telão
    const btnFocusBoard = document.getElementById('e3d-btn-focus-board');
    if (btnFocusBoard) {
      btnFocusBoard.addEventListener('click', () => {
        theta = 0.08;
        zoom = 1.35;
        handleResize();
      });
    }
  }

  // Redimensionamento responsivo e ortográfico
  function handleResize() {
    if (!stageContainer || !renderer || !camera) return;
    const w = stageContainer.clientWidth;
    const h = stageContainer.clientHeight;
    if (w === 0 || h === 0) return;

    renderer.setSize(w, h);
    const aspect = w / h;
    const s = 10.5 / zoom;
    Object.assign(camera, {
      left: -s * aspect,
      right: s * aspect,
      top: s,
      bottom: -s
    });
    camera.updateProjectionMatrix();
  }

  // ============================================================================
  // PAINEL COMPACTO DE CONTROLE (DOCK)
  // ============================================================================

  function buildDockPanel() {
    const tabsContainer = document.getElementById('e3d-dock-tabs');
    if (!tabsContainer) return;

    tabsContainer.innerHTML = AGENT_ROLES.map(cfg => `
      <button class="e3d-agent-tab-btn ${cfg.id === activeDockAgentId ? 'active' : ''}" data-agent="${cfg.id}" id="dock-tab-${cfg.id}">
        <span class="e3d-agent-tab-dot" style="color: ${cfg.colorHex};"></span>
        <span>${cfg.shortName}</span>
      </button>
    `).join('');

    tabsContainer.querySelectorAll('.e3d-agent-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.agent;
        selectDockAgent(id);
      });
    });

    updateDockPanelUI(activeDockAgentId);
  }

  function selectDockAgent(agentId) {
    activeDockAgentId = agentId;
    document.querySelectorAll('.e3d-agent-tab-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.agent === agentId);
    });
    updateDockPanelUI(agentId);
    renderWhiteboardCanvas();
  }

  function updateDockPanelUI(agentId) {
    const cfg = AGENT_ROLES.find(a => a.id === agentId);
    if (!cfg) return;

    const ag = agents3D[agentId];
    const isOffline = ag && ag.state === 'offline';

    // Top info
    const iconEl = document.getElementById('e3d-dock-agent-icon');
    const nameEl = document.getElementById('e3d-dock-agent-name');
    const roleEl = document.getElementById('e3d-dock-agent-role');
    const descEl = document.getElementById('e3d-dock-agent-desc');
    const toggleEl = document.getElementById('e3d-dock-toggle-input');

    if (iconEl) {
      iconEl.style.background = cfg.colorHex;
      iconEl.innerHTML = `<i class="fa-solid fa-robot"></i>`;
    }
    if (nameEl) nameEl.textContent = cfg.name;
    if (roleEl) roleEl.textContent = cfg.role;
    if (descEl) descEl.textContent = ag ? ag.lastActionSummary : 'Monitoramento contínuo da base.';

    if (toggleEl) {
      toggleEl.checked = !isOffline;
      toggleEl.onchange = e => {
        const isOn = e.target.checked;
        const states = JSON.parse(localStorage.getItem('iaAgentStates') || '{}');
        states[agentId] = isOn;
        localStorage.setItem('iaAgentStates', JSON.stringify(states));

        if (isOn) {
          wakeAgentFromLounge(agentId);
          if (window.AgentRuntime) window.AgentRuntime.start(agentId);
        } else {
          sendAgentToLounge(agentId);
          if (window.AgentRuntime) window.AgentRuntime.stop(agentId);
        }
      };
    }

    // Botão Executar Agora
    const runBtn = document.getElementById('e3d-dock-run-btn');
    if (runBtn) {
      runBtn.disabled = isOffline || (ag && ag.state === 'running');
      runBtn.innerHTML = ag && ag.state === 'running'
        ? `<i class="fa-solid fa-spinner fa-spin"></i> Processando...`
        : `<i class="fa-solid fa-play"></i> Executar Agora`;
      runBtn.onclick = () => {
        if (window.AgentRuntime) window.AgentRuntime.executeCycle(agentId, false);
      };
    }

    // Botão Histórico
    const histBtn = document.getElementById('e3d-dock-hist-btn');
    if (histBtn) {
      histBtn.onclick = () => {
        if (window.openAgentHistoryModal) window.openAgentHistoryModal(agentId);
      };
    }

    // Botão Limpar Logs
    const clearBtn = document.getElementById('e3d-dock-clear-logs');
    if (clearBtn) {
      clearBtn.onclick = () => {
        if (window.AgentLogger) {
          window.AgentLogger.clearLogs(agentId);
          renderDockLogs(agentId);
        }
      };
    }

    renderDockLogs(agentId);
  }

  function renderDockLogs(agentId) {
    const feed = document.getElementById('e3d-dock-logs-feed');
    if (!feed) return;

    if (!window.AgentLogger) {
      feed.innerHTML = `<div class="e3d-log-empty">Aguardando dados...</div>`;
      return;
    }

    const logs = window.AgentLogger.getLogs(agentId);
    if (logs.length === 0) {
      feed.innerHTML = `<div class="e3d-log-empty">Aguardando próximo ciclo de varredura...</div>`;
      return;
    }

    feed.innerHTML = logs.slice(0, 5).map(l => `
      <div class="e3d-log-item">
        <span class="e3d-log-time">[${l.time}]</span>
        <span class="e3d-log-txt">${l.text}</span>
      </div>
    `).join('');
  }

  // ============================================================================
  // SINCRONIZAÇÃO EM TEMPO REAL COM O RUNTIME DO EnterSight
  // ============================================================================

  function syncWithAgentRuntime() {
    // Escuta eventos customizados de ciclo emitidos pelo ia-hub.js
    window.addEventListener('ia-agent-cycle-start', e => {
      const { agentId } = e.detail;
      sendAgentToWhiteboard(agentId);
    });

    window.addEventListener('ia-agent-cycle-end', e => {
      const { agentId, success, summary } = e.detail;
      returnAgentToDesk(agentId, success, summary);
    });

    window.addEventListener('ia-agent-toggle', e => {
      const { agentId, isOn } = e.detail;
      if (isOn) {
        wakeAgentFromLounge(agentId);
      } else {
        sendAgentToLounge(agentId);
      }
    });

    window.addEventListener('ia-agent-new-log', e => {
      const { agentId, text, type } = e.detail;
      const ag = agents3D[agentId];
      if (ag) {
        ag.lastActionSummary = text;
        ag.lastActionTime = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        if (type === 'alert') ag.state = 'error';
        updateAgentSpriteLabel(ag);
        renderWhiteboardCanvas();
        if (activeDockAgentId === agentId) renderDockLogs(agentId);
      }
    });

    // Atualização da contagem regressiva no dock
    setInterval(() => {
      if (!window.AgentRuntime || !window.AgentRuntime.countdowns) return;
      const remaining = window.AgentRuntime.countdowns[activeDockAgentId] || 0;
      const cdEl = document.getElementById('e3d-dock-countdown');
      const barEl = document.getElementById('e3d-dock-progress-fill');
      const cfg = AGENT_ROLES.find(a => a.id === activeDockAgentId);

      if (cdEl && cfg) {
        const ag = agents3D[activeDockAgentId];
        if (ag && ag.state === 'offline') {
          cdEl.textContent = 'Pausado';
          if (barEl) barEl.style.width = '0%';
        } else {
          const mins = Math.floor(remaining / 60);
          const secs = remaining % 60;
          cdEl.textContent = `em ${mins}:${secs < 10 ? '0' : ''}${secs}`;
          if (barEl) {
            const total = cfg.intervaloSegundos || 180;
            const pct = Math.max(0, Math.min(100, (1 - remaining / total) * 100));
            barEl.style.width = `${pct}%`;
          }
        }
      }
    }, 1000);
  }

  // ============================================================================
  // GERENCIAMENTO DINÂMICO DE DARK MODE NO ESCRITÓRIO 3D
  // ============================================================================

  function applyTheme(isDark) {
    isDarkTheme = !!isDark;

    if (!scene || !renderer) return;

    if (isDarkTheme) {
      scene.background.setHex(0x090e1c);
      if (ambientLight) {
        ambientLight.color.setHex(0x1e293b);
        ambientLight.intensity = 0.24;
      }
      if (sunLight) {
        sunLight.color.setHex(0x38bdf8);
        sunLight.intensity = 0.14;
      }
      if (floorMesh && floorMesh.material) floorMesh.material.color.setHex(0x111a2e);
      if (wallBackMesh && wallBackMesh.material) wallBackMesh.material.color.setHex(0x162035);
      if (wallLeftMesh && wallLeftMesh.material) wallLeftMesh.material.color.setHex(0x131c30);
      if (nightLightsGroup) nightLightsGroup.visible = true;

      // Painel de logomarca na parede (sempre visível)
      if (logoBackBoardMesh && logoBackBoardMesh.material) logoBackBoardMesh.material.color.setHex(0x1e3a8a);

      // Telas dos computadores dos agentes mais brilhantes no escuro
      Object.values(agents3D).forEach(ag => {
        if (ag.screenGlow && ag.screenGlow.material) {
          ag.screenGlow.material.emissiveIntensity = 1.6;
        }
        updateAgentSpriteLabel(ag);
      });
    } else {
      scene.background.setHex(0xeaf2ff);
      if (ambientLight) {
        ambientLight.color.setHex(0xffffff);
        ambientLight.intensity = 0.78;
      }
      if (sunLight) {
        sunLight.color.setHex(0xffffff);
        sunLight.intensity = 0.72;
      }
      if (floorMesh && floorMesh.material) floorMesh.material.color.setHex(FLOOR_COLOR);
      if (wallBackMesh && wallBackMesh.material) wallBackMesh.material.color.setHex(WHITE);
      if (wallLeftMesh && wallLeftMesh.material) wallLeftMesh.material.color.setHex(0xf6f9ff);
      if (nightLightsGroup) nightLightsGroup.visible = false;

      // Painel de logomarca na parede (sempre visível)
      if (logoBackBoardMesh && logoBackBoardMesh.material) logoBackBoardMesh.material.color.setHex(BLUE);

      // Telas dos monitores dos agentes voltam à intensidade suave
      Object.values(agents3D).forEach(ag => {
        if (ag.screenGlow && ag.screenGlow.material) {
          ag.screenGlow.material.emissiveIntensity = 0.5;
        }
        updateAgentSpriteLabel(ag);
      });
    }

    drawBrandLogo();
    renderWhiteboardCanvas();
  }

  function setupThemeObserver() {
    window.addEventListener('temaAlterado', e => {
      const isDark = e.detail ? e.detail.isDark : detectDarkMode();
      applyTheme(isDark);
    });

    const themeObserver = new MutationObserver(() => {
      const darkNow = detectDarkMode();
      if (darkNow !== isDarkTheme) {
        applyTheme(darkNow);
      }
    });

    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class', 'data-tema', 'data-theme']
    });

    if (document.body) {
      themeObserver.observe(document.body, {
        attributes: true,
        attributeFilter: ['class', 'data-tema', 'data-theme']
      });
    }
  }

  // ============================================================================
  // INICIALIZAÇÃO PRINCIPAL DO ESCRITÓRIO 3D
  // ============================================================================

  function initOffice3D() {
    stageContainer = document.getElementById('e3d-viewport');
    if (!stageContainer) return;

    // 1. Verificação de Fallback WebGL
    if (!isWebGLAvailable() || typeof THREE === 'undefined') {
      console.warn('WebGL não suportado ou Three.js ausente. Ativando fallback clássico.');
      const fallbackGrid = document.getElementById('ia-agents-fallback-grid');
      const e3dWrap = document.getElementById('escritorio3d-wrapper');
      if (e3dWrap) e3dWrap.style.display = 'none';
      if (fallbackGrid) fallbackGrid.classList.add('active-fallback');
      return;
    }

    // 2. Renderer Three.js
    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.className = 'e3d-canvas';
    stageContainer.appendChild(renderer.domElement);

    // 3. Cena e Câmera Ortográfica
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xeaf2ff);
    camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -50, 100);
    clock = new THREE.Clock();

    // 4. Iluminação
    ambientLight = new THREE.AmbientLight(0xffffff, 0.78);
    scene.add(ambientLight);

    sunLight = new THREE.DirectionalLight(0xffffff, 0.72);
    sunLight.position.set(9, 16, 9);
    sunLight.castShadow = true;
    Object.assign(sunLight.shadow.camera, {
      left: -14,
      right: 14,
      top: 14,
      bottom: -14,
      near: 1,
      far: 45
    });
    sunLight.shadow.mapSize.width = 1024;
    sunLight.shadow.mapSize.height = 1024;
    scene.add(sunLight);

    // 5. Construção do Cenário e Personagens
    buildOfficeEnvironment();

    const savedStates = JSON.parse(localStorage.getItem('iaAgentStates') || '{}');
    AGENT_ROLES.forEach((cfg, idx) => {
      const ag = buildAgentCharacter(cfg, idx);
      agents3D[cfg.id] = ag;

      const isOff = savedStates[cfg.id] === false;
      if (isOff) {
        ag.state = 'offline';
        ag.group.position.set(ag.loungePos.x, ag.loungePos.y, ag.loungePos.z);
        ag.group.rotation.y = -Math.PI / 2;
        ag.currentStatusText = '☕ Em descanso';
      }
      updateAgentSpriteLabel(ag);
    });

    // 6. Configuração e Aplicação do Dark Mode / Tema
    setupThemeObserver();
    applyTheme(detectDarkMode());

    // 7. Listeners e Dock
    setupInteractionListeners();
    buildDockPanel();
    syncWithAgentRuntime();
    handleResize();

    window.addEventListener('resize', handleResize);

    // 7. Otimização de Performance: IntersectionObserver e Page Visibility
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          startLoop();
        } else {
          stopLoop();
        }
      });
    }, { threshold: 0.1 });
    observer.observe(stageContainer);

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        stopLoop();
      } else {
        startLoop();
      }
    });

    startLoop();
  }

  function startLoop() {
    if (!isRunning) {
      isRunning = true;
      clock.start();
      animationLoop();
    }
  }

  function stopLoop() {
    isRunning = false;
    if (animId) {
      cancelAnimationFrame(animId);
      animId = null;
    }
  }

  // Exporta controle global para integração
  window.Escritorio3D = {
    init: initOffice3D,
    sendToWhiteboard: sendAgentToWhiteboard,
    returnToDesk: returnAgentToDesk,
    sendToLounge: sendAgentToLounge,
    wakeFromLounge: wakeAgentFromLounge,
    resize: handleResize,
    setTheme: applyTheme
  };

  // Inicializa quando a DOM estiver pronta
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initOffice3D);
  } else {
    initOffice3D();
  }
})();
