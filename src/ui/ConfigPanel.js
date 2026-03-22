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

    this._buildHelpPopup();
  }

  _buildHelpPopup() {
    this.helpOverlay = document.createElement('div');
    this.helpOverlay.className = 'wf-help-overlay';
    this.helpOverlay.innerHTML = `
      <div class="wf-help-popup">
        <div class="wf-help-popup-header">
          <span class="wf-help-popup-title">Field Help</span>
          <button class="wf-help-popup-close">✕</button>
        </div>
        <div class="wf-help-popup-body" id="wf-help-body"></div>
      </div>
    `;
    document.body.appendChild(this.helpOverlay);

    this.helpOverlay.querySelector('.wf-help-popup-close').addEventListener('click', () => this._hideHelp());
    this.helpOverlay.addEventListener('click', (e) => {
      if (e.target === this.helpOverlay) this._hideHelp();
    });
  }

  _showHelp(def) {
    const body = this.helpOverlay.querySelector('#wf-help-body');
    const help = def.help || {};
    
    // Basic sanitization & construction
    let html = '';
    if (help.text) {
      // Replace only https links with clickable anchors, escaping others
      const sanitizedText = help.text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/(https:\/\/[^\s]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>');
      html += `<p>${sanitizedText}</p>`;
    }
    
    if (help.image) {
      html += `<img src="${help.image}" alt="Help Illustration">`;
    }

    body.innerHTML = html;
    this.helpOverlay.classList.add('wf-help-overlay--active');
  }

  _hideHelp() {
    this.helpOverlay.classList.remove('wf-help-overlay--active');
  }

  show(node, onChange) {
    this._nodeId   = node.id;
    this._node     = node; // Store node for schema access
    this._onChange = onChange;
    this._render(node);
    this.container.querySelector('.wf-config').classList.add('wf-config--active');
  }

  clear() {
    this._nodeId   = null;
    this._node     = null;
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
    this._hideHelp();
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

    // Bind help icons
    this.bodyEl.querySelectorAll('.wf-help-icon').forEach(el => {
      el.addEventListener('click', (e) => {
        const key = e.currentTarget.dataset.helpKey;
        const def = schema[key];
        if (def) this._showHelp(def);
      });
    });

    // Bind list interactions
    this.bodyEl.querySelectorAll('.wf-config-list').forEach(listEl => {
      const addBtn = listEl.querySelector('.wf-config-list-add-btn');
      const input  = listEl.querySelector('.wf-config-list-add input');

      const addItem = () => {
        const text = input.value.trim();
        if (!text) return;
        const itemsContainer = listEl.querySelector('.wf-config-list-items');
        const newItem = document.createElement('div');
        newItem.className = 'wf-config-list-item';
        newItem.innerHTML = `
          <span class="wf-config-list-item-text">${text}</span>
          <button class="wf-config-list-remove">✕</button>
        `;
        itemsContainer.appendChild(newItem);
        input.value = '';
        this._emitChange();
      };

      addBtn.addEventListener('click', addItem);
      input.addEventListener('keydown', e => { if (e.key === 'Enter') addItem(); });

      listEl.addEventListener('click', e => {
        if (e.target.classList.contains('wf-config-list-remove')) {
          e.target.closest('.wf-config-list-item').remove();
          this._emitChange();
        }
      });
    });
  }

  _emitChange() {
    if (!this._onChange) return;
    const config = {};
    this.bodyEl.querySelectorAll('[data-field]').forEach(el => {
      const key = el.dataset.field;
      if (el.classList.contains('wf-config-list')) {
        // Collect list items
        const items = Array.from(el.querySelectorAll('.wf-config-list-item-text')).map(span => span.textContent);
        config[key] = items;
      } else if (el.type === 'checkbox') {
        config[key] = el.checked;
      } else {
        config[key] = el.value;
      }
    });
    this._onChange(this._nodeId, config);
  }

  _fieldHTML(key, def, value) {
    const val  = value !== undefined ? value : (def.default ?? '');
    const id   = `wf-field-${key}`;
    
    const helpIcon = def.help ? `<span class="wf-help-icon" data-help-key="${key}" title="Get help">?</span>` : '';

    const wrap = (inner) => `
      <div class="wf-config-field">
        <div class="wf-config-field-label-row">
          <label for="${id}">${def.label || key}</label>
          ${helpIcon}
        </div>
        ${inner}
      </div>
    `;

    switch (def.type) {
      case 'list':
        const items = Array.isArray(val) ? val : [];
        return wrap(`
          <div class="wf-config-list" id="${id}" data-field="${key}">
            <div class="wf-config-list-items">
              ${items.map(item => `
                <div class="wf-config-list-item">
                  <span class="wf-config-list-item-text">${item}</span>
                  <button class="wf-config-list-remove">✕</button>
                </div>
              `).join('')}
            </div>
            <div class="wf-config-list-add">
              <input type="text" class="wf-input" placeholder="Add item...">
              <button class="wf-config-list-add-btn">Add</button>
            </div>
            ${def.description ? `<div class="wf-config-list-description">${def.description}</div>` : ''}
          </div>
        `);

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
