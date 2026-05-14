import "@testing-library/jest-dom/vitest";

// Mock import.meta.env for Vite-based apps
// Vitest sets process.env but Vite uses import.meta.env
// The vitest config passes env vars which become import.meta.env in Vite

// Mock react-router-dom
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useParams: vi.fn(() => ({ id: "test-exp-123" })),
    useNavigate: vi.fn(() => vi.fn()),
    useSearchParams: vi.fn(() => [new URLSearchParams(), vi.fn()]),
    Link: ({ to, children }: any) => actual.createComponent ? actual.createComponent("a", { href: to }, children) : null,
    Outlet: () => null,
  };
});

// Mock firebase/auth and firebase/firestore
vi.mock("firebase/auth", () => ({
  getAuth: vi.fn(() => ({
    currentUser: null,
    signOut: vi.fn(),
    onAuthStateChanged: vi.fn((cb) => { cb(null); return vi.fn(); }),
  })),
  signInWithEmailAndPassword: vi.fn(),
  createUserWithEmailAndPassword: vi.fn(),
  connectAuthEmulator: vi.fn(),
  onAuthStateChanged: vi.fn((auth, cb) => { cb(null); return vi.fn(); }),
}));

vi.mock("firebase/firestore", () => ({
  getFirestore: vi.fn(() => ({})),
  doc: vi.fn(),
  setDoc: vi.fn(),
  connectFirestoreEmulator: vi.fn(),
}));

vi.mock("firebase/app", () => ({
  initializeApp: vi.fn(() => ({ name: "test-app" })),
}));

// Mock firebase module
vi.mock("../lib/firebase", () => ({
  auth: { currentUser: null, signOut: vi.fn(), onAuthStateChanged: vi.fn() },
  db: {},
  app: { name: "test-app" },
  getFirebaseAuth: vi.fn(() => Promise.resolve({ currentUser: null })),
  getFirebaseDb: vi.fn(() => Promise.resolve({})),
  getFirebaseApp: vi.fn(() => Promise.resolve({ name: "test-app" })),
}));

// Mock socket.io-client
vi.mock("socket.io-client", () => ({
  default: {
    io: vi.fn(() => ({
      on: vi.fn(),
      off: vi.fn(),
      emit: vi.fn(),
      disconnect: vi.fn(),
    })),
  },
  io: vi.fn(() => ({
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
    disconnect: vi.fn(),
  })),
}));

// Mock react-markdown (heavy dependency)
vi.mock("react-markdown", () => ({
  default: ({ children }: any) => children,
}));

vi.mock("remark-gfm", () => ({
  default: vi.fn(),
}));

// Mock react-syntax-highlighter
vi.mock("react-syntax-highlighter/dist/esm/styles/prism", () => ({
  oneLight: {},
}));

// Mock mermaid
vi.mock("mermaid", () => ({
  default: {
    initialize: vi.fn(),
    render: vi.fn(() => Promise.resolve({ svg: "<svg></svg>" })),
  },
}));

// Mock @monaco-editor/react
vi.mock("@monaco-editor/react", () => ({
  default: () => null,
}));

// Mock @xyflow/react and reactflow
vi.mock("@xyflow/react", () => ({
  ReactFlow: () => null,
  ReactFlowProvider: ({ children }: any) => children,
  useNodesState: () => [[], vi.fn(), vi.fn()],
  useEdgesState: () => [[], vi.fn(), vi.fn()],
  useReactFlow: () => ({}),
  MarkerType: { ArrowClosed: "arrowclosed" },
  Position: { Left: "left", Right: "right", Top: "top", Bottom: "bottom" },
  Handle: () => null,
  Background: () => null,
  Controls: () => null,
  MiniMap: () => null,
}));

vi.mock("reactflow", () => ({
  ReactFlow: () => null,
  ReactFlowProvider: ({ children }: any) => children,
  useNodesState: () => [[], vi.fn(), vi.fn()],
  useEdgesState: () => [[], vi.fn(), vi.fn()],
  MarkerType: { ArrowClosed: "arrowclosed" },
  Position: { Left: "left", Right: "right", Top: "top", Bottom: "bottom" },
  Handle: () => null,
}));

// Mock react-konva and konva
vi.mock("react-konva", () => ({
  Stage: () => null,
  Layer: () => null,
  Line: () => null,
  Rect: () => null,
  Circle: () => null,
  Text: () => null,
  Image: () => null,
  Transformer: () => null,
  Group: () => null,
}));

vi.mock("konva", () => ({
  default: {},
}));

// Mock react-switch
vi.mock("react-switch", () => ({
  default: () => null,
}));

// Mock survey-core / survey-react-ui
vi.mock("survey-core", () => ({
  Model: vi.fn(),
}));

vi.mock("survey-react-ui", () => ({
  Survey: () => null,
}));

// Mock grapesjs
vi.mock("grapesjs", () => ({
  default: {
    init: vi.fn(() => ({})),
  },
}));

// Mock papaparse
vi.mock("papaparse", () => ({
  default: {
    parse: vi.fn(() => ({ data: [] })),
    unparse: vi.fn(() => ""),
  },
}));

// Mock exceljs
vi.mock("exceljs", () => ({
  Workbook: vi.fn(),
}));

// Mock bootstrap CSS import
vi.mock("bootstrap/dist/css/bootstrap.min.css", () => ({}));
