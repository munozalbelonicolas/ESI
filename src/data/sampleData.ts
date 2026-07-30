export const SAMPLE_PRODUCTS = [
  {
    name: 'Cuadernillo ESI Nivel Secundario — Guias & Secuencias Didácticas',
    description: `
      <h3>Cuadernillo integral de ESI para el aula</h3>
      <p>Material imprescindible para docentes de nivel secundario. Incluye secuencias didácticas completas, actividades para trabajar en clase, marcos teóricos actualizados y fichas fotocopiables para estudiantes.</p>
      <h4>Contenidos principales:</h4>
      <ul>
        <li>Cuidado del cuerpo y la salud en la adolescencia</li>
        <li>Vínculos afectivos y prevención de la violencia de género</li>
        <li>Derechos sexuales y reproductivos</li>
        <li>Diversidad e identidad en la escuela</li>
      </ul>
      <p><strong>Formato:</strong> PDF descargable listo para imprimir.</p>
    `,
    shortDescription: 'Secuencias didácticas completas y actividades para trabajar los 5 ejes de la ESI en el aula de secundaria.',
    price: 4500,
    compareAtPrice: 6000,
    isFree: false,
    category: 'Cuadernillos',
    images: [
      'https://d22fxaf9t8d39k.cloudfront.net/9f9e8e95da2ed9e665173f111bb758d1dd792087a99ee5cdce9e721472df48a9202263.png',
    ],
    stock: -1, // ilimitado (digital)
    isDigital: true,
    digitalFileUrl: null,
    isActive: true,
    tags: ['ESI', 'Cuadernillo', 'Secundaria', 'Docentes'],
  },
  {
    name: 'Juego Didáctico: Rueda de los Derechos y los Vínculos',
    description: `
      <h3>Juego de cartas y dilemas para el aula</h3>
      <p>Dinámica participativa pensada para promover el debate respetuoso y la reflexión en grupos de secundaria. Incluye 40 tarjetas con situaciones cotidianas, dilemas éticos y preguntas disparadoras sobre afectividad, consentimiento y mitos del amor romántico.</p>
    `,
    shortDescription: '40 tarjetas de dilemas y debate sobre afectividad, consentimiento y vínculos sanos.',
    price: 6800,
    compareAtPrice: 8500,
    isFree: false,
    category: 'Juegos',
    images: [
      'https://d22fxaf9t8d39k.cloudfront.net/9f9e8e95da2ed9e665173f111bb758d1dd792087a99ee5cdce9e721472df48a9202263.png',
    ],
    stock: 25,
    isDigital: false,
    digitalFileUrl: null,
    isActive: true,
    tags: ['Juego', 'Tarjetas', 'Vínculos', 'Debate'],
  },
  {
    name: 'Agenda Docente ESI 2026 — Planificador y Efemérides',
    description: `
      <h3>La agenda pensada para profes que trabajan la ESI</h3>
      <p>Organizador anual con todas las efemérides de ESI del calendario escolar argentino, espacio para planificación semanal, fichas de seguimiento por curso y sugerencias de actividades para cada fecha clave.</p>
    `,
    shortDescription: 'Planificador docente 2026 con efemérides escolares de ESI y fichas de curso.',
    price: 8900,
    compareAtPrice: 11000,
    isFree: false,
    category: 'Agenda',
    images: [
      'https://d22fxaf9t8d39k.cloudfront.net/9f9e8e95da2ed9e665173f111bb758d1dd792087a99ee5cdce9e721472df48a9202263.png',
    ],
    stock: 15,
    isDigital: false,
    digitalFileUrl: null,
    isActive: true,
    tags: ['Agenda', '2026', 'Planificador', 'Efemérides'],
  },
  {
    name: 'Pack Efemérides ESI: Material Gráfico e Imprimibles',
    description: `
      <h3>Afiches, flyers e infografías para la escuela</h3>
      <p>Pack digital con recursos visuales listos para imprimir y colgar en la cartelera escolar o proyectar en clase durante las semanas temáticas (25N, 8M, Día de la ESI, etc.).</p>
    `,
    shortDescription: 'Afiches e infografías en alta resolución para carteleras escolares y semanas temáticas.',
    price: 0,
    compareAtPrice: 3500,
    isFree: true,
    category: 'Calendario y Efemérides',
    images: [
      'https://d22fxaf9t8d39k.cloudfront.net/9f9e8e95da2ed9e665173f111bb758d1dd792087a99ee5cdce9e721472df48a9202263.png',
    ],
    stock: -1,
    isDigital: true,
    digitalFileUrl: null,
    isActive: true,
    tags: ['Gratis', 'Efemérides', 'Afiches', 'Cartelera'],
  },
];

export const SAMPLE_POSTS = [
  {
    title: '¿Cómo abordar la ESI en secundaria sin morir en el intento?',
    excerpt: 'Estrategias prácticas para romper el hielo y generar espacios de diálogo seguros con estudiantes de 1º a 6º año.',
    body: `
      <p>La Educación Sexual Integral en la escuela secundaria suele despertar dudas, temores o prejuicios tanto en docentes como en las familias. Sin embargo, cuando se aborda desde una perspectiva de derechos, empatía y escucha activa, se convierte en una de las herramientas más valiosas para el desarrollo pleno de las y los jóvenes.</p>
      <h3>1. Empezar por el marco normativo y conceptual</h3>
      <p>Recordar que la ESI es una ley nacional (Ley 26.150) ayuda a encuadrar la tarea docente como un deber pedagógico y una garantía de derechos para el estudiantado.</p>
      <h3>2. Generar un buzón de preguntas anónimas</h3>
      <p>Una técnica sencilla y muy efectiva es colocar una cajita en el aula donde las y los estudiantes puedan dejar sus dudas por escrito sin firmar. Esto reduce la vergüenza y permite planificar la clase según sus inquietudes reales.</p>
      <h3>3. Usar recursos disparadores</h3>
      <p>Los cortometrajes, las canciones, los casos hipotéticos o los juegos de rol son excelentes puertas de entrada para tratar temas complejos sin personalizarlos de entrada.</p>
    `,
    coverImage: 'https://d22fxaf9t8d39k.cloudfront.net/9f9e8e95da2ed9e665173f111bb758d1dd792087a99ee5cdce9e721472df48a9202263.png',
    isPublished: true,
    tags: ['Docentes', 'Estrategias', 'Aula', 'Secundaria'],
  },
  {
    title: 'Efemérides ESI del mes: Claves para trabajar en la escuela',
    excerpt: 'Un recorrido por las fechas destacadas del calendario escolar argentino y cómo transformarlas en proyectos transversales.',
    body: `
      <p>Las efemérides son una oportunidad fundamental para conectar la ESI con la memoria colectiva, la historia y la ciudadanía crítica.</p>
      <p>En este artículo repasamos las fechas clave del trimestre y te compartimos ideas para trabajarlas desde distintas asignaturas.</p>
    `,
    coverImage: 'https://d22fxaf9t8d39k.cloudfront.net/9f9e8e95da2ed9e665173f111bb758d1dd792087a99ee5cdce9e721472df48a9202263.png',
    isPublished: true,
    tags: ['Efemérides', 'Proyectos', 'Transversalidad'],
  },
];

export const SAMPLE_COUPONS = [
  {
    code: 'DOCENTE10',
    type: 'percentage' as const,
    value: 10,
    minPurchase: 0,
    maxUses: 100,
    isActive: true,
    expiresAt: '2026-12-31',
  },
  {
    code: 'BIENVENIDA',
    type: 'fixed' as const,
    value: 1000,
    minPurchase: 5000,
    maxUses: 50,
    isActive: true,
    expiresAt: '2026-12-31',
  },
];
