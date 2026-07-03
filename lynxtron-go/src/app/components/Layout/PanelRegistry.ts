/**
 * PanelRegistry — manages all registered panels (explorer, search, debug, etc.).
 * Panels register a descriptor; the layout system uses the registry to look up
 * which component to render in each PanelGroup slot.
 */

export interface PanelDescriptor {
  id: string;
  title: string;
  icon: string;            // single character or emoji for Activity Bar
  defaultLocation: string; // e.g. 'sidebar', 'panel'
  singleton?: boolean;
}

class PanelRegistryImpl {
  private panels = new Map<string, PanelDescriptor>();

  register(descriptor: PanelDescriptor): void {
    this.panels.set(descriptor.id, descriptor);
  }

  get(id: string): PanelDescriptor | undefined {
    return this.panels.get(id);
  }

  getByLocation(location: string): PanelDescriptor[] {
    return [...this.panels.values()].filter(p => p.defaultLocation === location);
  }

  all(): PanelDescriptor[] {
    return [...this.panels.values()];
  }
}

export const panelRegistry = new PanelRegistryImpl();

// ── Built-in panels ─────────────────────────────────────────────────────────

panelRegistry.register({
  id: 'explorer',
  title: 'Explorer',
  icon: '\u{1F4C1}', // folder icon
  defaultLocation: 'sidebar',
  singleton: true,
});

panelRegistry.register({
  id: 'search',
  title: 'Search',
  icon: '\u{1F50D}', // magnifying glass
  defaultLocation: 'sidebar',
  singleton: true,
});

panelRegistry.register({
  id: 'debug',
  title: 'Debug',
  icon: '\u{1F41E}', // bug
  defaultLocation: 'sidebar',
  singleton: true,
});

// ── Bottom panel entries ────────────────────────────────────────────────────

panelRegistry.register({
  id: 'terminal',
  title: 'Terminal',
  icon: '\u{1F4BB}',
  defaultLocation: 'bottom',
  singleton: true,
});

panelRegistry.register({
  id: 'output',
  title: 'Output',
  icon: '\u{1F4C4}',
  defaultLocation: 'bottom',
  singleton: true,
});

panelRegistry.register({
  id: 'problems',
  title: 'Problems',
  icon: '\u26A0',
  defaultLocation: 'bottom',
  singleton: true,
});
