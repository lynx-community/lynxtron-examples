# Customizable Layout Architecture

## 1. 设计目标

- 用户可自由拖动分隔条调整各区域宽高
- 每个区域放什么模块（面板）由用户决定，可拖拽重排
- Search、Debug、Terminal 等未来功能可作为面板插入任意区域
- 布局状态持久化，重启恢复
- 渐进式迁移：不一次性重写，从当前硬编码布局逐步演进

## 2. 核心概念

```
+---------------------------------------------------------------+
|                        Activity Bar                           |
|  [Explorer] [Search] [Git] [Debug] [Extensions]              |
+------+------+---------------------------------+---------------+
|      |      |                                 |               |
| Act  | Side |         Editor Group            |  Secondary    |
| Bar  | Bar  |   (tabs + editor + breadcrumb)  |  Sidebar      |
|      |      |                                 |  (optional)   |
|      |      +---------------------------------+               |
|      |      |         Panel Area              |               |
|      |      |   [Terminal] [Output] [Debug]   |               |
+------+------+---------------------------------+---------------+
|                        Status Bar                             |
+---------------------------------------------------------------+
```

### 2.1 Layout Tree (布局树)

布局用一棵二叉树描述，每个节点是 **SplitContainer** 或 **Leaf**：

```typescript
// 布局树节点
type LayoutNode = SplitNode | LeafNode;

interface SplitNode {
  type: 'split';
  direction: 'horizontal' | 'vertical'; // 分割方向
  ratio: number;       // 第一个子节点占比 0-1
  minSize?: number;    // 子节点最小尺寸 (px)
  children: [LayoutNode, LayoutNode];
}

interface LeafNode {
  type: 'leaf';
  panelGroupId: string;  // 此叶子承载哪个面板组
}
```

示例 — 默认 IDE 布局：

```typescript
const DEFAULT_LAYOUT: SplitNode = {
  type: 'split',
  direction: 'horizontal',
  ratio: 0.2,              // sidebar 占 20%
  children: [
    { type: 'leaf', panelGroupId: 'sidebar' },
    {
      type: 'split',
      direction: 'vertical',
      ratio: 0.7,            // editor 占 70%, panel 占 30%
      children: [
        { type: 'leaf', panelGroupId: 'editor' },
        { type: 'leaf', panelGroupId: 'panel' },
      ],
    },
  ],
};
```

### 2.2 Panel (面板)

面板是布局系统的原子单位，每个面板是一个独立的功能模块：

```typescript
interface PanelDescriptor {
  id: string;            // 唯一标识，如 'explorer', 'search', 'terminal'
  title: string;         // 显示名
  icon?: string;         // Activity Bar 图标
  component: () => JSX.Element;  // 渲染函数
  defaultLocation: string;       // 默认所属 panelGroupId
  closeable?: boolean;           // 用户是否可关闭
  singleton?: boolean;           // 是否全局唯一实例
}
```

### 2.3 PanelGroup (面板组)

每个 LeafNode 对应一个 PanelGroup，管理该区域内的多个面板（tab 切换）：

```typescript
interface PanelGroup {
  id: string;                // 如 'sidebar', 'editor', 'panel'
  activePanelId: string;     // 当前激活的面板
  panelIds: string[];        // 该组包含的面板 id 列表（顺序 = tab 顺序）
}
```

## 3. 组件设计

### 3.1 组件树

```
<WorkbenchLayout>                    // 读取 layout tree，递归渲染
  <SplitContainer direction ratio>   // 二叉分割容器 + Sash
    <SplitContainer ...>
      <PanelGroupView id="sidebar">  // 面板组：tab bar + 活跃面板
        <PanelView panel={explorer}/>
        <PanelView panel={search}/>
      </PanelGroupView>
    </SplitContainer>
    <SplitContainer ...>
      <PanelGroupView id="editor">
        <EditorGroup />              // 编辑器特殊处理（内部有自己的 tab）
      </PanelGroupView>
      <PanelGroupView id="panel">
        <PanelView panel={terminal}/>
        <PanelView panel={output}/>
      </PanelGroupView>
    </SplitContainer>
  </SplitContainer>
  <StatusBar />                      // 始终固定底部
</WorkbenchLayout>
```

### 3.2 `<SplitContainer>` — 分割容器

核心布局原语，负责：
1. 按 `direction` + `ratio` 分配两个子节点的尺寸
2. 在两个子节点之间渲染 `<Sash>`（可拖动分隔条）
3. Sash 拖动时更新 `ratio`，触发重新布局

```typescript
interface SplitContainerProps {
  node: SplitNode;
  width: number;    // 父容器分配的可用宽度
  height: number;   // 父容器分配的可用高度
  onLayoutChange: (path: number[], patch: Partial<SplitNode>) => void;
}
```

**拖动手势实现**：

```typescript
// Sash: 4px 宽的透明拖动条
<view
  className="Sash"
  style={sashStyle}           // position: absolute, cursor: col-resize / row-resize
  onTouchStart={onDragStart}  // 记录起始位置
  onTouchMove={onDragMove}    // 计算 delta → 新 ratio（clamp by minSize）
  onTouchEnd={onDragEnd}      // 提交最终 ratio 到 layout store
/>
```

ReactLynx 环境下用 `bindtouchstart` / `bindtouchmove` / `bindtouchend`，计算触摸偏移量更新 ratio。

### 3.3 `<PanelGroupView>` — 面板组容器

一个 leaf 节点的渲染器：
- 顶部渲染 tab bar（如果有多个面板）
- 中间渲染当前活跃面板
- 支持面板拖入/拖出（Phase 2）

```typescript
interface PanelGroupViewProps {
  groupId: string;
  width: number;
  height: number;
}

function PanelGroupView({ groupId, width, height }: PanelGroupViewProps) {
  const group = useLayoutStore(s => s.panelGroups[groupId]);
  const panels = group.panelIds.map(id => panelRegistry.get(id));
  const ActiveComponent = panelRegistry.get(group.activePanelId).component;

  return (
    <view style={{ width, height, flexDirection: 'column' }}>
      {panels.length > 1 && (
        <PanelTabBar
          panels={panels}
          activeId={group.activePanelId}
          onSwitch={id => layoutStore.setActivePanel(groupId, id)}
        />
      )}
      <view style={{ flex: 1 }}>
        <ActiveComponent />
      </view>
    </view>
  );
}
```

### 3.4 `<Sash>` — 拖动分隔条

```
视觉:  |     (1px 线)
热区:  |||   (8px 宽，透明，易于触摸)
```

```typescript
function Sash({ direction, position, onDrag }: SashProps) {
  const isHorizontal = direction === 'horizontal';
  return (
    <view
      className={`Sash ${isHorizontal ? 'SashH' : 'SashV'}`}
      style={{
        position: 'absolute',
        [isHorizontal ? 'left' : 'top']: position - 4,
        [isHorizontal ? 'width' : 'height']: 8,
        [isHorizontal ? 'height' : 'width']: '100%',
        zIndex: 10,
      }}
      bindtouchstart={e => onDrag('start', e)}
      bindtouchmove={e => onDrag('move', e)}
      bindtouchend={e => onDrag('end', e)}
    />
  );
}
```

## 4. 状态管理 — LayoutStore

一个全局 store 管理整个布局状态：

```typescript
interface LayoutState {
  // 布局树
  root: LayoutNode;
  // 面板组映射
  panelGroups: Record<string, PanelGroup>;
  // 面板可见性
  panelVisibility: Record<string, boolean>;
}

interface LayoutActions {
  // Sash 拖动 → 更新 ratio
  updateRatio(path: number[], ratio: number): void;
  // 切换面板组内的活跃面板
  setActivePanel(groupId: string, panelId: string): void;
  // 移动面板到另一个组（拖拽）
  movePanel(panelId: string, fromGroup: string, toGroup: string, index?: number): void;
  // 分裂：将一个 leaf 拆成两个（拖拽到边缘时）
  splitLeaf(groupId: string, direction: 'horizontal' | 'vertical', newPanelId: string): void;
  // 关闭面板
  closePanel(panelId: string): void;
  // 切换面板显隐（如 Toggle Terminal）
  togglePanel(panelId: string): void;
  // 重置为默认布局
  resetLayout(): void;
  // 序列化 / 反序列化
  serialize(): string;
  restore(json: string): void;
}
```

### 持久化

```typescript
// 保存：布局变更时 debounce 写入
layoutStore.subscribe(debounce(() => {
  getExposed()?.config?.set('layout', layoutStore.serialize());
}, 500));

// 恢复：启动时读取
const saved = getExposed()?.config?.get('layout');
if (saved) layoutStore.restore(saved);
```

## 5. Panel Registry — 面板注册表

所有面板通过注册表管理，支持插件动态注册：

```typescript
class PanelRegistry {
  private panels = new Map<string, PanelDescriptor>();

  register(descriptor: PanelDescriptor): void {
    this.panels.set(descriptor.id, descriptor);
  }

  get(id: string): PanelDescriptor | undefined {
    return this.panels.get(id);
  }

  getByLocation(location: string): PanelDescriptor[] {
    return [...this.panels.values()]
      .filter(p => p.defaultLocation === location);
  }
}

// 内置面板注册
panelRegistry.register({
  id: 'explorer',
  title: 'Explorer',
  icon: 'files',
  component: () => <Sidebar {...sidebarProps} />,
  defaultLocation: 'sidebar',
  singleton: true,
});

panelRegistry.register({
  id: 'search',
  title: 'Search',
  icon: 'search',
  component: () => <SearchPanel />,
  defaultLocation: 'sidebar',
  singleton: true,
});

panelRegistry.register({
  id: 'debug',
  title: 'Debug',
  icon: 'bug',
  component: () => <DebugPanel />,
  defaultLocation: 'sidebar',
  singleton: true,
});

panelRegistry.register({
  id: 'terminal',
  title: 'Terminal',
  icon: 'terminal',
  component: () => <TerminalPanel />,
  defaultLocation: 'panel',
});
```

插件扩展示例：

```typescript
// 某个插件在 extension-host 中注册
lynxtron.window.registerPanel({
  id: 'git-changes',
  title: 'Source Control',
  icon: 'git-branch',
  component: 'git-changes-webview',  // 通过 webview bridge 渲染
  defaultLocation: 'sidebar',
});
```

## 6. Activity Bar — 区域快捷入口

左侧窄条，每个图标对应 sidebar 中的一个面板，点击切换：

```
+----+
| [] |  Explorer    (sidebar.activePanel = 'explorer')
| Q  |  Search      (sidebar.activePanel = 'search')
| Y  |  Git         (sidebar.activePanel = 'git')
| >  |  Debug       (sidebar.activePanel = 'debug')
| [] |  Extensions  (sidebar.activePanel = 'extensions')
+----+
```

再次点击已激活的图标 → 折叠 sidebar（ratio → 0 / 恢复）。

## 7. 迁移路径（从当前架构）

### Phase A: SplitContainer + Sash（最小可用）

仅引入布局树和拖动分隔条，不改变现有组件：

```
当前:  <Sidebar />  <MainArea />
迁移:  <SplitContainer direction="horizontal" ratio={0.2}>
         <Sidebar />
         <SplitContainer direction="vertical" ratio={0.7}>
           <MainArea />     {/* TabBar + Editor + StatusBar */}
           <PanelArea />    {/* 未来: Terminal / Output */}
         </SplitContainer>
       </SplitContainer>
```

改动范围：
- 新增: `SplitContainer.tsx`, `Sash.tsx`, `layoutStore.ts`
- 修改: `App.tsx` 用 SplitContainer 包裹现有组件
- 现有组件不动，只是接收 width/height props

### Phase B: PanelGroup + Registry

将 Sidebar 内容从硬编码改为面板注册：
- Explorer 变成 `panelRegistry.register({ id: 'explorer', ... })`
- Sidebar 区域变成 `<PanelGroupView groupId="sidebar">`
- 新增 Activity Bar 组件

### Phase C: 面板拖拽

支持将面板从一个 PanelGroup 拖到另一个：
- 拖到边缘 → splitLeaf（分裂产生新区域）
- 拖到 tab bar → movePanel（移入已有组）
- 需要 drag-and-drop 手势支持（ReactLynx 层面）

### Phase D: 用户自定义持久化

- 序列化整个 layout tree + panelGroups 到 JSON
- `~/.lynxtron-ide.json` 中存储
- 提供 "Reset Layout" 命令

## 8. 数据流总览

```
User drags Sash
      |
      v
Sash.onTouchMove → delta pixels
      |
      v
SplitContainer → new ratio = clamp(old + delta/totalSize, min, max)
      |
      v
LayoutStore.updateRatio(path, ratio)
      |
      v
React re-render → SplitContainer recalculates child sizes
      |
      v
Children receive new width/height props → re-layout
      |
      v
debounce → persist to ~/.lynxtron-ide.json
```

```
User clicks Activity Bar icon
      |
      v
LayoutStore.setActivePanel('sidebar', 'search')
      |
      v
PanelGroupView re-renders → shows SearchPanel
```

```
Plugin registers panel
      |
      v
PanelRegistry.register({ id: 'my-panel', ... })
      |
      v
LayoutStore.addPanel('sidebar', 'my-panel')  // 或用户选择位置
      |
      v
PanelGroupView re-renders → new tab appears
```

## 9. ReactLynx 适配注意事项

| 问题 | 方案 |
|------|------|
| Lynx 无 `mousemove`，只有 touch 事件 | Sash 用 `bindtouchmove`，换算 `touches[0].pageX/Y` |
| Lynx flexbox 不支持 `calc()` | SplitContainer 用绝对像素计算子尺寸，通过 `style={{ width, height }}` 传递 |
| Scintilla 是原生 NSView，不受 flex 影响 | EditorPanel 需要在 `onLayout` / 尺寸变化时调用 `scintillaApi.resize(id, w, h)` |
| `scroll-view` 可能吞掉 touch 事件 | Sash 的 z-index 要高于内容区，或用 `catch:touchmove` 阻止冒泡 |
| 拖拽面板需要 overlay | 拖拽时渲染半透明 ghost view（absolute 定位，跟随手指） |
