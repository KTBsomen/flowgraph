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

| Parameter | Type | Description |
| :--- | :--- | :--- |
| `container` | `HTMLElement` | **Required.** The parent element where the UI will be injected. |
| `nodes` | `Array` | Optional list of custom node definitions to extend the library. |
| `minimap` | `boolean` | Whether to show the minimap (default: `true`). |
| `canvasOptions` | `object` | Detailed canvas behavior settings (see below). |

### Canvas Options
| Option | Default | Description |
| :--- | :--- | :--- |
| `gridSize` | `20` | Distance between grid lines. |
| `showGrid` | `true` | Visibility of the background grid. |
| `snapToGrid`| `true` | Automatically align nodes to the grid on drop/move. |
| `minZoom` | `0.18` | Minimum zoom level. |
| `maxZoom` | `3.0` | Maximum zoom level. |

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

| Property | Description |
| :--- | :--- |
| `type` | Unique string identifier for the node type. |
| `label` | Display name shown in the sidebar and on the node. |
| `inputs` | Array of `{ name, label, type, multiple }`. Set `multiple: true` to allow many wires into one port. |
| `outputs`| Array of `{ name, label, type }`. |
| `configSchema`| UI fields for the right-side panel. Supports `text`, `number`, `select`, `code`, `textarea`. |
| `style` | Object with `background` (CSS color/gradient) and optional `icon` (SVG string). |

---

## 🔌 API Methods

The `createWorkflow` function returns a `workflow` object with the following methods:

### State Management
- `exportJSON()`: Returns a plain object representing the current workflow (nodes, edges, positions).
- `loadJSON(data)`: Clears the canvas and loads a previously exported state.
- `clear()`: Wipes everything from the canvas.

### Node Operations
- `addNode(type, position)`: Programmatically add a node of a specific type.
  - `position`: `{ x, y }` in world coordinates.
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

## 🎨 Styling

The library uses **Vanilla CSS variables** for easy theming. You can override these in your global CSS:

```css
:root {
  --wf-accent: #6366f1;
  --wf-bg-canvas: #0f172a;
  --wf-border: rgba(255, 255, 255, 0.1);
}
```

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
