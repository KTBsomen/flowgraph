/**
 * ConfigPanel — right panel; renders dynamic form from node configSchema
 */
export class ConfigPanel {
  constructor(container) {
    this.container = container;
    this._nodeId   = null;
    this._onChange = null;
    this._build();
  }

  _build() {
    this.container.innerHTML = `
      <div class="wf-config">
        <div class="wf-config-header">
          <span class="wf-config-title">Properties</span>
          <button class="wf-config-close" title="Close">✕</button>
        </div>
        <div class="wf-config-body" id="wf-config-body">
          <div class="wf-config-empty">
            <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.5">
              <rect x="8" y="12" width="32" height="24" rx="4"/>
              <path d="M16 20h16M16 28h10"/>
            </svg>
            <p>Select a node to configure</p>
          </div>
        </div>
      </div>
    `;
    this.bodyEl = this.container.querySelector('#wf-config-body');
    this.container.querySelector('.wf-config-close').addEventListener('click', () => {
      this.clear();
    });
  }

  show(node, onChange) {
    this._nodeId   = node.id;
    this._onChange = onChange;
    this._render(node);
    this.container.querySelector('.wf-config').classList.add('wf-config--active');
  }

  clear() {
    this._nodeId   = null;
    this._onChange = null;
    this.bodyEl.innerHTML = `
      <div class="wf-config-empty">
        <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.5">
          <rect x="8" y="12" width="32" height="24" rx="4"/>
          <path d="M16 20h16M16 28h10"/>
        </svg>
        <p>Select a node to configure</p>
      </div>
    `;
    this.container.querySelector('.wf-config').classList.remove('wf-config--active');
  }

  _render(node) {
    const schema = node.configSchema || {};
    const config = node.config      || {};
    const style  = node.style       || {};
    const bg     = style.background || '#6366f1';

    this.bodyEl.innerHTML = `
      <div class="wf-config-node-header" style="background:${bg}">
        <div class="wf-config-node-icon">${style.icon || ''}</div>
        <div>
          <div class="wf-config-node-label">${node.label}</div>
          <div class="wf-config-node-type">${node.type}</div>
        </div>
      </div>

      <div class="wf-config-section">
        <div class="wf-config-section-title">General</div>
        <div class="wf-config-field">
          <label>Node ID</label>
          <input type="text" class="wf-input" value="${node.id}" readonly>
        </div>
      </div>

      ${Object.keys(schema).length ? `
        <div class="wf-config-section">
          <div class="wf-config-section-title">Configuration</div>
          ${Object.entries(schema).map(([key, def]) => this._fieldHTML(key, def, config[key])).join('')}
        </div>
      ` : ''}

      ${(node.inputs?.length || node.outputs?.length) ? `
        <div class="wf-config-section">
          <div class="wf-config-section-title">Ports</div>
          ${(node.inputs || []).map(p => `
            <div class="wf-config-port wf-config-port--input">
              <div class="wf-port-dot wf-port--${p.type || 'any'}"></div>
              <span>${p.label || p.name}</span>
              <span class="wf-port-type-badge">${p.type || 'any'}</span>
            </div>
          `).join('')}
          ${(node.outputs || []).map(p => `
            <div class="wf-config-port wf-config-port--output">
              <span class="wf-port-type-badge">${p.type || 'any'}</span>
              <span>${p.label || p.name}</span>
              <div class="wf-port-dot wf-port--${p.type || 'any'}"></div>
            </div>
          `).join('')}
        </div>
      ` : ''}
    `;

    // Bind field changes
    this.bodyEl.querySelectorAll('[data-field]').forEach(el => {
      el.addEventListener('input', () => this._emitChange());
      el.addEventListener('change', () => this._emitChange());
    });
  }

  _fieldHTML(key, def, value) {
    const val  = value !== undefined ? value : (def.default ?? '');
    const id   = `wf-field-${key}`;
    const wrap = (inner) => `
      <div class="wf-config-field">
        <label for="${id}">${def.label || key}</label>
        ${inner}
      </div>
    `;

    switch (def.type) {
      case 'textarea':
        return wrap(`<textarea id="${id}" class="wf-input wf-textarea" data-field="${key}" rows="3">${val}</textarea>`);

      case 'code':
        return wrap(`<textarea id="${id}" class="wf-input wf-code" data-field="${key}" rows="4" spellcheck="false">${val}</textarea>`);

      case 'number':
        return wrap(`<input type="number" id="${id}" class="wf-input" data-field="${key}" value="${val}">`);

      case 'boolean':
        return wrap(`
          <label class="wf-toggle">
            <input type="checkbox" id="${id}" data-field="${key}" ${val ? 'checked' : ''}>
            <span class="wf-toggle-track"></span>
          </label>
        `);

      case 'select':
        return wrap(`
          <select id="${id}" class="wf-input wf-select" data-field="${key}">
            ${(def.options || []).map(o =>
              `<option value="${o}" ${o === val ? 'selected' : ''}>${o}</option>`
            ).join('')}
          </select>
        `);

      case 'color':
        return wrap(`<input type="color" id="${id}" class="wf-input wf-color" data-field="${key}" value="${val}">`);

      default:
        return wrap(`<input type="text" id="${id}" class="wf-input" data-field="${key}" value="${val}" placeholder="${def.placeholder || ''}">`);
    }
  }

  _emitChange() {
    if (!this._onChange) return;
    const config = {};
    this.bodyEl.querySelectorAll('[data-field]').forEach(el => {
      const key = el.dataset.field;
      if (el.type === 'checkbox') config[key] = el.checked;
      else config[key] = el.value;
    });
    this._onChange(this._nodeId, config);
  }
}
