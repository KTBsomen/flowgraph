# 🚀 "Build in Public" Marketing Storyline: FlowGraph

The story of FlowGraph isn't just about another workflow tool; it's about pushing the boundaries of **Vanilla JavaScript**. In a world obsessed with heavy frameworks (React, Vue) and massive dependency trees, FlowGraph is a breath of fresh air: a **zero-dependency, mobile-first, highly extensible** node-based orchestration engine. 

This is the narrative you are selling: **"High performance, zero bloat, and it actually works on your phone."**

---

## 📅 The Content Schedule & Storyline Arc

This schedule is designed to build momentum over a two-week period.

### 📌 Post 1: The Villain (Bloat) & The Vision
**When to Post:** Monday @ 9:00 AM (High engagement time for dev tools)
**The Angle:** State the problem with current workflow libraries (too heavy, tied to specific frameworks) and introduce your solution.
**Media:** A short code snippet showing the simple `<script>` tag import vs a massive `package.json`.

> Ever tried putting a node-based workflow editor in your app? You usually have to pull in React, a massive state management library, and 50MB of dependencies. 
> 
> I got tired of the bloat. So, I’m building **FlowGraph**: a powerful, 100% zero-dependency Vanilla JS library for visual workflows. 
> 
> The goal? An infinite canvas, high-res zoom, and a fully extensible node system that you can drop into ANY project with a single `<script>` tag. I’ll be sharing the build process here. Who else loves Vanilla JS? 👇
> 
> #buildinpublic #javascript #webdev #vanillajs

---

### 📌 Post 2: The Core Engine (Canvas & Math)
**When to Post:** Wednesday @ 1:00 PM (Mid-week technical deep dive)
**The Angle:** Show off the technical challenge of building the panning, zooming, and grid-snapping from scratch without libraries like D3 or Fabric.js.
**Media:** A 10-second GIF/video showing smooth panning, zooming in to a high-res node, and grid snapping.

> Building an infinite pannable canvas from scratch in pure JS is... an experience. 🤯
> 
> No D3, no Fabric.js. Just raw DOM manipulation, CSS transforms, and a lot of matrix math. Today I finally locked in the grid system for **FlowGraph**. 
> 
> 💡 Pro-tip: Using modern CSS transforms allows the nodes to stay aggressively sharp at a 3.0x zoom level without canvas pixelation. 
> 
> #frontend #engineering #css

---

### 📌 Post 3: The Extensibility (Custom Nodes)
**When to Post:** Friday @ 10:00 AM
**The Angle:** Appeal to developers by showing how easy it is to use the library. Emphasize the JSON schema approach for building nodes.
**Media:** Screenshot of the "Weather API" node code side-by-side with how it looks rendered on the canvas.

> A flow engine is useless if it’s hard to extend. 
> 
> I wanted developers to be able to create complex UI nodes in FlowGraph without writing a single line of HTML/CSS. So, I built a JSON-based schema engine. 
> 
> Define your inputs, outputs, config schemas (Select, Text, Code), and colors in a simple object, and the library auto-generates the UI and the right-side properties panel. Everything is decoupled. 
> 
> Dev experience is everything. 🛠️
> 
> #softwarearchitecture #developerx #javascript

---

### 📌 Post 4: The "Mobile First" Differentiator
**When to Post:** Tuesday @ 9:00 AM (Start of the second week)
**The Angle:** Highlight your unique selling proposition. Most flow editors break on mobile. Yours thrives.
**Media:** A screen recording from a mobile phone showing pinch-to-zoom and the "Click-to-Add" sidebar feature.

> Here is a hill I will die on: Workflow editors shouldn't be desktop-only. 📱
> 
> Almost every node-editor I’ve used completely breaks on a touchscreen. For FlowGraph, I implemented a mobile-first mindset from day one:
> ✅ Native pinch-to-zoom support
> ✅ Two-finger panning
> ✅ "Click-to-Add" nodes (because drag-and-drop on mobile is terrible)
> 
> Building complex orchestrations from your commute should be possible. 
> 
> #mobilefirst #uiux #indiehackers

---

### 📌 Post 5: The "Make it Exportable" Phase
**When to Post:** Thursday @ 2:00 PM
**The Angle:** Tying into your recent "module" and "fixes" commits. Showing the robustness of the data model.
**Media:** A code snippet showing `workflow.exportJSON()` outputting the graph adjacency list.

> Visualizing a workflow is only half the battle. Executing it is the real challenge. ⚡
> 
> Spent the last few days refactoring FlowGraph into a clean module. The best part? The UI state is completely decoupled from the data state. A simple `workflow.exportJSON()` gives you the full graph adjacency list, ready to be sent to your backend or evaluated.
> 
> I even added a `hasCycle()` method to validate loops before export. 
> 
> We are getting dangerously close to v1.0. 
> 
> #algorithms #coding #buildinpublic

---

### 📌 Post 6: The Launch / Call for Feedback
**When to Post:** Following Monday @ 9:00 AM
**The Angle:** The culmination of the journey. Ask for stars, feedback, and beta testers.
**Media:** A beautiful, fully configured example workflow (like multiple nodes connected, minimap visible, read-only mode off) alongside the GitHub repo link.

> 🚀 After weeks of battling matrix math, touch events, and pure Vanilla JS, **FlowGraph** is officially live!
> 
> It’s a zero-dependency, highly extensible, mobile-first node orchestration library. You can drop it into any project with a single `<script>` tag. 
> 
> Check out the live demo, play with the infinite canvas, and let me know if you can break it. 
> 🔗 [Link to Demo / GitHub]
> 
> If you like lightweight JS libraries, a ⭐ on GitHub would mean the world to me!
> #launch #opensource #javascript #github 
