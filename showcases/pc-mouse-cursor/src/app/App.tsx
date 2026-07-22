import lynxLogo from './assets/lynx-logo.png';
import desktopFrame from './assets/desktop-frame.png';
import { useDesktopDrag } from './useDesktopDrag';
import '@lynxtron-examples/config/tokens.css';
import './App.css';

export function App() {
  const {
    desktopHot,
    docked,
    dragging,
    logoPos,
    cancelDrag,
    finishDrag,
    handleDesktopLayout,
    handleLogoDown,
    handleMove,
    handleStageLayout,
  } = useDesktopDrag();
  const desktopFrameClassName = `DesktopFrame ${desktopHot ? 'DesktopFrame--hot' : ''} ${docked ? 'DesktopFrame--occupied' : ''}`;
  const logoCardClassName = `LogoCard ${dragging ? 'LogoCard--dragging' : ''} ${docked ? 'LogoCard--docked' : ''}`;
  const logoCardStyle = {
    left: `${logoPos.x}px`,
    top: `${logoPos.y}px`,
    cursor: dragging ? 'grabbing' : 'grab',
  };
  const pointerState = dragging ? 'dragging' : docked ? 'docked' : 'idle';
  const targetState = desktopHot ? 'hot' : docked ? 'occupied' : 'armed';

  return (
    <page
      className="Page"
      bindmousemove={handleMove}
      bindtouchmove={handleMove}
      bindmouseup={finishDrag}
      bindtouchend={finishDrag}
      bindtouchcancel={cancelDrag}
      bindmouseleave={cancelDrag}
    >
      <view className="Shell">
        <view className="Header">
          <text className="Title">Bringing Lynx to desktop</text>
          <text className="Caption">Drag the chip to the dock target.</text>
        </view>

        <view className="Stage" bindlayoutchange={handleStageLayout}>
          <text className="TargetTag">Dock target</text>

          <view className="HomeSlot" />
          <text className="HomeTag">Home</text>

          <view className={desktopFrameClassName} bindlayoutchange={handleDesktopLayout}>
            <image src={desktopFrame} className="DesktopFrameImage" />
          </view>

          <view className={logoCardClassName} style={logoCardStyle} bindmousedown={handleLogoDown} bindtouchstart={handleLogoDown}>
            <image src={lynxLogo} className="LogoImage" />
          </view>
        </view>

        <view className="Readout">
          <view className="ReadoutItem">
            <text className="ReadoutKey">x</text>
            <text className={`ReadoutValue ${dragging ? 'ReadoutValue--live' : ''}`}>{Math.round(logoPos.x)}</text>
          </view>
          <view className="ReadoutItem">
            <text className="ReadoutKey">y</text>
            <text className={`ReadoutValue ${dragging ? 'ReadoutValue--live' : ''}`}>{Math.round(logoPos.y)}</text>
          </view>
          <view className="ReadoutItem">
            <text className="ReadoutKey">state</text>
            <text className={`ReadoutValue ${dragging ? 'ReadoutValue--live' : ''} ${docked ? 'ReadoutValue--ok' : ''}`}>{pointerState}</text>
          </view>
          <view className="ReadoutItem">
            <text className="ReadoutKey">target</text>
            <text className={`ReadoutValue ${desktopHot ? 'ReadoutValue--live' : ''} ${docked ? 'ReadoutValue--ok' : ''}`}>{targetState}</text>
          </view>
        </view>
      </view>
    </page>
  );
}
