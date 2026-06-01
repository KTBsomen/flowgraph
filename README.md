# 🎨 FlowGraph

FlowGraph is a powerful, lightweight, and **zero-dependency** vanilla JavaScript library for building visual node-based workflows. It provides an infinite pannable canvas, high-resolution zoom, touch support, and a fully extensible node system.

---

## 🚀 Quick Start

### 1. Include the Library
You can include FlowGraph as an ES module:

```javascript
import { createWorkflow } from './src/index.js';
```

Or via a simple script tag (it's exposed as `window.createWorkflow`):
```html
<script src="./src/index.js" type="module"></script>
```

### 2. Initialize the Canvas
Create a container element in your HTML and initialize the workflow:

```html
<div id="workflow-container" style="width: 100vw; height: 100vh;"></div>

<script type="module">
  import { createWorkflow } from './src/index.js';

  const workflow = createWorkflow({
    container: document.getElementById('workflow-container'),
    minimap: true,
    canvasOptions: {
      gridSize: 20,
      snapToGrid: true
    },
    // Lifecycle hooks
    onChange: (data) => console.log('Workflow changed:', data),
    onConnect: (edge) => console.log('New connection:', edge)
  });
</script>
```

---

## 🛠️ Configuration Parameters

`createWorkflow(options)` accepts the following parameters:

| Parameter       | Type          | Description                                                                                             |
| :-------------- | :------------ | :------------------------------------------------------------------------------------------------------ |
| `container`     | `HTMLElement` | **Required.** The parent element where the UI will be injected.                                         |
| `nodes`         | `Array`       | Optional list of custom node definitions to extend the library.                                         |
| `minimap`       | `boolean`     | Whether to show the minimap (default: `true`).                                                          |
| `readOnly`      | `boolean`     | If `true`, hides sidebars/toolbars and disables edits while keeping nodes draggable (default: `false`). |
| `onEdit`        | `Function`    | If provided in `readOnly` mode, renders a premium "Edit Workflow" button that triggers this callback.   |
| `onNodeAdd`     | `Function`    | Callback `{ node, position }` triggered when a node is added.                                           |
| `canvasOptions` | `object`      | Detailed canvas behavior settings (see below).                                                          |

### Canvas Options
| Option       | Default | Description                                         |
| :----------- | :------ | :-------------------------------------------------- |
| `gridSize`   | `20`    | Distance between grid lines.                        |
| `showGrid`   | `true`  | Visibility of the background grid.                  |
| `snapToGrid` | `true`  | Automatically align nodes to the grid on drop/move. |
| `minZoom`    | `0.18`  | Minimum zoom level.                                 |
| `maxZoom`    | `3.0`   | Maximum zoom level.                                 |

---

## 📦 Creating Custom Nodes

Nodes are defined using a simple JSON-like schema. You can pass them during initialization or register them later.

### Example: A custom "Weather API" Node

```javascript
const weatherNode = {
  type: 'weather_fetch',
  label: 'Get Weather',
  category: 'Integration',
  description: 'Fetches current weather for a city',
  inputs: [
    { name: 'in', label: 'Trigger', type: 'any' }
  ],
  outputs: [
    { name: 'temp', label: 'Temperature', type: 'number' },
    { name: 'condition', label: 'Condition', type: 'string' }
  ],
  configSchema: {
    city: { type: 'text', label: 'City Name', default: 'New York' },
    unit: { type: 'select', label: 'Unit', options: ['Celsius', 'Fahrenheit'], default: 'Celsius' }
  },
  style: {
    background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
    icon: '<svg ...></svg>' // Custom SVG string
  }
};

// Register via constructor
const workflow = createWorkflow({
  container: el,
  nodes: [weatherNode]
});

// OR Register later
workflow.registerNodeType(weatherNode);
```

### Node Property Details

| Property       | Description                                                                                                                                                           |
| :------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `type`         | Unique string identifier for the node type.                                                                                                                           |
| `label`        | Display name shown in the sidebar and on the node.                                                                                                                    |
| `inputs`       | Array of `{ name, label, type, multiple }`. Set `multiple: true` to allow many wires into one port.                                                                   |
| `outputs`      | Array of `{ name, label, type }`.                                                                                                                                     |
| `configSchema` | UI fields for the right-side panel. Supports `text`, `number`, `select`, `code`, `textarea`, `color`. Each field can have an optional `help: { text, image }` object. |
| `style`        | Object with `background` (CSS color/gradient) and optional `icon` (SVG string).                                                                                       |

---

## 🔌 API Methods

The `createWorkflow` function returns a `workflow` object with the following methods:

### State Management
- `exportJSON()`: Returns a plain object representing the current workflow (nodes, edges, positions).
- `loadJSON(data)`: Clears the canvas and loads a previously exported state.
- `clear()`: Wipes everything from the canvas.

### Node Operations
- `addNode(type, position)`: Programmatically adds a node. **Returns the new node's unique ID.**
  - `type`: String (e.g. 'start', 'action').
  - `position`: `{ x, y }` in world coordinates.
- `addEdge(fromNode, fromPort, toNode, toPort)`: Connects two ports. Returns the edge ID or `null` if invalid.
  - `fromNode`: Source node ID.
  - `fromPort`: Name of the output port.
  - `toNode`: Target node ID.
  - `toPort`: Name of the input port.
- `removeNode(id)`: Remove a node by its unique ID.
- `deleteSelected()`: Deletes all currently selected nodes.

### Utility & Layout
- `fitToView()`: Automatically pans and zooms the canvas to fit all nodes nicely.
- `on(event, callback)`: Listen for internal state changes.
- `getAdjacencyList()`: Returns the workflow as a graph adjacency list.
- `hasCycle()`: Returns `true` if the workflow contains a loop (useful for validation).

---

## 📱 Mobile & UX Features

FlowGraph is built with a mobile-first mindset:
1. **Touch Support**: Pinch-to-zoom and two-finger panning work natively.
2. **Smooth Minimap**: Real-time dragging on the minimap for fast navigation.
3. **Responsive UI**: The sidebar and config panels automatically stack vertically on small screens.
4. **Click-to-Add**: On mobile, dragging is hard. Users can simply **click** a node in the sidebar to add it to the center of their screen.
5. **High-Res Zoom**: Uses modern CSS tricks to ensure nodes stay sharp and readable at all scales.

---

## 🎨 Styling & CSS Variables

The library uses **namespaced CSS variables** with the `wf-` prefix to avoid conflicts with your application styles. You can override these in your global CSS:

### Available CSS Variables

All CSS variables are prefixed with `wf-` to prevent style pollution:

**Colors:**
```css
:root {
  /* Backgrounds */
  --wf-bg-app: #0d0f14;           /* Main app background */
  --wf-bg-panel: #131620;         /* Panel background */
  --wf-bg-surface: #1a1e2e;       /* Surface elements */
  --wf-bg-hover: #1f2537;         /* Hover state */
  --wf-bg-active: #252c40;        /* Active state */

  /* Text */
  --wf-text-primary: #e2e8f0;     /* Primary text */
  --wf-text-secondary: #8892a4;   /* Secondary text */
  --wf-text-muted: #4a5568;       /* Muted text */

  /* Accents & Effects */
  --wf-accent: #6366f1;           /* Primary accent color */
  --wf-accent-soft: rgba(99, 102, 241, 0.15);
  --wf-accent-glow: rgba(99, 102, 241, 0.35);

  /* Status Colors */
  --wf-success: #10b981;
  --wf-warning: #f59e0b;
  --wf-danger: #ef4444;
  --wf-info: #06b6d4;

  /* Borders */
  --wf-border: rgba(255, 255, 255, 0.07);
  --wf-border-hover: rgba(255, 255, 255, 0.14);
}
```

**Spacing & Effects:**
```css
:root {
  /* Shadows */
  --wf-node-shadow: 0 4px 24px rgba(0, 0, 0, 0.5), 0 1px 4px rgba(0, 0, 0, 0.3);
  --wf-node-shadow-hover: 0 8px 40px rgba(0, 0, 0, 0.6), 0 2px 8px rgba(99, 102, 241, 0.2);
  --wf-panel-shadow: 2px 0 20px rgba(0, 0, 0, 0.4);

  /* Border Radius */
  --wf-radius-sm: 6px;
  --wf-radius-md: 10px;
  --wf-radius-lg: 14px;
  --wf-radius-xl: 20px;

  /* Typography */
  --wf-font-sans: 'DM Sans', system-ui, sans-serif;
  --wf-font-mono: 'JetBrains Mono', monospace;

  /* Animations */
  --wf-transition: 0.18s ease;
}
```

### Custom Theme Example

```css
/* Override default dark theme with a light theme */
:root {
  --wf-bg-app: #f5f5f5;
  --wf-bg-panel: #ffffff;
  --wf-bg-surface: #fafafa;
  --wf-text-primary: #1a1a1a;
  --wf-text-secondary: #666666;
  --wf-text-muted: #999999;
  --wf-border: rgba(0, 0, 0, 0.1);
  --wf-accent: #0066cc;
}
```

### Why the `wf-` Prefix?

All CSS variables use the `wf-` (FlowGraph) prefix to:
- **Prevent conflicts** with your application's global styles
- **Improve namespace clarity** in your CSS
- **Enable easy theming** by clearly identifying FlowGraph-specific variables
- **Follow CSS best practices** for component-scoped styling

---

## ✅ Ready-to-Run Example

```html
<!DOCTYPE html>
<html>
<body>
  <div id="app" style="width: 100vw; height: 100vh;"></div>
  
  <script type="module">
    import { createWorkflow } from './src/index.js';
    
    const wf = createWorkflow({ container: document.getElementById('app') });
    
    // Add two nodes programmatically
    wf.addNode('start', { x: 100, y: 100 });
    wf.addNode('end', { x: 500, y: 100 });
    
    // Auto-fit
    setTimeout(() => wf.fitToView(), 100);
  </script>
</body>
</html>
```
