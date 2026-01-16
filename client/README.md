# ExpBuilder Client

ExpBuilder frontend application built with **React 19**, **TypeScript**, and **Vite**.

## Description

User interface for creating cognitive psychology experiments using jsPsych. Provides a visual drag-and-drop editor, parameter configuration, real-time preview, and result management.

## Tech Stack

### Core

- **React 19** - UI framework
- **TypeScript 5.7** - Type safety
- **Vite 6** - Build tool and dev server
- **React Router DOM 7** - Routing

### UI Libraries

- **Chakra UI 3** - Component system
- **Bootstrap 5** - Base styles
- **React Icons** - Iconography
- **React Switch** - Toggle switches

### Visualization

- **@xyflow/react** - Experiment canvas (trial flow)
- **React Konva** - Canvas for Sketchpad component
- **Monaco Editor** - Code editor (Dev Mode)

### jsPsych Integration

- **GrapesJS** - HTML template editor
- **SurveyJS** - Survey component

### Firebase & Storage

- **Firebase 12** - Authentication and backend
- **react-firebase-hooks** - Firebase hooks

### Utilities

- **Socket.IO Client** - WebSocket for real-time tracking
- **PapaParse** - CSV Parser
- **ExcelJS** - Excel data export
- **Lodash.isEqual** - Deep object comparison
- **Juice** - Inline CSS for emails/export

## Installation

```bash
# From the client folder
cd client
npm install
```

## Environment Variables

Create a `.env` file in `client/`:

```env
VITE_API_URL=http://localhost:3000
VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-auth-domain
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-storage-bucket
VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
VITE_FIREBASE_APP_ID=your-app-id
```

## Scripts

```bash
# Development (port 5173)
npm run dev

# Production Build
npm run build

# Build Preview
npm run preview

# Linting
npm run lint
```

## Project Structure

```
client/src/
├── pages/              # Main pages
│   ├── Auth/          # Login, Register
│   ├── Dashboard/     # Experiment list
│   ├── ExperimentBuilder/  # Visual editor (see dedicated README)
│   └── Settings/      # User settings
├── components/        # Shared components
│   └── ProtectedRoute.tsx
├── lib/              # Utilities and configuration
│   ├── firebase.ts   # Firebase config
│   ├── theme.ts      # Chakra UI theme
│   ├── context.ts    # Global contexts
│   └── utils.ts      # Helper functions
└── assets/           # Images, icons, etc.
```

## Main Pages

### **LandingPage**

Initial page with project information.

### **Dashboard**

- User's experiment list
- Create new experiment
- Delete experiments
- Navigate to ExperimentBuilder

### **ExperimentBuilder**

Visual experiment editor. **See [ExperimentBuilder/README.md](src/pages/ExperimentBuilder/README.md)** for detailed documentation.

Features:

- Visual canvas with drag-and-drop
- Trial timeline
- Parameter configuration panel
- Real-time preview
- Developer mode (direct code)
- Media file management
- Export to GitHub Pages

### **Settings**

Integration settings:

- Firebase credentials
- GitHub OAuth
- Google Drive OAuth
- Dropbox OAuth
- OSF Token
- Change password
- Delete account

### **Auth**

- Login with Firebase
- User registration
- Password reset

## Backend Integration

The client communicates with:

1. **Local Express Server** (`localhost:3000`)
   - Experiment endpoints
   - Trials and loops
   - Media files
   - Session results
   - Cloudflare Tunnels

2. **Firebase Functions**
   - Authentication
   - Storage (Dropbox/Google Drive/OSF)
   - GitHub Pages publishing

3. **Socket.IO**
   - Real-time session tracking
   - Progress notifications

See [../../API_ENDPOINTS.md](../../API_ENDPOINTS.md) for full reference.

## Data Architecture

### **Normalized Architecture**

The project uses a normalized structure for trials and loops (see [CAMBIOS_NORMALIZACION.md](../../CAMBIOS_NORMALIZACION.md)):

```typescript
{
  trials: { [id: number]: Trial },
  loops: { [id: string]: Loop },
  timeline: TimelineItem[]
}
```

**Benefits:**

- O(1) lookups by ID
- Efficient updates (only the modified trial is sent)
- Simplified code
- No complex recursion

## Workflow

1. **Create experiment** → Dashboard
2. **Add trials** → ExperimentBuilder (drag to canvas)
3. **Configure parameters** → ConfigPanel
4. **Preview** → ExperimentPreview
5. **Run locally** → Generates HTML
6. **Publish** → GitHub Pages
7. **Collect data** → ResultsList

## Authentication

The client uses **Firebase Authentication**:

- Email/Password
- OAuth providers (optional)
- Protected routes with `ProtectedRoute` component

```tsx
import ProtectedRoute from "@/components/ProtectedRoute";

<Route element={<ProtectedRoute />}>
  <Route path="/dashboard" element={<Dashboard />} />
</Route>;
```

## Themes and Styles

- **Chakra UI** for main components
- **Bootstrap 5** for layout and utilities
- **Custom CSS** in `.css` files per module
- Centralized theme in `lib/theme.ts`

## Development

### API Proxy

Vite is configured to proxy to `localhost:3000`:

```typescript
// vite.config.ts
server: {
  proxy: {
    '/api': 'http://localhost:3000',
    '/img': 'http://localhost:3000',
    // ...
  }
}
```

### Hot Module Replacement (HMR)

Vite provides automatic HMR for rapid development.

### Type Safety

The project uses strict TypeScript. Main types are in:

- `pages/ExperimentBuilder/components/ConfigPanel/types.ts`
- Inline interfaces in components

## Production Build

```bash
npm run build
```

Output will be in `client/dist/` and will be copied to `resources/client/dist` by Electron Builder.

## Debugging

### React DevTools

Install the browser extension to inspect components.

### Redux DevTools (if applicable)

Although Redux is not used, providers expose state that you can inspect.

### Console Logs

In development, many components log important actions.

## Additional Resources

- [ExperimentBuilder README](src/pages/ExperimentBuilder/README.md) - Editor Architecture
- [CAMBIOS_NORMALIZACION.md](../../CAMBIOS_NORMALIZACION.md) - Structure Refactoring
- [jsPsych Documentation](https://www.jspsych.org/latest/)
- [Chakra UI Docs](https://chakra-ui.com/)
- [Vite Guide](https://vitejs.dev/guide/)

## Contributing

1. Keep TypeScript types updated
2. Use JSDoc for complex functions
3. Follow the existing folder structure
4. Add tests when possible
5. Keep components small and reusable

## License

See LICENSE file in the project root.
